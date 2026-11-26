import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { resolveAttendanceStoreId } from './barista-staff.js';
import { evaluateAndRaiseStockAlerts } from '../../services/inventory-alerts.js';
import { normalizeCustomizationValue, resolveCustomizationTypeForGroup } from './barista-menu-availability.js';

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
      await evaluateAndRaiseStockAlerts(connection, {
        tenantId: request.adminAuth.tenantId,
        storeId,
        inventoryItemIds: [payload.inventory_item_id]
      });
      await connection.commit();
      return reply.code(201).send({ id: movement.insertId, balance_after: balanceAfter });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  });

  app.get('/v1/barista/inventory/alerts', { preHandler: authenticateAdminRequest }, async (request) => {
    requireBaristaInventoryAccess(request);
    const storeId = await resolveAttendanceStoreId(request);
    const tenantId = request.adminAuth.tenantId;

    const [settingsRows] = await mysqlPool.query<RowDataPacket[]>(
      'SELECT barista_popup_enabled FROM inventory_alert_settings WHERE tenant_id = :tenantId LIMIT 1',
      { tenantId }
    );
    if (settingsRows[0] && Number(settingsRows[0].barista_popup_enabled) === 0) {
      return { store_id: storeId, alerts: [] };
    }

    const [alerts] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT a.id, a.inventory_item_id, ii.name AS inventory_item_name, ii.unit_code,
              a.alert_level,
              CAST(a.available_quantity_snapshot AS CHAR) AS available_quantity,
              CAST(a.reorder_level_snapshot AS CHAR) AS reorder_level,
              a.created_at
         FROM inventory_stock_alerts a
         JOIN inventory_items ii ON ii.id = a.inventory_item_id
        WHERE a.tenant_id = :tenantId AND a.store_id = :storeId
          AND a.status = 'open' AND a.barista_action = 'pending'
        ORDER BY FIELD(a.alert_level, 'empty', 'low'), a.created_at ASC`,
      { tenantId, storeId }
    );

    const enriched = [];
    for (const alert of alerts) {
      const itemId = Number(alert.inventory_item_id);
      const [menuItems] = await mysqlPool.query<RowDataPacket[]>(
        `SELECT mi.id, mi.name, COALESCE(sa.is_available, 1) AS is_available
           FROM inventory_menu_item_recipes r
           JOIN menu_items mi ON mi.id = r.menu_item_id AND mi.is_active = 1
           JOIN menu_item_tenants mt ON mt.menu_item_id = mi.id AND mt.tenant_id = :tenantId
           LEFT JOIN menu_item_store_availability sa ON sa.store_id = :storeId AND sa.menu_item_id = mi.id
          WHERE r.tenant_id = :tenantId AND r.inventory_item_id = :itemId
          ORDER BY mi.name`,
        { tenantId, storeId, itemId }
      );

      const [optionRows] = await mysqlPool.query<RowDataPacket[]>(
        `SELECT o.id, o.name AS option_name, g.id AS group_id, g.name AS group_name
           FROM inventory_option_recipes r
           JOIN menu_option_group_options o ON o.id = r.option_group_option_id AND o.is_active = 1
           JOIN menu_option_groups g ON g.id = o.option_group_id AND g.is_active = 1 AND g.tenant_id = :tenantId
          WHERE r.tenant_id = :tenantId AND r.inventory_item_id = :itemId
          ORDER BY g.sort_order, o.sort_order, o.name`,
        { tenantId, itemId }
      );

      const [customAvailRows] = await mysqlPool.query<RowDataPacket[]>(
        'SELECT customization_type, customization_value, is_available FROM store_customization_availability WHERE store_id = :storeId',
        { storeId }
      );
      const customAvailMap = new Map<string, boolean>();
      for (const row of customAvailRows) {
        customAvailMap.set(
          `${String(row.customization_type)}:${normalizeCustomizationValue(String(row.customization_value))}`,
          Boolean(row.is_available)
        );
      }

      const affectedOptions = optionRows.map((opt) => {
        const type = resolveCustomizationTypeForGroup(String(opt.group_name)) ?? `group:${opt.group_id}`;
        const value = normalizeCustomizationValue(String(opt.option_name));
        return {
          id: Number(opt.id),
          group_name: String(opt.group_name),
          option_name: String(opt.option_name),
          customization_type: type,
          customization_value: value,
          is_available: customAvailMap.get(`${type}:${value}`) ?? true
        };
      });

      enriched.push({
        id: Number(alert.id),
        inventory_item_id: itemId,
        inventory_item_name: String(alert.inventory_item_name),
        unit_code: String(alert.unit_code),
        alert_level: String(alert.alert_level),
        available_quantity: String(alert.available_quantity),
        reorder_level: String(alert.reorder_level),
        created_at: alert.created_at,
        affected_menu_items: menuItems.map((m) => ({
          id: Number(m.id),
          name: String(m.name),
          is_available: Boolean(m.is_available)
        })),
        affected_options: affectedOptions
      });
    }

    return { store_id: storeId, alerts: enriched };
  });

  app.post('/v1/barista/inventory/alerts/:alertId/respond', { preHandler: authenticateAdminRequest }, async (request) => {
    requireBaristaInventoryAccess(request);
    const params = z.object({ alertId: z.coerce.number().int().positive() }).parse(request.params);
    const payload = z.object({
      action: z.enum(['mark_out_of_stock', 'keep_available']),
      menu_item_ids: z.array(z.coerce.number().int().positive()).max(200).optional(),
      option_ids: z.array(z.coerce.number().int().positive()).max(200).optional()
    }).parse(request.body);
    const storeId = await resolveAttendanceStoreId(request);
    const tenantId = request.adminAuth.tenantId;

    const [alerts] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, inventory_item_id
         FROM inventory_stock_alerts
        WHERE id = :alertId AND tenant_id = :tenantId AND store_id = :storeId AND status = 'open'
        LIMIT 1`,
      { alertId: params.alertId, tenantId, storeId }
    );
    if (!alerts[0]) {
      throw new ApiError(404, 'stock_alert_not_found', 'Stock alert not found.');
    }

    if (payload.action === 'mark_out_of_stock') {
      const menuItemIds = payload.menu_item_ids ?? [];
      for (const menuItemId of menuItemIds) {
        await mysqlPool.query(
          `INSERT INTO menu_item_store_availability (store_id, menu_item_id, is_available)
           SELECT :storeId, i.id, 0
             FROM menu_items i
             JOIN menu_item_tenants mt ON mt.menu_item_id = i.id AND mt.tenant_id = :tenantId
            WHERE i.id = :menuItemId AND i.is_active = 1
           ON DUPLICATE KEY UPDATE is_available = 0`,
          { storeId, tenantId, menuItemId }
        );
      }

      const optionIds = payload.option_ids ?? [];
      if (optionIds.length > 0) {
        const placeholders = optionIds.map(() => '?').join(', ');
        const [optRows] = await mysqlPool.query<RowDataPacket[]>(
          `SELECT o.id, o.name AS option_name, g.id AS group_id, g.name AS group_name
             FROM menu_option_group_options o
             JOIN menu_option_groups g ON g.id = o.option_group_id AND g.tenant_id = ?
            WHERE o.id IN (${placeholders})`,
          [tenantId, ...optionIds]
        );
        for (const opt of optRows) {
          const type = resolveCustomizationTypeForGroup(String(opt.group_name)) ?? `group:${opt.group_id}`;
          const value = normalizeCustomizationValue(String(opt.option_name));
          await mysqlPool.query(
            `INSERT INTO store_customization_availability (store_id, customization_type, customization_value, is_available)
             VALUES (:storeId, :type, :value, 0)
             ON DUPLICATE KEY UPDATE is_available = 0`,
            { storeId, type, value }
          );
        }
      }
    }

    await mysqlPool.query(
      `UPDATE inventory_stock_alerts
          SET barista_action = :action,
              barista_responded_by_admin_user_id = :adminUserId,
              barista_responded_at = UTC_TIMESTAMP()
        WHERE id = :alertId`,
      {
        action: payload.action,
        adminUserId: request.adminAuth.adminUserId,
        alertId: params.alertId
      }
    );

    return { success: true, alert_id: params.alertId, action: payload.action };
  });
}
