import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  consumeInventoryForOrder,
  reserveInventoryForOrder
} from '../dist/services/inventory.js';
import { evaluateAndRaiseStockAlerts } from '../dist/services/inventory-alerts.js';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function mockConnection({ allocations = [], requirements = [], stock = null } = {}) {
  const executions = [];
  return {
    executions,
    async query(sql) {
      if (sql.includes('FROM inventory_order_allocations')) return [allocations];
      if (sql.includes('FROM inventory_order_usage_lines')) return [requirements];
      if (sql.includes('FROM inventory_store_stocks')) return [stock ? [stock] : []];
      if (sql.includes('FROM inventory_stock_alerts')) return [[]];
      throw new Error(`Unexpected inventory query: ${sql}`);
    },
    async execute(sql, values) {
      if (sql.includes('INSERT IGNORE INTO inventory_order_usage_lines')) return [{ affectedRows: 1 }];
      if (sql.includes('INSERT IGNORE INTO inventory_store_stocks')) return [{ affectedRows: 1 }];
      executions.push({ sql, values });
      return [{ affectedRows: 1 }];
    }
  };
}

test('inventory reservation holds each recipe component without changing on-hand stock', async () => {
  const connection = mockConnection({
    requirements: [{ tenant_id: 1, store_id: 2, inventory_item_id: 3, item_name: 'Fresh milk', required_quantity: '400.000' }],
    stock: { id: 9, inventory_item_id: 3, on_hand_quantity: '1000.000', reserved_quantity: '100.000', reorder_level: '0.000', average_unit_cost_rm: '0.0100' }
  });
  const result = await reserveInventoryForOrder(connection, 55);
  assert.equal(result.reservedComponents, 1);
  assert.equal(connection.executions.length, 3);
  assert.match(connection.executions[0].sql, /reserved_quantity = reserved_quantity \+ :required/);
  assert.doesNotMatch(connection.executions[0].sql, /on_hand_quantity = on_hand_quantity -/);
  assert.equal(connection.executions[0].values.required, 400);
});

test('inventory reservation allows checkout when available stock is insufficient and raises a stock alert', async () => {
  const connection = mockConnection({
    requirements: [{ tenant_id: 1, store_id: 2, inventory_item_id: 3, item_name: 'Large cup', required_quantity: '10.000' }],
    stock: { id: 9, inventory_item_id: 3, on_hand_quantity: '0.000', reserved_quantity: '0.000', reorder_level: '5.000', average_unit_cost_rm: '0.1000' }
  });
  const result = await reserveInventoryForOrder(connection, 56);
  assert.equal(result.reservedComponents, 1);
  assert.ok(connection.executions.some((e) => e.sql.includes('INSERT INTO inventory_stock_alerts')));
});

test('collection consumes a prior reservation, allows shortfall, and writes an idempotent ledger movement', async () => {
  const connection = mockConnection({
    allocations: [{ id: 7, tenant_id: 1, store_id: 2, inventory_item_id: 3, quantity: '250.000', status: 'reserved' }],
    stock: { id: 9, inventory_item_id: 3, on_hand_quantity: '100.000', reserved_quantity: '250.000', reorder_level: '0.000', average_unit_cost_rm: '0.0200' }
  });
  const result = await consumeInventoryForOrder(connection, 57);
  assert.equal(result.consumedComponents, 1);
  assert.match(connection.executions[0].sql, /on_hand_quantity = on_hand_quantity - :amount/);
  assert.match(connection.executions[1].sql, /INSERT IGNORE INTO inventory_movements/);
  assert.equal(connection.executions[1].values.quantityChange, -250);
  assert.equal(connection.executions[1].values.balanceAfter, -150);
  assert.equal(connection.executions[1].values.totalCost, 5);
  assert.match(connection.executions[2].sql, /status = 'consumed'/);
});

test('customer catalog never auto-disables availability_status from ingredient stock', async () => {
  const catalog = await source('src/http/routes/catalog.ts');
  assert.doesNotMatch(catalog, /loadRecipeAvailabilityIssues/);
  assert.match(catalog, /item\.availability_status = item\.is_available \? "available" : "sold_out"/);
});

test('inventory administration is tenant scoped and order lifecycle hooks cover both channels', async () => {
  const admin = await source('src/http/routes/admin-inventory.ts');
  assert.match(admin, /requireAnyAdminRole\(request, \['super_admin', 'operations_admin'\]\)/);
  assert.match(admin, /tenant_id = :tenantId/);
  assert.match(admin, /r\.tenant_id = :tenantId/);
  assert.doesNotMatch(admin, /c\.tenant_id/);
  assert.match(admin, /admin_audit_logs/);

  const mobile = await source('src/http/routes/checkout.ts');
  const counter = await source('src/http/routes/counter-payments.ts');
  const orders = await source('src/http/routes/admin-orders.ts');
  assert.match(mobile, /reserveInventoryForOrder\(connection, orderId\)/);
  assert.match(counter, /reserveInventoryForOrder\(connection, orderId\)/);
  assert.match(mobile, /consumeInventoryForOrder\(connection, order\.id\)/);
  assert.match(orders, /consumeInventoryForOrder\(connection, internalId\)/);
  assert.match(orders, /reverseInventoryForOrder\(connection, refund\.order_id\)/);
});

test('stock lock selects average cost so collection can price the consumption movement', async () => {
  const code = await source('src/services/inventory.ts');
  assert.match(code, /CAST\(average_unit_cost_rm AS CHAR\) AS average_unit_cost_rm/);
});

test('partial restock resolves the empty alert and opens a low alert', async () => {
  const alerts = [{ id: 1, level: 'empty', status: 'open' }];
  const connection = {
    async query(sql, values) {
      if (sql.includes('FROM inventory_store_stocks')) {
        return [[{ inventory_item_id: 3, on_hand_quantity: '4', reserved_quantity: '0', reorder_level: '10' }]];
      }
      if (sql.includes('FROM inventory_stock_alerts')) {
        return [alerts.filter((a) => a.status === 'open' && a.level === values[3])];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async execute(sql, values) {
      if (sql.includes("SET status = 'resolved'")) {
        for (const alert of alerts) if (alert.level !== values[3]) alert.status = 'resolved';
      } else if (sql.includes('INSERT INTO inventory_stock_alerts')) {
        alerts.push({ id: 2, level: values[3], status: 'open' });
      } else {
        throw new Error(`Unexpected statement: ${sql}`);
      }
      return [{ affectedRows: 1 }];
    }
  };
  await evaluateAndRaiseStockAlerts(connection, { tenantId: 1, storeId: 2, inventoryItemIds: [3] });
  assert.deepEqual(alerts.map(({ level, status }) => ({ level, status })), [
    { level: 'empty', status: 'resolved' },
    { level: 'low', status: 'open' }
  ]);
});
