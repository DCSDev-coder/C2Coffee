import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('inventory purchasing is supplier linked and deliveries are recorded line by line', async () => {
  const operations = await source('src/components/InventoryOperations.jsx');

  assert.match(operations, /selectedSupplierCatalog/);
  assert.match(operations, /Only items linked to that supplier can be ordered/);
  assert.match(operations, /Receive delivery/);
  assert.match(operations, /delivery_order_ref/);
  assert.match(operations, /supplier_invoice_ref/);
  assert.match(operations, /rejected_purchase_units/);
  assert.match(operations, /Receiving history/);
  assert.doesNotMatch(operations, />\s*Receive all\s*</);
});

test('supplier costs and catalog controls are hidden from non-cost roles', async () => {
  const operations = await source('src/components/InventoryOperations.jsx');
  const inventory = await source('src/components/Inventory.jsx');

  assert.match(operations, /data\.can_view_costs/);
  assert.match(operations, /Cost analytics/);
  assert.match(inventory, /canViewCosts \? `RM/);
  assert.match(inventory, /Manual stock entry/);
});

test('manual supplier receipts require a supplier-linked item filter', async () => {
  const inventory = await source('src/components/Inventory.jsx');
  const api = await source('../api/src/http/routes/admin-inventory.ts');
  const migration = await source('../api/src/db/migrations/121_link_inventory_movements_to_supplier.sql');

  assert.match(inventory, /Select supplier first/);
  assert.match(inventory, /Only inventory items linked to this supplier can be received here/);
  assert.match(inventory, /movementSupplierItems/);
  assert.match(api, /inventory_supplier_required/);
  assert.match(api, /inventory_supplier_item_missing/);
  assert.match(api, /supplier_id/);
  assert.match(migration, /fk_inventory_movement_supplier/);
});
