import test from 'node:test';
import assert from 'node:assert/strict';
import { malaysiaAttendanceDate, isBaristaHistoryStatus, eligibleWorkstationOutlets } from '../src/utils/baristaHistory.js';

test('attendance dates use Malaysia calendar day across UTC midnight', () => {
  assert.equal(malaysiaAttendanceDate('2026-11-24T17:00:00Z'), '2026-11-25');
  assert.equal(malaysiaAttendanceDate('2026-11-24T15:59:59Z'), '2026-11-24');
  assert.equal(malaysiaAttendanceDate(null), 'Unknown');
});

test('outlet picker includes active outlets, including non-customer-facing outlets', () => {
  assert.deepEqual(eligibleWorkstationOutlets([{ id: 1, status: 'active', is_customer_facing: true }, { id: 2, status: 'active', is_customer_facing: false }, { id: 3, status: 'inactive' }]).map((store) => store.id), [1, 2]);
  assert.deepEqual(eligibleWorkstationOutlets(null), []);
});

test('history includes closed and ready orders but excludes pending and preparation', () => {
  for (const status of ['Ready For Pickup', 'Collected', 'Cancelled', 'Refunded']) assert.equal(isBaristaHistoryStatus(status), true);
  for (const status of ['Pending Payment', 'Paid', 'Preparing']) assert.equal(isBaristaHistoryStatus(status), false);
});
