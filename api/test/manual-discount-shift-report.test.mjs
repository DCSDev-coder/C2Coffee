import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('manual card discounts are barista-only, paired with remarks, and auditable', async () => {
  const staff = await source('src/http/routes/barista-staff.ts');
  const counter = await source('src/http/routes/counter.ts');
  const counterPayments = await source('src/http/routes/counter-payments.ts');
  const migration = await source('src/db/migrations/154_create_order_manual_discounts.sql');

  assert.match(staff, /payment\/confirm'.*authenticateAdminRequest/);
  assert.match(staff, /assertStaffAccess\(request\)/);
  assert.match(staff, /Discount percentage and remarks are both required/);
  assert.match(staff, /manual_discount_stacking_not_allowed/);
  assert.match(staff, /applied_by_admin_user_id/);
  assert.match(staff, /amount_rm = :amountRm/);
  assert.doesNotMatch(counterPayments, /discount_percent/);
  assert.doesNotMatch(counter, /discount_percent: z/);
  assert.match(migration, /UNIQUE KEY uq_order_manual_discount_order \(order_id\)/);
});

test('clock-out returns an outlet report bounded by the selected attendance', async () => {
  const staff = await source('src/http/routes/barista-staff.ts');

  assert.match(staff, /o\.created_at >= :startAt/);
  assert.match(staff, /o\.created_at <= :endAt/);
  assert.match(staff, /shift_report:/);
  assert.match(staff, /gross_sales_rm: grossSalesRm\.toFixed\(2\)/);
  assert.match(staff, /net_sales_rm: Math\.max\(0, grossSalesRm - refundedRm\)\.toFixed\(2\)/);
});
