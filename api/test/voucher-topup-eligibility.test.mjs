import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateVoucherTopUpEligibility,
  getVoucherTopUpMinimum
} from '../dist/services/voucher-topup-eligibility.js';

const scope = {
  topup_reward: {
    min_tokens: 25,
    trigger: 'single_paid_topup'
  }
};

test('top-up voucher remains unavailable when a generic campaign issued it', () => {
  const result = evaluateVoucherTopUpEligibility({
    scope,
    templateId: 22,
    issueCaseRef: 'campaign:22',
    issuedByType: 'system'
  });

  assert.equal(result.required, true);
  assert.equal(result.eligible, false);
  assert.equal(result.minimumTokens, 25);
  assert.match(result.unavailableReason, /25 C2 Tokens/);
});

test('paid top-up provenance unlocks only its matching template', () => {
  assert.equal(evaluateVoucherTopUpEligibility({
    scope,
    templateId: 22,
    issueCaseRef: 'topup_reward:22:topup:901',
    issuedByType: 'system'
  }).eligible, true);

  assert.equal(evaluateVoucherTopUpEligibility({
    scope,
    templateId: 23,
    issueCaseRef: 'topup_reward:22:topup:901',
    issuedByType: 'system'
  }).eligible, false);
});

test('admin issuance is an explicit top-up rule override', () => {
  assert.equal(evaluateVoucherTopUpEligibility({
    scope,
    templateId: 22,
    issueCaseRef: 'manual:22:customer:5',
    issuedByType: 'admin'
  }).eligible, true);
});

test('invalid or absent top-up rule does not restrict ordinary vouchers', () => {
  assert.equal(getVoucherTopUpMinimum({ topup_reward: { min_tokens: 0 } }), null);
  assert.equal(evaluateVoucherTopUpEligibility({
    scope: {},
    templateId: 22,
    issueCaseRef: 'campaign:22',
    issuedByType: 'system'
  }).eligible, true);
});
