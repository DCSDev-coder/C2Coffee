import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('counter and authorized barista order entry use the server-verified price channel', async () => {
  const counter = await source('src/http/routes/counter.ts');
  const counterPayments = await source('src/http/routes/counter-payments.ts');
  const guard = await source('src/counter/guard.ts');

  assert.match(counter, /loadCatalogMenu\(request\.counterAuth\.storeId, request\.counterOrderContext\.priceChannel\)/);
  assert.match(
    counter,
    /loadCheckoutMenuItems\([\s\S]{0,240}bootstrap\.tier,[\s\S]{0,80}request\.counterOrderContext\.priceChannel/,
  );
  assert.match(
    counterPayments,
    /loadCheckoutMenuItems\([\s\S]{0,300}bootstrap\?\.tier \?\? 'kawan',[\s\S]{0,80}request\.counterOrderContext\.priceChannel/,
  );
  assert.match(guard, /verifyAdminAccessToken/);
  assert.match(guard, /Number\(session\.tenant_id\) !== request\.counterAuth\.tenantId/);
  assert.match(guard, /resolveBaristaShiftAccess/);
  assert.match(guard, /priceChannel: 'barista'/);
  assert.match(counter, /preHandler: \[authenticateCounterDevice, authenticateCounterOrderContext\]/);
  assert.match(counterPayments, /preHandler: \[authenticateCounterDevice, authenticateCounterOrderContext\]/);
});

test('mobile catalog remains on customer price and barista menu uses shared counter price', async () => {
  const catalog = await source('src/http/routes/catalog.ts');
  const baristaMenu = await source('src/http/routes/barista-menu-availability.ts');

  assert.match(catalog, /priceChannel: 'mobile' \| 'counter' \| 'barista' = 'mobile'/);
  assert.match(catalog, /: 'i\.base_price_rm'/);
  assert.match(baristaMenu, /CAST\(i\.counter_price_rm AS CHAR\) AS base_price_rm/);
});

test('price migrations keep one shared counter and barista RM price', async () => {
  const migration = await source('src/db/migrations/146_add_counter_barista_prices.sql');
  const cleanupMigration = await source('src/db/migrations/147_remove_legacy_barista_price.sql');
  const demoSeed = await source('src/db/seeds/001_demo_seed.sql');

  assert.match(migration, /ADD COLUMN counter_price_rm DECIMAL\(12,2\) NULL/);
  assert.doesNotMatch(migration, /ADD COLUMN barista_price_rm/);
  assert.match(migration, /SET counter_price_rm = base_price_rm/);
  assert.match(migration, /MODIFY COLUMN counter_price_rm DECIMAL\(12,2\) NOT NULL/);
  assert.doesNotMatch(migration, /ALTER TABLE orders/);
  assert.match(cleanupMigration, /DROP COLUMN barista_price_rm/);
  assert.doesNotMatch(demoSeed, /barista_price_rm/);
  assert.match(demoSeed, /base_price_rm,\s+counter_price_rm,/);
  assert.match(demoSeed, /seeded_items\.base_price_rm,\s+seeded_items\.base_price_rm,/);
});

test('pay-at-counter uses a neutral method and barista confirmation retains legacy compatibility', async () => {
  const counter = await source('src/http/routes/counter.ts');
  const counterPayments = await source('src/http/routes/counter-payments.ts');
  const baristaStaff = await source('src/http/routes/barista-staff.ts');
  const adminGuard = await source('src/admin/guard.ts');

  assert.match(counter, /methods: \['manual_counter'\]/);
  assert.match(counterPayments, /'manual_counter', 'manual_terminal', 'manual_cash'/);
  assert.match(baristaStaff, /'manual_counter', 'manual_terminal', 'manual_cash'/);
  assert.match(baristaStaff, /Pay-at-counter payment confirmed by barista/);
  assert.match(baristaStaff, /reason: z\.string\(\)\.trim\(\)\.max\(300\)\.nullable\(\)\.optional\(\)/);
  assert.match(adminGuard, /\^\\\/v1\\\/barista\\\/orders\\\/\[\^\/\]\+\\\/cancel\$/);
  assert.match(adminGuard, /\^\\\/v1\\\/barista\\\/orders\\\/\[\^\/\]\+\\\/payment\\\/confirm\$/);
});
