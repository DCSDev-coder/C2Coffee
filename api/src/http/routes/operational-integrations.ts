import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest } from '../../admin/guard.js';
import { ApiError } from '../errors.js';
import { mysqlPool } from '../../db/mysql.js';
import { isAllowedDirectPrinterDestination } from '../../lib/printer-network.js';
import {
  defaultCapabilities,
  integrationCapabilities,
  integrationProviders,
  parseCapabilities,
  printerDeliveryModes
} from '../../services/operational-integrations.js';
import { isCurrentAttendance, MAX_ACTIVE_SHIFT_MINUTES, summarizeMonthlyAttendance } from '../../services/attendance-duration.js';

const integrationStatus = z.enum(['not_configured', 'pending', 'connected', 'disabled']);
const printerConfigurationStatus = z.enum(['not_configured', 'pending', 'disabled']);
const providerCode = z.enum(integrationProviders);
const capability = z.enum(integrationCapabilities);
const nullableStoreId = z.coerce.number().int().positive().nullable().optional().default(null);

const integrationSchema = z.object({
  store_id: nullableStoreId,
  provider_code: providerCode,
  display_name: z.string().trim().min(1).max(120),
  status: integrationStatus.optional().default('not_configured'),
  capabilities: z.array(capability).optional(),
  connection_reference: z.string().trim().max(255).nullable().optional().default(null)
});

const printerSchema = z.object({
  store_id: nullableStoreId,
  integration_id: z.coerce.number().int().positive().nullable().optional().default(null),
  name: z.string().trim().min(1).max(120),
  delivery_mode: z.enum(printerDeliveryModes),
  printer_reference: z.string().trim().min(1).max(255),
  network_host: z.string().trim().max(255).nullable().optional().default(null),
  network_port: z.coerce.number().int().min(1).max(65535).nullable().optional().default(null),
  direct_print_device_key: z.string().trim().toUpperCase().max(32).nullable().optional().default(null),
  // A connector, not a form submission, is responsible for declaring a printer connected.
  status: printerConfigurationStatus.optional().default('pending'),
  is_default: z.boolean().optional().default(false)
}).superRefine((value, context) => {
  if (value.delivery_mode !== 'android_direct') return;
  if (!value.network_host) context.addIssue({ code: z.ZodIssueCode.custom, path: ['network_host'], message: 'Enter the printer IP address.' });
  if (value.network_port === null) context.addIssue({ code: z.ZodIssueCode.custom, path: ['network_port'], message: 'Enter the printer port.' });
  if (!value.direct_print_device_key) context.addIssue({ code: z.ZodIssueCode.custom, path: ['direct_print_device_key'], message: 'Enter the assigned tablet code.' });
  if (value.network_host && value.network_port !== null &&
      !isAllowedDirectPrinterDestination(value.network_host, value.network_port)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['network_host'],
      message: 'Use a private outlet Wi-Fi printer IPv4 address and raw print port 9100.'
    });
  }
});

const weeklyScheduleSchema = z.object({
  entries: z.array(z.object({
    barista_id: z.coerce.number().int().positive(),
    weekday: z.coerce.number().int().min(1).max(7),
    starts_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM time.'),
    ends_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM time.')
  }).refine((entry) => entry.ends_at !== entry.starts_at, {
    message: 'Start and end time cannot be the same.',
    path: ['ends_at']
  })).max(200)
});
const datedScheduleSchema = z.object({
  expected_revision: z.coerce.number().int().min(0),
  entries: z.array(z.object({
    barista_id: z.coerce.number().int().positive(),
    shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid shift date.'),
    starts_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM time.'),
    ends_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM time.')
  }).refine((entry) => entry.ends_at !== entry.starts_at, {
    message: 'Start and end time cannot be the same.',
    path: ['ends_at']
  })).max(400)
});
const attendanceQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  barista_id: z.coerce.number().int().positive().optional()
});
const workstationKeyPattern = /^C2-[A-Z0-9]{12}$/;
const baristaSoundStyle = z.enum(['short', 'long', 'two_tone']);
const baristaSoundSettingsSchema = z.object({
  volume_percent: z.coerce.number().int().min(0).max(100),
  incoming_order_enabled: z.coerce.boolean().default(true),
  clock_in_beeps: z.coerce.number().int().min(1).max(5),
  clock_in_style: baristaSoundStyle.optional().default('short'),
  clock_out_beeps: z.coerce.number().int().min(1).max(5),
  clock_out_style: baristaSoundStyle.optional().default('long'),
  side_work_beeps: z.coerce.number().int().min(1).max(5),
  side_work_style: baristaSoundStyle.optional().default('two_tone'),
  incoming_order_beeps: z.coerce.number().int().min(1).max(5),
  incoming_order_style: baristaSoundStyle.optional().default('two_tone'),
  cancellation_alert_enabled: z.coerce.boolean().default(true),
  cancellation_alert_beeps: z.coerce.number().int().min(1).max(5),
  cancellation_alert_style: baristaSoundStyle.optional().default('two_tone'),
  waiting_alert_enabled: z.coerce.boolean().default(true),
  waiting_alert_after_minutes: z.coerce.number().int().min(1).max(120),
  waiting_alert_repeat_minutes: z.coerce.number().int().min(1).max(120),
  waiting_alert_beeps: z.coerce.number().int().min(1).max(5),
  waiting_alert_style: baristaSoundStyle.optional().default('short'),
  preparing_alert_enabled: z.coerce.boolean().default(true),
  preparing_alert_after_minutes: z.coerce.number().int().min(1).max(240),
  preparing_alert_repeat_minutes: z.coerce.number().int().min(1).max(120),
  preparing_alert_beeps: z.coerce.number().int().min(1).max(5),
  preparing_alert_style: baristaSoundStyle.optional().default('short')
}).refine((value) => new Set([
  value.incoming_order_beeps,
  value.clock_in_beeps,
  value.clock_out_beeps,
  value.side_work_beeps,
  value.cancellation_alert_beeps
]).size === 5, {
  message: 'Use a different beep count for incoming orders, clock-in, clock-out, side work, and cancellation alerts.'
});

