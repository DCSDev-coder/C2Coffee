import assert from 'node:assert/strict';
import test from 'node:test';

import { topUpRequestSchema } from '../dist/payments/topup-request.js';

test('custom top-up accepts whole-ringgit amounts from RM1 to RM500', () => {
  assert.equal(topUpRequestSchema.parse({ amount_rm: 1, payment_method: 'duitnow_qr' }).amount_rm, 1);
  assert.equal(topUpRequestSchema.parse({ amount_rm: 500, payment_method: 'fpx' }).amount_rm, 500);
});

test('custom top-up rejects zero, decimals, and amounts above the wallet ceiling', () => {
  for (const amount of [0, 1.5, 501]) {
    assert.equal(
      topUpRequestSchema.safeParse({ amount_rm: amount, payment_method: 'duitnow_qr' }).success,
      false
    );
  }
});

test('legacy package requests remain accepted during the app rollout', () => {
  const request = topUpRequestSchema.parse({ package_id: 1, payment_method: 'fpx' });
  assert.equal(request.package_id, 1);
});

test('top-up requests require exactly one amount source', () => {
  assert.equal(topUpRequestSchema.safeParse({ payment_method: 'fpx' }).success, false);
  assert.equal(
    topUpRequestSchema.safeParse({ package_id: 1, amount_rm: 20, payment_method: 'fpx' }).success,
    false
  );
});
