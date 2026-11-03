import assert from 'node:assert/strict';
import test from 'node:test';

import { formatAdminErrorMessage } from '../src/lib/adminErrorMessage.js';

function response(status) {
  return { status };
}

test('admin errors never expose raw backend messages', () => {
  assert.equal(
    formatAdminErrorMessage(
      { error: { code: 'unexpected_error', message: 'SQLSTATE 42S22: unknown column secret_value' } },
      response(500),
    ),
    'We could not complete this request. Please try again.',
  );

  assert.equal(
    formatAdminErrorMessage(
      { error: { code: 'validation_error', message: 'Internal schema path: payload.items[0]' } },
      response(400),
    ),
    'Please review the information and try again.',
  );
});

test('admin errors keep curated operational guidance', () => {
  assert.equal(
    formatAdminErrorMessage(
      { error: { code: 'customer_not_found', message: 'database detail' } },
      response(404),
    ),
    'No active customer account was found for that phone number.',
  );
});
