import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/http/routes/admin-data-retention.ts', import.meta.url), 'utf8');

test('retention cleanup requires an administrator password and audit log', () => {
  assert.match(source, /requireAdminActionConfirmation/);
  assert.match(source, /data_retention_cleanup/);
  assert.match(source, /dry_run/);
});

test('protected business history is never a cleanup target', () => {
  for (const table of [
    'orders',
    'payments',
    'refunds',
    'token_ledger',
    'voucher_redemptions',
    'loyalty_cup_events',
    'referral_reward_outcomes',
    'admin_audit_logs',
  ]) {
    assert.doesNotMatch(source, new RegExp(`DELETE\\s+FROM\\s+${table}\\b`, 'i'));
  }
});

test('orphan media must complete quarantine and is rechecked before deletion', () => {
  assert.match(source, /INTERVAL 30 DAY/);
  assert.match(source, /review_due_at <= UTC_TIMESTAMP\(\)/);
  assert.match(source, /orphanPaths\.has\(row\.record_key\)/);
});
