import assert from 'node:assert/strict';
import test from 'node:test';

import { splitOrderPriceCorrection } from '../dist/services/order-price-correction.js';

test('returns a fully subsidised overcharge to company subsidy', () => {
  assert.deepEqual(splitOrderPriceCorrection({
    originalTokenAmount: 15,
    correctedTokenAmount: 9,
    originalSubsidyTokenAmount: 15
  }), {
    originalSubsidyTokenAmount: 15,
    originalPersonalTokenAmount: 0,
    correctedSubsidyTokenAmount: 9,
    correctedPersonalTokenAmount: 0,
    subsidyCorrectionTokenAmount: 6,
    personalCorrectionTokenAmount: 0,
    correctionTokenAmount: 6
  });
});

test('returns the personal tail first when an order crossed the subsidy boundary', () => {
  assert.deepEqual(splitOrderPriceCorrection({
    originalTokenAmount: 15,
    correctedTokenAmount: 9,
    originalSubsidyTokenAmount: 10
  }), {
    originalSubsidyTokenAmount: 10,
    originalPersonalTokenAmount: 5,
    correctedSubsidyTokenAmount: 9,
    correctedPersonalTokenAmount: 0,
    subsidyCorrectionTokenAmount: 1,
    personalCorrectionTokenAmount: 5,
    correctionTokenAmount: 6
  });
});

test('keeps the subsidy unchanged when the corrected amount still exceeds it', () => {
  const result = splitOrderPriceCorrection({
    originalTokenAmount: 15,
    correctedTokenAmount: 12,
    originalSubsidyTokenAmount: 10
  });
  assert.equal(result.subsidyCorrectionTokenAmount, 0);
  assert.equal(result.personalCorrectionTokenAmount, 3);
  assert.equal(result.correctionTokenAmount, 3);
});

test('returns a personal-only overcharge entirely to personal credit', () => {
  const result = splitOrderPriceCorrection({
    originalTokenAmount: 16,
    correctedTokenAmount: 13,
    originalSubsidyTokenAmount: 0
  });
  assert.equal(result.subsidyCorrectionTokenAmount, 0);
  assert.equal(result.personalCorrectionTokenAmount, 3);
  assert.equal(result.correctionTokenAmount, 3);
});
