import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('complimentary drink records remain separate, idempotent, and auditable', async () => {
  const migration = await source('src/db/migrations/138_create_marketing_drink_usage.sql');

  assert.match(migration, /CREATE TABLE marketing_drink_usages/);
  assert.match(migration, /CREATE TABLE marketing_drink_usage_items/);
  assert.match(migration, /CREATE TABLE marketing_drink_inventory_lines/);
  assert.match(migration, /barista_id INT NOT NULL/);
  assert.match(migration, /UNIQUE KEY uq_marketing_drink_usage_idempotency \(tenant_id, idempotency_key\)/);
  assert.match(migration, /'marketing_consumption', 'marketing_reversal'/);
  assert.doesNotMatch(migration, /customer_order_id|voucher_allocation_id|loyalty_cup/i);
});

test('barista marketing drink workflow requires drink products, attendance, PIN, and an audit record', async () => {
  const routes = await source('src/http/routes/barista-staff.ts');
  const guard = await source('src/admin/guard.ts');

  assert.match(routes, /app\.post\('\/v1\/barista\/marketing-drinks'/);
  assert.match(routes, /attendance\.clocked_out_at IS NULL/);
  assert.match(routes, /verifyPassword\(payload\.pin, barista\.pin_hash\)/);
  assert.match(routes, /category\.product_kind_code = 'drink'/);
  assert.match(routes, /idempotency_key = :idempotencyKey/);
  assert.match(routes, /'marketing_drink_recorded'/);
  assert.match(routes, /requireAnyAdminRole\(request, \['super_admin', 'operations_admin'\]\)/);
  assert.match(routes, /'marketing_drink_reversed'/);
  assert.match(guard, /canUseMarketingDrinks/);
  assert.match(guard, /path === '\/v1\/barista\/marketing-drinks\/catalog'/);
});

test('complimentary drink inventory uses recipes, protects reserved stock, and reverses explicitly', async () => {
  const inventory = await source('src/services/marketing-drink-usage.ts');

  assert.match(inventory, /inventory_menu_item_recipes/);
  assert.match(inventory, /marketing_recipe_required/);
  assert.match(inventory, /Number\(stock\.on_hand_quantity\) - Number\(stock\.reserved_quantity\)/);
  assert.match(inventory, /marketing_stock_unavailable/);
  assert.match(inventory, /'marketing_consumption'/);
  assert.match(inventory, /'marketing_reversal'/);
  assert.match(inventory, /LIMIT 1 FOR UPDATE/);
});

test('counter reprint is visibly marked as complimentary and not for sale', async () => {
  const printer = await source('../counter_app/lib/barista/services/direct_printer_service.dart');

  assert.match(printer, /printMarketingDrink/);
  assert.match(printer, /COMPLIMENTARY \/ MARKETING/);
  assert.match(printer, /NOT FOR SALE/);
});