function workstationKey(request: { headers: Record<string, string | string[] | undefined> }): string {
  const value = request.headers['x-c2-workstation-key'];
  const key = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!workstationKeyPattern.test(key)) throw new ApiError(400, 'invalid_workstation_key', 'This tablet needs a valid workstation code.');
  return key;
}

function malaysiaDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function malaysiaTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}

function weekdayForDate(date: string): number {
  const day = new Date(`${date}T12:00:00+08:00`).getUTCDay();
  return day === 0 ? 7 : day;
}

function previousMalaysiaDate(date: string): string {
  return malaysiaDate(new Date(new Date(`${date}T12:00:00+08:00`).getTime() - 86400000));
}

function isOvernightShift(startsAt: string, endsAt: string): boolean {
  return endsAt.slice(0, 5) < startsAt.slice(0, 5);
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = new Date(`${from}T12:00:00+08:00`); date <= new Date(`${to}T12:00:00+08:00`); date.setUTCDate(date.getUTCDate() + 1)) dates.push(malaysiaDate(date));
  return dates;
}

function planningWindow(): { from: string; to: string } {
  const from = malaysiaDate(new Date());
  const to = malaysiaDate(new Date(new Date(`${from}T12:00:00+08:00`).getTime() + 30 * 86400000));
  return { from, to };
}

function canOperate(request: { adminAuth?: { roles?: string[] } }): void {
  const roles = request.adminAuth?.roles ?? [];
  if (!roles.some((role) => ['super_admin', 'operations_admin', 'barista'].includes(role))) {
    throw new ApiError(403, 'forbidden', 'You do not have access to operational integrations.');
  }
}

function canConfigure(request: { adminAuth?: { roles?: string[] } }): void {
  const roles = request.adminAuth?.roles ?? [];
  if (!roles.some((role) => ['super_admin', 'operations_admin'].includes(role))) {
    throw new ApiError(403, 'forbidden', 'Only operations administrators can configure integrations.');
  }
}

async function assertStoreInTenant(storeId: number | null, tenantCode: string): Promise<void> {
  if (storeId === null) return;
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT s.id
     FROM stores s
     JOIN admin_tenants t ON t.id = s.tenant_id
     WHERE s.id = :storeId AND t.code = :tenantCode
     LIMIT 1`,
    { storeId, tenantCode }
  );
  if (!rows[0]) throw new ApiError(404, 'store_not_found', 'Store not found for this tenant.');
}

async function resolvePrinterStoreId(storeId: number | null, tenantCode: string): Promise<number> {
  if (storeId !== null) {
    await assertStoreInTenant(storeId, tenantCode);
    return storeId;
  }

  // Customer checkout currently routes to one customer-facing outlet. Bind a
  // printer to that same outlet instead of silently creating an unrouteable
  // tenant-wide printer record.
  const [stores] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT s.id
     FROM stores s
     JOIN admin_tenants t ON t.id = s.tenant_id
     WHERE t.code = :tenantCode AND s.status = 'active' AND s.is_customer_facing = 1
     ORDER BY s.id ASC
     LIMIT 2`,
    { tenantCode }
  );
  if (stores.length !== 1) {
    throw new ApiError(409, 'printer_outlet_not_configured', 'Configure exactly one customer-facing outlet before setting up a receipt printer.');
  }
  return Number(stores[0].id);
}

function integrationResponse(row: RowDataPacket) {
  return {
    ...row,
    capabilities: parseCapabilities(
      typeof row.capabilities_json === 'string' ? JSON.parse(row.capabilities_json) : row.capabilities_json
    )
  };
}

