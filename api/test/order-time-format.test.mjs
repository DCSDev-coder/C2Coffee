import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { formatDisplayDate, formatDisplayTime } from '../dist/http/routes/admin-orders.js';

test('order labels use the configured outlet timezone', () => {
  const orderedAt = new Date('2026-11-09T05:00:00.000Z');
  assert.equal(formatDisplayTime(orderedAt, 'Asia/Kuala_Lumpur'), '1:00 PM');
  assert.equal(formatDisplayDate(orderedAt, 'Asia/Kuala_Lumpur'), 'Nov 9, 2026');
});

test('barista order payload exposes the preparation transition timestamp', async () => {
  const source = await readFile(new URL('../src/http/routes/admin-orders.ts', import.meta.url), 'utf8');
  assert.match(source, /osh\.to_status = 'preparing'/);
  assert.match(source, /statusStartedAt: o\.preparing_at/);
});
