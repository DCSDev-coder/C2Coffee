import assert from 'node:assert/strict';
import test from 'node:test';

import { allocateIntegerTotal, incrementalQuantityAllocation } from '../dist/services/partial-refund.js';
import { formatTierName, getTierProgress } from '../dist/services/loyalty-tiers.js';

test('partial refunds allocate only the charged tokens across order lines', () => {
  const allocation = allocateIntegerTotal(15, [
    { id: 1, weight: 5 },
    { id: 2, weight: 20 }
  ]);
  assert.equal(allocation.get(1), 3);
  assert.equal(allocation.get(2), 12);
  assert.equal([...allocation.values()].reduce((sum, value) => sum + value, 0), 15);
});

test('repeated partial quantities cannot exceed the line allocation', () => {
  const first = incrementalQuantityAllocation(7, 2, 0, 1);
  const second = incrementalQuantityAllocation(7, 2, 1, 1);
  assert.equal(first, 4);
  assert.equal(second, 3);
  assert.equal(first + second, 7);
});

test('RM cent allocation remains exact after line rounding', () => {
  const allocation = allocateIntegerTotal(2080, [
    { id: 10, weight: 1090 },
    { id: 11, weight: 990 }
  ]);
  assert.equal([...allocation.values()].reduce((sum, value) => sum + value, 0), 2080);
});

test('tier labels use the configured name instead of legacy code formatting', () => {
  const tiers = [
    { code: 'kawan', name: 'Sipper', minCups: 1, isActive: true, sortOrder: 0 },
    { code: 'legend', name: 'Legendary', minCups: 50, isActive: true, sortOrder: 1 }
  ];
  assert.equal(formatTierName(tiers, 'kawan'), 'Sipper');
  assert.equal(formatTierName(tiers, null), 'Not yet tiered');
  assert.equal(getTierProgress(0, tiers).tierCode, null);
  assert.equal(getTierProgress(0, tiers).isQualified, false);
  assert.equal(getTierProgress(1, tiers).tierName, 'Sipper');
});
