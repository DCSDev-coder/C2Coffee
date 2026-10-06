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

const guideTypeSchema = z.enum(['attire', 'rules', 'drink']);
const imageUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  data_url: z.string().trim().min(1)
});
const attendanceActionSchema = z.object({
  barista_id: z.coerce.number().int().positive(),
  pin: z.string().regex(/^\d{6}$/)
});

const sideWorkSchema = z.object({
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(500).nullable().optional(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
});

const sideWorkCompletionSchema = attendanceActionSchema.extend({
  task_id: z.coerce.number().int().positive()
});

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

function guideResponse(row: RowDataPacket) {
  return {
    id: Number(row.id), guide_type: row.guide_type, menu_item_id: row.menu_item_id == null ? null : Number(row.menu_item_id), guide_title: row.guide_title ?? null,
    image_url: row.image_url, sort_order: Number(row.sort_order), is_active: !!row.is_active,
    menu_item_name: row.menu_item_name ?? null, created_at: row.created_at, updated_at: row.updated_at
  };
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
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const parts = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT t.id, t.title, t.instructions, DATE_FORMAT(t.scheduled_date, '%Y-%m-%d') AS scheduled_date,
              TIME_FORMAT(t.scheduled_time, '%H:%i') AS scheduled_time,
              c.completed_at, c.barista_id AS completed_by_barista_id, b.name AS completed_by_barista_name
       FROM barista_side_work_tasks t
       LEFT JOIN barista_side_work_completions c ON c.task_id = t.id
       LEFT JOIN baristas b ON b.id = c.barista_id
       WHERE t.tenant_id = :tenantId AND t.scheduled_date = :today AND t.is_active = 1
       ORDER BY t.scheduled_time ASC, t.id ASC`,
      { tenantId: request.adminAuth.tenantId, today }
    );
    return { tasks: rows.map((row) => ({ ...row, id: Number(row.id) })) };
  });

  app.post('/v1/barista/side-work/complete', { preHandler: authenticateAdminRequest }, async (request, reply) => {
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
    const [baristas, attendance] = await Promise.all([
      mysqlPool.query<RowDataPacket[]>(
        `SELECT b.id, b.name, b.pin_hash IS NOT NULL AS pin_configured FROM baristas b
         WHERE b.tenant_code = :tenantCode AND (
           b.is_active = 1 OR EXISTS (
             SELECT 1 FROM barista_attendance a
             WHERE a.tenant_id = :tenantId AND a.barista_id = b.id AND a.clocked_out_at IS NULL
           )
         ) ORDER BY b.name ASC`,
        { tenantCode: request.adminAuth.tenantCode, tenantId: request.adminAuth.tenantId }
      ),
      mysqlPool.query<RowDataPacket[]>(
        `SELECT a.id, a.barista_id, b.name AS barista_name, a.clocked_in_at
         FROM barista_attendance a JOIN baristas b ON b.id = a.barista_id
         WHERE a.tenant_id = :tenantId AND a.clocked_out_at IS NULL AND a.barista_id IS NOT NULL
         ORDER BY a.clocked_in_at ASC`,
        { tenantId: request.adminAuth.tenantId }
      )
    ]);
    return {
      baristas: baristas[0].map((row) => ({ id: Number(row.id), name: row.name, pin_configured: !!row.pin_configured })),
      active_attendance: attendance[0].map((row) => ({ id: Number(row.id), barista_id: Number(row.barista_id), barista_name: row.barista_name, clocked_in_at: row.clocked_in_at }))
    };
  });

  app.post('/v1/barista/attendance/clock-in', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    assertStaffAccess(request);
    const payload = attendanceActionSchema.parse(request.body);
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
         AND clocked_out_at IS NULL ORDER BY clocked_in_at DESC LIMIT 1 FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId, baristaId: payload.barista_id }
      );
      if (existing[0]) {
        await connection.commit();
        return reply.send({ attendance: { id: Number(existing[0].id), clocked_in_at: existing[0].clocked_in_at, clocked_out_at: null }, unchanged: true });
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO barista_attendance (tenant_id, barista_id, recorded_by_admin_user_id, clocked_in_at) VALUES (:tenantId, :baristaId, :adminUserId, UTC_TIMESTAMP())`,
        { tenantId: request.adminAuth.tenantId, baristaId: payload.barista_id, adminUserId: request.adminAuth.adminUserId }
      );
      const [rows] = await connection.query<RowDataPacket[]>('SELECT id, clocked_in_at, clocked_out_at FROM barista_attendance WHERE id = ?', [result.insertId]);
      await connection.commit();
      return reply.code(201).send({ attendance: { id: Number(rows[0].id), clocked_in_at: rows[0].clocked_in_at, clocked_out_at: null } });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/barista/attendance/clock-out', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    assertStaffAccess(request);
    const payload = attendanceActionSchema.parse(request.body);
    const [baristas] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT pin_hash FROM baristas WHERE id = :baristaId AND tenant_code = :tenantCode LIMIT 1`,
      { baristaId: payload.barista_id, tenantCode: request.adminAuth.tenantCode }
    );
    if (!baristas[0]?.pin_hash || !(await verifyPassword(payload.pin, baristas[0].pin_hash))) {
      throw new ApiError(401, 'invalid_barista_pin', 'The selected barista or PIN is not valid.');
    }
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE barista_attendance SET clocked_out_at = UTC_TIMESTAMP()
       WHERE tenant_id = :tenantId AND barista_id = :baristaId AND clocked_out_at IS NULL`,
      { tenantId: request.adminAuth.tenantId, baristaId: payload.barista_id }
    );
    return reply.send({ success: true, unchanged: result.affectedRows === 0 });
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
}
