import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('customer status refresh reconciles authoritative CHIP payment exactly once', async () => {
  const routes = await source('src/http/routes/topups.ts');
  const settlement = await source('src/services/chip-topup-settlement.ts');

  assert.match(routes, /getChipPurchase\(topup\.provider_bill_id\)/);
  assert.match(routes, /settleChipTopUpPurchase\(topup\.provider_bill_id, purchase/);
  assert.match(routes, /eventSource: 'customer_status_refresh'/);

  assert.match(settlement, /LIMIT 1 FOR UPDATE/);
  assert.match(settlement, /payment\.payment_status === 'paid' \|\| payment\.topup_status === 'paid'/);
  assert.match(settlement, /return \{ received: true, duplicate: true \}/);
  assert.match(settlement, /INSERT INTO token_ledger[\s\S]{0,500}'credit', 'topup_paid'/);
});

test('expired CHIP attempts are closed at the provider before their reservation is released', async () => {
  const reconciliation = await source('src/services/chip-topup-reconciliation.ts');

  assert.match(reconciliation, /cancelChipPurchase/);
  assert.match(reconciliation, /expires_at/);
  assert.match(
    reconciliation,
    /expires_at[\s\S]*?cancelChipPurchase\(row\.provider_bill_id\)[\s\S]*?settleChipTopUpPurchase/,
  );
  assert.doesNotMatch(
    reconciliation,
    /SET r\.status = 'released'[\s\S]{0,180}checkout_expired/,
    'an expired local reservation must not be released while its provider checkout remains payable',
  );
});

test('provider uncertainty never tells the current app that a pending payment has expired', async () => {
  const routes = await source('src/http/routes/topups.ts');

  assert.doesNotMatch(
    routes,
    /topup\.status === 'pending_payment'[\s\S]{0,180}\? 'expired'/,
    'the app clears an expired reference, so only a provider-confirmed terminal state may unlock another payment',
  );
  assert.match(routes, /await getChipPurchase\(topup\.provider_bill_id\)/);
  assert.match(routes, /await cancelChipPurchase\(topup\.provider_bill_id\)/);
  assert.match(
    routes,
    /can_start_new_topup:\s*\['failed', 'cancelled', 'refunded'\]\.includes\(topup\.status\)/,
  );
});

test('creating a new top-up cannot bypass an unresolved CHIP payment', async () => {
  const routes = await source('src/http/routes/topups.ts');
  const chipClient = await source('src/payments/chip-client.ts');

  assert.doesNotMatch(routes, /release_reason = 'checkout_abandoned'/);
  assert.match(routes, /reconcileCustomerTopUpsBeforeCreate/);
  assert.match(routes, /await getChipPurchase\(row\.provider_bill_id\)/);
  assert.match(routes, /await cancelChipPurchase\(row\.provider_bill_id\)/);
  assert.match(routes, /LIMIT 1 FOR UPDATE/);
  assert.match(routes, /topup_payment_in_progress/);
  assert.match(routes, /provider_id_missing/);
  assert.match(routes, /purchase\.reference\.startsWith\('TOP-'\)/);
  assert.match(routes, /providerMappingResult\.affectedRows !== 1/);
  assert.match(chipClient, /due_strict:\s*true/);
});
