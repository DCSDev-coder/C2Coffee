import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { resolveAttendanceStoreId } from './barista-staff.js';

const movementSchema = z.object({
  inventory_item_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive().max(10_000_000),
  movement_type: z.enum(['stock_add', 'waste']),
  reason_code: z.enum(['expired', 'damaged', 'spillage', 'quality', 'staff_use', 'other']).optional(),
  note: z.string().trim().max(500).optional().or(z.literal(''))
});

function requireBaristaInventoryAccess(request: FastifyRequest): void {
  requireAnyAdminRole(request, ['super_admin', 'operations_admin', 'barista']);
}

export async function registerBaristaInventoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/barista/inventory', { preHandler: authenticateAdminRequest }, async (request) => {
    requireBaristaInventoryAccess(request);
    const storeId = await resolveAttendanceStoreId(request);
    const [items] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT ii.id, ii.name, ii.category, ii.unit_code,
              CAST(COALESCE(ss.on_hand_quantity, 0) AS CHAR) AS on_hand_quantity,
              CAST(COALESCE(ss.reserved_quantity, 0) AS CHAR) AS reserved_quantity,
              CAST(COALESCE(ss.on_hand_quantity, 0) - COALESCE(ss.reserved_quantity, 0) AS CHAR) AS available_quantity
         FROM inventory_items ii
         LEFT JOIN inventory_store_stocks ss ON ss.inventory_item_id = ii.id AND ss.store_id = :storeId
        WHERE ii.tenant_id = :tenantId AND ii.is_active = 1 ORDER BY ii.category, ii.name`,
      { storeId, tenantId: request.adminAuth.tenantId }
    );
    const [stores] = await mysqlPool.query<RowDataPacket[]>(
      'SELECT name FROM stores WHERE id = :storeId AND tenant_id = :tenantId LIMIT 1',
      { storeId, tenantId: request.adminAuth.tenantId }
    );
    return { store_id: storeId, store_name: stores[0]?.name ?? 'Current outlet', items };
  });

  app.post('/v1/barista/inventory/movements', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireBaristaInventoryAccess(request);
    const payload = movementSchema.parse(request.body);
    if (payload.movement_type === 'waste' && !payload.reason_code) {
      throw new ApiError(400, 'inventory_waste_reason_required', 'Select a wastage reason.');
    }
    const storeId = await resolveAttendanceStoreId(request);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO inventory_store_stocks (tenant_id, store_id, inventory_item_id)
         SELECT :tenantId, :storeId, id FROM inventory_items
          WHERE id = :itemId AND tenant_id = :tenantId AND is_active = 1
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        { tenantId: request.adminAuth.tenantId, storeId, itemId: payload.inventory_item_id }
      );
      const [stocks] = await connection.query<RowDataPacket[]>(
        `SELECT ss.id, ss.on_hand_quantity, ss.reserved_quantity FROM inventory_store_stocks ss
          JOIN inventory_items ii ON ii.id = ss.inventory_item_id AND ii.tenant_id = :tenantId
         WHERE ss.store_id = :storeId AND ss.inventory_item_id = :itemId LIMIT 1 FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId, storeId, itemId: payload.inventory_item_id }
      );
      if (!stocks[0]) throw new ApiError(404, 'inventory_item_not_found', 'Inventory item not found.');
      const oldBalance = Number(stocks[0].on_hand_quantity);
      const change = payload.movement_type === 'waste' ? -payload.quantity : payload.quantity;
      const balanceAfter = Math.round((oldBalance + change) * 1000) / 1000;
      if (balanceAfter < 0) throw new ApiError(409, 'inventory_negative_stock_blocked', 'Wastage cannot exceed the available stock.');
      if (balanceAfter < Number(stocks[0].reserved_quantity)) {
        throw new ApiError(409, 'inventory_adjustment_below_reserved', 'This change would reduce stock reserved for active orders.');
      }
      await connection.execute(
        'UPDATE inventory_store_stocks SET on_hand_quantity = :balanceAfter, updated_at = UTC_TIMESTAMP() WHERE id = :stockId',
        { balanceAfter, stockId: stocks[0].id }
      );
      const [movement] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_movements
          (tenant_id, store_id, inventory_item_id, movement_type, quantity_change, balance_after, note, created_by_admin_user_id, created_at)
         VALUES (:tenantId, :storeId, :itemId, :movementType, :change, :balanceAfter, :note, :adminUserId, UTC_TIMESTAMP())`,
        {
          tenantId: request.adminAuth.tenantId, storeId, itemId: payload.inventory_item_id,
          movementType: payload.movement_type === 'waste' ? 'waste' : 'adjustment', change, balanceAfter,
          note: payload.movement_type === 'waste' ? `[${payload.reason_code}] ${payload.note || ''}`.trim() : (payload.note || 'Barista stock addition'),
          adminUserId: request.adminAuth.adminUserId
        }
      );
      await connection.commit();
      return reply.code(201).send({ id: movement.insertId, balance_after: balanceAfter });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  });
}
