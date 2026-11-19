import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('orders persist and expose token voucher discounts and the rewarded item', async () => {
  const migration = await source('src/db/migrations/158_snapshot_order_voucher_application.sql');
  const checkout = await source('src/http/routes/checkout.ts');
  const orders = await source('src/http/routes/admin-orders.ts');

  assert.match(migration, /voucher_discount_tokens/);
  assert.match(migration, /voucher_reward_summary/);
  assert.match(checkout, /voucherDiscountTokens: discountTokens/);
  assert.match(checkout, /voucherRewardSummary/);
  assert.match(orders, /voucherDiscountTokens/);
  assert.match(orders, /voucherRewardSummary/);
  assert.match(orders, /inferredVoucherDiscountTokens/);
});

test('barista order history passes the real total and explicit voucher audit fields', async () => {
  const history = await source('../counter_app/lib/barista/screens/order_history_page.dart');
  const card = await source('../counter_app/lib/barista/widgets/order_card.dart');

  assert.match(history, /total: order\.total/);
  assert.match(history, /voucherDiscountTokens: order\.voucherDiscountTokens/);
  assert.match(history, /voucherRewardSummary: order\.voucherRewardSummary/);
  assert.match(card, /Discount:.*C2 Credit/);
  assert.match(card, /voucherRewardSummary/);
});
