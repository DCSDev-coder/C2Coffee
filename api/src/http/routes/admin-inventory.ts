import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const unitCodes = ['piece', 'gram', 'millilitre'] as const;
const itemSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().min(1).max(80).optional(),
  barcode: z.string().trim().max(120).optional().or(z.literal('')),
  category: z.string().trim().min(1).max(80).default('ingredient'),
  unit_code: z.enum(unitCodes),
  is_active: z.coerce.boolean().default(true)
});
const itemPatchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  code: z.string().trim().min(1).max(80).optional(),
  barcode: z.string().trim().max(120).optional().or(z.literal('')),
  category: z.string().trim().min(1).max(80).optional(),
  unit_code: z.enum(unitCodes).optional(),
  is_active: z.coerce.boolean().optional()
});
const stockQuerySchema = z.object({ store_id: z.coerce.number().int().positive() });
const movementSchema = z.object({
  store_id: z.coerce.number().int().positive(),
  inventory_item_id: z.coerce.number().int().positive(),
  supplier_id: z.coerce.number().int().positive().optional().nullable(),
  movement_type: z.enum(['purchase', 'waste', 'adjustment']),
  quantity: z.coerce.number().positive().max(10_000_000),
  adjustment_direction: z.enum(['increase', 'decrease']).optional(),
  unit_cost_rm: z.coerce.number().min(0).max(1_000_000).optional(),
  reorder_level: z.coerce.number().min(0).max(10_000_000).optional(),
  note: z.string().trim().max(500).optional().or(z.literal(''))
});
const recipeSchema = z.object({
  components: z.array(z.object({
    inventory_item_id: z.coerce.number().int().positive(),
    quantity_per_menu_item: z.coerce.number().positive().max(1_000_000)
  })).max(100)
});
const monthQuerySchema = stockQuerySchema.extend({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
});

function requireInventoryAccess(request: FastifyRequest): void {
  requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
}

function canViewInventoryCosts(request: FastifyRequest): boolean {
  return request.adminAuth.roles.includes('super_admin');
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

async function assertStore(connection: PoolConnection, tenantId: number, storeId: number): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    'SELECT id FROM stores WHERE id = :storeId AND tenant_id = :tenantId LIMIT 1',
    { storeId, tenantId }
  );
  if (!rows[0]) throw new ApiError(404, 'inventory_store_not_found', 'Outlet not found for this tenant.');
}

async function audit(
  connection: PoolConnection,
  request: FastifyRequest,
  actionCode: string,
  targetType: string,
  targetId: number | null,
  after: unknown
): Promise<void> {
  await connection.execute(
    `INSERT INTO admin_audit_logs
       (admin_user_id, effective_roles_json, action_code, target_type, target_id,
        after_json, ip_address, user_agent, created_at)
     VALUES
       (:adminUserId, :roles, :actionCode, :targetType, :targetId,
        :afterJson, :ipAddress, :userAgent, UTC_TIMESTAMP())`,
    {
      adminUserId: request.adminAuth.adminUserId,
      roles: JSON.stringify(request.adminAuth.roles),
      actionCode,
      targetType,
      targetId,
      afterJson: JSON.stringify(after),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null
    }
  );
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1) - 8 * 60 * 60 * 1000),
    end: new Date(Date.UTC(year, monthNumber, 1) - 8 * 60 * 60 * 1000)
  };
}

