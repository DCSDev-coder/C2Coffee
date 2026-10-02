import assert from 'node:assert/strict';
import test from 'node:test';

import { isStoreOpenNow, isStoreTradingNow } from '../dist/services/store-availability.js';

const everyDay = Object.fromEntries(
  ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => [day, { closed: false, open: '08:00', close: '22:00' }]),
);

test('legacy outlets without a schedule remain open', () => {
  assert.equal(isStoreOpenNow({ status: 'active', supports_pickup: 1 }), true);
});

test('counter trading hours do not depend on pickup support', () => {
  const store = { status: 'active', supports_pickup: 0 };
  assert.equal(isStoreTradingNow(store), true);
  assert.equal(isStoreOpenNow(store), false);
});

test('configured hours use the outlet timezone', () => {
  const store = { status: 'active', supports_pickup: 1, timezone: 'Asia/Kuala_Lumpur', weekly_hours_json: everyDay };
  assert.equal(isStoreOpenNow(store, new Date('2026-10-01T04:00:00Z')), true);
  assert.equal(isStoreOpenNow(store, new Date('2026-10-01T15:00:00Z')), false);
});

test('temporary closure and overnight schedules are enforced', () => {
  assert.equal(isStoreOpenNow({ status: 'active', supports_pickup: 1, temporarily_closed: 1 }), false);
  const overnight = structuredClone(everyDay);
  overnight.wed = { closed: false, open: '18:00', close: '02:00' };
  overnight.thu = { closed: true, open: '', close: '' };
  const store = { status: 'active', supports_pickup: 1, timezone: 'Asia/Kuala_Lumpur', weekly_hours_json: overnight };
  assert.equal(isStoreOpenNow(store, new Date('2026-09-30T17:00:00Z')), true);
});
