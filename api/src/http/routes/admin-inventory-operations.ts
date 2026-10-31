import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const id = z.coerce.number().int().positive();
const quantity = z.coerce.number().positive().max(10_000_000);
const stockQuery = z.object({ store_id: id });
const supplierSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().max(80).optional().or(z.literal('')),
  contact_name: z.string().trim().max(255).optional().or(z.literal('')),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(80).optional().or(z.literal('')),
  payment_terms: z.string().trim().max(120).optional().or(z.literal('')),
  default_lead_time_days: z.coerce.number().int().min(0).max(365).default(0),
  notes: z.string().trim().max(500).optional().or(z.literal(''))
});
const supplierItemSchema = z.object({
  supplier_id: id,
  inventory_item_id: id,
  supplier_sku: z.string().trim().max(120).optional().or(z.literal('')),
  supplier_barcode: z.string().trim().max(120).optional().or(z.literal('')),
  purchase_unit_name: z.string().trim().min(1).max(80),
  stock_units_per_purchase_unit: quantity,
  latest_purchase_unit_cost_rm: z.coerce.number().min(0).max(1_000_000),
  minimum_order_quantity: quantity.default(1),
  lead_time_days: z.coerce.number().int().min(0).max(365).optional().nullable(),
  is_preferred: z.coerce.boolean().default(false)
});
const purchaseOrderSchema = z.object({
  store_id: id,
  supplier_id: id,
  expected_at: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  lines: z.array(z.object({
    inventory_item_id: id,
    ordered_purchase_units: quantity
  })).min(1).max(200)
});
const receiptSchema = z.object({
  received_at: z.coerce.date().optional(),
  delivery_order_ref: z.string().trim().max(120).optional().or(z.literal('')),
  supplier_invoice_ref: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  lines: z.array(z.object({
    line_id: id,
    delivered_purchase_units: quantity,
    rejected_purchase_units: z.coerce.number().min(0).max(10_000_000).default(0),
    rejection_reason: z.string().trim().max(255).optional().or(z.literal(''))
  }).refine((line) => line.rejected_purchase_units <= line.delivered_purchase_units, {
    message: 'Rejected quantity cannot exceed delivered quantity.'
  })).min(1).max(200)
});
const levelSchema = z.object({
  store_id: id,
  reorder_level: z.coerce.number().min(0).max(10_000_000),
  ideal_stock_level: z.coerce.number().min(0).max(10_000_000)
});
const transferSchema = z.object({
  from_store_id: id,
  to_store_id: id,
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  lines: z.array(z.object({ inventory_item_id: id, quantity })).min(1).max(200)
}).refine((value) => value.from_store_id !== value.to_store_id, {
  message: 'Choose two different outlets.', path: ['to_store_id']
});
const stocktakeSchema = z.object({
  store_id: id,
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  lines: z.array(z.object({
    inventory_item_id: id,
    counted_purchase_units: z.coerce.number().min(0).max(10_000_000).default(0),
    counted_loose_units: z.coerce.number().min(0).max(10_000_000).default(0)
  })).min(1).max(1000)
});
const wastageSchema = z.object({
  store_id: id,
  inventory_item_id: id,
  quantity,
  reason_code: z.enum(['expired', 'damaged', 'spillage', 'quality', 'staff_use', 'other']),
  note: z.string().trim().max(500).optional().or(z.literal(''))
});
const supplierReturnSchema = z.object({
  store_id: id,
  supplier_id: id,
  inventory_item_id: id,
  quantity,
  reason: z.string().trim().min(1).max(500)
});
const optionRecipeSchema = z.object({
  components: z.array(z.object({ inventory_item_id: id, quantity_delta: z.coerce.number().min(-1_000_000).max(1_000_000).refine((value) => value !== 0) })).max(100)
});

function requireAccess(request: FastifyRequest): void {
  requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
}

function canViewCosts(request: FastifyRequest): boolean {
  return request.adminAuth.roles.includes('super_admin');
}

function code(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

function reference(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `${prefix}-${timestamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

async function assertStore(connection: PoolConnection, tenantId: number, storeId: number): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    'SELECT id FROM stores WHERE id = :storeId AND tenant_id = :tenantId LIMIT 1',
    { storeId, tenantId }
  );
  if (!rows[0]) throw new ApiError(404, 'inventory_store_not_found', 'Outlet not found for this tenant.');
}

async function assertSupplier(connection: PoolConnection, tenantId: number, supplierId: number): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    'SELECT id FROM inventory_suppliers WHERE id = :supplierId AND tenant_id = :tenantId AND is_active = 1 LIMIT 1',
    { supplierId, tenantId }
  );
  if (!rows[0]) throw new ApiError(404, 'inventory_supplier_not_found', 'Supplier not found for this tenant.');
}

async function lockStock(connection: PoolConnection, tenantId: number, storeId: number, itemId: number): Promise<RowDataPacket> {
  await connection.execute(
    `INSERT INTO inventory_store_stocks (tenant_id, store_id, inventory_item_id)
     SELECT :tenantId, :storeId, ii.id FROM inventory_items ii
      WHERE ii.id = :itemId AND ii.tenant_id = :tenantId
     ON DUPLICATE KEY UPDATE id = id`,
    { tenantId, storeId, itemId }
  );
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT ss.id, CAST(ss.on_hand_quantity AS CHAR) AS on_hand_quantity,
            CAST(ss.reserved_quantity AS CHAR) AS reserved_quantity,
            CAST(ss.average_unit_cost_rm AS CHAR) AS average_unit_cost_rm
       FROM inventory_store_stocks ss
       JOIN inventory_items ii ON ii.id = ss.inventory_item_id AND ii.tenant_id = :tenantId
      WHERE ss.store_id = :storeId AND ss.inventory_item_id = :itemId
      LIMIT 1 FOR UPDATE`,
    { tenantId, storeId, itemId }
  );
  if (!rows[0]) throw new ApiError(404, 'inventory_item_not_found', 'Inventory item not found for this tenant.');
  return rows[0];
}

