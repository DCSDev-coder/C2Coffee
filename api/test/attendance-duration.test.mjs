import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeMonthlyAttendance } from '../dist/services/attendance-duration.js';

test('splits a completed shift across Malaysia calendar months', () => {
  const result = summarizeMonthlyAttendance([
    { barista_id: 1, barista_name: 'Aina', clocked_in_at: '2026-10-31T15:00:00.000Z', clocked_out_at: '2026-10-31T18:00:00.000Z' }
  ], {
    now: new Date('2026-11-10T00:00:00.000Z'),
    monthKeys: ['2026-10', '2026-11']
  });
  assert.deepEqual(result, [
    { barista_id: 1, barista_name: 'Aina', month: '2026-10', hours: 1 },
    { barista_id: 1, barista_name: 'Aina', month: '2026-11', hours: 2 }
  ]);
});

test('counts a genuinely active shift only up to now', () => {
  const result = summarizeMonthlyAttendance([
    { barista_id: 2, barista_name: 'Mira', clocked_in_at: '2026-11-10T00:00:00.000Z', clocked_out_at: null }
  ], {
    now: new Date('2026-11-10T04:30:00.000Z'),
    monthKeys: ['2026-11']
  });
  assert.equal(result[0].hours, 4.5);
});

test('excludes a stale missing clock-out from performance totals', () => {
  const result = summarizeMonthlyAttendance([
    { barista_id: 3, barista_name: 'Kimi', clocked_in_at: '2026-11-05T01:00:00.000Z', clocked_out_at: null }
  ], {
    now: new Date('2026-11-10T04:30:00.000Z'),
    monthKeys: ['2026-11']
  });
  assert.deepEqual(result, []);
});

test('excludes an implausibly long completed record from performance totals', () => {
  const result = summarizeMonthlyAttendance([
    { barista_id: 4, barista_name: 'Hana', clocked_in_at: '2026-11-01T00:00:00.000Z', clocked_out_at: '2026-11-04T00:00:00.000Z' }
  ], {
    now: new Date('2026-11-10T04:30:00.000Z'),
    monthKeys: ['2026-11']
  });
  assert.deepEqual(result, []);
});
