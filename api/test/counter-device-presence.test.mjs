import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COUNTER_DEVICE_ONLINE_WINDOW_SECONDS,
  resolveCounterDevicePresence
} from '../dist/services/counter-device-presence.js';

test('reports an activated device online inside the heartbeat window', () => {
  const presence = resolveCounterDevicePresence({
    status: 'active',
    activatedAt: '2026-10-21T03:00:00.000Z',
    secondsSinceLastSeen: COUNTER_DEVICE_ONLINE_WINDOW_SECONDS
  });
  assert.equal(presence.connectionStatus, 'online');
  assert.equal(presence.isOnline, true);
});

test('reports an enabled device offline after the heartbeat window', () => {
  const presence = resolveCounterDevicePresence({
    status: 'active',
    activatedAt: '2026-10-21T03:00:00.000Z',
    secondsSinceLastSeen: COUNTER_DEVICE_ONLINE_WINDOW_SECONDS + 1
  });
  assert.equal(presence.connectionStatus, 'offline');
  assert.equal(presence.isOnline, false);
});

test('distinguishes awaiting activation, disabled and revoked devices', () => {
  assert.equal(resolveCounterDevicePresence({
    status: 'active', activatedAt: null, secondsSinceLastSeen: null
  }).connectionStatus, 'awaiting_activation');
  assert.equal(resolveCounterDevicePresence({
    status: 'inactive', activatedAt: '2026-10-21', secondsSinceLastSeen: 1
  }).connectionStatus, 'disabled');
  assert.equal(resolveCounterDevicePresence({
    status: 'revoked', activatedAt: '2026-10-21', secondsSinceLastSeen: 1
  }).connectionStatus, 'revoked');
});
