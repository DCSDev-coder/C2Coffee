import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest } from '../../admin/guard.js';
import { ApiError } from '../errors.js';
import { mysqlPool } from '../../db/mysql.js';
import {
  defaultCapabilities,
  integrationCapabilities,
  integrationProviders,
  parseCapabilities,
  printerDeliveryModes
} from '../../services/operational-integrations.js';

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
  // A connector, not a form submission, is responsible for declaring a printer connected.
  status: printerConfigurationStatus.optional().default('pending'),
  is_default: z.boolean().optional().default(false)
});

const weeklyScheduleSchema = z.object({
  entries: z.array(z.object({
    barista_id: z.coerce.number().int().positive(),
    weekday: z.coerce.number().int().min(1).max(7),
    starts_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM time.'),
    ends_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM time.')
  }).refine((entry) => entry.ends_at > entry.starts_at, {
    message: 'Shift end time must be after start time.',
    path: ['ends_at']
  })).max(200)
});
const attendanceQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  barista_id: z.coerce.number().int().positive().optional()
});

function malaysiaDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

function malaysiaTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}

function weekdayForDate(date: string): number {
  const day = new Date(`${date}T12:00:00+08:00`).getUTCDay();
  return day === 0 ? 7 : day;
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = new Date(`${from}T12:00:00+08:00`); date <= new Date(`${to}T12:00:00+08:00`); date.setUTCDate(date.getUTCDate() + 1)) dates.push(malaysiaDate(date));
  return dates;
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

function integrationResponse(row: RowDataPacket) {
  return {
    ...row,
    capabilities: parseCapabilities(
      typeof row.capabilities_json === 'string' ? JSON.parse(row.capabilities_json) : row.capabilities_json
    )
  };
}

