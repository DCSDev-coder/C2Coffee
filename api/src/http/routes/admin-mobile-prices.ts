import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { mobilePriceWindowsOverlap, weekdayMaskToDays } from '../../services/scheduled-mobile-pricing.js';

const id = z.coerce.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const scheduleSchema = z.object({
  name: z.string().trim().min(1).max(160), store_id: id, menu_item_id: id,
  days: z.array(z.coerce.number().int().min(1).max(7)).min(1).max(7),
  start_minute: z.coerce.number().int().min(0).max(1439),
  end_minute: z.coerce.number().int().min(0).max(1439),
  start_date: date.nullish(), end_date: date.nullish(),
  price_rm: z.coerce.number().min(0).max(1000000).refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001),
  price_tokens: z.coerce.number().int().min(0).max(1000000),
  is_active: z.boolean().default(false)
}).superRefine((value, ctx) => {
  if (value.start_minute === value.end_minute) ctx.addIssue({ code: 'custom', path: ['end_minute'], message: 'Start and end must differ.' });
  if (value.start_date && value.end_date && value.start_date > value.end_date) ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'End date must not precede start date.' });
});
type Schedule = z.infer<typeof scheduleSchema>;
function access(request: FastifyRequest) { requireAnyAdminRole(request, ['super_admin', 'operations_admin']); }

