import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  consumeInventoryForOrder,
  reserveInventoryForOrder
} from '../dist/services/inventory.js';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function mockConnection({ allocations = [], requirements = [], stock = null } = {}) {
  const executions = [];
  return {
    executions,
    async query(sql) {
      if (sql.includes('FROM inventory_order_allocations')) return [allocations];
      if (sql.includes('SUM(r.quantity_per_menu_item')) return [requirements];
      if (sql.includes('FROM inventory_store_stocks')) return [stock ? [stock] : []];
      throw new Error(`Unexpected inventory query: ${sql}`);
    },
    async execute(sql, values) {
      executions.push({ sql, values });
      return [{ affectedRows: 1 }];
    }
  };
}

test('inventory reservation holds each recipe component without changing on-hand stock', async () => {
  const connection = mockConnection({
    requirements: [{ tenant_id: 1, store_id: 2, inventory_item_id: 3, item_name: 'Fresh milk', required_quantity: '400.000' }],
    stock: { id: 9, on_hand_quantity: '1000.000', reserved_quantity: '100.000' }
  });
  const result = await reserveInventoryForOrder(connection, 55);
  assert.equal(result.reservedComponents, 1);
  assert.equal(connection.executions.length, 2);
  assert.match(connection.executions[0].sql, /reserved_quantity = reserved_quantity \+ :required/);
  assert.doesNotMatch(connection.executions[0].sql, /on_hand_quantity = on_hand_quantity -/);
  assert.equal(connection.executions[0].values.required, 400);
});

test('inventory reservation blocks checkout when available stock is insufficient', async () => {
  const connection = mockConnection({
    requirements: [{ tenant_id: 1, store_id: 2, inventory_item_id: 3, item_name: 'Large cup', required_quantity: '10.000' }],
    stock: { id: 9, on_hand_quantity: '12.000', reserved_quantity: '5.000' }
  });
  await assert.rejects(
    reserveInventoryForOrder(connection, 56),
    (error) => error?.code === 'inventory_insufficient_stock'
  );
  assert.equal(connection.executions.length, 0);
});

test('collection consumes a prior reservation and writes an idempotent ledger movement', async () => {
  const connection = mockConnection({
    allocations: [{ id: 7, tenant_id: 1, store_id: 2, inventory_item_id: 3, quantity: '250.000', status: 'reserved' }],
    stock: { id: 9, on_hand_quantity: '1000.000', reserved_quantity: '250.000' }
  });
  const result = await consumeInventoryForOrder(connection, 57);
  assert.equal(result.consumedComponents, 1);
  assert.equal(connection.executions.length, 3);
  assert.match(connection.executions[0].sql, /on_hand_quantity = on_hand_quantity - :amount/);
  assert.match(connection.executions[1].sql, /INSERT IGNORE INTO inventory_movements/);
  assert.equal(connection.executions[1].values.quantityChange, -250);
  assert.equal(connection.executions[1].values.balanceAfter, 750);
  assert.match(connection.executions[2].sql, /status = 'consumed'/);
});

test('inventory administration is tenant scoped and order lifecycle hooks cover both channels', async () => {
  const admin = await source('src/http/routes/admin-inventory.ts');
  assert.match(admin, /requireAnyAdminRole\(request, \['super_admin', 'operations_admin'\]\)/);
  assert.match(admin, /tenant_id = :tenantId/);
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
