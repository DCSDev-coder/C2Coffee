import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  resolveBaristaShiftAccess,
  shouldBlockBaristaClockOut,
} from '../dist/services/barista-shift-access.js';

const openHours = Object.fromEntries(
  ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => [day, { closed: false, open: '08:00', close: '22:00' }]),
);

function connectionFixture({ store = {}, attendance = [] } = {}) {
  return {
    async query(sql) {
      if (sql.includes('FROM stores')) return [[{ status: 'active', temporarily_closed: 0, timezone: 'Asia/Kuala_Lumpur', weekly_hours_json: JSON.stringify(openHours), ...store }]];
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

test('closes outside configured opening hours without a timetable', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture(), { ...input, now: new Date('2026-10-20T23:05:00.000Z') });
  assert.equal(state.schedule_status, 'closed');
  assert.equal(state.access_state, 'closed');
  assert.equal(state.can_prepare_orders, false);
  assert.match(state.message, /opening hours/);
});

test('waits for a barista during opening hours', async () => {
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

test('temporary closure overrides attendance and opening hours', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    store: { temporarily_closed: 1 },
    attendance: [{ id: 1, barista_id: 1, barista_name: 'Aina', clocked_in_at: '2026-10-20T01:00:00.000Z' }]
  }), input);
  assert.equal(state.can_prepare_orders, false);
  assert.equal(state.access_state, 'closed');
});

test('does not use previous-day attendance to open a new operating window', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    attendance: [{ id: 2, barista_id: 2, barista_name: 'Mira', clocked_in_at: '2026-10-19T01:00:00.000Z' }]
  }), input);
  assert.equal(state.active_attendance.length, 0);
  assert.equal(state.can_prepare_orders, false);
});

test('keeps previous-date attendance during one overnight operating window', async () => {
  const overnightHours = Object.fromEntries(
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => [day, { closed: false, open: '20:00', close: '02:00' }]),
  );
  const state = await resolveBaristaShiftAccess(connectionFixture({
    store: { weekly_hours_json: JSON.stringify(overnightHours) },
    attendance: [{ id: 3, barista_id: 3, barista_name: 'Nadia', clocked_in_at: '2026-10-20T12:30:00.000Z' }]
  }), { ...input, now: new Date('2026-10-20T17:00:00.000Z') });
  assert.equal(state.active_attendance.length, 1);
  assert.equal(state.can_prepare_orders, true);
});

test('accepts a replacement barista clocking in after midnight during an overnight window', async () => {
  const overnightHours = Object.fromEntries(
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => [day, { closed: false, open: '20:00', close: '02:00' }]),
  );
  const state = await resolveBaristaShiftAccess(connectionFixture({
    store: { weekly_hours_json: JSON.stringify(overnightHours) },
    attendance: [{ id: 4, barista_id: 4, barista_name: 'Sofia', clocked_in_at: '2026-10-20T16:30:00.000Z' }]
  }), { ...input, now: new Date('2026-10-20T17:00:00.000Z') });
  assert.equal(state.active_attendance.length, 1);
  assert.equal(state.can_prepare_orders, true);
});

test('does not reuse an after-midnight attendance for the next evening shift', async () => {
  const overnightHours = Object.fromEntries(
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => [day, { closed: false, open: '20:00', close: '02:00' }]),
  );
  const state = await resolveBaristaShiftAccess(connectionFixture({
    store: { weekly_hours_json: JSON.stringify(overnightHours) },
    attendance: [{ id: 5, barista_id: 5, barista_name: 'Hana', clocked_in_at: '2026-10-19T16:30:00.000Z' }]
  }), { ...input, now: new Date('2026-10-20T12:30:00.000Z') });
  assert.equal(state.active_attendance.length, 0);
  assert.equal(state.can_prepare_orders, false);
});

test('after closing, coverage includes only the most recently ended operating window', async () => {
  const overnightHours = Object.fromEntries(
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => [day, { closed: false, open: '20:00', close: '02:00' }]),
  );
  const state = await resolveBaristaShiftAccess(connectionFixture({
    store: { weekly_hours_json: JSON.stringify(overnightHours) },
    attendance: [
      { id: 6, barista_id: 6, barista_name: 'Recent', clocked_in_at: '2026-10-20T12:30:00.000Z' },
      { id: 7, barista_id: 7, barista_name: 'Stale', clocked_in_at: '2026-10-18T12:30:00.000Z' },
    ]
  }), { ...input, now: new Date('2026-10-20T19:00:00.000Z') });
  assert.equal(state.active_attendance.length, 0);
  assert.deepEqual(state.coverage_attendance.map((row) => row.barista_name), ['Recent']);
});

test('active orders block only the final clocked-in barista', () => {
  assert.equal(shouldBlockBaristaClockOut({ activeAttendanceCount: 1, activeOrderCount: 2 }), true);
  assert.equal(shouldBlockBaristaClockOut({ activeAttendanceCount: 2, activeOrderCount: 2 }), false);
  assert.equal(shouldBlockBaristaClockOut({ activeAttendanceCount: 1, activeOrderCount: 0 }), false);
});

test('clock-out active order check excludes ready_for_pickup and cancellation-approved orders', async () => {
  const baristaStaff = await readFile(new URL('../src/http/routes/barista-staff.ts', import.meta.url), 'utf8');
  assert.match(baristaStaff, /o\.status IN \('pending_payment', 'paid', 'accepted', 'preparing'\)/);
  assert.doesNotMatch(baristaStaff, /status IN \('paid', 'accepted', 'preparing', 'ready_for_pickup'\)/);
  assert.match(baristaStaff, /FROM order_cancellation_requests ocr/);
});
