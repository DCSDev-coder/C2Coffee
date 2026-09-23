import assert from 'node:assert/strict';
import test from 'node:test';

import { settleReferralRewards } from '../dist/services/referrals.js';

test('referral is rewarded when both configured rewards issue', () => {
  assert.equal(
    settleReferralRewards({ issued: true }, { issued: true }, false),
    'rewarded'
  );
});

test('referral is rewarded when the referrer monthly cap is intentionally reached', () => {
  assert.equal(
    settleReferralRewards({ issued: true }, { issued: false }, true),
    'rewarded'
  );
});

test('referral remains qualified when either configured grant fails', () => {
  assert.equal(
    settleReferralRewards({ issued: false, reason: 'voucher_unavailable' }, { issued: true }, false),
    'qualified'
  );
  assert.equal(
    settleReferralRewards({ issued: true }, { issued: false, reason: 'token_balance_cap' }, false),
    'qualified'
  );
});
