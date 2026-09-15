import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import sharp from 'sharp';
import { z } from 'zod';
import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { saveMediaAsset } from '../../lib/media-assets.js';

const guideTypeSchema = z.enum(['attire', 'rules', 'drink']);
const imageUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  data_url: z.string().trim().min(1)
});

const guideSchema = z.object({
  guide_type: guideTypeSchema,
  menu_item_id: z.coerce.number().int().positive().nullable().optional(),
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
    id: Number(row.id), guide_type: row.guide_type, menu_item_id: row.menu_item_id == null ? null : Number(row.menu_item_id),
    image_url: row.image_url, sort_order: Number(row.sort_order), is_active: !!row.is_active,
    menu_item_name: row.menu_item_name ?? null, created_at: row.created_at, updated_at: row.updated_at
  };
}

export async function registerBaristaStaffRoutes(app: FastifyInstance) {
  app.get('/v1/barista/attendance/current', { preHandler: authenticateAdminRequest }, async (request) => {
    assertStaffAccess(request);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, clocked_in_at, clocked_out_at FROM barista_attendance
       WHERE tenant_id = :tenantId AND admin_user_id = :adminUserId AND clocked_out_at IS NULL
       ORDER BY clocked_in_at DESC LIMIT 1`,
      { tenantId: request.adminAuth.tenantId, adminUserId: request.adminAuth.adminUserId }
    );
    return { attendance: rows[0] ? { id: Number(rows[0].id), clocked_in_at: rows[0].clocked_in_at, clocked_out_at: rows[0].clocked_out_at } : null };
  });

  app.post('/v1/barista/attendance/clock-in', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    assertStaffAccess(request);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id, clocked_in_at FROM barista_attendance WHERE tenant_id = :tenantId AND admin_user_id = :adminUserId
         AND clocked_out_at IS NULL ORDER BY clocked_in_at DESC LIMIT 1 FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId, adminUserId: request.adminAuth.adminUserId }
      );
      if (existing[0]) {
        await connection.commit();
        return reply.send({ attendance: { id: Number(existing[0].id), clocked_in_at: existing[0].clocked_in_at, clocked_out_at: null }, unchanged: true });
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO barista_attendance (tenant_id, admin_user_id, clocked_in_at) VALUES (:tenantId, :adminUserId, UTC_TIMESTAMP())`,
        { tenantId: request.adminAuth.tenantId, adminUserId: request.adminAuth.adminUserId }
      );
      const [rows] = await connection.query<RowDataPacket[]>('SELECT id, clocked_in_at, clocked_out_at FROM barista_attendance WHERE id = ?', [result.insertId]);
      await connection.commit();
      return reply.code(201).send({ attendance: { id: Number(rows[0].id), clocked_in_at: rows[0].clocked_in_at, clocked_out_at: null } });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/barista/attendance/clock-out', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    assertStaffAccess(request);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE barista_attendance SET clocked_out_at = UTC_TIMESTAMP()
       WHERE tenant_id = :tenantId AND admin_user_id = :adminUserId AND clocked_out_at IS NULL`,
      { tenantId: request.adminAuth.tenantId, adminUserId: request.adminAuth.adminUserId }
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
      `INSERT INTO barista_sop_guides (tenant_id, guide_type, menu_item_id, image_url, sort_order, is_active, created_by_admin_user_id)
       VALUES (:tenantId, :guideType, :menuItemId, :imageUrl, :sortOrder, :isActive, :adminUserId)`,
      { tenantId: request.adminAuth.tenantId, guideType: payload.guide_type, menuItemId: payload.menu_item_id ?? null, imageUrl: payload.image_url, sortOrder: payload.sort_order, isActive: payload.is_active ? 1 : 0, adminUserId: request.adminAuth.adminUserId }
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
