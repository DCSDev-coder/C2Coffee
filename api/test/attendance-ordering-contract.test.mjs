import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('catalog and checkout surfaces use attendance-driven availability', async () => {
  const [catalog, checkout, counter, counterPayments] = await Promise.all([
    source('src/http/routes/catalog.ts'),
    source('src/http/routes/checkout.ts'),
    source('src/http/routes/counter.ts'),
    source('src/http/routes/counter-payments.ts'),
  ]);
  for (const route of [catalog, checkout, counter, counterPayments]) {
    assert.match(route, /resolveBaristaShiftAccess/);
  }
  assert.doesNotMatch(checkout, /isStoreAcceptingMobileOrdersNow/);
  assert.doesNotMatch(counter, /isStoreTradingNow/);
  assert.doesNotMatch(counterPayments, /isStoreTradingNow/);
  assert.match(catalog, /mobile_ordering_status: access\.can_prepare_orders/);
});