export async function registerOperationalIntegrationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/barista-sound-settings', { preHandler: authenticateAdminRequest }, async (request) => {
    canConfigure(request);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT s.id AS store_id, s.name AS store_name,
              COALESCE(bs.volume_percent, 70) AS volume_percent,
              COALESCE(bs.incoming_order_enabled, 1) AS incoming_order_enabled,
              COALESCE(bs.clock_in_beeps, 1) AS clock_in_beeps,
              COALESCE(bs.clock_in_style, 'short') AS clock_in_style,
              COALESCE(bs.clock_out_beeps, 2) AS clock_out_beeps,
              COALESCE(bs.clock_out_style, 'long') AS clock_out_style,
              COALESCE(bs.side_work_beeps, 3) AS side_work_beeps,
              COALESCE(bs.side_work_style, 'two_tone') AS side_work_style,
              COALESCE(bs.incoming_order_beeps, 4) AS incoming_order_beeps,
              COALESCE(bs.incoming_order_style, 'two_tone') AS incoming_order_style
              ,COALESCE(bs.cancellation_alert_enabled, 1) AS cancellation_alert_enabled
              ,COALESCE(bs.cancellation_alert_beeps, 5) AS cancellation_alert_beeps
              ,COALESCE(bs.cancellation_alert_style, 'two_tone') AS cancellation_alert_style
              ,COALESCE(bs.waiting_alert_enabled, 1) AS waiting_alert_enabled
              ,COALESCE(bs.waiting_alert_after_minutes, 5) AS waiting_alert_after_minutes
              ,COALESCE(bs.waiting_alert_repeat_minutes, 10) AS waiting_alert_repeat_minutes
              ,COALESCE(bs.waiting_alert_beeps, 2) AS waiting_alert_beeps
              ,COALESCE(bs.waiting_alert_style, 'short') AS waiting_alert_style
              ,COALESCE(bs.preparing_alert_enabled, 1) AS preparing_alert_enabled
              ,COALESCE(bs.preparing_alert_after_minutes, 10) AS preparing_alert_after_minutes
              ,COALESCE(bs.preparing_alert_repeat_minutes, 10) AS preparing_alert_repeat_minutes
              ,COALESCE(bs.preparing_alert_beeps, 1) AS preparing_alert_beeps
              ,COALESCE(bs.preparing_alert_style, 'short') AS preparing_alert_style
       FROM stores s
       LEFT JOIN barista_sound_settings bs
         ON bs.tenant_id = s.tenant_id AND bs.store_id = s.id
       WHERE s.tenant_id = :tenantId AND s.status = 'active'
       ORDER BY s.is_customer_facing DESC, s.name ASC`,
      { tenantId: request.adminAuth.tenantId }
    );
    return {
      outlets: rows.map((row) => ({
        store_id: Number(row.store_id),
        store_name: row.store_name,
        volume_percent: Number(row.volume_percent),
        incoming_order_enabled: Number(row.incoming_order_enabled),
        clock_in_beeps: Number(row.clock_in_beeps),
        clock_in_style: row.clock_in_style,
        clock_out_beeps: Number(row.clock_out_beeps),
        clock_out_style: row.clock_out_style,
        side_work_beeps: Number(row.side_work_beeps),
        side_work_style: row.side_work_style,
        incoming_order_beeps: Number(row.incoming_order_beeps),
        incoming_order_style: row.incoming_order_style
        ,cancellation_alert_enabled: Number(row.cancellation_alert_enabled)
        ,cancellation_alert_beeps: Number(row.cancellation_alert_beeps)
        ,cancellation_alert_style: row.cancellation_alert_style
        ,waiting_alert_enabled: Number(row.waiting_alert_enabled)
        ,waiting_alert_after_minutes: Number(row.waiting_alert_after_minutes)
        ,waiting_alert_repeat_minutes: Number(row.waiting_alert_repeat_minutes)
        ,waiting_alert_beeps: Number(row.waiting_alert_beeps)
        ,waiting_alert_style: row.waiting_alert_style
        ,preparing_alert_enabled: Number(row.preparing_alert_enabled)
        ,preparing_alert_after_minutes: Number(row.preparing_alert_after_minutes)
        ,preparing_alert_repeat_minutes: Number(row.preparing_alert_repeat_minutes)
        ,preparing_alert_beeps: Number(row.preparing_alert_beeps)
        ,preparing_alert_style: row.preparing_alert_style
      }))
    };
  });

  app.put('/v1/admin/barista-sound-settings/:storeId', { preHandler: authenticateAdminRequest }, async (request) => {
    canConfigure(request);
    const storeId = z.coerce.number().int().positive().parse((request.params as { storeId: string }).storeId);
    const body = baristaSoundSettingsSchema.parse(request.body);
    await assertStoreInTenant(storeId, request.adminAuth.tenantCode);
    await mysqlPool.execute(
      `INSERT INTO barista_sound_settings (
         tenant_id, store_id, volume_percent, incoming_order_enabled,
         clock_in_beeps, clock_in_style, clock_out_beeps, clock_out_style,
         side_work_beeps, side_work_style, incoming_order_beeps, incoming_order_style,
         cancellation_alert_enabled, cancellation_alert_beeps, cancellation_alert_style,
         waiting_alert_enabled, waiting_alert_after_minutes, waiting_alert_repeat_minutes,
         waiting_alert_beeps, waiting_alert_style,
         preparing_alert_enabled, preparing_alert_after_minutes, preparing_alert_repeat_minutes,
         preparing_alert_beeps, preparing_alert_style,
         updated_by_admin_user_id
       ) VALUES (
         :tenantId, :storeId, :volumePercent, :incomingOrderEnabled,
         :clockInBeeps, :clockInStyle, :clockOutBeeps, :clockOutStyle,
         :sideWorkBeeps, :sideWorkStyle, :incomingOrderBeeps, :incomingOrderStyle,
         :cancellationAlertEnabled, :cancellationAlertBeeps, :cancellationAlertStyle,
         :waitingAlertEnabled, :waitingAlertAfterMinutes, :waitingAlertRepeatMinutes,
         :waitingAlertBeeps, :waitingAlertStyle,
         :preparingAlertEnabled, :preparingAlertAfterMinutes, :preparingAlertRepeatMinutes,
         :preparingAlertBeeps, :preparingAlertStyle,
         :adminUserId
       )
       ON DUPLICATE KEY UPDATE
         volume_percent = VALUES(volume_percent),
         incoming_order_enabled = VALUES(incoming_order_enabled),
         clock_in_beeps = VALUES(clock_in_beeps),
         clock_in_style = VALUES(clock_in_style),
         clock_out_beeps = VALUES(clock_out_beeps),
         clock_out_style = VALUES(clock_out_style),
         side_work_beeps = VALUES(side_work_beeps),
         side_work_style = VALUES(side_work_style),
         incoming_order_beeps = VALUES(incoming_order_beeps),
         incoming_order_style = VALUES(incoming_order_style),
         cancellation_alert_enabled = VALUES(cancellation_alert_enabled),
         cancellation_alert_beeps = VALUES(cancellation_alert_beeps),
         cancellation_alert_style = VALUES(cancellation_alert_style),
         waiting_alert_enabled = VALUES(waiting_alert_enabled),
         waiting_alert_after_minutes = VALUES(waiting_alert_after_minutes),
         waiting_alert_repeat_minutes = VALUES(waiting_alert_repeat_minutes),
         waiting_alert_beeps = VALUES(waiting_alert_beeps),
         waiting_alert_style = VALUES(waiting_alert_style),
         preparing_alert_enabled = VALUES(preparing_alert_enabled),
         preparing_alert_after_minutes = VALUES(preparing_alert_after_minutes),
         preparing_alert_repeat_minutes = VALUES(preparing_alert_repeat_minutes),
         preparing_alert_beeps = VALUES(preparing_alert_beeps),
         preparing_alert_style = VALUES(preparing_alert_style),
         updated_by_admin_user_id = VALUES(updated_by_admin_user_id)`,
      {
        tenantId: request.adminAuth.tenantId,
        storeId,
        volumePercent: body.volume_percent,
        incomingOrderEnabled: body.incoming_order_enabled ? 1 : 0,
        clockInBeeps: body.clock_in_beeps,
        clockInStyle: body.clock_in_style,
        clockOutBeeps: body.clock_out_beeps,
        clockOutStyle: body.clock_out_style,
        sideWorkBeeps: body.side_work_beeps,
        sideWorkStyle: body.side_work_style,
        incomingOrderBeeps: body.incoming_order_beeps,
        incomingOrderStyle: body.incoming_order_style,
        cancellationAlertEnabled: body.cancellation_alert_enabled ? 1 : 0,
        cancellationAlertBeeps: body.cancellation_alert_beeps,
        cancellationAlertStyle: body.cancellation_alert_style,
        waitingAlertEnabled: body.waiting_alert_enabled ? 1 : 0,
        waitingAlertAfterMinutes: body.waiting_alert_after_minutes,
        waitingAlertRepeatMinutes: body.waiting_alert_repeat_minutes,
        waitingAlertBeeps: body.waiting_alert_beeps,
        waitingAlertStyle: body.waiting_alert_style,
        preparingAlertEnabled: body.preparing_alert_enabled ? 1 : 0,
        preparingAlertAfterMinutes: body.preparing_alert_after_minutes,
        preparingAlertRepeatMinutes: body.preparing_alert_repeat_minutes,
        preparingAlertBeeps: body.preparing_alert_beeps,
        preparingAlertStyle: body.preparing_alert_style,
        adminUserId: request.adminAuth.adminUserId
      }
    );
    return { saved: true, store_id: storeId, ...body };
  });

  app.get('/v1/admin/operations/attendance', { preHandler: authenticateAdminRequest }, async (request) => {
    canConfigure(request);
    const query = attendanceQuerySchema.parse(request.query);
    const today = malaysiaDate(new Date());
    const to = query.to ?? today;
    const from = query.from ?? malaysiaDate(new Date(new Date(`${to}T12:00:00+08:00`).getTime() - 29 * 86400000));
    if (from > to || datesBetween(from, to).length > 93) throw new ApiError(400, 'invalid_date_range', 'Choose a date range of up to 93 days.');
    const currentMonthStart = `${today.slice(0, 7)}-01`;
    const previousMonthStart = malaysiaDate(new Date(new Date(`${currentMonthStart}T12:00:00+08:00`).getTime() - 86400000)).slice(0, 7) + '-01';
    const nextMonthStart = malaysiaDate(new Date(new Date(`${currentMonthStart}T12:00:00+08:00`).getTime() + 32 * 86400000)).slice(0, 7) + '-01';
    const [attendanceResult, monthlyResult] = await Promise.all([
      mysqlPool.query<RowDataPacket[]>(
        `SELECT a.id, a.barista_id, b.name AS barista_name, a.clocked_in_at, a.clocked_out_at
         FROM barista_attendance a JOIN baristas b ON b.id = a.barista_id
         WHERE a.tenant_id = :tenantId AND a.barista_id IS NOT NULL
           AND a.clocked_in_at >= CONVERT_TZ(CONCAT(:from, ' 00:00:00'), '+08:00', '+00:00')
           AND a.clocked_in_at < CONVERT_TZ(CONCAT(DATE_ADD(:to, INTERVAL 1 DAY), ' 00:00:00'), '+08:00', '+00:00')
           AND (:baristaId IS NULL OR a.barista_id = :baristaId)
         ORDER BY a.clocked_in_at DESC`,
        { tenantId: request.adminAuth.tenantId, from, to, baristaId: query.barista_id ?? null }
      ),
      mysqlPool.query<RowDataPacket[]>(
        `SELECT a.barista_id, b.name AS barista_name, a.clocked_in_at, a.clocked_out_at
         FROM barista_attendance a JOIN baristas b ON b.id = a.barista_id
         WHERE a.tenant_id = :tenantId AND a.barista_id IS NOT NULL
           AND a.clocked_in_at < CONVERT_TZ(CONCAT(:monthEnd, ' 00:00:00'), '+08:00', '+00:00')
           AND (a.clocked_out_at IS NULL OR a.clocked_out_at > CONVERT_TZ(CONCAT(:monthStart, ' 00:00:00'), '+08:00', '+00:00'))
           AND (:baristaId IS NULL OR a.barista_id = :baristaId)
         ORDER BY b.name ASC, a.clocked_in_at ASC`,
        { tenantId: request.adminAuth.tenantId, monthStart: previousMonthStart, monthEnd: nextMonthStart, baristaId: query.barista_id ?? null }
      )
    ]);
    const records: Array<Record<string, unknown>> = attendanceResult[0].map((row) => {
      const clockInDate = malaysiaDate(new Date(row.clocked_in_at));
      const durationMinutes = row.clocked_out_at
        ? Math.round((new Date(row.clocked_out_at).getTime() - new Date(row.clocked_in_at).getTime()) / 60000)
        : null;
      const currentAttendance = !row.clocked_out_at && isCurrentAttendance(row.clocked_in_at);
      const needsReview = durationMinutes !== null && durationMinutes > MAX_ACTIVE_SHIFT_MINUTES;
      return {
        id: Number(row.id), barista_id: Number(row.barista_id), barista_name: row.barista_name, date: clockInDate,
        planned_start: null, planned_end: null, planned_ends_next_day: false,
        clocked_in_at: row.clocked_in_at, clocked_out_at: row.clocked_out_at,
        late_minutes: 0, duration_minutes: durationMinutes,
        status: needsReview ? 'needs_review' : row.clocked_out_at ? 'completed' : currentAttendance ? 'clocked_in' : 'missing_clock_out'
      };
    });
    const monthlyHours = summarizeMonthlyAttendance(monthlyResult[0].map((row) => ({
      barista_id: row.barista_id,
      barista_name: String(row.barista_name),
      clocked_in_at: row.clocked_in_at,
      clocked_out_at: row.clocked_out_at
    })), { monthKeys: [previousMonthStart.slice(0, 7), currentMonthStart.slice(0, 7)] });
    return { from, to, attendance: records, monthly_hours: monthlyHours, summary: {
      active_now: records.filter((record) => record.status === 'clocked_in' || record.status === 'clocked_in_late').length,
      late_arrivals: 0,
      missing_clock_out: records.filter((record) => record.status === 'missing_clock_out' || record.status === 'needs_review').length,
      missed_clock_in: 0
    } };
  });

  app.get('/v1/admin/operational-integrations', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const { from, to } = planningWindow();
    const [integrations, printers, schedules, datedShifts, revisionRows] = await Promise.all([
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT id, store_id, provider_code, display_name, status, capabilities_json,
                connection_reference, last_checked_at, last_error_code, created_at, updated_at
         FROM outlet_integrations
         WHERE tenant_code = :tenantCode
         ORDER BY display_name ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT id, store_id, integration_id, name, delivery_mode, printer_reference, network_host, network_port, direct_print_device_key, status,
                is_default, last_checked_at, last_error_code, created_at, updated_at
         FROM printer_targets
         WHERE tenant_code = :tenantCode
         ORDER BY is_default DESC, name ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT s.id, s.barista_id, b.name AS barista_name, s.weekday, s.starts_at, s.ends_at, s.is_active
         FROM barista_weekly_schedules s
         JOIN baristas b ON b.id = s.barista_id
         WHERE s.tenant_code = :tenantCode AND s.is_active = 1 AND b.is_active = 1
         ORDER BY s.weekday ASC, s.starts_at ASC, b.name ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT s.id, s.barista_id, b.name AS barista_name, DATE_FORMAT(s.shift_date, '%Y-%m-%d') AS shift_date, s.starts_at, s.ends_at
         FROM barista_dated_shifts s
         JOIN baristas b ON b.id = s.barista_id
         WHERE s.tenant_code = :tenantCode AND b.is_active = 1
           AND s.shift_date BETWEEN :from AND :to
         ORDER BY s.shift_date ASC, s.starts_at ASC, b.name ASC`,
        { tenantCode: request.adminAuth.tenantCode, from, to }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT revision FROM barista_schedule_revisions WHERE tenant_code = :tenantCode`,
        { tenantCode: request.adminAuth.tenantCode }
      )
    ]);

    return reply.send({
      integrations: integrations[0].map(integrationResponse),
      printers: printers[0].map((row) => ({ ...row, is_default: !!row.is_default })),
      weekly_schedule: schedules[0].map((row) => ({ ...row, is_active: !!row.is_active })),
      scheduled_shifts: datedShifts[0],
      schedule_revision: Number(revisionRows[0][0]?.revision ?? 0)
    });
  });

  app.put('/v1/admin/shift-schedule', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const body = datedScheduleSchema.parse(request.body);
    const { from, to } = planningWindow();
    const connection = await mysqlPool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT IGNORE INTO barista_schedule_revisions (tenant_code, revision)
         VALUES (:tenantCode, 0)`,
        { tenantCode: request.adminAuth.tenantCode }
      );
      const [revisionRows] = await connection.execute<RowDataPacket[]>(
        `SELECT revision FROM barista_schedule_revisions
         WHERE tenant_code = :tenantCode FOR UPDATE`,
        { tenantCode: request.adminAuth.tenantCode }
      );
      const currentRevision = Number(revisionRows[0]?.revision ?? 0);
      if (currentRevision !== body.expected_revision) {
        throw new ApiError(409, 'schedule_changed', 'The timetable changed after you opened it. Refresh and review the latest shifts before publishing.');
      }
      const [baristas] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM baristas WHERE tenant_code = :tenantCode AND is_active = 1',
        { tenantCode: request.adminAuth.tenantCode }
      );
      const activeBaristaIds = new Set(baristas.map((barista) => Number(barista.id)));
      const duplicateKeys = new Set<string>();

      for (const entry of body.entries) {
        if (entry.shift_date < from || entry.shift_date > to) {
          throw new ApiError(400, 'shift_date_out_of_range', 'Shifts can be published from today through the next 30 days.');
        }
        if (!activeBaristaIds.has(entry.barista_id)) {
          throw new ApiError(400, 'barista_unavailable', 'Every scheduled barista must be active for this tenant.');
        }
        const key = `${entry.barista_id}:${entry.shift_date}:${entry.starts_at}`;
        if (duplicateKeys.has(key)) {
          throw new ApiError(400, 'duplicate_shift', 'A barista cannot have duplicate shifts with the same start time.');
        }
        duplicateKeys.add(key);
      }

      await connection.execute(
        `DELETE FROM barista_dated_shifts
         WHERE tenant_code = :tenantCode AND shift_date BETWEEN :from AND :to`,
        { tenantCode: request.adminAuth.tenantCode, from, to }
      );
      await connection.execute(
        `DELETE FROM barista_schedule_publications
         WHERE tenant_code = :tenantCode AND store_id IS NULL AND schedule_date BETWEEN :from AND :to`,
        { tenantCode: request.adminAuth.tenantCode, from, to }
      );
      for (const scheduleDate of datesBetween(from, to)) {
        await connection.execute(
          `INSERT INTO barista_schedule_publications (
             tenant_code, store_id, schedule_date, published_by_admin_user_id, published_at
           ) VALUES (:tenantCode, NULL, :scheduleDate, :adminUserId, UTC_TIMESTAMP())`,
          {
            tenantCode: request.adminAuth.tenantCode,
            scheduleDate,
            adminUserId: request.adminAuth.adminUserId
          }
        );
      }
      for (const entry of body.entries) {
        await connection.execute(
          `INSERT INTO barista_dated_shifts (
            tenant_code, barista_id, shift_date, starts_at, ends_at, created_by_admin_user_id
          ) VALUES (
            :tenantCode, :baristaId, :shiftDate, :startsAt, :endsAt, :adminUserId
          )`,
          {
            tenantCode: request.adminAuth.tenantCode,
            baristaId: entry.barista_id,
            shiftDate: entry.shift_date,
            startsAt: entry.starts_at,
            endsAt: entry.ends_at,
            adminUserId: request.adminAuth.adminUserId
          }
        );
      }
      const nextRevision = currentRevision + 1;
      await connection.execute(
        `UPDATE barista_schedule_revisions
         SET revision = :nextRevision, updated_by_admin_user_id = :adminUserId, updated_at = UTC_TIMESTAMP()
         WHERE tenant_code = :tenantCode`,
        {
          nextRevision,
          adminUserId: request.adminAuth.adminUserId,
          tenantCode: request.adminAuth.tenantCode
        }
      );
      await connection.commit();
      return reply.send({ saved: body.entries.length, from, to, schedule_revision: nextRevision });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.put('/v1/admin/weekly-schedule', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const body = weeklyScheduleSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();

    try {
      await connection.beginTransaction();
      const [baristas] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM baristas WHERE tenant_code = :tenantCode AND is_active = 1',
        { tenantCode: request.adminAuth.tenantCode }
      );
      const activeBaristaIds = new Set(baristas.map((barista) => Number(barista.id)));
      const invalidEntry = body.entries.find((entry) => !activeBaristaIds.has(entry.barista_id));
      if (invalidEntry) {
        throw new ApiError(400, 'barista_unavailable', 'Every scheduled barista must be active for this tenant.');
      }

      const shiftKeys = new Set<string>();
      for (const entry of body.entries) {
        const shiftKey = `${entry.barista_id}:${entry.weekday}:${entry.starts_at}`;
        if (shiftKeys.has(shiftKey)) {
          throw new ApiError(400, 'duplicate_shift', 'A barista cannot have duplicate shifts with the same start time.');
        }
        shiftKeys.add(shiftKey);
      }

      await connection.execute(
        'DELETE FROM barista_weekly_schedules WHERE tenant_code = :tenantCode',
        { tenantCode: request.adminAuth.tenantCode }
      );
      for (const entry of body.entries) {
        await connection.execute(
          `INSERT INTO barista_weekly_schedules (
            tenant_code, barista_id, weekday, starts_at, ends_at, is_active
          ) VALUES (
            :tenantCode, :baristaId, :weekday, :startsAt, :endsAt, 1
          )`,
          {
            tenantCode: request.adminAuth.tenantCode,
            baristaId: entry.barista_id,
            weekday: entry.weekday,
            startsAt: entry.starts_at,
            endsAt: entry.ends_at
          }
        );
      }
      await connection.commit();
      return reply.send({ saved: body.entries.length });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/operational-integrations', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const body = integrationSchema.parse(request.body);
    await assertStoreInTenant(body.store_id, request.adminAuth.tenantCode);
    const capabilities = body.capabilities ?? defaultCapabilities[body.provider_code];

    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO outlet_integrations (
        tenant_code, store_id, provider_code, display_name, status, capabilities_json, connection_reference
      ) VALUES (
        :tenantCode, :storeId, :providerCode, :displayName, :status, :capabilities, :connectionReference
      )`,
      {
        tenantCode: request.adminAuth.tenantCode,
        storeId: body.store_id,
        providerCode: body.provider_code,
        displayName: body.display_name,
        status: body.status,
        capabilities: JSON.stringify(capabilities),
        connectionReference: body.connection_reference
      }
    );

    return reply.code(201).send({ id: result.insertId });
  });

  app.post('/v1/admin/printer-targets', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const body = printerSchema.parse(request.body);
    const printerStoreId = body.delivery_mode === 'android_direct'
      ? await resolvePrinterStoreId(body.store_id, request.adminAuth.tenantCode)
      : body.store_id;
    if (body.delivery_mode !== 'android_direct') {
      await assertStoreInTenant(printerStoreId, request.adminAuth.tenantCode);
    }

    if (body.integration_id !== null) {
      const [integrations] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT id FROM outlet_integrations WHERE id = :integrationId AND tenant_code = :tenantCode LIMIT 1`,
        { integrationId: body.integration_id, tenantCode: request.adminAuth.tenantCode }
      );
      if (!integrations[0]) throw new ApiError(404, 'integration_not_found', 'Integration not found for this tenant.');
    }

    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      if (body.is_default) {
        await connection.execute(
          'UPDATE printer_targets SET is_default = 0 WHERE tenant_code = :tenantCode AND store_id <=> :storeId',
          { tenantCode: request.adminAuth.tenantCode, storeId: printerStoreId }
        );
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO printer_targets (
          tenant_code, store_id, integration_id, name, delivery_mode, printer_reference, network_host, network_port, direct_print_device_key, status, is_default
        ) VALUES (
          :tenantCode, :storeId, :integrationId, :name, :deliveryMode, :printerReference, :networkHost, :networkPort, :directPrintDeviceKey, :status, :isDefault
        )`,
        {
          tenantCode: request.adminAuth.tenantCode,
          storeId: printerStoreId,
          integrationId: body.integration_id,
          name: body.name,
          deliveryMode: body.delivery_mode,
          printerReference: body.printer_reference,
          networkHost: body.delivery_mode === 'android_direct' ? body.network_host : null,
          networkPort: body.delivery_mode === 'android_direct' ? body.network_port : null,
          directPrintDeviceKey: body.delivery_mode === 'android_direct' ? body.direct_print_device_key : null,
          status: body.status,
          isDefault: body.is_default
        }
      );
      await connection.commit();
      return reply.code(201).send({ id: result.insertId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.delete('/v1/admin/printer-targets/:printerTargetId', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const { printerTargetId } = z.object({ printerTargetId: z.coerce.number().int().positive() }).parse(request.params);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [printers] = await connection.execute<RowDataPacket[]>(
        `SELECT id, name FROM printer_targets
         WHERE id = :printerTargetId AND tenant_code = :tenantCode
         LIMIT 1 FOR UPDATE`,
        { printerTargetId, tenantCode: request.adminAuth.tenantCode }
      );
      const printer = printers[0];
      if (!printer) throw new ApiError(404, 'printer_not_found', 'The printer route was not found.');

      const [jobs] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM print_jobs WHERE printer_target_id = :printerTargetId',
        { printerTargetId }
      );
      if (Number(jobs[0]?.total ?? 0) > 0) {
        throw new ApiError(409, 'printer_has_print_history', 'This printer has receipt history and cannot be removed. Disable it instead.');
      }

      await connection.execute(
        'DELETE FROM printer_targets WHERE id = :printerTargetId AND tenant_code = :tenantCode',
        { printerTargetId, tenantCode: request.adminAuth.tenantCode }
      );
      await connection.commit();
      return reply.code(204).send();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  // The browser console needs the published roster, but it must not depend on a
  // tablet workstation key or receive printer configuration.
  app.get('/v1/barista/weekly-schedule', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canOperate(request);
    const { from, to } = planningWindow();
    const [schedules, datedShifts] = await Promise.all([
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT s.weekday, s.starts_at, s.ends_at, b.id AS barista_id, b.name AS barista_name
       FROM barista_weekly_schedules s
       JOIN baristas b ON b.id = s.barista_id
       WHERE s.tenant_code = :tenantCode AND s.is_active = 1 AND b.is_active = 1
         AND (
           :isBaristaOnly = 0
           OR s.store_id IS NULL
           OR EXISTS (SELECT 1 FROM admin_user_store_assignments aus WHERE aus.admin_user_id = :adminUserId AND aus.store_id = s.store_id)
         )
       ORDER BY s.weekday ASC, s.starts_at ASC`,
        { tenantCode: request.adminAuth.tenantCode, adminUserId: request.adminAuth.adminUserId, isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0 }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT DATE_FORMAT(s.shift_date, '%Y-%m-%d') AS shift_date, s.starts_at, s.ends_at, b.id AS barista_id, b.name AS barista_name
         FROM barista_dated_shifts s
         JOIN baristas b ON b.id = s.barista_id
         WHERE s.tenant_code = :tenantCode AND b.is_active = 1 AND s.shift_date BETWEEN :from AND :to
           AND (
             :isBaristaOnly = 0
             OR s.store_id IS NULL
             OR EXISTS (SELECT 1 FROM admin_user_store_assignments aus WHERE aus.admin_user_id = :adminUserId AND aus.store_id = s.store_id)
           )
         ORDER BY s.shift_date ASC, s.starts_at ASC`,
        { tenantCode: request.adminAuth.tenantCode, from, to, adminUserId: request.adminAuth.adminUserId, isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0 }
      )
    ]);

    return reply.send({ weekly_schedule: schedules[0], scheduled_shifts: datedShifts[0] });
  });

  app.get('/v1/barista/operations/context', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canOperate(request);
    const key = workstationKey(request);
    const { from, to } = planningWindow();
    const [integrations, printers, datedShifts] = await Promise.all([
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT provider_code, display_name, status, capabilities_json, last_checked_at, last_error_code
         FROM outlet_integrations oi
         WHERE tenant_code = :tenantCode
           AND (
           :isBaristaOnly = 0
             OR oi.store_id IS NULL
             OR EXISTS (SELECT 1 FROM admin_user_store_assignments aus WHERE aus.admin_user_id = :adminUserId AND aus.store_id = oi.store_id)
           )
         ORDER BY display_name ASC`,
        { tenantCode: request.adminAuth.tenantCode, adminUserId: request.adminAuth.adminUserId, isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0 }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT id, name, delivery_mode, status, is_default,
                CASE WHEN delivery_mode = 'android_direct' AND direct_print_device_key = :workstationKey THEN network_host ELSE NULL END AS network_host,
                CASE WHEN delivery_mode = 'android_direct' AND direct_print_device_key = :workstationKey THEN network_port ELSE NULL END AS network_port,
                last_checked_at, last_error_code
         FROM printer_targets pt
         WHERE tenant_code = :tenantCode
           AND (
           :isBaristaOnly = 0
             OR pt.store_id IS NULL
           OR EXISTS (SELECT 1 FROM admin_user_store_assignments aus WHERE aus.admin_user_id = :adminUserId AND aus.store_id = pt.store_id)
           )
           AND (pt.delivery_mode <> 'android_direct' OR pt.direct_print_device_key = :workstationKey)
         ORDER BY is_default DESC, name ASC`,
        { tenantCode: request.adminAuth.tenantCode, adminUserId: request.adminAuth.adminUserId, isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0, workstationKey: key }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT DATE_FORMAT(s.shift_date, '%Y-%m-%d') AS shift_date,
                s.starts_at, s.ends_at, b.id AS barista_id, b.name AS barista_name
         FROM barista_dated_shifts s
         JOIN baristas b ON b.id = s.barista_id
         WHERE s.tenant_code = :tenantCode AND b.is_active = 1 AND s.shift_date BETWEEN :from AND :to
           AND (
             :isBaristaOnly = 0
             OR s.store_id IS NULL
             OR EXISTS (
               SELECT 1 FROM admin_user_store_assignments aus
               WHERE aus.admin_user_id = :adminUserId AND aus.store_id = s.store_id
             )
           )
         ORDER BY s.shift_date ASC, s.starts_at ASC, b.name ASC`,
        {
          tenantCode: request.adminAuth.tenantCode,
          from,
          to,
          adminUserId: request.adminAuth.adminUserId,
          isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0
        }
      )
    ]);

    return reply.send({
      integrations: integrations[0].map(integrationResponse),
      printers: printers[0].map((row) => ({ ...row, is_default: !!row.is_default })),
      scheduled_shifts: datedShifts[0]
    });
  });

  app.post('/v1/barista/direct-printer/tested', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canOperate(request);
    const key = workstationKey(request);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE printer_targets pt SET status = 'connected', last_checked_at = UTC_TIMESTAMP(), last_error_code = NULL
       WHERE pt.tenant_code = :tenantCode AND pt.delivery_mode = 'android_direct' AND pt.direct_print_device_key = :workstationKey
       AND (:isBaristaOnly = 0 OR pt.store_id IS NULL OR EXISTS (SELECT 1 FROM admin_user_store_assignments aus WHERE aus.admin_user_id = :adminUserId AND aus.store_id = pt.store_id))`,
      { tenantCode: request.adminAuth.tenantCode, workstationKey: key, adminUserId: request.adminAuth.adminUserId, isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0 }
    );
    if (result.affectedRows !== 1) throw new ApiError(404, 'direct_printer_not_assigned', 'No direct printer is assigned to this tablet.');
    return reply.send({ connected: true });
  });

  app.post('/v1/barista/direct-print-jobs/claim', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canOperate(request);
    const key = workstationKey(request);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [printers] = await connection.execute<RowDataPacket[]>(
        `SELECT pt.id, pt.name, pt.network_host, pt.network_port FROM printer_targets pt
         WHERE pt.tenant_code = :tenantCode AND pt.delivery_mode = 'android_direct' AND pt.status = 'connected'
           AND pt.direct_print_device_key = :workstationKey
           AND (:isBaristaOnly = 0 OR pt.store_id IS NULL OR EXISTS (SELECT 1 FROM admin_user_store_assignments aus WHERE aus.admin_user_id = :adminUserId AND aus.store_id = pt.store_id))
         LIMIT 1 FOR UPDATE`,
        { tenantCode: request.adminAuth.tenantCode, workstationKey: key, adminUserId: request.adminAuth.adminUserId, isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0 }
      );
      const printer = printers[0];
      if (!printer?.network_host || !printer.network_port) { await connection.commit(); return reply.code(204).send(); }
      await connection.execute(
        `UPDATE print_jobs SET status = 'queued', last_error_code = 'tablet_claim_timed_out'
         WHERE printer_target_id = :printerTargetId AND status = 'dispatching' AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 MINUTE)`,
        { printerTargetId: printer.id }
      );
      const [jobs] = await connection.execute<RowDataPacket[]>(
        `SELECT j.id, j.job_ref, o.order_ref, o.created_at,
                COALESCE(NULLIF(TRIM(up.display_name), ''), 'Guest') AS customer_name,
                COALESCE(ctm.is_employee, 0) AS is_employee
         FROM print_jobs j
         JOIN orders o ON o.id = j.order_id
         JOIN stores s ON s.id = o.store_id
         LEFT JOIN user_profiles up ON up.user_id = o.user_id
         LEFT JOIN customer_tenant_memberships ctm
           ON ctm.user_id = o.user_id AND ctm.tenant_id = s.tenant_id
         WHERE j.printer_target_id = :printerTargetId AND j.status = 'queued' ORDER BY j.created_at ASC LIMIT 1 FOR UPDATE`,
        { printerTargetId: printer.id }
      );
      const job = jobs[0];
      if (!job) { await connection.commit(); return reply.code(204).send(); }
      await connection.execute(`UPDATE print_jobs SET status = 'dispatching', attempt_count = attempt_count + 1, last_error_code = NULL WHERE id = :jobId`, { jobId: job.id });
      const [items] = await connection.execute<RowDataPacket[]>(
        `SELECT oi.id, oi.item_name_snapshot, oi.quantity FROM order_items oi
         WHERE oi.order_id = (SELECT order_id FROM print_jobs WHERE id = :jobId) ORDER BY oi.id ASC`,
        { jobId: job.id }
      );
      const [modifiers] = await connection.execute<RowDataPacket[]>(
        `SELECT oim.order_item_id, oim.modifier_group_name_snapshot, oim.modifier_option_name_snapshot
         FROM order_item_modifiers oim
         JOIN order_items oi ON oi.id = oim.order_item_id
         WHERE oi.order_id = (SELECT order_id FROM print_jobs WHERE id = :jobId)
         ORDER BY oim.id ASC`,
        { jobId: job.id }
      );
      const detailsByItemId = new Map<number, string[]>();
      for (const modifier of modifiers) {
        const details = detailsByItemId.get(Number(modifier.order_item_id)) ?? [];
        details.push(`${modifier.modifier_group_name_snapshot}: ${modifier.modifier_option_name_snapshot}`);
        detailsByItemId.set(Number(modifier.order_item_id), details);
      }
      await connection.commit();
      return reply.send({ job_ref: job.job_ref, printer: { name: printer.name, host: printer.network_host, port: Number(printer.network_port) }, order: { order_ref: job.order_ref, customer_name: job.customer_name, is_employee: Number(job.is_employee) === 1, created_at: new Date(job.created_at).toISOString(), items: items.map((item) => ({ name: item.item_name_snapshot, quantity: Number(item.quantity), details: detailsByItemId.get(Number(item.id)) ?? [] })) } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  });

  app.post('/v1/barista/direct-print-jobs/acknowledge', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canOperate(request);
    const key = workstationKey(request);
    const body = z.object({ job_ref: z.string().uuid(), outcome: z.enum(['printed', 'failed']), error_code: z.string().trim().max(100).optional() }).parse(request.body);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE print_jobs j JOIN printer_targets pt ON pt.id = j.printer_target_id
       SET j.status = :status, j.last_error_code = :errorCode, j.printed_at = CASE WHEN :status = 'printed' THEN UTC_TIMESTAMP() ELSE NULL END
       WHERE j.job_ref = :jobRef AND j.status = 'dispatching' AND pt.tenant_code = :tenantCode
         AND pt.delivery_mode = 'android_direct' AND pt.direct_print_device_key = :workstationKey`,
      { status: body.outcome, errorCode: body.outcome === 'failed' ? body.error_code ?? 'tablet_print_failed' : null, jobRef: body.job_ref, tenantCode: request.adminAuth.tenantCode, workstationKey: key }
    );
    if (result.affectedRows !== 1) throw new ApiError(409, 'print_job_not_dispatching', 'The print job is no longer available.');
    return reply.send({ acknowledged: true });
  });

  app.post('/v1/barista/print-jobs', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canOperate(request);
    const body = z.object({
      order_ref: z.string().trim().min(1).max(80),
      printer_target_id: z.coerce.number().int().positive(),
      request_type: z.enum(['original', 'reprint']).default('original')
    }).parse(request.body);

    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [orders] = await connection.execute<RowDataPacket[]>(
        `SELECT o.id
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE o.order_ref = :orderRef AND t.code = :tenantCode
           AND (
             :isBaristaOnly = 0
             OR EXISTS (SELECT 1 FROM admin_user_store_assignments aus WHERE aus.admin_user_id = :adminUserId AND aus.store_id = o.store_id)
           )
         LIMIT 1 FOR UPDATE`,
        { orderRef: body.order_ref, tenantCode: request.adminAuth.tenantCode, adminUserId: request.adminAuth.adminUserId, isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0 }
      );
      if (!orders[0]) throw new ApiError(404, 'order_not_found', 'Order not found for this tenant.');

      const [printers] = await connection.execute<RowDataPacket[]>(
        `SELECT pt.id FROM printer_targets pt
         JOIN orders o ON o.id = :orderId
         WHERE pt.id = :printerTargetId AND pt.tenant_code = :tenantCode AND pt.status = 'connected'
           AND pt.store_id = o.store_id
         LIMIT 1 FOR UPDATE`,
        { printerTargetId: body.printer_target_id, tenantCode: request.adminAuth.tenantCode, orderId: orders[0].id }
      );
      if (!printers[0]) {
        throw new ApiError(409, 'printer_not_ready', 'The selected printer is not connected.');
      }

      const jobRef = crypto.randomUUID();
      await connection.execute(
        `INSERT INTO print_jobs (
          job_ref, tenant_code, order_id, printer_target_id, requested_by_admin_user_id, request_type
        ) VALUES (
          :jobRef, :tenantCode, :orderId, :printerTargetId, :adminUserId, :requestType
        )`,
        {
          jobRef,
          tenantCode: request.adminAuth.tenantCode,
          orderId: orders[0].id,
          printerTargetId: body.printer_target_id,
          adminUserId: request.adminAuth.adminUserId,
          requestType: body.request_type
        }
      );
      await connection.commit();
      return reply.code(202).send({ job_ref: jobRef, status: 'queued' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
