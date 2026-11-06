import assert from 'node:assert/strict';
import test from 'node:test';

import { allocateSubsidyEligibleDrinkTokens } from '../dist/services/subsidy-checkout-policy.js';
import { calculatePersonalTokenRefund } from '../dist/services/employee-token-allowance.js';

test('all configured drink spend remains subsidy eligible without deductions', () => {
  assert.equal(
    allocateSubsidyEligibleDrinkTokens({
      totalTokens: 10,
      drinkTokens: 10,
      priorDeductions: 0,
    }),
    10,
  );
});

test('voucher and gift-card deductions cannot redirect subsidy to non-drinks', () => {
  assert.equal(
    allocateSubsidyEligibleDrinkTokens({
      totalTokens: 10,
      drinkTokens: 10,
      priorDeductions: 10,
    }),
    0,
  );
  assert.equal(
    allocateSubsidyEligibleDrinkTokens({
      totalTokens: 15,
      drinkTokens: 10,
      priorDeductions: 5,
    }),
    5,
  );
});

test('food and merchandise remain ineligible for subsidy', () => {
  assert.equal(
    allocateSubsidyEligibleDrinkTokens({
      totalTokens: 10,
      drinkTokens: 0,
      priorDeductions: 0,
    }),
    0,
  );
});

test('cancellation returns personal C2 Credit separately from restored subsidy', () => {
  assert.equal(calculatePersonalTokenRefund(10, 10), 0);
  assert.equal(calculatePersonalTokenRefund(15, 10), 5);
  assert.equal(calculatePersonalTokenRefund(0, 0), 0);
});
