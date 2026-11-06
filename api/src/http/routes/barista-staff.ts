import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import sharp from 'sharp';
import { z } from 'zod';
import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { saveMediaAsset } from '../../lib/media-assets.js';
import { verifyPassword } from '../../lib/password.js';
import { resolveBaristaShiftAccess } from '../../services/barista-shift-access.js';
import { loadBaristaSoundSettings } from '../../services/barista-sound-settings.js';
import { createUserNotification } from '../notifications.js';
import { deliverPushToUser } from '../../services/push-delivery.js';
import { releaseInventoryForOrder } from '../../services/inventory.js';
import { restoreGiftCardForRefund } from '../../services/gift-cards.js';
import { issueRefundReplacementVoucher } from '../../services/voucher-replacement.js';
import { calculatePersonalTokenRefund, restoreEmployeeAllowanceForRefund } from '../../services/employee-token-allowance.js';
import { consumeMarketingDrinkInventory, reverseMarketingDrinkInventory } from '../../services/marketing-drink-usage.js';

const guideTypeSchema = z.enum(['attire', 'rules', 'drink']);
const imageUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  data_url: z.string().trim().min(1)
});
const attendanceActionSchema = z.object({
  barista_id: z.coerce.number().int().positive(),
  pin: z.string().regex(/^\d{6}$/)
});

const emergencyReasonSchema = z.enum([
  'medical_emergency',
  'safety_incident',
  'power_outage',
  'equipment_failure',
  'other'
]);

const emergencyActionSchema = attendanceActionSchema.extend({
  reason_code: emergencyReasonSchema,
  note: z.string().trim().max(500).nullable().optional(),
  idempotency_key: z.string().trim().min(16).max(100)
});

const sideWorkSchema = z.object({
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(500).nullable().optional(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
});
const sideWorkBatchSchema = z.object({
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(500).nullable().optional(),
  scheduled_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(31),
  scheduled_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
});

const sideWorkCompletionSchema = attendanceActionSchema.extend({
  task_id: z.coerce.number().int().positive()
});

const marketingDrinkPurposeSchema = z.enum(['sampling', 'campaign', 'content_production', 'influencer', 'goodwill', 'other']);
const marketingDrinkUsageSchema = attendanceActionSchema.extend({
  idempotency_key: z.string().trim().min(16).max(100),
  purpose_code: marketingDrinkPurposeSchema,
  campaign_name: z.string().trim().max(160).nullable().optional(),
  reason_note: z.string().trim().min(3).max(500),
  items: z.array(z.object({
    menu_item_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(20)
  })).min(1).max(20)
}).superRefine((value, context) => {
  const ids = value.items.map((item) => item.menu_item_id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Each drink may only appear once.', path: ['items'] });
  }
});

const marketingReportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  store_id: z.coerce.number().int().positive().optional(),
  purpose_code: marketingDrinkPurposeSchema.optional()
});

function malaysiaDate(value = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value);
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}

function addDays(date: string, days: number): string {
  return malaysiaDate(new Date(new Date(`${date}T12:00:00+08:00`).getTime() + days * 86400000));
}

function isRealIsoDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validateSideWorkDates(values: string[]): void {
  const from = malaysiaDate();
  const to = addDays(from, 30);
  for (const value of values) {
    if (!isRealIsoDate(value) || value < from || value > to) {
      throw new ApiError(400, 'side_work_date_out_of_range', 'Side work can be scheduled from today through the next 30 days.');
    }
  }
}

const guideSchema = z.object({
  guide_type: guideTypeSchema,
  menu_item_id: z.coerce.number().int().positive().nullable().optional(),
  guide_title: z.string().trim().min(1).max(120).nullable().optional(),
  image_url: z.string().trim().min(1).max(512),
  sort_order: z.coerce.number().int().min(0).max(999).optional().default(0),
  is_active: z.coerce.boolean().optional().default(true)
}).superRefine((value, context) => {
  if (value.guide_type === 'drink' && !value.menu_item_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A drink guide must be linked to a menu item.', path: ['menu_item_id'] });
  }
  if (value.guide_type !== 'drink' && value.menu_item_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Only drink guides can be linked to a menu item.', path: ['menu_item_id'] });
  }
});

function assertStaffAccess(request: { adminAuth: { roles: string[] } }) {
  requireAnyAdminRole(request as never, ['super_admin', 'operations_admin', 'barista']);
}

async function resolveAttendanceStoreId(request: {
  headers: Record<string, string | string[] | undefined>;
  adminAuth: { adminUserId: number; tenantId: number; tenantCode: string; isBaristaOnly: boolean };
}): Promise<number> {
  const rawKey = request.headers['x-c2-workstation-key'];
  const key = typeof rawKey === 'string' ? rawKey.trim().toUpperCase() : '';
  if (key) {
    if (!/^C2-[A-Z0-9]{12}$/.test(key)) {
      throw new ApiError(400, 'invalid_workstation_key', 'This tablet needs a valid C2 Store device code.');
    }
    const [devices] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT store_id FROM printer_targets
       WHERE tenant_code = :tenantCode AND direct_print_device_key = :workstationKey
         AND store_id IS NOT NULL
       ORDER BY is_default DESC, id ASC LIMIT 1`,
      { tenantCode: request.adminAuth.tenantCode, workstationKey: key }
    );
    if (devices[0]?.store_id) return Number(devices[0].store_id);
  }

  const [stores] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT s.id
     FROM stores s
     WHERE s.tenant_id = :tenantId AND s.status = 'active'
       AND (
         :isBaristaOnly = 0 AND s.is_customer_facing = 1
         OR EXISTS (
           SELECT 1 FROM admin_user_store_assignments aus
           WHERE aus.admin_user_id = :adminUserId AND aus.store_id = s.id
         )
       )
     ORDER BY s.is_customer_facing DESC, s.id ASC
     LIMIT 2`,
    {
      tenantId: request.adminAuth.tenantId,
      adminUserId: request.adminAuth.adminUserId,
      isBaristaOnly: request.adminAuth.isBaristaOnly ? 1 : 0
    }
  );
  if (stores.length !== 1) {
    throw new ApiError(409, 'workstation_outlet_required', 'Assign this C2 Store device to exactly one outlet before using shift access.');
  }
  return Number(stores[0].id);
}

function guideResponse(row: RowDataPacket) {
  return {
    id: Number(row.id), guide_type: row.guide_type, menu_item_id: row.menu_item_id == null ? null : Number(row.menu_item_id), guide_title: row.guide_title ?? null,
    image_url: row.image_url, sort_order: Number(row.sort_order), is_active: !!row.is_active,
    menu_item_name: row.menu_item_name ?? null, created_at: row.created_at, updated_at: row.updated_at
  };
}

function emergencyCustomerMessage(expectedReopenAt: Date | null, sameDay: boolean): string {
  if (!expectedReopenAt) {
    return 'This outlet has closed early today due to an emergency. Please check the app for the next update.';
  }
  const reopenLabel = new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    weekday: sameDay ? undefined : 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(expectedReopenAt);
  return sameDay
    ? `This outlet is temporarily closed due to an emergency. We expect to reopen during the next scheduled shift at ${reopenLabel}.`
    : `This outlet has closed early today due to an emergency. The next scheduled shift starts ${reopenLabel}.`;
}

