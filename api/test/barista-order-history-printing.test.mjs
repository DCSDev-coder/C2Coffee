import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('barista workspace order feed contains only today operational and history orders', async () => {
  const orders = await source('src/http/routes/admin-orders.ts');
  assert.match(orders, /view: z\.enum\(\['all', 'barista_workspace'\]\)/);
  assert.match(orders, /o\.status IN \('pending_payment', 'paid', 'accepted', 'preparing', 'ready_for_pickup', 'collected'\)/);
  assert.match(orders, /DATE_ADD\(o\.created_at, INTERVAL 8 HOUR\)/);
});

test('manual receipt requests remain tenant, outlet, role, and printer guarded', async () => {
  const printing = await source('src/http/routes/operational-integrations.ts');
  assert.match(printing, /app\.post\('\/v1\/barista\/print-jobs'/);
  assert.match(printing, /canOperate\(request\)/);
  assert.match(printing, /o\.order_ref = :orderRef AND t\.code = :tenantCode/);
  assert.match(printing, /admin_user_store_assignments/);
  assert.match(printing, /pt\.store_id = o\.store_id/);
  assert.match(printing, /pt\.status = 'connected'/);
  assert.match(printing, /request_type/);
});
