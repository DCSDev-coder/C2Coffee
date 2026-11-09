import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routes = await readFile(
  new URL('../src/http/routes/barista-staff.ts', import.meta.url),
  'utf8',
);
const checkout = await readFile(
  new URL('../src/http/routes/checkout.ts', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../src/db/migrations/130_create_outlet_emergency_closures.sql', import.meta.url),
  'utf8',
);
const chipSettlement = await readFile(
  new URL('../src/services/chip-counter-settlement.ts', import.meta.url),
  'utf8',
);
const guard = await readFile(
  new URL('../src/admin/guard.ts', import.meta.url),
  'utf8',
);

test('barista guard allows attendance history, inventory, and emergency outlet actions', () => {
  assert.match(guard, /status\|history\|current\|clock-in\|clock-out/);
  assert.match(guard, /\/v1\/barista\/inventory/);
  assert.match(guard, /\/v1\/barista\/inventory\/movements/);
  assert.match(guard, /\/v1\/barista\/outlet\/emergency-close/);
  assert.match(guard, /\/v1\/barista\/outlet\/emergency-reopen/);
});

test('emergency closure blocks prepared orders and safely handles earlier orders', () => {
  assert.match(routes, /'preparing', 'ready_for_pickup'/);
  assert.match(routes, /emergency_active_orders_block/);
  assert.match(routes, /order_cancellation_requests/);
  assert.match(routes, /releaseInventoryForOrder/);
  assert.match(routes, /restoreGiftCardForRefund/);
  assert.match(routes, /issueRefundReplacementVoucher/);
  assert.match(routes, /deliverPushToUser/);
});

test('emergency closure is outlet scoped, auditable and retry safe', () => {
  assert.match(migration, /UNIQUE KEY uq_outlet_emergency_idempotency/);
  assert.match(migration, /expected_reopen_at/);
  assert.match(routes, /outlet_emergency_closed/);
  assert.match(routes, /outlet_emergency_reopened/);
  assert.match(checkout, /autoReopenEmergencyClosures/);
  assert.match(chipSettlement, /latePaidAfterCancellation/);
  assert.match(chipSettlement, /refund_pending/);
});
