import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  resolveBaristaShiftAccess,
  shouldBlockBaristaClockOut,
} from '../dist/services/barista-shift-access.js';

function connectionFixture({ store = {}, attendance = [] } = {}) {
  return {
    async query(sql) {
      if (sql.includes('FROM stores')) return [[{ status: 'active', temporarily_closed: 0, timezone: 'Asia/Kuala_Lumpur', ...store }]];
      if (sql.includes('clocked_out_at IS NULL')) return [attendance];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
}

const input = {
  tenantId: 1,
  tenantCode: 'c2coffee',
  storeId: 10,
  now: new Date('2026-10-20T01:05:00.000Z')
};

test('early clock-in opens the outlet without consulting opening hours', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    attendance: [{ id: 9, barista_id: 9, barista_name: 'Early', clocked_in_at: '2026-10-20T22:45:00.000Z' }]
  }), { ...input, now: new Date('2026-10-20T23:05:00.000Z') });
  assert.equal(state.schedule_status, 'published');
  assert.equal(state.access_state, 'unlocked');
  assert.equal(state.can_prepare_orders, true);
  assert.match(state.message, /open and staffed/);
});

test('active outlet waits for a barista at any time of day', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({ attendance: [] }), input);
  assert.equal(state.schedule_status, 'published');
  assert.equal(state.access_state, 'locked');
  assert.equal(state.can_prepare_orders, false);
  assert.match(state.message, /Clock in/);
  assert.deepEqual(state.missing_staff, []);
});

test('opens as soon as any barista clocks in', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    attendance: [{ id: 1, barista_id: 1, barista_name: 'Aina', clocked_in_at: '2026-10-20T01:00:00.000Z' }]
  }), input);
  assert.equal(state.access_state, 'unlocked');
  assert.equal(state.can_prepare_orders, true);
  assert.equal(state.current_staff.length, 0);
  assert.equal(state.missing_staff.length, 0);
});

test('temporary closure overrides attendance', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    store: { temporarily_closed: 1 },
    attendance: [{ id: 1, barista_id: 1, barista_name: 'Aina', clocked_in_at: '2026-10-20T01:00:00.000Z' }]
  }), input);
  assert.equal(state.can_prepare_orders, false);
  assert.equal(state.access_state, 'closed');
});

test('ignores a stale missing clock-out instead of keeping the outlet open', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    attendance: [{ id: 2, barista_id: 2, barista_name: 'Mira', clocked_in_at: '2026-10-19T01:00:00.000Z' }]
  }), input);
  assert.equal(state.active_attendance.length, 0);
  assert.equal(state.can_prepare_orders, false);
});

test('keeps recent previous-date attendance active after midnight', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    attendance: [{ id: 3, barista_id: 3, barista_name: 'Nadia', clocked_in_at: '2026-10-20T12:30:00.000Z' }]
  }), { ...input, now: new Date('2026-10-20T17:00:00.000Z') });
  assert.equal(state.active_attendance.length, 1);
  assert.equal(state.can_prepare_orders, true);
});

test('accepts a replacement barista clocking in after midnight', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    attendance: [{ id: 4, barista_id: 4, barista_name: 'Sofia', clocked_in_at: '2026-10-20T16:30:00.000Z' }]
  }), { ...input, now: new Date('2026-10-20T17:00:00.000Z') });
  assert.equal(state.active_attendance.length, 1);
  assert.equal(state.can_prepare_orders, true);
});

test('does not reuse stale attendance for a later shift', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    attendance: [{ id: 5, barista_id: 5, barista_name: 'Hana', clocked_in_at: '2026-10-19T16:30:00.000Z' }]
  }), { ...input, now: new Date('2026-10-20T12:30:00.000Z') });
  assert.equal(state.active_attendance.length, 0);
  assert.equal(state.can_prepare_orders, false);
});

test('active attendance keeps the outlet open at any time', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    attendance: [
      { id: 6, barista_id: 6, barista_name: 'Recent', clocked_in_at: '2026-10-20T12:30:00.000Z' },
      { id: 7, barista_id: 7, barista_name: 'Stale', clocked_in_at: '2026-10-18T12:30:00.000Z' },
    ]
  }), { ...input, now: new Date('2026-10-20T19:00:00.000Z') });
  assert.equal(state.active_attendance.length, 1);
  assert.equal(state.can_prepare_orders, true);
  assert.deepEqual(state.coverage_attendance.map((row) => row.barista_name), ['Recent']);
});

test('temporary closure still overrides an early clock-in outside scheduled hours', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    store: { temporarily_closed: 1 },
    attendance: [{ id: 10, barista_id: 10, barista_name: 'Early', clocked_in_at: '2026-10-20T22:45:00.000Z' }]
  }), { ...input, now: new Date('2026-10-20T23:05:00.000Z') });
  assert.equal(state.access_state, 'closed');
  assert.equal(state.can_prepare_orders, false);
});

test('active orders block only the final clocked-in barista', () => {
  assert.equal(shouldBlockBaristaClockOut({ activeAttendanceCount: 1, activeOrderCount: 2 }), true);
  assert.equal(shouldBlockBaristaClockOut({ activeAttendanceCount: 2, activeOrderCount: 2 }), false);
  assert.equal(shouldBlockBaristaClockOut({ activeAttendanceCount: 1, activeOrderCount: 0 }), false);
});

test('clock-out active order check matches visible active orders and excludes pending payment', async () => {
  const baristaStaff = await readFile(new URL('../src/http/routes/barista-staff.ts', import.meta.url), 'utf8');
  assert.match(baristaStaff, /o\.status IN \('paid', 'accepted', 'preparing', 'ready_for_pickup'\)/);
  assert.doesNotMatch(baristaStaff, /o\.status IN \('pending_payment', 'paid', 'accepted', 'preparing'\)/);
  assert.match(baristaStaff, /FROM order_cancellation_requests ocr/);
  assert.match(baristaStaff, /Outstanding order/);
});

test('shift access cannot read or evaluate configured opening hours', async () => {
  const source = await readFile(new URL('../src/services/barista-shift-access.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /isStoreTradingNow|weekly_hours_json/);
});
