import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { evaluateAndRaiseStockAlerts, parseAlertRecipients } from '../../services/inventory-alerts.js';

const positiveId = z.coerce.number().int().positive();

function requireAccess(request: FastifyRequest): void {
  requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
}

function canViewCosts(request: FastifyRequest): boolean {
  return request.adminAuth.roles.some((role) => ['super_admin', 'admin'].includes(role));
}

function codeFromName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

export async function registerAdminInventoryStorehubRoutes(app: FastifyInstance): Promise<void> {
  // 1. Supply Needs (supports store_id=all or numeric store_id)
  app.get('/v1/admin/inventory/supply-needs', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const tenantId = request.adminAuth.tenantId;
    const rawStoreId = String((request.query as Record<string, unknown>)?.store_id ?? 'all').trim();
    const storeId = rawStoreId === 'all' || rawStoreId === '' ? null : positiveId.parse(rawStoreId);

    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT ss.store_id, s.name AS store_name, ii.id AS inventory_item_id, ii.code, ii.name,
              ii.category, ii.unit_code,
              CAST(ss.on_hand_quantity AS CHAR) AS on_hand_quantity,
              CAST(ss.reserved_quantity AS CHAR) AS reserved_quantity,
              CAST(ss.on_hand_quantity - ss.reserved_quantity AS CHAR) AS available_quantity,
              CAST(ss.reorder_level AS CHAR) AS reorder_level,
              CAST(ss.ideal_stock_level AS CHAR) AS ideal_stock_level,
              CAST(GREATEST(COALESCE(NULLIF(ss.ideal_stock_level, 0), ss.reorder_level) - (ss.on_hand_quantity - ss.reserved_quantity), 0) AS CHAR) AS suggested_order_quantity,
              sup.id AS preferred_supplier_id, sup.name AS preferred_supplier_name,
              si.purchase_unit_name, CAST(si.stock_units_per_purchase_unit AS CHAR) AS stock_units_per_purchase_unit
         FROM inventory_store_stocks ss
         JOIN stores s ON s.id = ss.store_id AND s.tenant_id = :tenantId AND s.status = 'active'
         JOIN inventory_items ii ON ii.id = ss.inventory_item_id AND ii.tenant_id = :tenantId AND ii.is_active = 1
         LEFT JOIN inventory_supplier_items si ON si.tenant_id = :tenantId AND si.inventory_item_id = ii.id AND si.is_preferred = 1
         LEFT JOIN inventory_suppliers sup ON sup.id = si.supplier_id AND sup.is_active = 1
        WHERE ss.tenant_id = :tenantId
          AND (:storeId IS NULL OR ss.store_id = :storeId)
          AND ((ss.on_hand_quantity - ss.reserved_quantity) <= 0 OR (ss.reorder_level > 0 AND (ss.on_hand_quantity - ss.reserved_quantity) <= ss.reorder_level))
        ORDER BY (ss.on_hand_quantity - ss.reserved_quantity) ASC, s.name, ii.name`,
      { tenantId, storeId }
    );

    return { items: rows };
  });

  // 2. Stock Value (negative balances contribute RM 0 and are flagged as shortfall)
  app.get('/v1/admin/inventory/stock-value', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const tenantId = request.adminAuth.tenantId;
    const rawStoreId = String((request.query as Record<string, unknown>)?.store_id ?? 'all').trim();
    const storeId = rawStoreId === 'all' || rawStoreId === '' ? null : positiveId.parse(rawStoreId);
    const showCosts = canViewCosts(request);

    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT ss.store_id, s.name AS store_name, ii.id AS inventory_item_id, ii.code, ii.name,
              ii.category, ii.unit_code,
              CAST(ss.on_hand_quantity AS CHAR) AS on_hand_quantity,
              CAST(ss.reserved_quantity AS CHAR) AS reserved_quantity,
              CAST(ss.on_hand_quantity - ss.reserved_quantity AS CHAR) AS available_quantity,
              ${showCosts ? 'CAST(ss.average_unit_cost_rm AS CHAR) AS average_unit_cost_rm,' : 'NULL AS average_unit_cost_rm,'}
              ${showCosts ? 'CAST(GREATEST(ss.on_hand_quantity, 0) * ss.average_unit_cost_rm AS CHAR) AS stock_value_rm,' : 'NULL AS stock_value_rm,'}
              IF(ss.on_hand_quantity < 0, 1, 0) AS is_shortfall
         FROM inventory_store_stocks ss
         JOIN stores s ON s.id = ss.store_id AND s.tenant_id = :tenantId
         JOIN inventory_items ii ON ii.id = ss.inventory_item_id AND ii.tenant_id = :tenantId AND ii.is_active = 1
        WHERE ss.tenant_id = :tenantId
          AND (:storeId IS NULL OR ss.store_id = :storeId)
        ORDER BY s.name, ii.name`,
      { tenantId, storeId }
    );

    const totalValueRm = showCosts
      ? rows.reduce((sum, row) => sum + Number(row.stock_value_rm || 0), 0)
      : null;

    return { can_view_costs: showCosts, total_value_rm: totalValueRm, items: rows };
  });

  // 3. Stock Loss Report (wastage + negative stocktake variances + shortfall consumptions)
  app.get('/v1/admin/inventory/stock-loss-report', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const tenantId = request.adminAuth.tenantId;
    const rawStoreId = String((request.query as Record<string, unknown>)?.store_id ?? 'all').trim();
    const storeId = rawStoreId === 'all' || rawStoreId === '' ? null : positiveId.parse(rawStoreId);
    const showCosts = canViewCosts(request);

    const [wastage] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT w.id, w.store_id, s.name AS store_name, ii.id AS inventory_item_id, ii.name AS item_name, ii.unit_code,
              'wastage' AS loss_source, w.reason_code AS reason, w.note,
              CAST(w.quantity AS CHAR) AS quantity,
              ${showCosts ? 'CAST(ABS(COALESCE(m.total_cost_rm, 0)) AS CHAR) AS cost_rm,' : 'NULL AS cost_rm,'}
              w.created_at
         FROM inventory_wastage_records w
         JOIN stores s ON s.id = w.store_id
         JOIN inventory_items ii ON ii.id = w.inventory_item_id
         LEFT JOIN inventory_movements m ON m.id = w.movement_id
        WHERE w.tenant_id = :tenantId AND (:storeId IS NULL OR w.store_id = :storeId)
        ORDER BY w.created_at DESC
        LIMIT 250`,
      { tenantId, storeId }
    );

    const [variances] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT stl.id, st.store_id, s.name AS store_name, ii.id AS inventory_item_id, ii.name AS item_name, ii.unit_code,
              'stocktake_variance' AS loss_source, st.stocktake_ref AS reason, st.notes AS note,
              CAST(ABS(stl.variance_quantity) AS CHAR) AS quantity,
              ${showCosts ? 'CAST(ABS(stl.variance_quantity) * ss.average_unit_cost_rm AS CHAR) AS cost_rm,' : 'NULL AS cost_rm,'}
              COALESCE(st.approved_at, st.created_at) AS created_at
         FROM inventory_stocktake_lines stl
         JOIN inventory_stocktakes st ON st.id = stl.stocktake_id
         JOIN stores s ON s.id = st.store_id
         JOIN inventory_items ii ON ii.id = stl.inventory_item_id
         LEFT JOIN inventory_store_stocks ss ON ss.store_id = st.store_id AND ss.inventory_item_id = stl.inventory_item_id
        WHERE st.tenant_id = :tenantId AND st.status = 'approved' AND stl.variance_quantity < 0
          AND (:storeId IS NULL OR st.store_id = :storeId)
        ORDER BY COALESCE(st.approved_at, st.created_at) DESC
        LIMIT 250`,
      { tenantId, storeId }
    );

    const entries = [...wastage, ...variances].sort(
      (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()
    );
    return { can_view_costs: showCosts, entries };
  });

  // 4. Stock Return List + Wastage List + Audit Trail
  app.get('/v1/admin/inventory/supplier-returns', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const tenantId = request.adminAuth.tenantId;
    const rawStoreId = String((request.query as Record<string, unknown>)?.store_id ?? 'all').trim();
    const storeId = rawStoreId === 'all' || rawStoreId === '' ? null : positiveId.parse(rawStoreId);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT r.id, r.return_ref, r.store_id, s.name AS store_name, r.supplier_id, sup.name AS supplier_name,
              r.inventory_item_id, ii.name AS item_name, ii.unit_code,
              CAST(r.quantity AS CHAR) AS quantity, r.reason, r.created_at
         FROM inventory_supplier_returns r
         JOIN stores s ON s.id = r.store_id
         JOIN inventory_suppliers sup ON sup.id = r.supplier_id
         JOIN inventory_items ii ON ii.id = r.inventory_item_id
        WHERE r.tenant_id = :tenantId AND (:storeId IS NULL OR r.store_id = :storeId)
        ORDER BY r.created_at DESC
        LIMIT 250`,
      { tenantId, storeId }
    );
    return { returns: rows };
  });

  app.get('/v1/admin/inventory/wastage', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const tenantId = request.adminAuth.tenantId;
    const rawStoreId = String((request.query as Record<string, unknown>)?.store_id ?? 'all').trim();
    const storeId = rawStoreId === 'all' || rawStoreId === '' ? null : positiveId.parse(rawStoreId);
    const showCosts = canViewCosts(request);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT w.id, w.store_id, s.name AS store_name, w.inventory_item_id, ii.name AS item_name, ii.unit_code,
              CAST(w.quantity AS CHAR) AS quantity, w.reason_code, w.note,
              ${showCosts ? 'CAST(ABS(COALESCE(m.total_cost_rm, 0)) AS CHAR) AS cost_rm,' : 'NULL AS cost_rm,'}
              w.created_at
         FROM inventory_wastage_records w
         JOIN stores s ON s.id = w.store_id
         JOIN inventory_items ii ON ii.id = w.inventory_item_id
         LEFT JOIN inventory_movements m ON m.id = w.movement_id
        WHERE w.tenant_id = :tenantId AND (:storeId IS NULL OR w.store_id = :storeId)
        ORDER BY w.created_at DESC
        LIMIT 250`,
      { tenantId, storeId }
    );
    return { can_view_costs: showCosts, records: rows };
  });

  app.get('/v1/admin/inventory/audit-trail', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const tenantId = request.adminAuth.tenantId;
    const q = request.query as Record<string, unknown>;
    const rawStoreId = String(q?.store_id ?? 'all').trim();
    const storeId = rawStoreId === 'all' || rawStoreId === '' ? null : positiveId.parse(rawStoreId);
    const movementType = String(q?.movement_type ?? '').trim() || null;
    const search = String(q?.search ?? '').trim();
    const limit = Math.min(250, Math.max(20, Number(q?.limit ?? 100) || 100));
    const showCosts = canViewCosts(request);

    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT m.id, m.store_id, s.name AS store_name, m.inventory_item_id, ii.name AS item_name, ii.unit_code,
              m.movement_type, CAST(m.quantity_change AS CHAR) AS quantity_change,
              CAST(m.balance_after AS CHAR) AS balance_after,
              ${showCosts ? 'CAST(m.total_cost_rm AS CHAR) AS total_cost_rm,' : 'NULL AS total_cost_rm,'}
              m.note, m.created_at, au.full_name AS actor_name
         FROM inventory_movements m
         JOIN stores s ON s.id = m.store_id
         JOIN inventory_items ii ON ii.id = m.inventory_item_id
         LEFT JOIN admin_users au ON au.id = m.created_by_admin_user_id
        WHERE m.tenant_id = :tenantId
          AND (:storeId IS NULL OR m.store_id = :storeId)
          AND (:movementType IS NULL OR m.movement_type = :movementType)
          AND (:search = '' OR ii.name LIKE CONCAT('%', :search, '%') OR COALESCE(m.note, '') LIKE CONCAT('%', :search, '%'))
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT :limit`,
      { tenantId, storeId, movementType, search, limit }
    );

    return { can_view_costs: showCosts, movements: rows };
  });

  // 5. Multi-UoM Conversions per item
  app.get('/v1/admin/inventory/items/:itemId/units', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { itemId } = z.object({ itemId: positiveId }).parse(request.params);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, unit_name, CAST(factor_to_base AS CHAR) AS factor_to_base,
              allow_purchase, allow_count, allow_waste, is_active
         FROM inventory_item_units
        WHERE tenant_id = :tenantId AND inventory_item_id = :itemId AND is_active = 1
        ORDER BY unit_name`,
      { tenantId: request.adminAuth.tenantId, itemId }
    );
    return { units: rows };
  });

  app.put('/v1/admin/inventory/items/:itemId/units', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { itemId } = z.object({ itemId: positiveId }).parse(request.params);
    const payload = z.object({
      units: z.array(z.object({
        unit_name: z.string().trim().min(1).max(80),
        factor_to_base: z.coerce.number().positive().max(1_000_000),
        allow_purchase: z.boolean().default(true),
        allow_count: z.boolean().default(true),
        allow_waste: z.boolean().default(true)
      })).max(20)
    }).parse(request.body);

    const tenantId = request.adminAuth.tenantId;
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        'UPDATE inventory_item_units SET is_active = 0 WHERE tenant_id = :tenantId AND inventory_item_id = :itemId',
        { tenantId, itemId }
      );
      for (const unit of payload.units) {
        await connection.execute(
          `INSERT INTO inventory_item_units
             (tenant_id, inventory_item_id, unit_name, factor_to_base, allow_purchase, allow_count, allow_waste, is_active)
           VALUES (:tenantId, :itemId, :unitName, :factor, :allowPurchase, :allowCount, :allowWaste, 1)
           ON DUPLICATE KEY UPDATE
             factor_to_base = VALUES(factor_to_base),
             allow_purchase = VALUES(allow_purchase),
             allow_count = VALUES(allow_count),
             allow_waste = VALUES(allow_waste),
             is_active = 1`,
          {
            tenantId,
            itemId,
            unitName: unit.unit_name,
            factor: unit.factor_to_base,
            allowPurchase: unit.allow_purchase ? 1 : 0,
            allowCount: unit.allow_count ? 1 : 0,
            allowWaste: unit.allow_waste ? 1 : 0
          }
        );
      }
      await connection.commit();
      return { updated: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  // 6. CSV Import (inventory items and thresholds; stock counts are separate)
  app.post('/v1/admin/inventory/import-csv', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const payload = z.object({
      store_id: positiveId,
      dry_run: z.boolean().default(true),
      rows: z.array(z.object({
        name: z.string().trim().min(1).max(255),
        code: z.string().trim().max(80).optional().or(z.literal('')),
        barcode: z.string().trim().max(120).optional().or(z.literal('')),
        category: z.string().trim().max(80).optional().or(z.literal('')),
        unit_code: z.enum(['piece', 'gram', 'millilitre']).default('piece'),
        reorder_level: z.coerce.number().min(0).max(10_000_000).optional(),
        ideal_stock_level: z.coerce.number().min(0).max(10_000_000).optional()
      })).min(1).max(500)
    }).parse(request.body);

    const tenantId = request.adminAuth.tenantId;
    const [existingRows] = await mysqlPool.query<RowDataPacket[]>(
      'SELECT id, code, name FROM inventory_items WHERE tenant_id = :tenantId',
      { tenantId }
    );
    const byCode = new Map<string, number>();
    const byName = new Map<string, number>();
    for (const row of existingRows) {
      byCode.set(String(row.code).toLowerCase(), Number(row.id));
      byName.set(String(row.name).toLowerCase(), Number(row.id));
    }

    const preview = payload.rows.map((row) => {
      const code = (row.code && codeFromName(row.code)) || codeFromName(row.name);
      const matchedId = byCode.get(code.toLowerCase()) ?? byName.get(row.name.toLowerCase()) ?? null;
      return { ...row, code, action: matchedId ? 'update' : 'create', matched_item_id: matchedId };
    });

    if (payload.dry_run) {
      return { dry_run: true, summary: { create: preview.filter((r) => r.action === 'create').length, update: preview.filter((r) => r.action === 'update').length }, preview };
    }

    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const touchedIds: number[] = [];
      for (const row of preview) {
        let itemId = row.matched_item_id;
        if (itemId) {
          await connection.execute(
            `UPDATE inventory_items
                SET name = :name,
                    barcode = COALESCE(NULLIF(:barcode, ''), barcode),
                    category = COALESCE(NULLIF(:category, ''), category),
                    is_active = 1
              WHERE id = :itemId AND tenant_id = :tenantId`,
            { name: row.name, barcode: row.barcode || '', category: row.category || '', itemId, tenantId }
          );
        } else {
          const [res] = await connection.execute<RowDataPacket[] & { insertId: number }>(
            `INSERT INTO inventory_items (tenant_id, code, barcode, name, category, unit_code)
             VALUES (:tenantId, :code, :barcode, :name, :category, :unitCode)`,
            {
              tenantId,
              code: row.code,
              barcode: row.barcode || null,
              name: row.name,
              category: row.category || 'ingredient',
              unitCode: row.unit_code
            }
          );
          itemId = (res as unknown as { insertId: number }).insertId;
        }
        await connection.execute(
          `INSERT INTO inventory_store_stocks (tenant_id, store_id, inventory_item_id, reorder_level, ideal_stock_level)
           VALUES (:tenantId, :storeId, :itemId, :reorder, :ideal)
           ON DUPLICATE KEY UPDATE
             reorder_level = COALESCE(:reorderOpt, reorder_level),
             ideal_stock_level = COALESCE(:idealOpt, ideal_stock_level)`,
          {
            tenantId,
            storeId: payload.store_id,
            itemId,
            reorder: row.reorder_level ?? 0,
            ideal: row.ideal_stock_level ?? 0,
            reorderOpt: row.reorder_level ?? null,
            idealOpt: row.ideal_stock_level ?? null
          }
        );
        touchedIds.push(itemId);
      }
      await evaluateAndRaiseStockAlerts(connection, { tenantId, storeId: payload.store_id, inventoryItemIds: touchedIds });
      await connection.commit();
      return { dry_run: false, processed: preview.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  // 7. Stock Alert Settings & Admin Web Notification Bell
  app.get('/v1/admin/inventory/alert-settings', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT email_enabled, email_recipients_json, admin_web_enabled, barista_popup_enabled
         FROM inventory_alert_settings
        WHERE tenant_id = :tenantId
        LIMIT 1`,
      { tenantId: request.adminAuth.tenantId }
    );
    const row = rows[0];
    return {
      email_enabled: row ? Boolean(row.email_enabled) : true,
      email_recipients: row ? parseAlertRecipients(row.email_recipients_json) : [],
      admin_web_enabled: row ? Boolean(row.admin_web_enabled) : true,
      barista_popup_enabled: row ? Boolean(row.barista_popup_enabled) : true
    };
  });

  app.put('/v1/admin/inventory/alert-settings', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const payload = z.object({
      email_enabled: z.boolean(),
      email_recipients: z.array(z.string().trim().email().max(255)).max(50),
      admin_web_enabled: z.boolean(),
      barista_popup_enabled: z.boolean().default(true)
    }).parse(request.body);

    const recipients = parseAlertRecipients(payload.email_recipients);
    await mysqlPool.query(
      `INSERT INTO inventory_alert_settings
         (tenant_id, email_enabled, email_recipients_json, admin_web_enabled, barista_popup_enabled, updated_by_admin_user_id)
       VALUES (:tenantId, :emailEnabled, :recipientsJson, :adminWebEnabled, :baristaPopupEnabled, :adminUserId)
       ON DUPLICATE KEY UPDATE
         email_enabled = VALUES(email_enabled),
         email_recipients_json = VALUES(email_recipients_json),
         admin_web_enabled = VALUES(admin_web_enabled),
         barista_popup_enabled = VALUES(barista_popup_enabled),
         updated_by_admin_user_id = VALUES(updated_by_admin_user_id)`,
      {
        tenantId: request.adminAuth.tenantId,
        emailEnabled: payload.email_enabled ? 1 : 0,
        recipientsJson: JSON.stringify(recipients),
        adminWebEnabled: payload.admin_web_enabled ? 1 : 0,
        baristaPopupEnabled: payload.barista_popup_enabled ? 1 : 0,
        adminUserId: request.adminAuth.adminUserId
      }
    );

    return {
      email_enabled: payload.email_enabled,
      email_recipients: recipients,
      admin_web_enabled: payload.admin_web_enabled,
      barista_popup_enabled: payload.barista_popup_enabled
    };
  });

  app.get('/v1/admin/inventory/alerts', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const tenantId = request.adminAuth.tenantId;
    const [settingsRows] = await mysqlPool.query<RowDataPacket[]>(
      'SELECT admin_web_enabled FROM inventory_alert_settings WHERE tenant_id = :tenantId LIMIT 1',
      { tenantId }
    );
    if (settingsRows[0] && Number(settingsRows[0].admin_web_enabled) === 0) {
      return { alerts: [] };
    }

    const [alerts] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT a.id, a.store_id, s.name AS store_name, a.inventory_item_id, ii.name AS item_name,
              ii.unit_code, a.alert_level,
              CAST(a.available_quantity_snapshot AS CHAR) AS available_quantity,
              CAST(a.reorder_level_snapshot AS CHAR) AS reorder_level,
              a.barista_action, a.admin_acknowledged_at, a.created_at
         FROM inventory_stock_alerts a
         JOIN stores s ON s.id = a.store_id
         JOIN inventory_items ii ON ii.id = a.inventory_item_id
        WHERE a.tenant_id = :tenantId AND a.status = 'open'
        ORDER BY (a.admin_acknowledged_at IS NULL) DESC, FIELD(a.alert_level, 'empty', 'low'), a.created_at DESC
        LIMIT 100`,
      { tenantId }
    );

    return { alerts };
  });

  app.post('/v1/admin/inventory/alerts/:alertId/acknowledge', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAccess(request);
    const { alertId } = z.object({ alertId: positiveId }).parse(request.params);
    await mysqlPool.query(
      `UPDATE inventory_stock_alerts
          SET admin_acknowledged_by_admin_user_id = :adminUserId,
              admin_acknowledged_at = UTC_TIMESTAMP()
        WHERE id = :alertId AND tenant_id = :tenantId`,
      { adminUserId: request.adminAuth.adminUserId, alertId, tenantId: request.adminAuth.tenantId }
    );
    return { acknowledged: true };
  });
}