export async function registerOperationalIntegrationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/operations/attendance', { preHandler: authenticateAdminRequest }, async (request) => {
    canConfigure(request);
    const query = attendanceQuerySchema.parse(request.query);
    const today = malaysiaDate(new Date());
    const to = query.to ?? today;
    const from = query.from ?? malaysiaDate(new Date(new Date(`${to}T12:00:00+08:00`).getTime() - 29 * 86400000));
    if (from > to || datesBetween(from, to).length > 93) throw new ApiError(400, 'invalid_date_range', 'Choose a date range of up to 93 days.');
    const [attendanceResult, scheduleResult] = await Promise.all([
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
        `SELECT s.barista_id, b.name AS barista_name, s.weekday, s.starts_at, s.ends_at, s.created_at
         FROM barista_weekly_schedules s JOIN baristas b ON b.id = s.barista_id
         WHERE s.tenant_code = :tenantCode AND s.is_active = 1
           AND (:baristaId IS NULL OR s.barista_id = :baristaId)`,
        { tenantCode: request.adminAuth.tenantCode, baristaId: query.barista_id ?? null }
      )
    ]);
    const schedules = scheduleResult[0];
    const actualByKey = new Set<string>();
    const records: Array<Record<string, unknown>> = attendanceResult[0].map((row) => {
      const date = malaysiaDate(new Date(row.clocked_in_at));
      actualByKey.add(`${row.barista_id}:${date}`);
      const time = malaysiaTime(row.clocked_in_at);
      const candidates = schedules.filter((schedule) =>
        Number(schedule.barista_id) === Number(row.barista_id)
        && Number(schedule.weekday) === weekdayForDate(date)
        && malaysiaDate(new Date(schedule.created_at)) <= date
      );
      const planned = candidates.sort((left, right) => Math.abs(time.localeCompare(left.starts_at.slice(0, 5))) - Math.abs(time.localeCompare(right.starts_at.slice(0, 5))))[0];
      const lateMinutes = planned && time > planned.starts_at.slice(0, 5)
        ? Math.round((new Date(`${date}T${time}:00+08:00`).getTime() - new Date(`${date}T${planned.starts_at.slice(0, 5)}:00+08:00`).getTime()) / 60000)
        : 0;
      const durationMinutes = row.clocked_out_at ? Math.round((new Date(row.clocked_out_at).getTime() - new Date(row.clocked_in_at).getTime()) / 60000) : null;
      return {
        id: Number(row.id), barista_id: Number(row.barista_id), barista_name: row.barista_name, date,
        planned_start: planned?.starts_at?.slice(0, 5) ?? null, planned_end: planned?.ends_at?.slice(0, 5) ?? null,
        clocked_in_at: row.clocked_in_at, clocked_out_at: row.clocked_out_at, late_minutes: lateMinutes, duration_minutes: durationMinutes,
        status: !row.clocked_out_at
          ? date < today
            ? 'missing_clock_out'
            : lateMinutes > 0
              ? 'clocked_in_late'
              : 'clocked_in'
          : !planned
            ? 'unscheduled'
            : lateMinutes > 0
              ? 'late'
              : 'completed'
      };
    });
    for (const date of datesBetween(from, to)) {
      if (date >= today) continue;
      for (const shift of schedules.filter((entry) =>
        Number(entry.weekday) === weekdayForDate(date)
        && malaysiaDate(new Date(entry.created_at)) <= date
      )) {
        if (!actualByKey.has(`${shift.barista_id}:${date}`)) records.push({
          id: `missing-${shift.barista_id}-${date}`, barista_id: Number(shift.barista_id), barista_name: shift.barista_name, date,
          planned_start: shift.starts_at.slice(0, 5), planned_end: shift.ends_at.slice(0, 5), clocked_in_at: null, clocked_out_at: null,
          late_minutes: 0, duration_minutes: null, status: 'missed_clock_in'
        });
      }
    }
    records.sort((left, right) => `${right.date}${right.barista_name}`.localeCompare(`${left.date}${left.barista_name}`));
    return { from, to, attendance: records, summary: {
      active_now: records.filter((record) => record.status === 'clocked_in' || record.status === 'clocked_in_late').length,
      late_arrivals: records.filter((record) => record.status === 'late' || record.status === 'clocked_in_late').length,
      missing_clock_out: records.filter((record) => record.status === 'missing_clock_out').length,
      missed_clock_in: records.filter((record) => record.status === 'missed_clock_in').length
    } };
  });

  app.get('/v1/admin/operational-integrations', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const [integrations, printers, schedules] = await Promise.all([
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT id, store_id, provider_code, display_name, status, capabilities_json,
                connection_reference, last_checked_at, last_error_code, created_at, updated_at
         FROM outlet_integrations
         WHERE tenant_code = :tenantCode
         ORDER BY display_name ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT id, store_id, integration_id, name, delivery_mode, printer_reference, status,
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
         WHERE s.tenant_code = :tenantCode AND s.is_active = 1
         ORDER BY s.weekday ASC, s.starts_at ASC, b.name ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      )
    ]);

    return reply.send({
      integrations: integrations[0].map(integrationResponse),
      printers: printers[0].map((row) => ({ ...row, is_default: !!row.is_default })),
      weekly_schedule: schedules[0].map((row) => ({ ...row, is_active: !!row.is_active }))
    });
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
    await assertStoreInTenant(body.store_id, request.adminAuth.tenantCode);

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
          'UPDATE printer_targets SET is_default = 0 WHERE tenant_code = :tenantCode',
          { tenantCode: request.adminAuth.tenantCode }
        );
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO printer_targets (
          tenant_code, store_id, integration_id, name, delivery_mode, printer_reference, status, is_default
        ) VALUES (
          :tenantCode, :storeId, :integrationId, :name, :deliveryMode, :printerReference, :status, :isDefault
        )`,
        {
          tenantCode: request.adminAuth.tenantCode,
          storeId: body.store_id,
          integrationId: body.integration_id,
          name: body.name,
          deliveryMode: body.delivery_mode,
          printerReference: body.printer_reference,
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

  app.get('/v1/barista/operations/context', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canOperate(request);
    const [integrations, printers, schedules] = await Promise.all([
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
        `SELECT id, name, delivery_mode, status, is_default, last_checked_at, last_error_code
         FROM printer_targets pt
         WHERE tenant_code = :tenantCode
           AND (
           :isBaristaOnly = 0
             OR pt.store_id IS NULL
             OR EXISTS (SELECT 1 FROM admin_user_store_assignments aus WHERE aus.admin_user_id = :adminUserId AND aus.store_id = pt.store_id)
           )
         ORDER BY is_default DESC, name ASC`,
        { tenantCode: request.adminAuth.tenantCode, adminUserId: request.adminAuth.adminUserId, isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0 }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT s.weekday, s.starts_at, s.ends_at, b.id AS barista_id, b.name AS barista_name
         FROM barista_weekly_schedules s
         JOIN baristas b ON b.id = s.barista_id
         WHERE s.tenant_code = :tenantCode AND s.is_active = 1
           AND (
           :isBaristaOnly = 0
             OR s.store_id IS NULL
             OR EXISTS (SELECT 1 FROM admin_user_store_assignments aus WHERE aus.admin_user_id = :adminUserId AND aus.store_id = s.store_id)
           )
         ORDER BY s.weekday ASC, s.starts_at ASC`,
        { tenantCode: request.adminAuth.tenantCode, adminUserId: request.adminAuth.adminUserId, isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0 }
      )
    ]);

    return reply.send({
      integrations: integrations[0].map(integrationResponse),
      printers: printers[0].map((row) => ({ ...row, is_default: !!row.is_default })),
      weekly_schedule: schedules[0]
    });
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