async function validateAndLock(connection: PoolConnection, tenantId: number, value: Schedule, excludeId: number | null) {
  // Serialize concurrent changes for the same outlet, including new schedules.
  const [stores] = await connection.query<RowDataPacket[]>(
    'SELECT id FROM stores WHERE id = :storeId AND tenant_id = :tenantId FOR UPDATE',
    { storeId: value.store_id, tenantId });
  if (!stores[0]) throw new ApiError(400, 'invalid_store', 'Choose an outlet belonging to this tenant.');
  const [items] = await connection.query<RowDataPacket[]>(
    'SELECT menu_item_id FROM menu_item_tenants WHERE tenant_id = :tenantId AND menu_item_id = :itemId',
    { tenantId, itemId: value.menu_item_id });
  if (!items[0]) throw new ApiError(400, 'invalid_menu_item', 'Choose an item belonging to this tenant.');
  if (!value.is_active) return;
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id, weekday_mask, start_minute, end_minute,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date FROM mobile_price_schedules
      WHERE tenant_id = :tenantId AND store_id = :storeId AND menu_item_id = :itemId
        AND is_active = 1 AND (:excludeId IS NULL OR id <> :excludeId) FOR UPDATE`,
    { tenantId, storeId: value.store_id, itemId: value.menu_item_id, excludeId });
  const proposed = { days: value.days, startMinute: value.start_minute, endMinute: value.end_minute,
    startDate: value.start_date, endDate: value.end_date };
  if (rows.some((row) => mobilePriceWindowsOverlap(proposed, {
    days: weekdayMaskToDays(Number(row.weekday_mask)), startMinute: Number(row.start_minute), endMinute: Number(row.end_minute),
    startDate: row.start_date, endDate: row.end_date
  }))) throw new ApiError(409, 'mobile_price_schedule_conflict', 'This item already has an overlapping active weekly schedule at this outlet.');
}

export async function registerAdminMobilePriceRoutes(app: FastifyInstance) {
  app.get('/v1/admin/mobile-price-schedules', { preHandler: authenticateAdminRequest }, async (request) => {
    access(request);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT p.id, p.name, p.store_id, s.name AS store_name, p.menu_item_id, i.name AS item_name,
              p.weekday_mask, p.start_minute, p.end_minute,
              DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(p.end_date, '%Y-%m-%d') AS end_date,
              CAST(p.price_rm AS CHAR) AS price_rm, p.price_tokens, p.is_active
         FROM mobile_price_schedules p JOIN stores s ON s.id = p.store_id
         JOIN menu_items i ON i.id = p.menu_item_id WHERE p.tenant_id = :tenantId ORDER BY p.id DESC`,
      { tenantId: request.adminAuth.tenantId });
    return { schedules: rows.map((row) => ({ ...row, days: weekdayMaskToDays(Number(row.weekday_mask)), is_active: Number(row.is_active) === 1 })) };
  });
  app.post('/v1/admin/mobile-price-schedules', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    access(request);
    const value = scheduleSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await validateAndLock(connection, request.adminAuth.tenantId, value, null);
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO mobile_price_schedules (tenant_id, store_id, menu_item_id, name, start_date, end_date, weekday_mask,
           start_minute, end_minute, price_rm, price_tokens, is_active, created_by_admin_user_id)
         VALUES (:tenantId, :storeId, :itemId, :name, :startDate, :endDate, :mask,
           :startMinute, :endMinute, :priceRm, :priceTokens, :active, :adminId)`,
        { tenantId: request.adminAuth.tenantId, storeId: value.store_id, itemId: value.menu_item_id, name: value.name,
          startDate: value.start_date ?? null, endDate: value.end_date ?? null,
          mask: [...new Set(value.days)].reduce((mask, day) => mask | (1 << (day - 1)), 0),
          startMinute: value.start_minute, endMinute: value.end_minute, priceRm: value.price_rm,
          priceTokens: value.price_tokens, active: value.is_active ? 1 : 0, adminId: request.adminAuth.adminUserId });
      await writeAudit(connection, request, 'mobile_price_schedule_created', result.insertId, value);
      await connection.commit();
      return reply.code(201).send({ id: result.insertId });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });
  app.put('/v1/admin/mobile-price-schedules/:scheduleId', { preHandler: authenticateAdminRequest }, async (request) => {
    access(request);
    const { scheduleId } = z.object({ scheduleId: id }).parse(request.params);
    const value = scheduleSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      // Lock the target store first, as in creation. Existing scope is immutable,
      // avoiding inconsistent lock ordering when editing schedules concurrently.
      await validateAndLock(connection, request.adminAuth.tenantId, value, scheduleId);
      const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT id, store_id, menu_item_id FROM mobile_price_schedules WHERE id = :scheduleId AND tenant_id = :tenantId FOR UPDATE',
        { scheduleId, tenantId: request.adminAuth.tenantId });
      if (!rows[0]) throw new ApiError(404, 'mobile_price_schedule_not_found', 'Schedule not found.');
      if (Number(rows[0].store_id) !== value.store_id || Number(rows[0].menu_item_id) !== value.menu_item_id) {
        throw new ApiError(400, 'mobile_price_scope_immutable', 'Create a new schedule to change the item or outlet.');
      }
      await connection.execute(
        `UPDATE mobile_price_schedules SET name = :name, start_date = :startDate, end_date = :endDate,
           weekday_mask = :mask, start_minute = :startMinute, end_minute = :endMinute,
           price_rm = :priceRm, price_tokens = :priceTokens, is_active = :active
         WHERE id = :scheduleId AND tenant_id = :tenantId`,
        { scheduleId, tenantId: request.adminAuth.tenantId, name: value.name,
          startDate: value.start_date ?? null, endDate: value.end_date ?? null,
          mask: [...new Set(value.days)].reduce((mask, day) => mask | (1 << (day - 1)), 0),
          startMinute: value.start_minute, endMinute: value.end_minute, priceRm: value.price_rm,
          priceTokens: value.price_tokens, active: value.is_active ? 1 : 0 });
      await writeAudit(connection, request, 'mobile_price_schedule_updated', scheduleId, value);
      await connection.commit();
      return { updated: true };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });
}

async function writeAudit(connection: PoolConnection, request: FastifyRequest, action: string, scheduleId: number, value: Schedule) {
  await connection.execute(
    `INSERT INTO admin_audit_logs
       (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent, created_at)
     VALUES (:adminId, :roles, :action, 'mobile_price_schedule', :targetId, :afterJson, :ip, :userAgent, UTC_TIMESTAMP())`,
    { adminId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), action,
      targetId: String(scheduleId), afterJson: JSON.stringify(value), ip: request.ip,
      userAgent: String(request.headers['user-agent'] ?? '').slice(0, 512) });
}
