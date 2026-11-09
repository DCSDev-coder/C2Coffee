import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDisplayDate, formatDisplayTime } from '../dist/http/routes/admin-orders.js';

test('order labels use the configured outlet timezone', () => {
  const orderedAt = new Date('2026-11-09T05:00:00.000Z');
  assert.equal(formatDisplayTime(orderedAt, 'Asia/Kuala_Lumpur'), '1:00 PM');
  assert.equal(formatDisplayDate(orderedAt, 'Asia/Kuala_Lumpur'), 'Nov 9, 2026');
});