export async function registerAdminInventoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/inventory/context', { preHandler: authenticateAdminRequest }, async (request) => {
    requireInventoryAccess(request);
    const [stores] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, code, name, status FROM stores
        WHERE tenant_id = :tenantId ORDER BY status = 'active' DESC, name`,
      { tenantId: request.adminAuth.tenantId }
    );
    const [menuItems] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT i.id, i.code, i.name, c.name AS category_name, i.is_active,
              COUNT(r.id) AS recipe_component_count
         FROM menu_items i
         JOIN menu_categories c ON c.id = i.category_id
         LEFT JOIN inventory_menu_item_recipes r
           ON r.menu_item_id = i.id AND r.tenant_id = :tenantId
        GROUP BY i.id, i.code, i.name, c.name, i.is_active
        ORDER BY c.sort_order, c.name, i.name`,
      { tenantId: request.adminAuth.tenantId }
    );
    return { stores, menu_items: menuItems };
  });

  app.get('/v1/admin/inventory', { preHandler: authenticateAdminRequest }, async (request) => {
    requireInventoryAccess(request);
    const { store_id: storeId } = stockQuerySchema.parse(request.query);
    const connection = await mysqlPool.getConnection();
    try {
      await assertStore(connection, request.adminAuth.tenantId, storeId);
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT ii.id, ii.code, ii.barcode, ii.name, ii.category, ii.unit_code, ii.is_active,
                CAST(COALESCE(ss.on_hand_quantity, 0) AS CHAR) AS on_hand_quantity,
                CAST(COALESCE(ss.reserved_quantity, 0) AS CHAR) AS reserved_quantity,
                CAST(COALESCE(ss.on_hand_quantity, 0) - COALESCE(ss.reserved_quantity, 0) AS CHAR) AS available_quantity,
                CAST(COALESCE(ss.reorder_level, 0) AS CHAR) AS reorder_level,
                CAST(COALESCE(ss.ideal_stock_level, 0) AS CHAR) AS ideal_stock_level,
                CAST(COALESCE(ss.average_unit_cost_rm, 0) AS CHAR) AS average_unit_cost_rm,
                COALESCE(recipe_usage.menu_item_count, 0) AS linked_menu_item_count
           FROM inventory_items ii
           LEFT JOIN inventory_store_stocks ss
             ON ss.inventory_item_id = ii.id AND ss.store_id = :storeId
           LEFT JOIN (
             SELECT inventory_item_id, COUNT(DISTINCT menu_item_id) AS menu_item_count
               FROM inventory_menu_item_recipes
              WHERE tenant_id = :tenantId GROUP BY inventory_item_id
           ) recipe_usage ON recipe_usage.inventory_item_id = ii.id
          WHERE ii.tenant_id = :tenantId
          ORDER BY ii.is_active DESC, ii.category, ii.name`,
        { tenantId: request.adminAuth.tenantId, storeId }
      );
      const showCosts = canViewInventoryCosts(request);
      return {
        store_id: storeId,
        can_view_costs: showCosts,
        items: rows.map((row) => ({
          ...row,
          average_unit_cost_rm: showCosts ? row.average_unit_cost_rm : null
        }))
      };
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/inventory/items', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireInventoryAccess(request);
    const payload = itemSchema.parse(request.body);
    const code = normalizeCode(payload.code || payload.name);
    if (!code) throw new ApiError(400, 'inventory_code_invalid', 'Enter a valid inventory item code.');
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_items (tenant_id, code, barcode, name, category, unit_code, is_active)
         VALUES (:tenantId, :code, :barcode, :name, :category, :unitCode, :isActive)`,
        {
          tenantId: request.adminAuth.tenantId,
          code,
          barcode: payload.barcode || null,
          name: payload.name,
          category: payload.category,
          unitCode: payload.unit_code,
          isActive: payload.is_active ? 1 : 0
        }
      );
      await audit(connection, request, 'inventory_item_created', 'inventory_item', result.insertId, payload);
      await connection.commit();
      return reply.code(201).send({ id: result.insertId, code });
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'inventory_item_exists', 'An inventory item with this code or barcode already exists.');
      }
      throw error;
    } finally {
      connection.release();
    }
  });

  app.patch('/v1/admin/inventory/items/:itemId', { preHandler: authenticateAdminRequest }, async (request) => {
    requireInventoryAccess(request);
    const { itemId } = z.object({ itemId: z.coerce.number().int().positive() }).parse(request.params);
    const payload = itemPatchSchema.parse(request.body);
    if (Object.keys(payload).length === 0) return { updated: false };
    const updates: string[] = [];
    const values: Record<string, string | number | null> = { itemId, tenantId: request.adminAuth.tenantId };
    if (payload.name !== undefined) { updates.push('name = :name'); values.name = payload.name; }
    if (payload.code !== undefined) { updates.push('code = :code'); values.code = normalizeCode(payload.code); }
    if (payload.barcode !== undefined) { updates.push('barcode = :barcode'); values.barcode = payload.barcode || null; }
    if (payload.category !== undefined) { updates.push('category = :category'); values.category = payload.category; }
    if (payload.unit_code !== undefined) { updates.push('unit_code = :unitCode'); values.unitCode = payload.unit_code; }
    if (payload.is_active !== undefined) { updates.push('is_active = :isActive'); values.isActive = payload.is_active ? 1 : 0; }
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      if (payload.is_active === false) {
        const [usage] = await connection.query<RowDataPacket[]>(
          `SELECT
             (SELECT COUNT(*) FROM inventory_menu_item_recipes
               WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS linked_recipe_count,
             (SELECT COUNT(*) FROM inventory_option_recipes
               WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS linked_option_recipe_count,
             (SELECT COALESCE(SUM(reserved_quantity), 0) FROM inventory_store_stocks
               WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS reserved_quantity`,
          { tenantId: request.adminAuth.tenantId, itemId }
        );
        if (Number(usage[0]?.reserved_quantity || 0) > 0) {
          throw new ApiError(409, 'inventory_item_reserved', 'This item cannot be archived while stock is reserved for active orders.');
        }
        if (Number(usage[0]?.linked_recipe_count || 0) > 0 || Number(usage[0]?.linked_option_recipe_count || 0) > 0) {
          throw new ApiError(409, 'inventory_item_linked', 'Remove this item from all menu recipes before archiving it.');
        }
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE inventory_items SET ${updates.join(', ')}, updated_at = UTC_TIMESTAMP()
          WHERE id = :itemId AND tenant_id = :tenantId`,
        values
      );
      if (result.affectedRows !== 1) throw new ApiError(404, 'inventory_item_not_found', 'Inventory item not found.');
      await audit(connection, request, 'inventory_item_updated', 'inventory_item', itemId, payload);
      await connection.commit();
      return { updated: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.delete('/v1/admin/inventory/items/:itemId', { preHandler: authenticateAdminRequest }, async (request) => {
    requireInventoryAccess(request);
    const { itemId } = z.object({ itemId: z.coerce.number().int().positive() }).parse(request.params);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [items] = await connection.query<RowDataPacket[]>(
        `SELECT id, name FROM inventory_items
          WHERE id = :itemId AND tenant_id = :tenantId LIMIT 1 FOR UPDATE`,
        { itemId, tenantId: request.adminAuth.tenantId }
      );
      if (!items[0]) throw new ApiError(404, 'inventory_item_not_found', 'Inventory item not found.');
      const [usage] = await connection.query<RowDataPacket[]>(
        `SELECT
           (SELECT COUNT(*) FROM inventory_menu_item_recipes WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS recipe_count,
           (SELECT COUNT(*) FROM inventory_movements WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS movement_count,
           (SELECT COUNT(*) FROM inventory_store_stocks WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS stock_count,
           (SELECT COUNT(*) FROM inventory_order_allocations WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS allocation_count,
           (SELECT COUNT(*) FROM inventory_option_recipes WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS option_recipe_count,
           (SELECT COUNT(*) FROM inventory_supplier_items WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS supplier_item_count,
           (SELECT COUNT(*) FROM inventory_purchase_order_lines WHERE inventory_item_id = :itemId) AS purchase_order_count,
           (SELECT COUNT(*) FROM inventory_stock_transfer_lines WHERE inventory_item_id = :itemId) AS transfer_count,
           (SELECT COUNT(*) FROM inventory_stocktake_lines WHERE inventory_item_id = :itemId) AS stocktake_count,
           (SELECT COUNT(*) FROM inventory_wastage_records WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS wastage_count,
           (SELECT COUNT(*) FROM inventory_supplier_returns WHERE tenant_id = :tenantId AND inventory_item_id = :itemId) AS supplier_return_count`,
        { tenantId: request.adminAuth.tenantId, itemId }
      );
      const relatedCount = ['recipe_count', 'movement_count', 'stock_count', 'allocation_count',
        'option_recipe_count', 'supplier_item_count', 'purchase_order_count', 'transfer_count',
        'stocktake_count', 'wastage_count', 'supplier_return_count']
        .reduce((sum, key) => sum + Number(usage[0]?.[key] || 0), 0);
      if (relatedCount > 0) {
        throw new ApiError(409, 'inventory_item_has_history', 'This item has related stock or recipe data and must be archived instead of deleted.');
      }
      await connection.execute(
        'DELETE FROM inventory_items WHERE id = :itemId AND tenant_id = :tenantId',
        { itemId, tenantId: request.adminAuth.tenantId }
      );
      await audit(connection, request, 'inventory_item_deleted', 'inventory_item', itemId, { name: items[0].name });
      await connection.commit();
      return { deleted: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/inventory/movements', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireInventoryAccess(request);
    const payload = movementSchema.parse(request.body);
    if (payload.movement_type === 'purchase' && !canViewInventoryCosts(request)) {
      throw new ApiError(403, 'inventory_direct_receipt_forbidden', 'Use an approved purchase order to receive supplier stock.');
    }
    if (payload.movement_type === 'purchase' && !payload.supplier_id) {
      throw new ApiError(400, 'inventory_supplier_required', 'Select the supplier that delivered this stock.');
    }
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await assertStore(connection, request.adminAuth.tenantId, payload.store_id);
      const [items] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM inventory_items
          WHERE id = :itemId AND tenant_id = :tenantId AND is_active = 1 LIMIT 1 FOR UPDATE`,
        { itemId: payload.inventory_item_id, tenantId: request.adminAuth.tenantId }
      );
      if (!items[0]) throw new ApiError(404, 'inventory_item_not_found', 'Inventory item not found.');
      if (payload.movement_type === 'purchase') {
        const [supplierItems] = await connection.query<RowDataPacket[]>(
          `SELECT si.id
             FROM inventory_supplier_items si
             JOIN inventory_suppliers s ON s.id = si.supplier_id
            WHERE si.tenant_id = :tenantId
              AND si.supplier_id = :supplierId
              AND si.inventory_item_id = :itemId
              AND s.is_active = 1
            LIMIT 1`,
          { tenantId: request.adminAuth.tenantId, supplierId: payload.supplier_id, itemId: payload.inventory_item_id }
        );
        if (!supplierItems[0]) {
          throw new ApiError(400, 'inventory_supplier_item_missing', 'Link this inventory item to the selected supplier before recording a receipt.');
        }
      }
      await connection.execute(
        `INSERT INTO inventory_store_stocks
           (tenant_id, store_id, inventory_item_id, on_hand_quantity, reserved_quantity)
         VALUES (:tenantId, :storeId, :itemId, 0, 0)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        { tenantId: request.adminAuth.tenantId, storeId: payload.store_id, itemId: payload.inventory_item_id }
      );
      const [stocks] = await connection.query<RowDataPacket[]>(
        `SELECT id, CAST(on_hand_quantity AS CHAR) AS on_hand_quantity,
                CAST(reserved_quantity AS CHAR) AS reserved_quantity,
                CAST(average_unit_cost_rm AS CHAR) AS average_unit_cost_rm
           FROM inventory_store_stocks
          WHERE store_id = :storeId AND inventory_item_id = :itemId LIMIT 1 FOR UPDATE`,
        { storeId: payload.store_id, itemId: payload.inventory_item_id }
      );
      const stock = stocks[0];
      const oldOnHand = Number(stock.on_hand_quantity);
      const sign = payload.movement_type === 'purchase' ||
        (payload.movement_type === 'adjustment' && payload.adjustment_direction !== 'decrease') ? 1 : -1;
      const change = Math.round(sign * payload.quantity * 1000) / 1000;
      const balanceAfter = Math.round((oldOnHand + change) * 1000) / 1000;
      if (balanceAfter < 0) {
        throw new ApiError(409, 'inventory_negative_stock_blocked', 'This change would make the stock balance negative.');
      }
      if (balanceAfter < Number(stock.reserved_quantity)) {
        throw new ApiError(409, 'inventory_adjustment_below_reserved', 'This change would reduce stock below the quantity reserved for active orders.');
      }
      const unitCost = payload.movement_type === 'purchase' ? Number(payload.unit_cost_rm ?? 0) : null;
      const averageCost = payload.movement_type === 'purchase' && balanceAfter > 0
        ? ((oldOnHand * Number(stock.average_unit_cost_rm)) + (payload.quantity * Number(unitCost))) / balanceAfter
        : Number(stock.average_unit_cost_rm);
      await connection.execute(
        `UPDATE inventory_store_stocks
            SET on_hand_quantity = :balanceAfter,
                average_unit_cost_rm = :averageCost,
                reorder_level = COALESCE(:reorderLevel, reorder_level),
                updated_at = UTC_TIMESTAMP()
          WHERE id = :stockId`,
        { balanceAfter, averageCost, reorderLevel: payload.reorder_level ?? null, stockId: stock.id }
      );
      const [movement] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_movements
           (tenant_id, store_id, inventory_item_id, supplier_id, movement_type, quantity_change,
            unit_cost_rm, total_cost_rm, balance_after, note, created_by_admin_user_id, created_at)
         VALUES
           (:tenantId, :storeId, :itemId, :supplierId, :movementType, :quantityChange,
            :unitCost, :totalCost, :balanceAfter, :note, :adminUserId, UTC_TIMESTAMP())`,
        {
          tenantId: request.adminAuth.tenantId,
          storeId: payload.store_id,
          itemId: payload.inventory_item_id,
          supplierId: payload.supplier_id ?? null,
          movementType: payload.movement_type,
          quantityChange: change,
          unitCost,
          totalCost: unitCost === null ? null : Math.round(payload.quantity * unitCost * 100) / 100,
          balanceAfter,
          note: payload.note || null,
          adminUserId: request.adminAuth.adminUserId
        }
      );
      await audit(connection, request, 'inventory_stock_movement_recorded', 'inventory_movement', movement.insertId, payload);
      await connection.commit();
      return reply.code(201).send({ id: movement.insertId, balance_after: balanceAfter });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/inventory/recipes', { preHandler: authenticateAdminRequest }, async (request) => {
    requireInventoryAccess(request);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT r.menu_item_id, r.inventory_item_id, ii.name AS inventory_item_name,
              ii.unit_code, CAST(r.quantity_per_menu_item AS CHAR) AS quantity_per_menu_item
         FROM inventory_menu_item_recipes r
         JOIN inventory_items ii ON ii.id = r.inventory_item_id
        WHERE r.tenant_id = :tenantId
        ORDER BY r.menu_item_id, ii.name`,
      { tenantId: request.adminAuth.tenantId }
    );
    return { recipes: rows };
  });

  app.put('/v1/admin/inventory/recipes/:menuItemId', { preHandler: authenticateAdminRequest }, async (request) => {
    requireInventoryAccess(request);
    const { menuItemId } = z.object({ menuItemId: z.coerce.number().int().positive() }).parse(request.params);
    const payload = recipeSchema.parse(request.body);
    const uniqueIds = new Set(payload.components.map((component) => component.inventory_item_id));
    if (uniqueIds.size !== payload.components.length) throw new ApiError(400, 'inventory_recipe_duplicate', 'Each inventory item can appear only once in a recipe.');
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [menuItems] = await connection.query<RowDataPacket[]>('SELECT id FROM menu_items WHERE id = :menuItemId LIMIT 1 FOR UPDATE', { menuItemId });
      if (!menuItems[0]) throw new ApiError(404, 'menu_item_not_found', 'Menu item not found.');
      if (payload.components.length > 0) {
        const componentParams = Object.fromEntries(
          payload.components.map((component, index) => [`componentId${index}`, component.inventory_item_id])
        );
        const componentPlaceholders = payload.components.map((_, index) => `:componentId${index}`).join(',');
        const [items] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM inventory_items
            WHERE tenant_id = :tenantId AND is_active = 1 AND id IN (${componentPlaceholders})
            FOR UPDATE`,
          { tenantId: request.adminAuth.tenantId, ...componentParams }
        );
        if (items.length !== payload.components.length) throw new ApiError(400, 'inventory_recipe_item_invalid', 'One or more inventory items are unavailable.');
      }
      await connection.execute(
        'DELETE FROM inventory_menu_item_recipes WHERE tenant_id = :tenantId AND menu_item_id = :menuItemId',
        { tenantId: request.adminAuth.tenantId, menuItemId }
      );
      for (const component of payload.components) {
        await connection.execute(
          `INSERT INTO inventory_menu_item_recipes
             (tenant_id, menu_item_id, inventory_item_id, quantity_per_menu_item)
           VALUES (:tenantId, :menuItemId, :inventoryItemId, :quantity)`,
          {
            tenantId: request.adminAuth.tenantId,
            menuItemId,
            inventoryItemId: component.inventory_item_id,
            quantity: Math.round(component.quantity_per_menu_item * 1000) / 1000
          }
        );
      }
      await audit(connection, request, 'inventory_recipe_updated', 'menu_item', menuItemId, payload);
      await connection.commit();
      return { updated: true, component_count: payload.components.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/inventory/report', { preHandler: authenticateAdminRequest }, async (request) => {
    requireInventoryAccess(request);
    const query = monthQuerySchema.parse(request.query);
    const { start, end } = monthBounds(query.month);
    const connection = await mysqlPool.getConnection();
    try {
      await assertStore(connection, request.adminAuth.tenantId, query.store_id);
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT ii.id, ii.name, ii.category, ii.unit_code,
                CAST(COALESCE(before_month.opening_stock, first_month.opening_stock, 0) AS CHAR) AS opening_stock,
                CAST(COALESCE(monthly.purchased, 0) AS CHAR) AS purchased,
                CAST(COALESCE(monthly.consumed, 0) AS CHAR) AS consumed,
                CAST(COALESCE(monthly.wasted, 0) AS CHAR) AS wasted,
                CAST(COALESCE(monthly.adjusted, 0) AS CHAR) AS adjusted,
                CAST(COALESCE(monthly.refund_reversed, 0) AS CHAR) AS refund_reversed,
                CAST(COALESCE(month_end.closing_stock, before_month.opening_stock, first_month.opening_stock, 0) AS CHAR) AS closing_stock,
                CAST(COALESCE(ss.on_hand_quantity, 0) AS CHAR) AS current_stock,
                CAST(COALESCE(ss.reserved_quantity, 0) AS CHAR) AS reserved_stock,
                CAST(COALESCE(ss.reorder_level, 0) AS CHAR) AS reorder_level,
                CAST(COALESCE(monthly.purchase_cost_rm, 0) AS CHAR) AS purchase_cost_rm
           FROM inventory_items ii
           LEFT JOIN inventory_store_stocks ss
             ON ss.inventory_item_id = ii.id AND ss.store_id = :storeId
           LEFT JOIN (
             SELECT inventory_item_id,
                    SUM(CASE WHEN movement_type IN ('purchase', 'purchase_receive', 'transfer_in') THEN quantity_change ELSE 0 END) AS purchased,
                    SUM(CASE WHEN movement_type = 'consumption' THEN -quantity_change ELSE 0 END) AS consumed,
                    SUM(CASE WHEN movement_type = 'waste' THEN -quantity_change ELSE 0 END) AS wasted,
                    SUM(CASE WHEN movement_type IN ('adjustment', 'stocktake_adjustment', 'transfer_out', 'supplier_return') THEN quantity_change ELSE 0 END) AS adjusted,
                    SUM(CASE WHEN movement_type = 'refund_reversal' THEN quantity_change ELSE 0 END) AS refund_reversed,
                    SUM(CASE WHEN movement_type IN ('purchase', 'purchase_receive') THEN COALESCE(total_cost_rm, 0) ELSE 0 END) AS purchase_cost_rm
               FROM inventory_movements
              WHERE tenant_id = :tenantId AND store_id = :storeId
                AND created_at >= :startAt AND created_at < :endAt
              GROUP BY inventory_item_id
           ) monthly ON monthly.inventory_item_id = ii.id
           LEFT JOIN (
             SELECT latest.inventory_item_id, latest.balance_after AS opening_stock
               FROM inventory_movements latest
               JOIN (
                 SELECT inventory_item_id, MAX(id) AS max_id
                   FROM inventory_movements
                  WHERE tenant_id = :tenantId AND store_id = :storeId AND created_at < :startAt
                  GROUP BY inventory_item_id
               ) prior ON prior.max_id = latest.id
           ) before_month ON before_month.inventory_item_id = ii.id
           LEFT JOIN (
             SELECT first_entry.inventory_item_id,
                    first_entry.balance_after - first_entry.quantity_change AS opening_stock
               FROM inventory_movements first_entry
               JOIN (
                 SELECT inventory_item_id, MIN(id) AS min_id
                   FROM inventory_movements
                  WHERE tenant_id = :tenantId AND store_id = :storeId
                    AND created_at >= :startAt AND created_at < :endAt
                  GROUP BY inventory_item_id
               ) first_ids ON first_ids.min_id = first_entry.id
           ) first_month ON first_month.inventory_item_id = ii.id
           LEFT JOIN (
             SELECT closing_entry.inventory_item_id, closing_entry.balance_after AS closing_stock
               FROM inventory_movements closing_entry
               JOIN (
                 SELECT inventory_item_id, MAX(id) AS max_id
                   FROM inventory_movements
                  WHERE tenant_id = :tenantId AND store_id = :storeId AND created_at < :endAt
                  GROUP BY inventory_item_id
               ) closing_ids ON closing_ids.max_id = closing_entry.id
           ) month_end ON month_end.inventory_item_id = ii.id
          WHERE ii.tenant_id = :tenantId
          ORDER BY ii.category, ii.name`,
        {
          tenantId: request.adminAuth.tenantId,
          storeId: query.store_id,
          startAt: start,
          endAt: end
        }
      );
      const showCosts = canViewInventoryCosts(request);
      return {
        month: query.month,
        store_id: query.store_id,
        can_view_costs: showCosts,
        generated_at: new Date().toISOString(),
        items: rows.map((row) => ({
          ...row,
          purchase_cost_rm: showCosts ? row.purchase_cost_rm : null
        }))
      };
    } finally {
      connection.release();
    }
  });
}
