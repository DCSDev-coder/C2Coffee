import assert from 'node:assert/strict';
import test from 'node:test';

import { renderReceipt } from '../src/escpos.js';

test('renders an 80 mm ESC/POS receipt and ends with a full cut', () => {
  const output = renderReceipt({
    order_ref: 'ORD-123',
    order_number: 17,
    created_at: '2026-09-17T10:00:00.000Z',
    items: [{ name: 'Butterscotch Latte', quantity: 2, line_total_rm: '25.80' }],
    final_total_rm: '25.80',
    token_amount: 26
  });

  assert.equal(output.subarray(0, 2).toString('hex'), '1b40');
  assert.match(output.toString('ascii'), /ORDER #17/);
  assert.match(output.toString('ascii'), /2 x Butterscotch Latte/);
  assert.match(output.toString('ascii'), /TOTAL: RM 25.80/);
  assert.deepEqual([...output.subarray(-3)], [0x1d, 0x56, 0x00]);
});
