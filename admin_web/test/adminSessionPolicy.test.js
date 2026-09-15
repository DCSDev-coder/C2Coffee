import test from 'node:test';
import assert from 'node:assert/strict';

import { isTerminalAdminSessionFailure } from '../src/lib/adminSessionPolicy.js';

test('only confirmed authentication failures end an admin session', () => {
  assert.equal(isTerminalAdminSessionFailure({ status: 401 }), true);
  assert.equal(isTerminalAdminSessionFailure({ code: 'invalid_refresh_token', status: 400 }), true);
  assert.equal(isTerminalAdminSessionFailure({ code: 'admin_not_active', status: 403 }), true);
  assert.equal(isTerminalAdminSessionFailure({ code: 'network_error', status: 503 }), false);
  assert.equal(isTerminalAdminSessionFailure({ code: 'unexpected_error', status: 500 }), false);
});
