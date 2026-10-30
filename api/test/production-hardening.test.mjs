import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('standalone customer broadcasts are rate limited, idempotent, and audited', async () => {
  const marketing = await source('src/http/routes/admin-marketing.ts');
  assert.match(marketing, /idempotency_key: z\.string\(\)\.uuid\(\)/);
  assert.match(marketing, /rateLimit: \{ max: 5, timeWindow: "1 hour" \}/);
  assert.match(
    marketing,
    /ON DUPLICATE KEY UPDATE delivery_key = VALUES\(delivery_key\)/,
  );
  assert.doesNotMatch(marketing, /ON DUPLICATE KEY UPDATE id = id/);
  assert.match(marketing, /customer_message_broadcast/);
  assert.match(marketing, /type: "marketing_poster"/);
  assert.match(marketing, /message_kind: "customer_message"/);
  assert.match(marketing, /destination: "notifications"/);
  assert.match(marketing, /if \(idempotentReplay \|\| recipients === 0\)/);
  assert.match(marketing, /idempotent_replay: idempotentReplay/);
});

test('customer push registration retires stale tokens for the same device', async () => {
  const customerData = await source('src/http/routes/customer-data.ts');
  assert.match(customerData, /WHERE device_id = :deviceId/);
  assert.match(customerData, /push_token <> :pushToken/);
  assert.match(customerData, /AND status = 'active'/);
  assert.match(customerData, /tokenFingerprint/);
});

test('recurring side work is calendar-valid, range-limited, and duplicate-safe', async () => {
  const staff = await source('src/http/routes/barista-staff.ts');
  assert.match(staff, /function isRealIsoDate/);
  assert.match(staff, /side_work_date_out_of_range/);
  assert.match(staff, /today through the next 30 days/);
  assert.match(staff, /LIMIT 1 FOR UPDATE/);
  assert.match(staff, /skipped \+= 1/);
});

test('timetable publication rejects stale editors and supports an empty roster', async () => {
  const operations = await source('src/http/routes/operational-integrations.ts');
  const migration = await source('src/db/migrations/112_add_schedule_revision_guard.sql');
  assert.match(migration, /barista_schedule_revisions/);
  assert.match(operations, /expected_revision/);
  assert.match(operations, /schedule_changed/);
  assert.match(operations, /FOR UPDATE/);
  assert.doesNotMatch(operations, /Add at least one shift before publishing/);
});

test('production readiness requires every current release migration', async () => {
  const readiness = await source('src/scripts/production-readiness.ts');
  for (const migration of [
    '108_', '109_', '110_', '111_', '112_', '113_', '114_', '115_', '116_'
  ]) {
    assert.match(readiness, new RegExp(migration));
  }
  assert.match(readiness, /Latest schema migrations/);
});

test('menu restore clears the archive timestamp without undefined bind values', async () => {
  const menu = await source('src/http/routes/admin-menu.ts');
  assert.match(menu, /payload\.is_active[\s\S]{0,220}archived_at = NULL/);
  assert.doesNotMatch(menu, /archivedAt:\s*undefined/);
});
