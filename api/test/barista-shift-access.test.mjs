import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBaristaShiftAccess } from '../dist/services/barista-shift-access.js';

function connectionFixture({ publications = [], shifts = [], attendance = [], history = [] }) {
  return {
    async query(sql) {
      if (sql.includes('barista_schedule_publications')) return [publications];
      if (sql.includes('FROM barista_dated_shifts')) return [shifts];
      if (sql.includes('clocked_out_at IS NULL')) return [attendance];
      if (sql.includes('SELECT DISTINCT a.barista_id')) return [history];
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

const openingShifts = [
  { barista_id: 1, barista_name: 'Aina', shift_date: '2026-10-20', starts_at: '09:00', ends_at: '17:00' },
  { barista_id: 2, barista_name: 'Mira', shift_date: '2026-10-20', starts_at: '09:00', ends_at: '17:00' }
];

test('locks when today timetable is not published', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({}), input);
  assert.equal(state.schedule_status, 'unpublished');
  assert.equal(state.can_prepare_orders, false);
});

test('locks when no opening barista has clocked in yet', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    publications: [{ schedule_date: '2026-10-20' }],
    shifts: openingShifts,
    attendance: [],
    history: []
  }), input);
  assert.equal(state.access_state, 'locked');
  assert.equal(state.can_prepare_orders, false);
  assert.deepEqual(state.missing_staff.map((staff) => staff.barista_name), ['Aina', 'Mira']);
});

test('unlocks immediately when one of the scheduled opening baristas clocks in', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    publications: [{ schedule_date: '2026-10-20' }],
    shifts: openingShifts,
    attendance: [{ id: 1, barista_id: 1, barista_name: 'Aina', clocked_in_at: '2026-10-20T01:00:00.000Z' }],
    history: [{ barista_id: 1 }]
  }), input);
  assert.equal(state.access_state, 'handover');
  assert.equal(state.can_prepare_orders, true);
  assert.deepEqual(state.missing_staff.map((staff) => staff.barista_name), ['Mira']);
});

test('keeps service available when an incoming barista is late after opening completed', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    publications: [{ schedule_date: '2026-10-20' }],
    shifts: openingShifts,
    attendance: [{ id: 1, barista_id: 1, barista_name: 'Aina', clocked_in_at: '2026-10-20T01:00:00.000Z' }],
    history: [{ barista_id: 1 }, { barista_id: 2 }]
  }), input);
  assert.equal(state.access_state, 'handover');
  assert.equal(state.can_prepare_orders, true);
  assert.deepEqual(state.missing_staff.map((staff) => staff.barista_name), ['Mira']);
});

test('raises the five-minute closing notice without locking preparation', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    publications: [{ schedule_date: '2026-10-20' }],
    shifts: [{ barista_id: 1, barista_name: 'Aina', shift_date: '2026-10-20', starts_at: '09:00', ends_at: '17:00' }],
    attendance: [{ id: 1, barista_id: 1, barista_name: 'Aina', clocked_in_at: '2026-10-20T01:00:00.000Z' }],
    history: [{ barista_id: 1 }]
  }), { ...input, now: new Date('2026-10-20T08:56:00.000Z') });
  assert.equal(state.access_state, 'closing');
  assert.equal(state.minutes_until_shift_end, 4);
  assert.equal(state.can_prepare_orders, true);
});

test('ignores unclosed attendance from a previous day when no overnight shift is active', async () => {
  const state = await resolveBaristaShiftAccess(connectionFixture({
    publications: [{ schedule_date: '2026-10-20' }],
    shifts: [
      { barista_id: 1, barista_name: 'Aina', shift_date: '2026-10-19', starts_at: '17:00', ends_at: '22:00' },
      { barista_id: 1, barista_name: 'Aina', shift_date: '2026-10-20', starts_at: '09:00', ends_at: '17:00' }
    ],
    attendance: [{ id: 9, barista_id: 1, barista_name: 'Aina', clocked_in_at: '2026-10-19T09:05:00.000Z' }],
    history: []
  }), input);
  assert.equal(state.access_state, 'locked');
  assert.deepEqual(state.active_attendance, []);
  assert.deepEqual(state.missing_staff.map((staff) => staff.barista_name), ['Aina']);
});
