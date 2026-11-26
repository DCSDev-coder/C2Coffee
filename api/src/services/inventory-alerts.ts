import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../db/mysql.js';
import { sendStockAlertEmail } from './otp-email.js';

type QueryExecutor = Pick<PoolConnection, 'query' | 'execute'>;

type StockAlertRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  store_id: number;
  inventory_item_id: number;
  on_hand_quantity: string;
  reserved_quantity: string;
  reorder_level: string;
};

/**
 * Evaluates current available stock for the given items at a store and opens
 * deduplicated 'low' or 'empty' alerts when thresholds are crossed. Restocking
 * above reorder_level resolves open alerts without ever toggling menu items on
 * or off automatically.
 */
export async function evaluateAndRaiseStockAlerts(
  executor: QueryExecutor,
  input: { tenantId: number; storeId: number; inventoryItemIds: number[] }
): Promise<void> {
  const uniqueIds = Array.from(
    new Set(input.inventoryItemIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
  );
  if (uniqueIds.length === 0) return;

  const placeholders = uniqueIds.map(() => '?').join(', ');
  const [stocks] = await executor.query<StockAlertRow[]>(
    `SELECT ss.id, ss.tenant_id, ss.store_id, ss.inventory_item_id,
            CAST(ss.on_hand_quantity AS CHAR) AS on_hand_quantity,
            CAST(ss.reserved_quantity AS CHAR) AS reserved_quantity,
            CAST(ss.reorder_level AS CHAR) AS reorder_level
       FROM inventory_store_stocks ss
       JOIN inventory_items ii ON ii.id = ss.inventory_item_id AND ii.is_active = 1
      WHERE ss.tenant_id = ? AND ss.store_id = ? AND ss.inventory_item_id IN (${placeholders})`,
    [input.tenantId, input.storeId, ...uniqueIds]
  );

  for (const stock of stocks) {
    const onHand = Number(stock.on_hand_quantity);
    const reserved = Number(stock.reserved_quantity);
    const available = Math.round((onHand - reserved + Number.EPSILON) * 1000) / 1000;
    const reorderLevel = Number(stock.reorder_level);

    const targetLevel: 'low' | 'empty' | null =
      available <= 0
        ? 'empty'
        : reorderLevel > 0 && available <= reorderLevel
          ? 'low'
          : null;

    if (targetLevel === null) {
      await executor.execute(
        `UPDATE inventory_stock_alerts
            SET status = 'resolved', resolved_at = UTC_TIMESTAMP()
          WHERE tenant_id = ? AND store_id = ? AND inventory_item_id = ? AND status = 'open'`,
        [input.tenantId, input.storeId, stock.inventory_item_id]
      );
      continue;
    }

    // Resolve the previous severity in either direction, including partial restocks.
    await executor.execute(
      `UPDATE inventory_stock_alerts
          SET status = 'resolved', resolved_at = UTC_TIMESTAMP()
        WHERE tenant_id = ? AND store_id = ? AND inventory_item_id = ?
          AND alert_level <> ? AND status = 'open'`,
      [input.tenantId, input.storeId, stock.inventory_item_id, targetLevel]
    );

    const [existing] = await executor.query<Array<RowDataPacket & { id: number }>>(
      `SELECT id
         FROM inventory_stock_alerts
        WHERE tenant_id = ? AND store_id = ? AND inventory_item_id = ?
          AND alert_level = ? AND status = 'open'
        LIMIT 1`,
      [input.tenantId, input.storeId, stock.inventory_item_id, targetLevel]
    );

    if (existing[0]) {
      await executor.execute(
        `UPDATE inventory_stock_alerts
            SET available_quantity_snapshot = ?, reorder_level_snapshot = ?
          WHERE id = ?`,
        [available, reorderLevel, existing[0].id]
      );
    } else {
      await executor.execute(
        `INSERT INTO inventory_stock_alerts
           (tenant_id, store_id, inventory_item_id, alert_level, status,
            available_quantity_snapshot, reorder_level_snapshot, created_at)
         VALUES (?, ?, ?, ?, 'open', ?, ?, UTC_TIMESTAMP())`,
        [input.tenantId, input.storeId, stock.inventory_item_id, targetLevel, available, reorderLevel]
      );
    }
  }
}

export function parseAlertRecipients(raw: unknown): string[] {
  if (!raw) return [];
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = raw.split(/[\s,;]+/);
    }
  }
  return Array.from(
    new Set(
      list
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
  );
}

type PendingAlertEmailRow = RowDataPacket & {
  alert_id: number;
  tenant_id: number;
  store_id: number;
  store_name: string;
  item_name: string;
  unit_code: string;
  alert_level: 'low' | 'empty';
  available_quantity_snapshot: string;
  reorder_level_snapshot: string;
  email_recipients_json: unknown;
};

/**
 * Sends one digest email per outlet for newly opened stock alerts that have not
 * been emailed yet. Failures are logged and retried on the next sweep without
 * affecting orders.
 */
export async function runStockAlertEmailSweep(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const [rows] = await mysqlPool.query<PendingAlertEmailRow[]>(
    `SELECT a.id AS alert_id, a.tenant_id, a.store_id, s.name AS store_name,
            ii.name AS item_name, ii.unit_code, a.alert_level,
            CAST(a.available_quantity_snapshot AS CHAR) AS available_quantity_snapshot,
            CAST(a.reorder_level_snapshot AS CHAR) AS reorder_level_snapshot,
            cfg.email_recipients_json
       FROM inventory_stock_alerts a
       JOIN inventory_alert_settings cfg
         ON cfg.tenant_id = a.tenant_id AND cfg.email_enabled = 1
       JOIN stores s ON s.id = a.store_id
       JOIN inventory_items ii ON ii.id = a.inventory_item_id
      WHERE a.status = 'open' AND a.email_sent_at IS NULL
      ORDER BY a.tenant_id, a.store_id, a.id
      LIMIT 200`
  );

  if (rows.length === 0) return { sent, failed };

  const byStore = new Map<string, PendingAlertEmailRow[]>();
  for (const row of rows) {
    const key = `${row.tenant_id}:${row.store_id}`;
    const list = byStore.get(key) ?? [];
    list.push(row);
    byStore.set(key, list);
  }

  for (const group of byStore.values()) {
    const recipients = parseAlertRecipients(group[0].email_recipients_json);
    const alertIds = group.map((row) => row.alert_id);
    if (recipients.length === 0) continue;

    try {
      await sendStockAlertEmail({
        to: recipients,
        storeName: group[0].store_name,
        items: group.map((row) => ({
          name: row.item_name,
          level: row.alert_level,
          available: row.available_quantity_snapshot,
          reorderLevel: row.reorder_level_snapshot,
          unitCode: row.unit_code
        }))
      });
      const placeholders = alertIds.map(() => '?').join(', ');
      await mysqlPool.execute(
        `UPDATE inventory_stock_alerts SET email_sent_at = UTC_TIMESTAMP() WHERE id IN (${placeholders})`,
        alertIds
      );
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { sent, failed };
}