async function addMovement(
  connection: PoolConnection,
  input: { tenantId: number; storeId: number; itemId: number; type: string; change: number; balance: number; unitCost?: number | null; note?: string | null; adminUserId: number }
): Promise<number> {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO inventory_movements
       (tenant_id, store_id, inventory_item_id, movement_type, quantity_change,
        unit_cost_rm, total_cost_rm, balance_after, note, created_by_admin_user_id, created_at)
     VALUES (:tenantId, :storeId, :itemId, :type, :change, :unitCost,
             :totalCost, :balance, :note, :adminUserId, UTC_TIMESTAMP())`,
    {
      ...input,
      unitCost: input.unitCost ?? null,
      totalCost: input.unitCost == null ? null : Math.round(Math.abs(input.change) * input.unitCost * 100) / 100,
      note: input.note || null
    }
  );
  return result.insertId;
}

async function audit(connection: PoolConnection, request: FastifyRequest, action: string, target: string, targetId: number | null, after: unknown): Promise<void> {
  await connection.execute(
    `INSERT INTO admin_audit_logs
       (admin_user_id, effective_roles_json, action_code, target_type, target_id,
        after_json, ip_address, user_agent, created_at)
     VALUES (:adminUserId, :roles, :action, :target, :targetId,
             :afterJson, :ip, :userAgent, UTC_TIMESTAMP())`,
    {
      adminUserId: request.adminAuth.adminUserId,
      roles: JSON.stringify(request.adminAuth.roles),
      action,
      target,
      targetId,
      afterJson: JSON.stringify(after),
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null
    }
  );
}

export async function registerAdminInventoryOperationsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/inventory/operations', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { store_id: storeId } = stockQuery.parse(request.query);
    const tenantId = request.adminAuth.tenantId;
    const connection = await mysqlPool.getConnection();
    try {
      await assertStore(connection, tenantId, storeId);
      const [supplyNeeds] = await connection.query<RowDataPacket[]>(
        `SELECT ii.id, ii.name, ii.code, ii.unit_code,
                CAST(COALESCE(ss.on_hand_quantity, 0) AS CHAR) AS on_hand_quantity,
                CAST(COALESCE(ss.reserved_quantity, 0) AS CHAR) AS reserved_quantity,
                CAST(COALESCE(ss.on_hand_quantity - ss.reserved_quantity, 0) AS CHAR) AS available_quantity,
                CAST(COALESCE(ss.reorder_level, 0) AS CHAR) AS reorder_level,
                CAST(COALESCE(ss.ideal_stock_level, 0) AS CHAR) AS ideal_stock_level,
                CAST(GREATEST(COALESCE(ss.ideal_stock_level, 0) - COALESCE(ss.on_hand_quantity - ss.reserved_quantity, 0) - COALESCE(open_po.ordered_stock_units, 0), 0) AS CHAR) AS suggested_order_quantity,
                CAST(COALESCE(open_po.ordered_stock_units, 0) AS CHAR) AS already_ordered_quantity,
                supplier.id AS preferred_supplier_id, supplier.name AS preferred_supplier_name
           FROM inventory_items ii
           LEFT JOIN inventory_store_stocks ss ON ss.inventory_item_id = ii.id AND ss.store_id = :storeId
           LEFT JOIN (
             SELECT pol.inventory_item_id,
                    SUM((pol.ordered_purchase_units - pol.received_purchase_units) * pol.stock_units_per_purchase_unit) AS ordered_stock_units
               FROM inventory_purchase_order_lines pol
               JOIN inventory_purchase_orders po ON po.id = pol.purchase_order_id
              WHERE po.tenant_id = :tenantId AND po.store_id = :storeId
                AND po.status IN ('submitted', 'partially_received')
              GROUP BY pol.inventory_item_id
           ) open_po ON open_po.inventory_item_id = ii.id
           LEFT JOIN inventory_supplier_items si ON si.inventory_item_id = ii.id AND si.tenant_id = :tenantId AND si.is_preferred = 1
           LEFT JOIN inventory_suppliers supplier ON supplier.id = si.supplier_id AND supplier.is_active = 1
          WHERE ii.tenant_id = :tenantId AND ii.is_active = 1
            AND COALESCE(ss.reorder_level, 0) > 0
            AND COALESCE(ss.on_hand_quantity - ss.reserved_quantity, 0) <= ss.reorder_level
          ORDER BY suggested_order_quantity DESC, ii.name`,
        { tenantId, storeId }
      );
      const [suppliers] = await connection.query<RowDataPacket[]>(
        `SELECT s.*, COUNT(si.id) AS linked_item_count
           FROM inventory_suppliers s
           LEFT JOIN inventory_supplier_items si ON si.supplier_id = s.id
          WHERE s.tenant_id = :tenantId AND s.is_active = 1
          GROUP BY s.id ORDER BY s.name`, { tenantId }
      );
      const [supplierItems] = await connection.query<RowDataPacket[]>(
        `SELECT si.*, s.name AS supplier_name, ii.name AS inventory_item_name, ii.unit_code
           FROM inventory_supplier_items si
           JOIN inventory_suppliers s ON s.id = si.supplier_id
           JOIN inventory_items ii ON ii.id = si.inventory_item_id
          WHERE si.tenant_id = :tenantId ORDER BY s.name, ii.name`, { tenantId }
      );
      const [purchaseOrders] = await connection.query<RowDataPacket[]>(
        `SELECT po.*, s.name AS supplier_name,
                COUNT(pol.id) AS line_count,
                CAST(COALESCE(SUM(pol.ordered_purchase_units * pol.purchase_unit_cost_rm), 0) AS CHAR) AS total_rm
           FROM inventory_purchase_orders po
           JOIN inventory_suppliers s ON s.id = po.supplier_id
           LEFT JOIN inventory_purchase_order_lines pol ON pol.purchase_order_id = po.id
          WHERE po.tenant_id = :tenantId AND po.store_id = :storeId
          GROUP BY po.id ORDER BY po.created_at DESC LIMIT 100`, { tenantId, storeId }
      );
      const [transfers] = await connection.query<RowDataPacket[]>(
        `SELECT t.*, fs.name AS from_store_name, ts.name AS to_store_name, COUNT(l.id) AS line_count
           FROM inventory_stock_transfers t
           JOIN stores fs ON fs.id = t.from_store_id JOIN stores ts ON ts.id = t.to_store_id
           LEFT JOIN inventory_stock_transfer_lines l ON l.transfer_id = t.id
          WHERE t.tenant_id = :tenantId AND (t.from_store_id = :storeId OR t.to_store_id = :storeId)
          GROUP BY t.id ORDER BY t.created_at DESC LIMIT 100`, { tenantId, storeId }
      );
      const [stocktakes] = await connection.query<RowDataPacket[]>(
        `SELECT st.*, COUNT(sl.id) AS line_count,
                CAST(COALESCE(SUM(ABS(sl.variance_quantity)), 0) AS CHAR) AS absolute_variance
           FROM inventory_stocktakes st LEFT JOIN inventory_stocktake_lines sl ON sl.stocktake_id = st.id
          WHERE st.tenant_id = :tenantId AND st.store_id = :storeId
          GROUP BY st.id ORDER BY st.created_at DESC LIMIT 100`, { tenantId, storeId }
      );
      const showCosts = canViewCosts(request);
      const visibleSupplierItems = supplierItems.map((row) => ({
        ...row,
        latest_purchase_unit_cost_rm: showCosts ? row.latest_purchase_unit_cost_rm : null
      }));
      const visiblePurchaseOrders = purchaseOrders.map((row) => ({
        ...row,
        total_rm: showCosts ? row.total_rm : null
      }));
      return {
        can_view_costs: showCosts,
        supply_needs: supplyNeeds,
        suppliers,
        supplier_items: visibleSupplierItems,
        purchase_orders: visiblePurchaseOrders,
        transfers,
        stocktakes
      };
    } finally { connection.release(); }
  });

  app.patch('/v1/admin/inventory/items/:itemId/levels', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { itemId } = z.object({ itemId: id }).parse(request.params);
    const payload = levelSchema.parse(request.body);
    if (payload.ideal_stock_level > 0 && payload.ideal_stock_level < payload.reorder_level) {
      throw new ApiError(400, 'inventory_level_invalid', 'Ideal stock must be equal to or higher than the reorder alert.');
    }
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await assertStore(connection, request.adminAuth.tenantId, payload.store_id);
      await lockStock(connection, request.adminAuth.tenantId, payload.store_id, itemId);
      await connection.execute(
        `UPDATE inventory_store_stocks SET reorder_level = :reorderLevel,
                ideal_stock_level = :idealLevel, updated_at = UTC_TIMESTAMP()
          WHERE store_id = :storeId AND inventory_item_id = :itemId`,
        { reorderLevel: payload.reorder_level, idealLevel: payload.ideal_stock_level, storeId: payload.store_id, itemId }
      );
      await audit(connection, request, 'inventory_levels_updated', 'inventory_item', itemId, payload);
      await connection.commit();
      return { updated: true };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/admin/inventory/suppliers', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAccess(request);
    if (!canViewCosts(request)) {
      throw new ApiError(403, 'inventory_supplier_catalog_forbidden', 'Only Super Admin can manage suppliers and supplier pricing.');
    }
    const payload = supplierSchema.parse(request.body);
    const supplierCode = code(payload.code || payload.name);
    if (!supplierCode) throw new ApiError(400, 'inventory_supplier_code_invalid', 'Enter a valid supplier name or code.');
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_suppliers
           (tenant_id, code, name, contact_name, email, phone, payment_terms, default_lead_time_days, notes)
         VALUES (:tenantId, :code, :name, :contactName, :email, :phone, :paymentTerms, :leadTime, :notes)`,
        {
          tenantId: request.adminAuth.tenantId,
          code: supplierCode,
          name: payload.name,
          contactName: payload.contact_name || null,
          email: payload.email || null,
          phone: payload.phone || null,
          paymentTerms: payload.payment_terms || null,
          leadTime: payload.default_lead_time_days,
          notes: payload.notes || null
        }
      );
      await audit(connection, request, 'inventory_supplier_created', 'inventory_supplier', result.insertId, payload);
      await connection.commit();
      return reply.code(201).send({ id: result.insertId, code: supplierCode });
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw new ApiError(409, 'inventory_supplier_exists', 'A supplier with this code already exists.');
      throw error;
    } finally { connection.release(); }
  });

  app.post('/v1/admin/inventory/supplier-items', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    if (!canViewCosts(request)) {
      throw new ApiError(403, 'inventory_supplier_catalog_forbidden', 'Only Super Admin can manage suppliers and supplier pricing.');
    }
    const payload = supplierItemSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await assertSupplier(connection, request.adminAuth.tenantId, payload.supplier_id);
      const [items] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM inventory_items WHERE id = :itemId AND tenant_id = :tenantId AND is_active = 1 LIMIT 1 FOR UPDATE',
        { itemId: payload.inventory_item_id, tenantId: request.adminAuth.tenantId }
      );
      if (!items[0]) throw new ApiError(404, 'inventory_item_not_found', 'Inventory item not found for this tenant.');
      if (payload.is_preferred) await connection.execute('UPDATE inventory_supplier_items SET is_preferred = 0 WHERE tenant_id = :tenantId AND inventory_item_id = :itemId', { tenantId: request.adminAuth.tenantId, itemId: payload.inventory_item_id });
      await connection.execute(
        `INSERT INTO inventory_supplier_items
           (tenant_id, supplier_id, inventory_item_id, supplier_sku, supplier_barcode, purchase_unit_name,
            stock_units_per_purchase_unit, latest_purchase_unit_cost_rm, minimum_order_quantity, lead_time_days, is_preferred)
         VALUES (:tenantId, :supplierId, :itemId, :sku, :barcode, :unitName, :factor, :cost, :minimum, :leadTime, :preferred)
         ON DUPLICATE KEY UPDATE supplier_sku = VALUES(supplier_sku), supplier_barcode = VALUES(supplier_barcode), purchase_unit_name = VALUES(purchase_unit_name),
           stock_units_per_purchase_unit = VALUES(stock_units_per_purchase_unit),
           latest_purchase_unit_cost_rm = VALUES(latest_purchase_unit_cost_rm),
           minimum_order_quantity = VALUES(minimum_order_quantity), lead_time_days = VALUES(lead_time_days), is_preferred = VALUES(is_preferred)`,
        {
          tenantId: request.adminAuth.tenantId,
          supplierId: payload.supplier_id,
          itemId: payload.inventory_item_id,
          sku: payload.supplier_sku || null,
          barcode: payload.supplier_barcode || null,
          unitName: payload.purchase_unit_name,
          factor: payload.stock_units_per_purchase_unit,
          cost: payload.latest_purchase_unit_cost_rm,
          minimum: payload.minimum_order_quantity,
          leadTime: payload.lead_time_days ?? null,
          preferred: payload.is_preferred ? 1 : 0
        }
      );
      await audit(connection, request, 'inventory_supplier_item_saved', 'inventory_item', payload.inventory_item_id, payload);
      await connection.commit();
      return { updated: true };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/admin/inventory/purchase-orders', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAccess(request);
    const payload = purchaseOrderSchema.parse(request.body);
    if (new Set(payload.lines.map((line) => line.inventory_item_id)).size !== payload.lines.length) throw new ApiError(400, 'inventory_po_duplicate_item', 'Each item can appear only once.');
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await assertStore(connection, request.adminAuth.tenantId, payload.store_id);
      await assertSupplier(connection, request.adminAuth.tenantId, payload.supplier_id);
      const poRef = reference('PO');
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_purchase_orders
           (tenant_id, store_id, supplier_id, purchase_order_ref, expected_at, notes, created_by_admin_user_id)
         VALUES (:tenantId, :storeId, :supplierId, :ref, :expectedAt, :notes, :adminUserId)`,
        { tenantId: request.adminAuth.tenantId, storeId: payload.store_id, supplierId: payload.supplier_id, ref: poRef, expectedAt: payload.expected_at ?? null, notes: payload.notes || null, adminUserId: request.adminAuth.adminUserId }
      );
      for (const line of payload.lines) {
        await lockStock(connection, request.adminAuth.tenantId, payload.store_id, line.inventory_item_id);
        const [catalogRows] = await connection.query<RowDataPacket[]>(
          `SELECT purchase_unit_name, stock_units_per_purchase_unit,
                  latest_purchase_unit_cost_rm, minimum_order_quantity
             FROM inventory_supplier_items
            WHERE tenant_id = :tenantId AND supplier_id = :supplierId
              AND inventory_item_id = :itemId LIMIT 1 FOR UPDATE`,
          {
            tenantId: request.adminAuth.tenantId,
            supplierId: payload.supplier_id,
            itemId: line.inventory_item_id
          }
        );
        const catalogItem = catalogRows[0];
        if (!catalogItem) {
          throw new ApiError(
            409,
            'inventory_po_supplier_item_missing',
            'Every purchase-order item must first be linked to the selected supplier.'
          );
        }
        if (line.ordered_purchase_units < Number(catalogItem.minimum_order_quantity)) {
          throw new ApiError(
            409,
            'inventory_po_below_supplier_minimum',
            'An ordered quantity is below the supplier minimum order quantity.'
          );
        }
        await connection.execute(
          `INSERT INTO inventory_purchase_order_lines
             (purchase_order_id, inventory_item_id, ordered_purchase_units, stock_units_per_purchase_unit, purchase_unit_name, purchase_unit_cost_rm)
           VALUES (:poId, :itemId, :ordered, :factor, :unitName, :cost)`,
          {
            poId: result.insertId,
            itemId: line.inventory_item_id,
            ordered: line.ordered_purchase_units,
            factor: catalogItem.stock_units_per_purchase_unit,
            unitName: catalogItem.purchase_unit_name,
            cost: catalogItem.latest_purchase_unit_cost_rm
          }
        );
      }
      await audit(connection, request, 'inventory_purchase_order_created', 'inventory_purchase_order', result.insertId, payload);
      await connection.commit();
      return reply.code(201).send({ id: result.insertId, purchase_order_ref: poRef });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.get('/v1/admin/inventory/purchase-orders/:poId', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { poId } = z.object({ poId: id }).parse(request.params);
    const [orders] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT po.*, s.name AS supplier_name FROM inventory_purchase_orders po
       JOIN inventory_suppliers s ON s.id = po.supplier_id
       WHERE po.id = :poId AND po.tenant_id = :tenantId LIMIT 1`,
      { poId, tenantId: request.adminAuth.tenantId }
    );
    if (!orders[0]) throw new ApiError(404, 'inventory_po_not_found', 'Purchase order not found.');
    const [lines] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT pol.*, ii.name AS inventory_item_name, ii.unit_code,
              CAST(pol.ordered_purchase_units - pol.received_purchase_units AS CHAR) AS remaining_purchase_units
         FROM inventory_purchase_order_lines pol
         JOIN inventory_items ii ON ii.id = pol.inventory_item_id AND ii.tenant_id = :tenantId
        WHERE pol.purchase_order_id = :poId ORDER BY ii.name`,
      { poId, tenantId: request.adminAuth.tenantId }
    );
    const [receipts] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT r.*, au.full_name AS received_by_name,
              COUNT(rl.id) AS line_count,
              CAST(COALESCE(SUM(rl.accepted_purchase_units), 0) AS CHAR) AS accepted_purchase_units,
              CAST(COALESCE(SUM(rl.rejected_purchase_units), 0) AS CHAR) AS rejected_purchase_units
         FROM inventory_purchase_receipts r
         JOIN admin_users au ON au.id = r.received_by_admin_user_id
         LEFT JOIN inventory_purchase_receipt_lines rl ON rl.receipt_id = r.id
        WHERE r.purchase_order_id = :poId AND r.tenant_id = :tenantId
        GROUP BY r.id, au.full_name ORDER BY r.received_at DESC`,
      { poId, tenantId: request.adminAuth.tenantId }
    );
    const showCosts = canViewCosts(request);
    return {
      can_view_costs: showCosts,
      purchase_order: orders[0],
      lines: lines.map((line) => ({ ...line, purchase_unit_cost_rm: showCosts ? line.purchase_unit_cost_rm : null })),
      receipts
    };
  });

  app.post('/v1/admin/inventory/purchase-orders/:poId/submit', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { poId } = z.object({ poId: id }).parse(request.params);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE inventory_purchase_orders SET status = 'submitted', submitted_at = UTC_TIMESTAMP()
          WHERE id = :poId AND tenant_id = :tenantId AND status = 'draft'`,
        { poId, tenantId: request.adminAuth.tenantId }
      );
      if (result.affectedRows !== 1) throw new ApiError(409, 'inventory_po_not_submittable', 'Only a draft purchase order can be submitted.');
      await audit(connection, request, 'inventory_purchase_order_submitted', 'inventory_purchase_order', poId, { status: 'submitted' });
      await connection.commit();
      return { submitted: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/inventory/purchase-orders/:poId/receive', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { poId } = z.object({ poId: id }).parse(request.params);
    const payload = receiptSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [orders] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM inventory_purchase_orders WHERE id = :poId AND tenant_id = :tenantId
          AND status IN ('submitted', 'partially_received') LIMIT 1 FOR UPDATE`,
        { poId, tenantId: request.adminAuth.tenantId }
      );
      const order = orders[0];
      if (!order) throw new ApiError(409, 'inventory_po_not_receivable', 'This purchase order cannot receive stock.');
      const receiptRef = reference('GRN');
      const [receiptHeader] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_purchase_receipts
           (tenant_id, purchase_order_id, receipt_ref, delivery_order_ref,
            supplier_invoice_ref, received_at, notes, received_by_admin_user_id)
         VALUES (:tenantId, :poId, :receiptRef, :deliveryOrderRef,
                 :invoiceRef, :receivedAt, :notes, :adminUserId)`,
        {
          tenantId: request.adminAuth.tenantId,
          poId,
          receiptRef,
          deliveryOrderRef: payload.delivery_order_ref || null,
          invoiceRef: payload.supplier_invoice_ref || null,
          receivedAt: payload.received_at ?? new Date(),
          notes: payload.notes || null,
          adminUserId: request.adminAuth.adminUserId
        }
      );
      for (const receipt of payload.lines) {
        const [lines] = await connection.query<RowDataPacket[]>(
          `SELECT * FROM inventory_purchase_order_lines WHERE id = :lineId AND purchase_order_id = :poId LIMIT 1 FOR UPDATE`,
          { lineId: receipt.line_id, poId }
        );
        const line = lines[0];
        if (!line) throw new ApiError(400, 'inventory_po_line_invalid', 'A purchase order line is invalid.');
        const remaining = Number(line.ordered_purchase_units) - Number(line.received_purchase_units);
        const acceptedPurchaseUnits = rounded(receipt.delivered_purchase_units - receipt.rejected_purchase_units);
        if (receipt.rejected_purchase_units > 0 && !receipt.rejection_reason) {
          throw new ApiError(400, 'inventory_receipt_rejection_reason_required', 'Enter a reason for every rejected quantity.');
        }
        if (acceptedPurchaseUnits > remaining) throw new ApiError(409, 'inventory_po_over_received', 'Accepted quantity exceeds the outstanding order quantity.');
        await connection.execute(
          `INSERT INTO inventory_purchase_receipt_lines
             (receipt_id, purchase_order_line_id, delivered_purchase_units,
              accepted_purchase_units, rejected_purchase_units, rejection_reason)
           VALUES (:receiptId, :lineId, :delivered, :accepted, :rejected, :reason)`,
          {
            receiptId: receiptHeader.insertId,
            lineId: receipt.line_id,
            delivered: receipt.delivered_purchase_units,
            accepted: acceptedPurchaseUnits,
            rejected: receipt.rejected_purchase_units,
            reason: receipt.rejection_reason || null
          }
        );
        if (acceptedPurchaseUnits === 0) continue;
        const stock = await lockStock(connection, request.adminAuth.tenantId, order.store_id, line.inventory_item_id);
        const stockIncrease = rounded(acceptedPurchaseUnits * Number(line.stock_units_per_purchase_unit));
        const oldOnHand = Number(stock.on_hand_quantity);
        const balance = rounded(oldOnHand + stockIncrease);
        const stockUnitCost = Number(line.purchase_unit_cost_rm) / Number(line.stock_units_per_purchase_unit);
        const averageCost = balance > 0 ? ((oldOnHand * Number(stock.average_unit_cost_rm)) + (stockIncrease * stockUnitCost)) / balance : stockUnitCost;
        await connection.execute('UPDATE inventory_store_stocks SET on_hand_quantity = :balance, average_unit_cost_rm = :averageCost WHERE id = :stockId', { balance, averageCost, stockId: stock.id });
        await connection.execute('UPDATE inventory_purchase_order_lines SET received_purchase_units = received_purchase_units + :received WHERE id = :lineId', { received: acceptedPurchaseUnits, lineId: receipt.line_id });
        await addMovement(connection, { tenantId: request.adminAuth.tenantId, storeId: order.store_id, itemId: line.inventory_item_id, type: 'purchase_receive', change: stockIncrease, balance, unitCost: stockUnitCost, note: `Received on ${receiptRef} against ${order.purchase_order_ref}.`, adminUserId: request.adminAuth.adminUserId });
        await connection.execute(
          `INSERT INTO inventory_supplier_cost_history
             (tenant_id, supplier_id, inventory_item_id, purchase_order_line_id, purchase_unit_name,
              stock_units_per_purchase_unit, purchase_unit_cost_rm)
           VALUES (:tenantId, :supplierId, :itemId, :lineId, :unitName, :factor, :cost)`,
          { tenantId: request.adminAuth.tenantId, supplierId: order.supplier_id, itemId: line.inventory_item_id, lineId: receipt.line_id, unitName: line.purchase_unit_name, factor: line.stock_units_per_purchase_unit, cost: line.purchase_unit_cost_rm }
        );
        await connection.execute(
          `UPDATE inventory_supplier_items SET latest_purchase_unit_cost_rm = :cost
            WHERE supplier_id = :supplierId AND inventory_item_id = :itemId`,
          { cost: line.purchase_unit_cost_rm, supplierId: order.supplier_id, itemId: line.inventory_item_id }
        );
      }
      const [remainingRows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS remaining FROM inventory_purchase_order_lines
          WHERE purchase_order_id = :poId AND received_purchase_units < ordered_purchase_units`, { poId }
      );
      const complete = Number(remainingRows[0].remaining) === 0;
      await connection.execute(
        `UPDATE inventory_purchase_orders SET status = :status, received_at = IF(:complete = 1, UTC_TIMESTAMP(), received_at)
          WHERE id = :poId`, { status: complete ? 'received' : 'partially_received', complete: complete ? 1 : 0, poId }
      );
      await audit(connection, request, 'inventory_purchase_order_received', 'inventory_purchase_order', poId, { receipt_ref: receiptRef, ...payload });
      await connection.commit();
      return { received: true, receipt_ref: receiptRef, status: complete ? 'received' : 'partially_received' };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/admin/inventory/purchase-orders/:poId/cancel', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { poId } = z.object({ poId: id }).parse(request.params);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE inventory_purchase_orders
            SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP()
          WHERE id = :poId AND tenant_id = :tenantId
            AND status IN ('draft', 'submitted')`,
        { poId, tenantId: request.adminAuth.tenantId }
      );
      if (result.affectedRows !== 1) {
        throw new ApiError(409, 'inventory_po_not_cancellable', 'Only an unreceived draft or submitted purchase order can be cancelled.');
      }
      await audit(connection, request, 'inventory_purchase_order_cancelled', 'inventory_purchase_order', poId, { status: 'cancelled' });
      await connection.commit();
      return { cancelled: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/inventory/transfers', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAccess(request);
    const payload = transferSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await assertStore(connection, request.adminAuth.tenantId, payload.from_store_id);
      await assertStore(connection, request.adminAuth.tenantId, payload.to_store_id);
      const transferRef = reference('TR');
      const [header] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_stock_transfers
           (tenant_id, from_store_id, to_store_id, transfer_ref, status, notes, submitted_at, created_by_admin_user_id)
         VALUES (:tenantId, :fromStoreId, :toStoreId, :ref, 'submitted', :notes, UTC_TIMESTAMP(), :adminUserId)`,
        { tenantId: request.adminAuth.tenantId, fromStoreId: payload.from_store_id, toStoreId: payload.to_store_id, ref: transferRef, notes: payload.notes || null, adminUserId: request.adminAuth.adminUserId }
      );
      for (const line of payload.lines) {
        const stock = await lockStock(connection, request.adminAuth.tenantId, payload.from_store_id, line.inventory_item_id);
        const available = Number(stock.on_hand_quantity) - Number(stock.reserved_quantity);
        if (available < line.quantity) throw new ApiError(409, 'inventory_transfer_insufficient_stock', 'A transfer item does not have enough available stock.');
        const balance = rounded(Number(stock.on_hand_quantity) - line.quantity);
        await connection.execute('UPDATE inventory_store_stocks SET on_hand_quantity = :balance WHERE id = :stockId', { balance, stockId: stock.id });
        await connection.execute(
          `INSERT INTO inventory_stock_transfer_lines (transfer_id, inventory_item_id, quantity, unit_cost_rm_snapshot)
           VALUES (:transferId, :itemId, :quantity, :cost)`,
          { transferId: header.insertId, itemId: line.inventory_item_id, quantity: line.quantity, cost: stock.average_unit_cost_rm }
        );
        await addMovement(connection, { tenantId: request.adminAuth.tenantId, storeId: payload.from_store_id, itemId: line.inventory_item_id, type: 'transfer_out', change: -line.quantity, balance, note: `Sent on ${transferRef}.`, adminUserId: request.adminAuth.adminUserId });
      }
      await audit(connection, request, 'inventory_transfer_submitted', 'inventory_stock_transfer', header.insertId, payload);
      await connection.commit();
      return reply.code(201).send({ id: header.insertId, transfer_ref: transferRef });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/admin/inventory/transfers/:transferId/receive', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { transferId } = z.object({ transferId: id }).parse(request.params);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [transfers] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM inventory_stock_transfers WHERE id = :transferId AND tenant_id = :tenantId
          AND status = 'submitted' LIMIT 1 FOR UPDATE`, { transferId, tenantId: request.adminAuth.tenantId }
      );
      const transfer = transfers[0];
      if (!transfer) throw new ApiError(409, 'inventory_transfer_not_receivable', 'This transfer cannot be received.');
      const [lines] = await connection.query<RowDataPacket[]>('SELECT * FROM inventory_stock_transfer_lines WHERE transfer_id = :transferId FOR UPDATE', { transferId });
      for (const line of lines) {
        const stock = await lockStock(connection, request.adminAuth.tenantId, transfer.to_store_id, line.inventory_item_id);
        const oldOnHand = Number(stock.on_hand_quantity);
        const balance = rounded(oldOnHand + Number(line.quantity));
        const averageCost = balance > 0 ? ((oldOnHand * Number(stock.average_unit_cost_rm)) + (Number(line.quantity) * Number(line.unit_cost_rm_snapshot))) / balance : Number(line.unit_cost_rm_snapshot);
        await connection.execute('UPDATE inventory_store_stocks SET on_hand_quantity = :balance, average_unit_cost_rm = :averageCost WHERE id = :stockId', { balance, averageCost, stockId: stock.id });
        await addMovement(connection, { tenantId: request.adminAuth.tenantId, storeId: transfer.to_store_id, itemId: line.inventory_item_id, type: 'transfer_in', change: Number(line.quantity), balance, note: `Received from ${transfer.transfer_ref}.`, adminUserId: request.adminAuth.adminUserId });
      }
      await connection.execute(`UPDATE inventory_stock_transfers SET status = 'received', received_at = UTC_TIMESTAMP(), received_by_admin_user_id = :adminUserId WHERE id = :transferId`, { adminUserId: request.adminAuth.adminUserId, transferId });
      await audit(connection, request, 'inventory_transfer_received', 'inventory_stock_transfer', transferId, {});
      await connection.commit();
      return { received: true };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/admin/inventory/stocktakes', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAccess(request);
    const payload = stocktakeSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await assertStore(connection, request.adminAuth.tenantId, payload.store_id);
      const stocktakeRef = reference('ST');
      const [header] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_stocktakes
           (tenant_id, store_id, stocktake_ref, status, notes, submitted_at, created_by_admin_user_id)
         VALUES (:tenantId, :storeId, :ref, 'submitted', :notes, UTC_TIMESTAMP(), :adminUserId)`,
        { tenantId: request.adminAuth.tenantId, storeId: payload.store_id, ref: stocktakeRef, notes: payload.notes || null, adminUserId: request.adminAuth.adminUserId }
      );
      for (const line of payload.lines) {
        const stock = await lockStock(connection, request.adminAuth.tenantId, payload.store_id, line.inventory_item_id);
        const expected = Number(stock.on_hand_quantity);
        const [unitRows] = await connection.query<RowDataPacket[]>(
          `SELECT COALESCE(si.purchase_unit_name, ii.purchase_unit_name, 'unit') AS purchase_unit_name,
                  COALESCE(si.stock_units_per_purchase_unit, ii.purchase_to_stock_factor, 1) AS conversion_factor
             FROM inventory_items ii
             LEFT JOIN inventory_supplier_items si
               ON si.inventory_item_id = ii.id AND si.tenant_id = :tenantId AND si.is_preferred = 1
            WHERE ii.id = :itemId AND ii.tenant_id = :tenantId LIMIT 1`,
          { tenantId: request.adminAuth.tenantId, itemId: line.inventory_item_id }
        );
        const purchaseUnitName = String(unitRows[0]?.purchase_unit_name || 'unit');
        const conversionFactor = Number(unitRows[0]?.conversion_factor || 1);
        const counted = rounded((line.counted_purchase_units * conversionFactor) + line.counted_loose_units);
        await connection.execute(
          `INSERT INTO inventory_stocktake_lines
             (stocktake_id, inventory_item_id, expected_quantity, counted_quantity,
              counted_purchase_units, counted_loose_units, purchase_unit_name_snapshot,
              stock_units_per_purchase_unit_snapshot, variance_quantity)
           VALUES (:stocktakeId, :itemId, :expected, :counted,
                   :purchaseUnits, :looseUnits, :purchaseUnitName, :factor, :variance)`,
          {
            stocktakeId: header.insertId,
            itemId: line.inventory_item_id,
            expected,
            counted,
            purchaseUnits: line.counted_purchase_units,
            looseUnits: line.counted_loose_units,
            purchaseUnitName,
            factor: conversionFactor,
            variance: rounded(counted - expected)
          }
        );
      }
      await audit(connection, request, 'inventory_stocktake_submitted', 'inventory_stocktake', header.insertId, payload);
      await connection.commit();
      return reply.code(201).send({ id: header.insertId, stocktake_ref: stocktakeRef });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/admin/inventory/stocktakes/:stocktakeId/approve', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { stocktakeId } = z.object({ stocktakeId: id }).parse(request.params);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [headers] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM inventory_stocktakes WHERE id = :stocktakeId AND tenant_id = :tenantId
          AND status = 'submitted' LIMIT 1 FOR UPDATE`, { stocktakeId, tenantId: request.adminAuth.tenantId }
      );
      const header = headers[0];
      if (!header) throw new ApiError(409, 'inventory_stocktake_not_approvable', 'This stock count cannot be approved.');
      const [lines] = await connection.query<RowDataPacket[]>('SELECT * FROM inventory_stocktake_lines WHERE stocktake_id = :stocktakeId FOR UPDATE', { stocktakeId });
      for (const line of lines) {
        const stock = await lockStock(connection, request.adminAuth.tenantId, header.store_id, line.inventory_item_id);
        if (Number(line.counted_quantity) < Number(stock.reserved_quantity)) throw new ApiError(409, 'inventory_stocktake_below_reserved', 'A counted balance is below stock reserved for open orders. Resolve those orders first.');
        const change = rounded(Number(line.counted_quantity) - Number(stock.on_hand_quantity));
        if (change !== 0) {
          await connection.execute('UPDATE inventory_store_stocks SET on_hand_quantity = :counted WHERE id = :stockId', { counted: line.counted_quantity, stockId: stock.id });
          await addMovement(connection, { tenantId: request.adminAuth.tenantId, storeId: header.store_id, itemId: line.inventory_item_id, type: 'stocktake_adjustment', change, balance: Number(line.counted_quantity), note: `Approved ${header.stocktake_ref}.`, adminUserId: request.adminAuth.adminUserId });
        }
      }
      await connection.execute(`UPDATE inventory_stocktakes SET status = 'approved', approved_at = UTC_TIMESTAMP(), approved_by_admin_user_id = :adminUserId WHERE id = :stocktakeId`, { adminUserId: request.adminAuth.adminUserId, stocktakeId });
      await audit(connection, request, 'inventory_stocktake_approved', 'inventory_stocktake', stocktakeId, {});
      await connection.commit();
      return { approved: true };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/admin/inventory/wastage', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAccess(request);
    const payload = wastageSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await assertStore(connection, request.adminAuth.tenantId, payload.store_id);
      const stock = await lockStock(connection, request.adminAuth.tenantId, payload.store_id, payload.inventory_item_id);
      const balance = rounded(Number(stock.on_hand_quantity) - payload.quantity);
      if (balance < Number(stock.reserved_quantity) || balance < 0) throw new ApiError(409, 'inventory_wastage_insufficient_stock', 'This wastage would reduce stock below the amount reserved for open orders.');
      await connection.execute('UPDATE inventory_store_stocks SET on_hand_quantity = :balance WHERE id = :stockId', { balance, stockId: stock.id });
      const movementId = await addMovement(connection, { tenantId: request.adminAuth.tenantId, storeId: payload.store_id, itemId: payload.inventory_item_id, type: 'waste', change: -payload.quantity, balance, note: payload.note || payload.reason_code, adminUserId: request.adminAuth.adminUserId });
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_wastage_records
           (tenant_id, store_id, inventory_item_id, quantity, reason_code, note, movement_id, created_by_admin_user_id)
         VALUES (:tenantId, :storeId, :itemId, :quantity, :reason, :note, :movementId, :adminUserId)`,
        { tenantId: request.adminAuth.tenantId, storeId: payload.store_id, itemId: payload.inventory_item_id, quantity: payload.quantity, reason: payload.reason_code, note: payload.note || null, movementId, adminUserId: request.adminAuth.adminUserId }
      );
      await audit(connection, request, 'inventory_wastage_recorded', 'inventory_wastage', result.insertId, payload);
      await connection.commit();
      return reply.code(201).send({ id: result.insertId });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/admin/inventory/supplier-returns', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAccess(request);
    const payload = supplierReturnSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await assertStore(connection, request.adminAuth.tenantId, payload.store_id);
      await assertSupplier(connection, request.adminAuth.tenantId, payload.supplier_id);
      const stock = await lockStock(connection, request.adminAuth.tenantId, payload.store_id, payload.inventory_item_id);
      const balance = rounded(Number(stock.on_hand_quantity) - payload.quantity);
      if (balance < Number(stock.reserved_quantity) || balance < 0) throw new ApiError(409, 'inventory_return_insufficient_stock', 'This return would reduce stock below the amount reserved for open orders.');
      await connection.execute('UPDATE inventory_store_stocks SET on_hand_quantity = :balance WHERE id = :stockId', { balance, stockId: stock.id });
      const returnRef = reference('RTN');
      const movementId = await addMovement(connection, { tenantId: request.adminAuth.tenantId, storeId: payload.store_id, itemId: payload.inventory_item_id, type: 'supplier_return', change: -payload.quantity, balance, note: `${returnRef}: ${payload.reason}`, adminUserId: request.adminAuth.adminUserId });
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_supplier_returns
           (tenant_id, store_id, supplier_id, inventory_item_id, quantity, return_ref, reason, movement_id, created_by_admin_user_id)
         VALUES (:tenantId, :storeId, :supplierId, :itemId, :quantity, :ref, :reason, :movementId, :adminUserId)`,
        { tenantId: request.adminAuth.tenantId, storeId: payload.store_id, supplierId: payload.supplier_id, itemId: payload.inventory_item_id, quantity: payload.quantity, ref: returnRef, reason: payload.reason, movementId, adminUserId: request.adminAuth.adminUserId }
      );
      await audit(connection, request, 'inventory_supplier_return_recorded', 'inventory_supplier_return', result.insertId, payload);
      await connection.commit();
      return reply.code(201).send({ id: result.insertId, return_ref: returnRef });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.get('/v1/admin/inventory/option-recipes', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const [options] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT o.id, o.name AS option_name, g.name AS group_name,
              COUNT(r.id) AS component_count
         FROM menu_option_group_options o
         JOIN menu_option_groups g ON g.id = o.option_group_id
         LEFT JOIN inventory_option_recipes r ON r.option_group_option_id = o.id AND r.tenant_id = :tenantId
        WHERE g.tenant_id = :tenantId AND o.is_active = 1
        GROUP BY o.id, o.name, g.name, g.sort_order, o.sort_order
        ORDER BY g.sort_order, g.name, o.sort_order, o.name`, { tenantId: request.adminAuth.tenantId }
    );
    const [recipes] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT r.option_group_option_id, r.inventory_item_id, ii.name AS inventory_item_name,
              ii.unit_code, CAST(r.quantity_delta AS CHAR) AS quantity_delta
         FROM inventory_option_recipes r JOIN inventory_items ii ON ii.id = r.inventory_item_id
        WHERE r.tenant_id = :tenantId ORDER BY r.option_group_option_id, ii.name`, { tenantId: request.adminAuth.tenantId }
    );
    return { options, recipes };
  });

  app.put('/v1/admin/inventory/option-recipes/:optionId', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { optionId } = z.object({ optionId: id }).parse(request.params);
    const payload = optionRecipeSchema.parse(request.body);
    if (new Set(payload.components.map((row) => row.inventory_item_id)).size !== payload.components.length) throw new ApiError(400, 'inventory_option_recipe_duplicate', 'Each inventory item can appear only once.');
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [options] = await connection.query<RowDataPacket[]>(
        `SELECT o.id FROM menu_option_group_options o JOIN menu_option_groups g ON g.id = o.option_group_id
          WHERE o.id = :optionId AND g.tenant_id = :tenantId LIMIT 1 FOR UPDATE`,
        { optionId, tenantId: request.adminAuth.tenantId }
      );
      if (!options[0]) throw new ApiError(404, 'inventory_option_not_found', 'Menu option not found for this tenant.');
      await connection.execute('DELETE FROM inventory_option_recipes WHERE tenant_id = :tenantId AND option_group_option_id = :optionId', { tenantId: request.adminAuth.tenantId, optionId });
      for (const component of payload.components) {
        const [items] = await connection.query<RowDataPacket[]>('SELECT id FROM inventory_items WHERE id = :itemId AND tenant_id = :tenantId AND is_active = 1 LIMIT 1', { itemId: component.inventory_item_id, tenantId: request.adminAuth.tenantId });
        if (!items[0]) throw new ApiError(400, 'inventory_option_recipe_item_invalid', 'An inventory item is unavailable.');
        await connection.execute(
          `INSERT INTO inventory_option_recipes (tenant_id, option_group_option_id, inventory_item_id, quantity_delta)
           VALUES (:tenantId, :optionId, :itemId, :quantityDelta)`,
          { tenantId: request.adminAuth.tenantId, optionId, itemId: component.inventory_item_id, quantityDelta: component.quantity_delta }
        );
      }
      await audit(connection, request, 'inventory_option_recipe_updated', 'menu_option', optionId, payload);
      await connection.commit();
      return { updated: true };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.get('/v1/admin/inventory/cost-analytics', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    if (!canViewCosts(request)) {
      throw new ApiError(403, 'inventory_cost_access_forbidden', 'Only Super Admin can view supplier prices and inventory costs.');
    }
    const { store_id: storeId } = stockQuery.parse(request.query);
    const tenantId = request.adminAuth.tenantId;
    const connection = await mysqlPool.getConnection();
    try {
      await assertStore(connection, tenantId, storeId);
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT ii.id, ii.name, ii.unit_code,
                CAST(COALESCE(ss.on_hand_quantity, 0) AS CHAR) AS on_hand_quantity,
                CAST(COALESCE(ss.average_unit_cost_rm, 0) AS CHAR) AS average_unit_cost_rm,
                CAST(COALESCE(ss.on_hand_quantity * ss.average_unit_cost_rm, 0) AS CHAR) AS stock_value_rm,
                CAST(COALESCE(usage_30.consumed_quantity, 0) AS CHAR) AS consumed_last_30_days,
                CAST(COALESCE(usage_30.consumed_cost_rm, 0) AS CHAR) AS consumed_cost_last_30_days_rm,
                CAST(COALESCE(costs.minimum_cost, 0) AS CHAR) AS lowest_recent_purchase_cost_rm,
                CAST(COALESCE(costs.maximum_cost, 0) AS CHAR) AS highest_recent_purchase_cost_rm
           FROM inventory_items ii
           LEFT JOIN inventory_store_stocks ss ON ss.inventory_item_id = ii.id AND ss.store_id = :storeId
           LEFT JOIN (
             SELECT inventory_item_id, SUM(-quantity_change) AS consumed_quantity,
                    SUM(-quantity_change * COALESCE(unit_cost_rm, 0)) AS consumed_cost_rm
               FROM inventory_movements
              WHERE tenant_id = :tenantId AND store_id = :storeId AND movement_type = 'consumption'
                AND created_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY GROUP BY inventory_item_id
           ) usage_30 ON usage_30.inventory_item_id = ii.id
           LEFT JOIN (
             SELECT inventory_item_id,
                    MIN(purchase_unit_cost_rm / stock_units_per_purchase_unit) AS minimum_cost,
                    MAX(purchase_unit_cost_rm / stock_units_per_purchase_unit) AS maximum_cost
               FROM inventory_supplier_cost_history
              WHERE tenant_id = :tenantId AND effective_at >= UTC_TIMESTAMP() - INTERVAL 180 DAY
              GROUP BY inventory_item_id
           ) costs ON costs.inventory_item_id = ii.id
          WHERE ii.tenant_id = :tenantId AND ii.is_active = 1 ORDER BY stock_value_rm DESC, ii.name`,
        { tenantId, storeId }
      );
      return { generated_at: new Date().toISOString(), items: rows };
    } finally { connection.release(); }
  });

  app.get('/v1/admin/inventory/procurement-report', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { store_id: storeId } = stockQuery.parse(request.query);
    const tenantId = request.adminAuth.tenantId;
    const showCosts = canViewCosts(request);
    const connection = await mysqlPool.getConnection();
    try {
      await assertStore(connection, tenantId, storeId);
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT po.id, po.purchase_order_ref, po.status, po.expected_at, po.submitted_at,
                po.received_at, s.name AS supplier_name,
                COUNT(DISTINCT pol.id) AS line_count,
                CAST(COALESCE(SUM(pol.ordered_purchase_units), 0) AS CHAR) AS ordered_purchase_units,
                CAST(COALESCE(SUM(pol.received_purchase_units), 0) AS CHAR) AS accepted_purchase_units,
                CAST(COALESCE(SUM(pol.ordered_purchase_units - pol.received_purchase_units), 0) AS CHAR) AS outstanding_purchase_units,
                CAST(COALESCE(SUM(pol.ordered_purchase_units * pol.purchase_unit_cost_rm), 0) AS CHAR) AS ordered_value_rm,
                CAST(COALESCE(SUM(pol.received_purchase_units * pol.purchase_unit_cost_rm), 0) AS CHAR) AS received_value_rm,
                CAST(COALESCE(rejected.rejected_purchase_units, 0) AS CHAR) AS rejected_purchase_units,
                COALESCE(receipts.receipt_count, 0) AS receipt_count
           FROM inventory_purchase_orders po
           JOIN inventory_suppliers s ON s.id = po.supplier_id
           LEFT JOIN inventory_purchase_order_lines pol ON pol.purchase_order_id = po.id
           LEFT JOIN (
             SELECT r.purchase_order_id, COUNT(*) AS receipt_count
               FROM inventory_purchase_receipts r
              WHERE r.tenant_id = :tenantId GROUP BY r.purchase_order_id
           ) receipts ON receipts.purchase_order_id = po.id
           LEFT JOIN (
             SELECT r.purchase_order_id, SUM(rl.rejected_purchase_units) AS rejected_purchase_units
               FROM inventory_purchase_receipts r
               JOIN inventory_purchase_receipt_lines rl ON rl.receipt_id = r.id
              WHERE r.tenant_id = :tenantId GROUP BY r.purchase_order_id
           ) rejected ON rejected.purchase_order_id = po.id
          WHERE po.tenant_id = :tenantId AND po.store_id = :storeId
          GROUP BY po.id, s.name, rejected.rejected_purchase_units, receipts.receipt_count
          ORDER BY po.created_at DESC LIMIT 250`,
        { tenantId, storeId }
      );
      return {
        can_view_costs: showCosts,
        generated_at: new Date().toISOString(),
        purchase_orders: rows.map((row) => ({
          ...row,
          ordered_value_rm: showCosts ? row.ordered_value_rm : null,
          received_value_rm: showCosts ? row.received_value_rm : null
        }))
      };
    } finally {
      connection.release();
    }
  });
}