async function nextPublishedShift(
  connection: Awaited<ReturnType<typeof mysqlPool.getConnection>>,
  tenantCode: string,
  storeId: number
): Promise<Date | null> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT CONVERT_TZ(TIMESTAMP(s.shift_date, s.starts_at), '+08:00', '+00:00') AS starts_at
       FROM barista_dated_shifts s
       JOIN barista_schedule_publications p
         ON p.tenant_code = s.tenant_code AND p.schedule_date = s.shift_date
        AND (p.store_id = s.store_id OR p.store_id IS NULL)
      WHERE s.tenant_code = :tenantCode
        AND (s.store_id = :storeId OR s.store_id IS NULL)
        AND TIMESTAMP(s.shift_date, s.starts_at) > CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
      ORDER BY s.shift_date, s.starts_at
      LIMIT 1`,
    { tenantCode, storeId }
  );
  return rows[0]?.starts_at ? new Date(rows[0].starts_at) : null;
}

export async function registerBaristaStaffRoutes(app: FastifyInstance) {
  app.get('/v1/admin/side-work', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const query = z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    }).parse(request.query);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT t.id, t.title, t.instructions, DATE_FORMAT(t.scheduled_date, '%Y-%m-%d') AS scheduled_date,
              TIME_FORMAT(t.scheduled_time, '%H:%i') AS scheduled_time, t.is_active,
              c.completed_at, c.barista_id AS completed_by_barista_id, b.name AS completed_by_barista_name
       FROM barista_side_work_tasks t
       LEFT JOIN barista_side_work_completions c ON c.task_id = t.id
       LEFT JOIN baristas b ON b.id = c.barista_id
       WHERE t.tenant_id = :tenantId
         AND (:fromDate IS NULL OR t.scheduled_date >= :fromDate)
         AND (:toDate IS NULL OR t.scheduled_date <= :toDate)
       ORDER BY t.scheduled_date ASC, t.scheduled_time ASC, t.id ASC`,
      { tenantId: request.adminAuth.tenantId, fromDate: query.from ?? null, toDate: query.to ?? null }
    );
    return { tasks: rows.map((row) => ({ ...row, id: Number(row.id), is_active: !!row.is_active })) };
  });

  app.post('/v1/admin/side-work', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const payload = sideWorkSchema.parse(request.body);
    validateSideWorkDates([payload.scheduled_date]);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO barista_side_work_tasks
         (tenant_id, title, instructions, scheduled_date, scheduled_time, created_by_admin_user_id)
       VALUES (:tenantId, :title, :instructions, :scheduledDate, :scheduledTime, :adminUserId)`,
      {
        tenantId: request.adminAuth.tenantId,
        title: payload.title,
        instructions: payload.instructions || null,
        scheduledDate: payload.scheduled_date,
        scheduledTime: payload.scheduled_time,
        adminUserId: request.adminAuth.adminUserId
      }
    );
    return reply.code(201).send({ id: Number(result.insertId) });
  });

  app.post('/v1/admin/side-work/bulk', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const payload = sideWorkBatchSchema.parse(request.body);
    const scheduledDates = [...new Set(payload.scheduled_dates)].sort();
    validateSideWorkDates(scheduledDates);
    const connection = await mysqlPool.getConnection();

    try {
      await connection.beginTransaction();
      const ids: number[] = [];
      let skipped = 0;
      for (const scheduledDate of scheduledDates) {
        const [existing] = await connection.execute<RowDataPacket[]>(
          `SELECT id FROM barista_side_work_tasks
           WHERE tenant_id = :tenantId AND title = :title
             AND scheduled_date = :scheduledDate AND scheduled_time = :scheduledTime
             AND is_active = 1
           LIMIT 1 FOR UPDATE`,
          {
            tenantId: request.adminAuth.tenantId,
            title: payload.title,
            scheduledDate,
            scheduledTime: payload.scheduled_time
          }
        );
        if (existing.length > 0) {
          skipped += 1;
          continue;
        }
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO barista_side_work_tasks
             (tenant_id, title, instructions, scheduled_date, scheduled_time, created_by_admin_user_id)
           VALUES (:tenantId, :title, :instructions, :scheduledDate, :scheduledTime, :adminUserId)`,
          {
            tenantId: request.adminAuth.tenantId,
            title: payload.title,
            instructions: payload.instructions || null,
            scheduledDate,
            scheduledTime: payload.scheduled_time,
            adminUserId: request.adminAuth.adminUserId
          }
        );
        ids.push(Number(result.insertId));
      }
      await connection.commit();
      return reply.code(201).send({ ids, saved: ids.length, skipped });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.delete('/v1/admin/side-work/:taskId', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const taskId = z.coerce.number().int().positive().parse((request.params as { taskId: string }).taskId);
    const [completions] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT c.id FROM barista_side_work_completions c
       JOIN barista_side_work_tasks t ON t.id = c.task_id
       WHERE c.task_id = :taskId AND t.tenant_id = :tenantId LIMIT 1`,
      { taskId, tenantId: request.adminAuth.tenantId }
    );
    if (completions[0]) {
      throw new ApiError(409, 'side_work_has_completion', 'Completed side work is retained as an audit record and cannot be removed.');
    }
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      'DELETE FROM barista_side_work_tasks WHERE id = :taskId AND tenant_id = :tenantId',
      { taskId, tenantId: request.adminAuth.tenantId }
    );
    if (!result.affectedRows) throw new ApiError(404, 'side_work_not_found', 'The side-work task was not found.');
    return reply.code(204).send();
  });

  app.get('/v1/barista/side-work', { preHandler: authenticateAdminRequest }, async (request) => {
    assertStaffAccess(request);
    const query = z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    }).parse(request.query);
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const parts = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    const fromDate = query.from ?? today;
    const toDate = query.to ?? fromDate;
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT t.id, t.title, t.instructions, DATE_FORMAT(t.scheduled_date, '%Y-%m-%d') AS scheduled_date,
              TIME_FORMAT(t.scheduled_time, '%H:%i') AS scheduled_time,
              TIMESTAMP(t.scheduled_date, t.scheduled_time) <= CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00') AS is_due,
              c.completed_at, c.barista_id AS completed_by_barista_id, b.name AS completed_by_barista_name
       FROM barista_side_work_tasks t
       LEFT JOIN barista_side_work_completions c ON c.task_id = t.id
       LEFT JOIN baristas b ON b.id = c.barista_id
       WHERE t.tenant_id = :tenantId
         AND t.scheduled_date BETWEEN :fromDate AND :toDate
         AND t.is_active = 1
       ORDER BY t.scheduled_date ASC, t.scheduled_time ASC, t.id ASC`,
      { tenantId: request.adminAuth.tenantId, fromDate, toDate }
    );
    return {
      tasks: rows.map((row) => ({
        ...row,
        id: Number(row.id),
        is_due: Boolean(row.is_due)
      }))
    };
  });

  app.post('/v1/barista/side-work/complete', {
    preHandler: authenticateAdminRequest,
    config: { rateLimit: { max: 12, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    assertStaffAccess(request);
    const payload = sideWorkCompletionSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [baristas] = await connection.query<RowDataPacket[]>(
        `SELECT id, pin_hash FROM baristas
         WHERE id = :baristaId AND tenant_code = :tenantCode AND is_active = 1 LIMIT 1 FOR UPDATE`,
        { baristaId: payload.barista_id, tenantCode: request.adminAuth.tenantCode }
      );
      if (!baristas[0]?.pin_hash || !(await verifyPassword(payload.pin, baristas[0].pin_hash))) {
        throw new ApiError(401, 'invalid_barista_pin', 'The selected barista or PIN is not valid.');
      }
      const [activeAttendance] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM barista_attendance
         WHERE tenant_id = :tenantId AND barista_id = :baristaId AND clocked_out_at IS NULL LIMIT 1`,
        { tenantId: request.adminAuth.tenantId, baristaId: payload.barista_id }
      );
      if (!activeAttendance[0]) {
        throw new ApiError(409, 'barista_not_clocked_in', 'Clock in before completing side work.');
      }
      const [tasks] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM barista_side_work_tasks
         WHERE id = :taskId AND tenant_id = :tenantId AND is_active = 1
           AND TIMESTAMP(scheduled_date, scheduled_time) <= CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
         LIMIT 1 FOR UPDATE`,
        { taskId: payload.task_id, tenantId: request.adminAuth.tenantId }
      );
      if (!tasks[0]) throw new ApiError(409, 'side_work_not_due', 'This side-work task is not due yet or is no longer available.');
      await connection.execute(
        `INSERT IGNORE INTO barista_side_work_completions
           (task_id, barista_id, recorded_by_admin_user_id)
         VALUES (:taskId, :baristaId, :adminUserId)`,
        { taskId: payload.task_id, baristaId: payload.barista_id, adminUserId: request.adminAuth.adminUserId }
      );
      await connection.commit();
      return reply.send({ completed: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/barista/attendance/status', { preHandler: authenticateAdminRequest }, async (request) => {
    assertStaffAccess(request);
    const storeId = await resolveAttendanceStoreId(request);
    const connection = await mysqlPool.getConnection();
    try {
      const [baristas, access, closureRows] = await Promise.all([
        connection.query<RowDataPacket[]>(
          `SELECT b.id, b.name, b.pin_hash IS NOT NULL AS pin_configured FROM baristas b
           WHERE b.tenant_code = :tenantCode AND (
             b.is_active = 1 OR EXISTS (
               SELECT 1 FROM barista_attendance a
               WHERE a.tenant_id = :tenantId AND a.barista_id = b.id AND a.clocked_out_at IS NULL
             )
           ) ORDER BY b.name ASC`,
          { tenantCode: request.adminAuth.tenantCode, tenantId: request.adminAuth.tenantId }
        ),
        resolveBaristaShiftAccess(connection, {
          tenantId: request.adminAuth.tenantId,
          tenantCode: request.adminAuth.tenantCode,
          storeId
        }),
        connection.query<RowDataPacket[]>(
          `SELECT id, reason_code, expected_reopen_at, created_at
             FROM outlet_emergency_closures
            WHERE tenant_id = :tenantId AND store_id = :storeId AND status = 'active'
            ORDER BY id DESC LIMIT 1`,
          { tenantId: request.adminAuth.tenantId, storeId }
        )
      ]);
      return {
        baristas: baristas[0].map((row) => ({ id: Number(row.id), name: row.name, pin_configured: !!row.pin_configured })),
        active_attendance: access.active_attendance,
        emergency_closure: closureRows[0][0]
          ? {
              id: Number(closureRows[0][0].id),
              reason_code: String(closureRows[0][0].reason_code),
              expected_reopen_at: closureRows[0][0].expected_reopen_at ? new Date(closureRows[0][0].expected_reopen_at).toISOString() : null,
              created_at: new Date(closureRows[0][0].created_at).toISOString()
            }
          : null
      };
    } finally {
      connection.release();
    }
  });

  app.get('/v1/barista/workstation/access-state', { preHandler: authenticateAdminRequest }, async (request) => {
    assertStaffAccess(request);
    const storeId = await resolveAttendanceStoreId(request);
    const connection = await mysqlPool.getConnection();
    try {
      const access = await resolveBaristaShiftAccess(connection, {
        tenantId: request.adminAuth.tenantId,
        tenantCode: request.adminAuth.tenantCode,
        storeId
      });
      const soundSettings = await loadBaristaSoundSettings(
        connection,
        request.adminAuth.tenantId,
        storeId
      );
      return { ...access, sound_settings: soundSettings };
    } finally {
      connection.release();
    }
  });

  app.post('/v1/barista/attendance/clock-in', {
    preHandler: authenticateAdminRequest,
    config: { rateLimit: { max: 12, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    assertStaffAccess(request);
    const payload = attendanceActionSchema.parse(request.body);
    const storeId = await resolveAttendanceStoreId(request);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [baristas] = await connection.query<RowDataPacket[]>(
        `SELECT id, name, pin_hash FROM baristas WHERE id = :baristaId AND tenant_code = :tenantCode AND is_active = 1 LIMIT 1 FOR UPDATE`,
        { baristaId: payload.barista_id, tenantCode: request.adminAuth.tenantCode }
      );
      const barista = baristas[0];
      if (!barista || !barista.pin_hash || !(await verifyPassword(payload.pin, barista.pin_hash))) {
        throw new ApiError(401, 'invalid_barista_pin', 'The selected barista or PIN is not valid.');
      }
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id, clocked_in_at FROM barista_attendance WHERE tenant_id = :tenantId AND barista_id = :baristaId
         AND (store_id = :storeId OR store_id IS NULL)
         AND clocked_out_at IS NULL ORDER BY clocked_in_at DESC FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId, baristaId: payload.barista_id, storeId }
      );
      if (existing.length > 0) {
        const access = await resolveBaristaShiftAccess(connection, {
          tenantId: request.adminAuth.tenantId,
          tenantCode: request.adminAuth.tenantCode,
          storeId
        });
        const stillActiveToday = access.active_attendance.find((item) => item.barista_id === payload.barista_id);
        if (stillActiveToday) {
          await connection.commit();
          return reply.send({
            attendance: { id: stillActiveToday.id, clocked_in_at: stillActiveToday.clocked_in_at, clocked_out_at: null },
            unchanged: true
          });
        }
        await connection.execute(
          `UPDATE barista_attendance
           SET clocked_out_at = UTC_TIMESTAMP()
           WHERE tenant_id = :tenantId AND barista_id = :baristaId
             AND (store_id = :storeId OR store_id IS NULL)
             AND clocked_out_at IS NULL`,
          { tenantId: request.adminAuth.tenantId, baristaId: payload.barista_id, storeId }
        );
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO barista_attendance (tenant_id, store_id, barista_id, recorded_by_admin_user_id, clocked_in_at)
         VALUES (:tenantId, :storeId, :baristaId, :adminUserId, UTC_TIMESTAMP())`,
        { tenantId: request.adminAuth.tenantId, storeId, baristaId: payload.barista_id, adminUserId: request.adminAuth.adminUserId }
      );
      const [rows] = await connection.query<RowDataPacket[]>('SELECT id, clocked_in_at, clocked_out_at FROM barista_attendance WHERE id = ?', [result.insertId]);
      await connection.commit();
      return reply.code(201).send({ attendance: { id: Number(rows[0].id), clocked_in_at: rows[0].clocked_in_at, clocked_out_at: null } });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/barista/attendance/clock-out', {
    preHandler: authenticateAdminRequest,
    config: { rateLimit: { max: 12, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    assertStaffAccess(request);
    const payload = attendanceActionSchema.parse(request.body);
    const storeId = await resolveAttendanceStoreId(request);
    const [baristas] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT pin_hash FROM baristas WHERE id = :baristaId AND tenant_code = :tenantCode LIMIT 1`,
      { baristaId: payload.barista_id, tenantCode: request.adminAuth.tenantCode }
    );
    if (!baristas[0]?.pin_hash || !(await verifyPassword(payload.pin, baristas[0].pin_hash))) {
      throw new ApiError(401, 'invalid_barista_pin', 'The selected barista or PIN is not valid.');
    }
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [activeRows] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM barista_attendance
         WHERE tenant_id = :tenantId AND store_id = :storeId AND barista_id = :baristaId
           AND clocked_out_at IS NULL
         LIMIT 1 FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId, storeId, baristaId: payload.barista_id }
      );
      if (!activeRows[0]) {
        await connection.commit();
        return reply.send({ success: true, unchanged: true });
      }

      const [activeOrders, access] = await Promise.all([
        connection.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS total FROM orders
           WHERE store_id = :storeId AND status IN ('paid', 'accepted', 'preparing', 'ready_for_pickup')`,
          { storeId }
        ),
        resolveBaristaShiftAccess(connection, {
          tenantId: request.adminAuth.tenantId,
          tenantCode: request.adminAuth.tenantCode,
          storeId
        })
      ]);
      const otherActiveIds = new Set<number>(
        access.active_attendance
          .filter((item) => item.barista_id !== payload.barista_id)
          .map((item) => item.barista_id)
      );
      const incomingRequired = access.current_staff.some(
        (staff) => staff.barista_id !== payload.barista_id && !otherActiveIds.has(staff.barista_id)
      );
      if (incomingRequired) {
        throw new ApiError(409, 'handover_required', 'The incoming scheduled barista must clock in before this shift can clock out.');
      }
      const currentShiftStillActive = access.current_staff.some(
        (staff) => staff.barista_id === payload.barista_id
      );
      if (otherActiveIds.size === 0 && currentShiftStillActive) {
        throw new ApiError(409, 'shift_coverage_required', 'The final scheduled barista must remain clocked in until the shift ends or another scheduled barista takes over.');
      }
      if (otherActiveIds.size === 0 && Number(activeOrders[0][0]?.total ?? 0) > 0) {
        throw new ApiError(409, 'active_orders_require_coverage', 'The final barista cannot clock out while active orders still need outlet coverage.');
      }

      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE barista_attendance SET clocked_out_at = UTC_TIMESTAMP()
         WHERE id = :attendanceId AND clocked_out_at IS NULL`,
        { attendanceId: activeRows[0].id }
      );
      await connection.commit();
      return reply.send({ success: true, unchanged: result.affectedRows === 0 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/barista/outlet/emergency-close', {
    preHandler: authenticateAdminRequest,
    config: { rateLimit: { max: 4, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    assertStaffAccess(request);
    const payload = emergencyActionSchema.parse(request.body);
    const storeId = await resolveAttendanceStoreId(request);
    const connection = await mysqlPool.getConnection();
    const pushMessages: Array<{ userId: number; title: string; body: string; type: string }> = [];
    const cancelledUserIds = new Set<number>();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id, cancelled_order_count, expected_reopen_at
           FROM outlet_emergency_closures
          WHERE tenant_id = :tenantId AND idempotency_key = :idempotencyKey
          LIMIT 1 FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId, idempotencyKey: payload.idempotency_key }
      );
      if (existing[0]) {
        await connection.commit();
        return reply.send({ closure: { id: Number(existing[0].id), status: 'active', expected_reopen_at: existing[0].expected_reopen_at }, cancelled_order_count: Number(existing[0].cancelled_order_count), unchanged: true });
      }

      const [baristas] = await connection.query<RowDataPacket[]>(
        `SELECT b.id, b.pin_hash
           FROM baristas b
           JOIN barista_attendance a ON a.barista_id = b.id
          WHERE b.id = :baristaId AND b.tenant_code = :tenantCode
            AND a.tenant_id = :tenantId AND a.store_id = :storeId
            AND a.clocked_out_at IS NULL
          LIMIT 1 FOR UPDATE`,
        { baristaId: payload.barista_id, tenantCode: request.adminAuth.tenantCode, tenantId: request.adminAuth.tenantId, storeId }
      );
      const barista = baristas[0];
      if (!barista?.pin_hash || !(await verifyPassword(payload.pin, barista.pin_hash))) {
        throw new ApiError(401, 'invalid_barista_pin', 'The selected barista or PIN is not valid.');
      }

      const [stores] = await connection.query<RowDataPacket[]>(
        `SELECT id, temporarily_closed FROM stores
          WHERE id = :storeId AND tenant_id = :tenantId LIMIT 1 FOR UPDATE`,
        { storeId, tenantId: request.adminAuth.tenantId }
      );
      if (!stores[0]) throw new ApiError(404, 'store_not_found', 'The outlet was not found.');
      const [activeClosure] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM outlet_emergency_closures
          WHERE tenant_id = :tenantId AND store_id = :storeId AND status = 'active'
          ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId, storeId }
      );
      if (activeClosure[0]) throw new ApiError(409, 'emergency_closure_active', 'This outlet is already temporarily closed.');

      const [orders] = await connection.query<RowDataPacket[]>(
        `SELECT o.id, o.order_ref, o.user_id, o.status, o.payment_mode,
                o.token_amount_charged, o.final_total_rm,
                p.id AS payment_id
           FROM orders o
           LEFT JOIN payments p ON p.id = (
             SELECT p2.id FROM payments p2 WHERE p2.order_id = o.id ORDER BY p2.id DESC LIMIT 1
           )
          WHERE o.store_id = :storeId
            AND o.status IN ('pending_payment', 'payment_failed', 'paid', 'accepted', 'preparing', 'ready_for_pickup')
          ORDER BY o.id FOR UPDATE`,
        { storeId }
      );
      const blockingOrders = orders.filter((order) => ['preparing', 'ready_for_pickup'].includes(String(order.status)));
      if (blockingOrders.length > 0) {
        throw new ApiError(409, 'emergency_active_orders_block', 'Complete all preparing and ready-for-pickup orders before closing the outlet.');
      }

      let cancelledOrderCount = 0;
      for (const order of orders) {
        cancelledUserIds.add(Number(order.user_id));
        const reason = 'Outlet emergency closure before preparation';
        if (['pending_payment', 'payment_failed'].includes(String(order.status))) {
          await connection.execute(
            `UPDATE orders SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
              WHERE id = :orderId AND status IN ('pending_payment', 'payment_failed')`,
            { orderId: order.id }
          );
          await connection.execute(
            `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at)
             VALUES (:orderId, :fromStatus, 'cancelled', 'admin', :adminUserId, :reason, UTC_TIMESTAMP())`,
            { orderId: order.id, fromStatus: order.status, adminUserId: request.adminAuth.adminUserId, reason }
          );
          await releaseInventoryForOrder(connection, Number(order.id));
          await restoreGiftCardForRefund(connection, Number(order.id), Number(order.user_id), `Returned after emergency cancellation ${order.order_ref}`);
          await createUserNotification(connection, { userId: Number(order.user_id), type: 'order_cancelled_emergency', title: 'Order cancelled — outlet temporarily closed', body: 'Your order was cancelled before payment completed because this outlet temporarily closed for an emergency.' });
          pushMessages.push({ userId: Number(order.user_id), type: 'order_cancelled_emergency', title: 'Order cancelled', body: 'This outlet temporarily closed for an emergency. Your unpaid order was cancelled.' });
          cancelledOrderCount += 1;
          continue;
        }

        await connection.execute(
          `INSERT INTO order_cancellation_requests (order_id, user_id, status, reason, requested_at, reviewed_at, reviewed_by_admin_user_id, review_reason, created_at, updated_at)
           VALUES (:orderId, :userId, :status, :reason, UTC_TIMESTAMP(), UTC_TIMESTAMP(), :adminUserId, :reviewReason, UTC_TIMESTAMP(), UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE status = VALUES(status), reviewed_at = VALUES(reviewed_at), reviewed_by_admin_user_id = VALUES(reviewed_by_admin_user_id), review_reason = VALUES(review_reason), updated_at = UTC_TIMESTAMP()`,
          { orderId: order.id, userId: order.user_id, status: order.payment_mode === 'direct' ? 'refund_pending' : 'completed', reason, adminUserId: request.adminAuth.adminUserId, reviewReason: reason }
        );

        if (order.payment_mode === 'direct') {
          const [existingRefunds] = await connection.query<RowDataPacket[]>(
            `SELECT id FROM refunds WHERE order_id = :orderId AND status IN ('pending', 'approved', 'completed') LIMIT 1 FOR UPDATE`,
            { orderId: order.id }
          );
          if (!existingRefunds[0]) {
            const refundRef = `RFD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 6).toUpperCase()}`;
            await connection.execute(
              `INSERT INTO refunds (order_id, payment_id, payment_mode, refund_ref, refund_amount_rm, refund_token_amount, status, reason, created_by_admin_id, created_at)
               VALUES (:orderId, :paymentId, 'direct', :refundRef, :amountRm, NULL, 'pending', :reason, :adminUserId, UTC_TIMESTAMP())`,
              { orderId: order.id, paymentId: order.payment_id, refundRef, amountRm: order.final_total_rm, reason, adminUserId: request.adminAuth.adminUserId }
            );
          }
          await createUserNotification(connection, { userId: Number(order.user_id), type: 'order_cancellation_approved', title: 'Order cancelled; refund pending', body: 'This outlet temporarily closed for an emergency. Your payment refund is now being processed.' });
          pushMessages.push({ userId: Number(order.user_id), type: 'order_cancellation_approved', title: 'Order cancelled; refund pending', body: 'This outlet temporarily closed for an emergency. Your refund is being processed.' });
          cancelledOrderCount += 1;
          continue;
        }

        const allowanceRefund = await restoreEmployeeAllowanceForRefund(connection, Number(order.id));
        const tokenAmount = calculatePersonalTokenRefund(Number(order.token_amount_charged), allowanceRefund.allowanceUsed);
        const [existingRefunds] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM refunds WHERE order_id = :orderId AND status IN ('pending', 'approved', 'completed') LIMIT 1 FOR UPDATE`,
          { orderId: order.id }
        );
        if (!existingRefunds[0]) {
          const [accounts] = await connection.query<RowDataPacket[]>(
            `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
            { userId: order.user_id }
          );
          if (!accounts[0]) throw new ApiError(409, 'token_account_not_found', 'The customer token account was not found.');
          const balanceAfter = Number(accounts[0].balance_available) + tokenAmount;
          if (tokenAmount > 0) {
            await connection.execute(`UPDATE token_accounts SET balance_available = :balanceAfter, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`, { balanceAfter, userId: order.user_id });
          }
          const refundRef = `RFD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 6).toUpperCase()}`;
          const replacementVoucherIssued = await issueRefundReplacementVoucher(connection, { orderId: Number(order.id), userId: Number(order.user_id), issueCaseRef: `refund:${refundRef}`, reason: `Replacement voucher for emergency-cancelled order ${order.order_ref}` });
          if (tokenAmount > 0) {
            await connection.execute(
              `INSERT INTO token_ledger (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
               VALUES (:userId, NULL, 'credit', 'refund_return', :orderId, :amount, :balanceAfter, :remarks, UTC_TIMESTAMP())`,
              { userId: order.user_id, orderId: order.id, amount: tokenAmount, balanceAfter, remarks: `Emergency cancellation for order ${order.order_ref}` }
            );
          }
          await connection.execute(
            `INSERT INTO refunds (order_id, payment_id, payment_mode, refund_ref, refund_amount_rm, refund_token_amount, status, reason, created_by_admin_id, created_at, completed_at)
             VALUES (:orderId, :paymentId, 'token', :refundRef, :amountRm, :tokenAmount, 'completed', :reason, :adminUserId, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
            { orderId: order.id, paymentId: order.payment_id, refundRef, amountRm: order.final_total_rm, tokenAmount, reason, adminUserId: request.adminAuth.adminUserId }
          );
          await releaseInventoryForOrder(connection, Number(order.id));
          await restoreGiftCardForRefund(connection, Number(order.id), Number(order.user_id), `Returned after emergency cancellation ${order.order_ref}`);
          await connection.execute(`UPDATE orders SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = :orderId AND status IN ('paid', 'accepted')`, { orderId: order.id });
          await connection.execute(
            `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at)
             VALUES (:orderId, :fromStatus, 'cancelled', 'admin', :adminUserId, :reason, UTC_TIMESTAMP())`,
            { orderId: order.id, fromStatus: order.status, adminUserId: request.adminAuth.adminUserId, reason }
          );
          await createUserNotification(connection, { userId: Number(order.user_id), type: 'order_cancelled', title: 'Order cancelled and tokens returned', body: replacementVoucherIssued ? `${tokenAmount} tokens were returned and an equivalent voucher was restored.` : `${tokenAmount} tokens were returned to your C2 Coffee account.` });
          pushMessages.push({ userId: Number(order.user_id), type: 'order_cancelled', title: 'Order cancelled and refunded', body: `${tokenAmount} tokens were returned because this outlet temporarily closed for an emergency.` });
        }
        cancelledOrderCount += 1;
      }

      const expectedReopenAt = await nextPublishedShift(connection, request.adminAuth.tenantCode, storeId);
      await connection.execute(`UPDATE stores SET temporarily_closed = 1, updated_at = UTC_TIMESTAMP() WHERE id = :storeId`, { storeId });
      const [closureResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO outlet_emergency_closures
          (tenant_id, store_id, barista_id, initiated_by_admin_user_id, idempotency_key, reason_code, note, expected_reopen_at, cancelled_order_count, created_at)
         VALUES (:tenantId, :storeId, :baristaId, :adminUserId, :idempotencyKey, :reasonCode, :note, :expectedReopenAt, :cancelledOrderCount, UTC_TIMESTAMP())`,
        { tenantId: request.adminAuth.tenantId, storeId, baristaId: payload.barista_id, adminUserId: request.adminAuth.adminUserId, idempotencyKey: payload.idempotency_key, reasonCode: payload.reason_code, note: payload.note || null, expectedReopenAt, cancelledOrderCount }
      );
      await connection.execute(
        `UPDATE barista_attendance SET clocked_out_at = UTC_TIMESTAMP()
          WHERE tenant_id = :tenantId AND store_id = :storeId AND barista_id = :baristaId AND clocked_out_at IS NULL`,
        { tenantId: request.adminAuth.tenantId, storeId, baristaId: payload.barista_id }
      );
      await connection.execute(
        `INSERT INTO admin_audit_logs (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent, created_at)
         VALUES (:adminUserId, :roles, 'outlet_emergency_closed', 'store', :storeId, :afterJson, :ipAddress, :userAgent, UTC_TIMESTAMP())`,
        { adminUserId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), storeId, afterJson: JSON.stringify({ closure_id: Number(closureResult.insertId), barista_id: payload.barista_id, reason_code: payload.reason_code, expected_reopen_at: expectedReopenAt, cancelled_order_count: cancelledOrderCount }), ipAddress: request.ip, userAgent: request.headers['user-agent'] ?? null }
      );

      const customerMessage = emergencyCustomerMessage(expectedReopenAt, expectedReopenAt ? malaysiaDate(expectedReopenAt) === malaysiaDate() : false);
      const [linkedUsers] = await connection.query<RowDataPacket[]>(
        `SELECT DISTINCT o.user_id FROM orders o JOIN users u ON u.id = o.user_id
          WHERE o.store_id = :storeId AND u.status = 'active'`,
        { storeId }
      );
      for (const user of linkedUsers) {
        if (cancelledUserIds.has(Number(user.user_id))) continue;
        await createUserNotification(connection, { userId: Number(user.user_id), type: 'outlet_emergency_closed', title: 'Outlet temporarily closed', body: customerMessage, data: { store_id: storeId, closure_id: Number(closureResult.insertId), destination: 'home' }, deliveryKey: `outlet-emergency-${closureResult.insertId}-${user.user_id}` });
        pushMessages.push({ userId: Number(user.user_id), type: 'outlet_emergency_closed', title: 'Outlet temporarily closed', body: customerMessage });
      }
      await connection.commit();

      for (const push of pushMessages) {
        try {
          await deliverPushToUser({ userId: push.userId, title: push.title, body: push.body, data: { type: push.type, store_id: String(storeId) } });
        } catch (error) {
          request.log.warn({ err: error, userId: push.userId, storeId }, 'Emergency closure push delivery failed.');
        }
      }
      return reply.send({ closure: { id: Number(closureResult.insertId), status: 'active', expected_reopen_at: expectedReopenAt?.toISOString() ?? null, message: customerMessage }, cancelled_order_count: cancelledOrderCount, barista_clocked_out: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/barista/outlet/emergency-reopen', {
    preHandler: authenticateAdminRequest,
    config: { rateLimit: { max: 6, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    assertStaffAccess(request);
    const payload = attendanceActionSchema.parse(request.body);
    const storeId = await resolveAttendanceStoreId(request);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [baristas] = await connection.query<RowDataPacket[]>(
        `SELECT id, pin_hash FROM baristas
          WHERE id = :baristaId AND tenant_code = :tenantCode AND is_active = 1
          LIMIT 1 FOR UPDATE`,
        { baristaId: payload.barista_id, tenantCode: request.adminAuth.tenantCode }
      );
      const barista = baristas[0];
      if (!barista?.pin_hash || !(await verifyPassword(payload.pin, barista.pin_hash))) {
        throw new ApiError(401, 'invalid_barista_pin', 'The selected barista or PIN is not valid.');
      }
      const [closures] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM outlet_emergency_closures
          WHERE tenant_id = :tenantId AND store_id = :storeId AND status = 'active'
          ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId, storeId }
      );
      if (!closures[0]) {
        await connection.commit();
        return reply.send({ reopened: true, unchanged: true });
      }
      const [scheduled] = await connection.query<RowDataPacket[]>(
        `SELECT s.id FROM barista_dated_shifts s
          WHERE s.tenant_code = :tenantCode AND s.barista_id = :baristaId
            AND (s.store_id = :storeId OR s.store_id IS NULL)
            AND (
              (s.ends_at > s.starts_at AND CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00') BETWEEN TIMESTAMP(s.shift_date, s.starts_at) AND TIMESTAMP(s.shift_date, s.ends_at))
              OR
              (s.ends_at < s.starts_at AND CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00') BETWEEN TIMESTAMP(s.shift_date, s.starts_at) AND DATE_ADD(TIMESTAMP(s.shift_date, s.ends_at), INTERVAL 1 DAY))
            )
          LIMIT 1`,
        { tenantCode: request.adminAuth.tenantCode, baristaId: payload.barista_id, storeId }
      );
      if (!scheduled[0] && request.adminAuth.isBaristaOnly) {
        throw new ApiError(409, 'barista_not_scheduled', 'Only a barista scheduled for the current shift can reopen this outlet.');
      }
      await connection.execute(
        `UPDATE outlet_emergency_closures
            SET status = 'reopened', reopened_at = UTC_TIMESTAMP(),
                reopened_by_barista_id = :baristaId,
                reopened_by_admin_user_id = :adminUserId
          WHERE id = :closureId AND status = 'active'`,
        { closureId: closures[0].id, baristaId: payload.barista_id, adminUserId: request.adminAuth.adminUserId }
      );
      await connection.execute(`UPDATE stores SET temporarily_closed = 0, updated_at = UTC_TIMESTAMP() WHERE id = :storeId`, { storeId });
      await connection.execute(
        `INSERT INTO barista_attendance (tenant_id, store_id, barista_id, recorded_by_admin_user_id, clocked_in_at)
         SELECT :tenantId, :storeId, :baristaId, :adminUserId, UTC_TIMESTAMP()
          WHERE NOT EXISTS (
            SELECT 1 FROM barista_attendance
             WHERE tenant_id = :tenantId AND store_id = :storeId AND barista_id = :baristaId AND clocked_out_at IS NULL
          )`,
        { tenantId: request.adminAuth.tenantId, storeId, baristaId: payload.barista_id, adminUserId: request.adminAuth.adminUserId }
      );
      await connection.execute(
        `INSERT INTO admin_audit_logs (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent, created_at)
         VALUES (:adminUserId, :roles, 'outlet_emergency_reopened', 'store', :storeId, :afterJson, :ipAddress, :userAgent, UTC_TIMESTAMP())`,
        { adminUserId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), storeId, afterJson: JSON.stringify({ closure_id: Number(closures[0].id), barista_id: payload.barista_id }), ipAddress: request.ip, userAgent: request.headers['user-agent'] ?? null }
      );
      await connection.commit();
      return reply.send({ reopened: true, barista_clocked_in: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/barista-guides', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT g.*, mi.name AS menu_item_name FROM barista_sop_guides g
       LEFT JOIN menu_items mi ON mi.id = g.menu_item_id
       WHERE g.tenant_id = :tenantId ORDER BY g.guide_type, mi.name, g.sort_order, g.id`,
      { tenantId: request.adminAuth.tenantId }
    );
    return { guides: rows.map(guideResponse) };
  });

  app.get('/v1/barista/guides', { preHandler: authenticateAdminRequest }, async (request) => {
    assertStaffAccess(request);
    const query = z.object({ menu_item_id: z.coerce.number().int().positive().optional() }).parse(request.query);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT g.*, mi.name AS menu_item_name FROM barista_sop_guides g
       LEFT JOIN menu_items mi ON mi.id = g.menu_item_id
       WHERE g.tenant_id = :tenantId AND g.is_active = 1
         AND (:menuItemId IS NULL OR g.menu_item_id = :menuItemId)
       ORDER BY g.guide_type, g.sort_order, g.id`,
      { tenantId: request.adminAuth.tenantId, menuItemId: query.menu_item_id ?? null }
    );
    return { guides: rows.map(guideResponse) };
  });

  app.post('/v1/admin/barista-guides/uploads', { preHandler: authenticateAdminRequest, bodyLimit: 10 * 1024 * 1024 }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const payload = imageUploadSchema.parse(request.body);
    const raw = Buffer.from(payload.data_url.includes('base64,') ? payload.data_url.split('base64,').pop() || '' : payload.data_url, 'base64');
    if (!raw.length || raw.length > 8 * 1024 * 1024) throw new ApiError(400, 'invalid_upload', 'Guide images must be between 1 byte and 8 MB.');
    let content: Buffer;
    try { content = await sharp(raw, { limitInputPixels: 32_000_000 }).rotate().resize({ width: 1600, height: 2200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84, effort: 4 }).toBuffer(); }
    catch { throw new ApiError(400, 'invalid_upload', 'Please upload a valid PNG, JPEG, or WebP image.'); }
    const assetPath = `/assets/barista-guides/${Date.now()}-${randomUUID()}.webp`;
    await saveMediaAsset({ assetPath, fileName: 'staff-guide.webp', mimeType: 'image/webp', content });
    return { image_url: assetPath };
  });

  app.post('/v1/admin/barista-guides', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const payload = guideSchema.parse(request.body);
    if (payload.menu_item_id) {
      const [menuRows] = await mysqlPool.query<RowDataPacket[]>(`SELECT id FROM menu_items WHERE id = :menuItemId LIMIT 1`, { menuItemId: payload.menu_item_id });
      if (!menuRows.length) throw new ApiError(404, 'menu_item_not_found', 'The selected menu item was not found.');
    }
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO barista_sop_guides (tenant_id, guide_type, menu_item_id, guide_title, image_url, sort_order, is_active, created_by_admin_user_id)
       VALUES (:tenantId, :guideType, :menuItemId, :guideTitle, :imageUrl, :sortOrder, :isActive, :adminUserId)`,
      { tenantId: request.adminAuth.tenantId, guideType: payload.guide_type, menuItemId: payload.menu_item_id ?? null, guideTitle: payload.guide_title ?? null, imageUrl: payload.image_url, sortOrder: payload.sort_order, isActive: payload.is_active ? 1 : 0, adminUserId: request.adminAuth.adminUserId }
    );
    return reply.code(201).send({ id: result.insertId });
  });

  app.delete('/v1/admin/barista-guides/:guideId', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const guideId = z.coerce.number().int().positive().parse((request.params as { guideId: string }).guideId);
    const [result] = await mysqlPool.execute<ResultSetHeader>('DELETE FROM barista_sop_guides WHERE id = :guideId AND tenant_id = :tenantId', { guideId, tenantId: request.adminAuth.tenantId });
    if (!result.affectedRows) throw new ApiError(404, 'guide_not_found', 'The guide was not found.');
    return reply.code(204).send();
  });

  app.get('/v1/barista/marketing-drinks/catalog', { preHandler: authenticateAdminRequest }, async (request) => {
    assertStaffAccess(request);
    const storeId = await resolveAttendanceStoreId(request);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT item.id, item.name, item.image_url, item.base_price_rm
         FROM menu_items item
         JOIN menu_categories category ON category.id = item.category_id
         JOIN menu_item_tenants tenant_item
           ON tenant_item.menu_item_id = item.id AND tenant_item.tenant_id = :tenantId
         LEFT JOIN menu_item_store_availability availability
           ON availability.menu_item_id = item.id AND availability.store_id = :storeId
        WHERE item.is_active = 1 AND category.is_active = 1
          AND category.product_kind_code = 'drink'
          AND COALESCE(availability.is_available, 1) = 1
        ORDER BY category.sort_order, item.sort_order, item.name`,
      { tenantId: request.adminAuth.tenantId, storeId }
    );
    return { drinks: rows.map((row) => ({ id: Number(row.id), name: row.name, image_url: row.image_url, base_price_rm: Number(row.base_price_rm) })) };
  });

  app.get('/v1/barista/marketing-drinks', { preHandler: authenticateAdminRequest }, async (request) => {
    assertStaffAccess(request);
    const storeId = await resolveAttendanceStoreId(request);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT mdu.id, mdu.usage_ref, mdu.purpose_code, mdu.campaign_name,
              mdu.reason_note, mdu.status, mdu.posted_at, barista.name AS barista_name,
              item.menu_item_id, item.menu_item_name_snapshot, item.quantity
         FROM marketing_drink_usages mdu
         JOIN baristas barista ON barista.id = mdu.barista_id
         JOIN marketing_drink_usage_items item ON item.usage_id = mdu.id
        WHERE mdu.tenant_id = :tenantId AND mdu.store_id = :storeId
          AND DATE(CONVERT_TZ(mdu.posted_at, '+00:00', '+08:00')) = :today
        ORDER BY mdu.posted_at DESC, mdu.id DESC, item.id`,
      { tenantId: request.adminAuth.tenantId, storeId, today: malaysiaDate() }
    );
    const usages = new Map<number, Record<string, unknown>>();
    for (const row of rows) {
      const id = Number(row.id);
      const usage = usages.get(id) ?? {
        id, usage_ref: row.usage_ref, purpose_code: row.purpose_code,
        campaign_name: row.campaign_name, reason_note: row.reason_note,
        status: row.status, posted_at: new Date(row.posted_at).toISOString(),
        barista_name: row.barista_name, items: []
      };
      (usage.items as Array<Record<string, unknown>>).push({
        menu_item_id: Number(row.menu_item_id), name: row.menu_item_name_snapshot, quantity: Number(row.quantity)
      });
      usages.set(id, usage);
    }
    return { usages: [...usages.values()] };
  });

  app.post('/v1/barista/marketing-drinks', {
    preHandler: authenticateAdminRequest,
    config: { rateLimit: { max: 20, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    assertStaffAccess(request);
    const payload = marketingDrinkUsageSchema.parse(request.body);
    const storeId = await resolveAttendanceStoreId(request);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id, usage_ref FROM marketing_drink_usages
          WHERE tenant_id = :tenantId AND idempotency_key = :idempotencyKey LIMIT 1 FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId, idempotencyKey: payload.idempotency_key }
      );
      if (existing[0]) {
        await connection.commit();
        return reply.send({ id: Number(existing[0].id), usage_ref: existing[0].usage_ref, unchanged: true });
      }
      const [baristas] = await connection.query<RowDataPacket[]>(
        `SELECT b.id, b.name, b.pin_hash
           FROM baristas b
           JOIN barista_attendance attendance ON attendance.barista_id = b.id
          WHERE b.id = :baristaId AND b.tenant_code = :tenantCode AND b.is_active = 1
            AND attendance.tenant_id = :tenantId AND attendance.store_id = :storeId
            AND attendance.clocked_out_at IS NULL
          LIMIT 1 FOR UPDATE`,
        { baristaId: payload.barista_id, tenantCode: request.adminAuth.tenantCode, tenantId: request.adminAuth.tenantId, storeId }
      );
      const barista = baristas[0];
      if (!barista?.pin_hash || !(await verifyPassword(payload.pin, barista.pin_hash))) {
        throw new ApiError(401, 'invalid_barista_pin', 'The selected barista or PIN is not valid.');
      }
      const itemIds = payload.items.map((item) => item.menu_item_id);
      const itemPlaceholders = itemIds.map(() => '?').join(',');
      const [menuItems] = await connection.query<RowDataPacket[]>(
        `SELECT item.id, item.name, item.base_price_rm
           FROM menu_items item
           JOIN menu_categories category ON category.id = item.category_id
           JOIN menu_item_tenants tenant_item ON tenant_item.menu_item_id = item.id AND tenant_item.tenant_id = ?
           LEFT JOIN menu_item_store_availability availability ON availability.menu_item_id = item.id AND availability.store_id = ?
          WHERE item.id IN (${itemPlaceholders}) AND item.is_active = 1 AND category.is_active = 1
            AND category.product_kind_code = 'drink' AND COALESCE(availability.is_available, 1) = 1
          FOR UPDATE`,
        [request.adminAuth.tenantId, storeId, ...itemIds]
      );
      if (menuItems.length !== itemIds.length) throw new ApiError(409, 'marketing_drink_unavailable', 'One or more selected drinks are no longer available at this outlet.');
      const usageRef = `MKT-${malaysiaDate().replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO marketing_drink_usages
           (usage_ref, tenant_id, store_id, barista_id, recorded_by_admin_user_id,
            idempotency_key, purpose_code, campaign_name, reason_note, posted_at)
         VALUES (:usageRef, :tenantId, :storeId, :baristaId, :adminUserId,
                 :idempotencyKey, :purposeCode, :campaignName, :reasonNote, UTC_TIMESTAMP())`,
        { usageRef, tenantId: request.adminAuth.tenantId, storeId, baristaId: payload.barista_id,
          adminUserId: request.adminAuth.adminUserId, idempotencyKey: payload.idempotency_key,
          purposeCode: payload.purpose_code, campaignName: payload.campaign_name || null, reasonNote: payload.reason_note }
      );
      const usageId = Number(result.insertId);
      const menuById = new Map(menuItems.map((row) => [Number(row.id), row]));
      for (const item of payload.items) {
        const menu = menuById.get(item.menu_item_id)!;
        await connection.execute(
          `INSERT INTO marketing_drink_usage_items
             (usage_id, menu_item_id, menu_item_name_snapshot, quantity, unit_price_rm_snapshot)
           VALUES (:usageId, :menuItemId, :name, :quantity, :price)`,
          { usageId, menuItemId: item.menu_item_id, name: menu.name, quantity: item.quantity, price: menu.base_price_rm }
        );
      }
      await consumeMarketingDrinkInventory(connection, {
        tenantId: request.adminAuth.tenantId, storeId, usageId,
        selections: payload.items.map((item) => ({ menuItemId: item.menu_item_id, quantity: item.quantity })),
        adminUserId: request.adminAuth.adminUserId
      });
      await connection.execute(
        `INSERT INTO admin_audit_logs
           (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent, created_at)
         VALUES (:adminUserId, :roles, 'marketing_drink_recorded', 'marketing_drink_usage', :usageId,
                 :afterJson, :ipAddress, :userAgent, UTC_TIMESTAMP())`,
        { adminUserId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), usageId,
          afterJson: JSON.stringify({ usage_ref: usageRef, store_id: storeId, barista_id: payload.barista_id, purpose_code: payload.purpose_code, items: payload.items }),
          ipAddress: request.ip, userAgent: request.headers['user-agent'] ?? null }
      );
      await connection.commit();
      return reply.code(201).send({
        id: usageId, usage_ref: usageRef, purpose_code: payload.purpose_code,
        campaign_name: payload.campaign_name || null, reason_note: payload.reason_note,
        barista_name: barista.name, posted_at: new Date().toISOString(),
        items: payload.items.map((item) => ({ name: menuById.get(item.menu_item_id)!.name, quantity: item.quantity }))
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/marketing-drink-usages', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin', 'marketing_admin']);
    const query = marketingReportQuerySchema.parse(request.query);
    const from = query.from ?? `${malaysiaDate().slice(0, 8)}01`;
    const to = query.to ?? malaysiaDate();
    if (from > to || new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime() > 366 * 86400000) {
      throw new ApiError(400, 'invalid_report_range', 'Choose a report range of up to 366 days.');
    }
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT mdu.id, mdu.usage_ref, mdu.store_id, store.name AS store_name,
              mdu.purpose_code, mdu.campaign_name, mdu.reason_note, mdu.status,
              mdu.posted_at, mdu.reversed_at, barista.name AS barista_name,
              item.menu_item_name_snapshot, item.quantity,
              COALESCE(inventory.total_cost_rm, 0) AS inventory_cost_rm
         FROM marketing_drink_usages mdu
         JOIN stores store ON store.id = mdu.store_id
         JOIN baristas barista ON barista.id = mdu.barista_id
         JOIN marketing_drink_usage_items item ON item.usage_id = mdu.id
         LEFT JOIN (
           SELECT usage_id, SUM(total_cost_rm) AS total_cost_rm
             FROM marketing_drink_inventory_lines GROUP BY usage_id
         ) inventory ON inventory.usage_id = mdu.id
        WHERE mdu.tenant_id = :tenantId
          AND DATE(CONVERT_TZ(mdu.posted_at, '+00:00', '+08:00')) BETWEEN :fromDate AND :toDate
          AND (:storeId IS NULL OR mdu.store_id = :storeId)
          AND (:purposeCode IS NULL OR mdu.purpose_code = :purposeCode)
        ORDER BY mdu.posted_at DESC, mdu.id DESC, item.id`,
      { tenantId: request.adminAuth.tenantId, fromDate: from, toDate: to, storeId: query.store_id ?? null, purposeCode: query.purpose_code ?? null }
    );
    return { usages: rows };
  });

  app.post('/v1/admin/marketing-drink-usages/:usageId/reverse', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const usageId = z.coerce.number().int().positive().parse((request.params as { usageId: string }).usageId);
    const reason = z.object({ reason: z.string().trim().min(3).max(500) }).parse(request.body).reason;
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [usages] = await connection.query<RowDataPacket[]>(
        `SELECT id, status FROM marketing_drink_usages WHERE id = :usageId AND tenant_id = :tenantId LIMIT 1 FOR UPDATE`,
        { usageId, tenantId: request.adminAuth.tenantId }
      );
      if (!usages[0]) throw new ApiError(404, 'marketing_usage_not_found', 'The complimentary usage record was not found.');
      if (usages[0].status !== 'posted') throw new ApiError(409, 'marketing_usage_not_reversible', 'This usage has already been reversed.');
      await reverseMarketingDrinkInventory(connection, { tenantId: request.adminAuth.tenantId, usageId, adminUserId: request.adminAuth.adminUserId });
      await connection.execute(
        `UPDATE marketing_drink_usages SET status = 'reversed', reversed_at = UTC_TIMESTAMP(),
                reversed_by_admin_user_id = :adminUserId, reversal_reason = :reason
          WHERE id = :usageId`,
        { usageId, adminUserId: request.adminAuth.adminUserId, reason }
      );
      await connection.execute(
        `INSERT INTO admin_audit_logs
           (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent, created_at)
         VALUES (:adminUserId, :roles, 'marketing_drink_reversed', 'marketing_drink_usage', :usageId,
                 :afterJson, :ipAddress, :userAgent, UTC_TIMESTAMP())`,
        { adminUserId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), usageId,
          afterJson: JSON.stringify({ reason }), ipAddress: request.ip, userAgent: request.headers['user-agent'] ?? null }
      );
      await connection.commit();
      return reply.send({ reversed: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
