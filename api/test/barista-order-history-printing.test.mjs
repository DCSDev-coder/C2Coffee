import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('barista workspace order feed contains only today operational and history orders', async () => {
  const orders = await source('src/http/routes/admin-orders.ts');
  assert.match(orders, /view: z\.enum\(\['all', 'barista_workspace'\]\)/);
  assert.match(orders, /:view = 'all' AND :isBaristaOnly = 0/);
  assert.match(orders, /o\.status IN \('pending_payment', 'paid', 'accepted', 'preparing', 'ready_for_pickup', 'collected'\)/);
  // Unpaid orders are visible only when a barista must confirm a manual
  // counter payment; online (CHIP) orders stay hidden until paid.
  assert.match(orders, /manual_gate\.status = 'pending'[\s\S]{0,120}manual_gate\.payment_method LIKE 'manual%'/);
  assert.match(orders, /payment_gate\.status IN \('paid', 'partially_refunded'\)/);
  assert.match(orders, /COALESCE\(o\.final_total_rm, 0\) = 0/);
  assert.match(orders, /DATE_ADD\(o\.created_at, INTERVAL 8 HOUR\)/);
});

test('print connector refuses jobs until the order payment is confirmed', async () => {
  const printing = await source('src/http/routes/print-connectors.ts');
  assert.match(printing, /o\.status IN \('paid', 'accepted', 'preparing', 'ready_for_pickup', 'collected'\)/);
  assert.match(printing, /pmt\.status IN \('paid', 'partially_refunded'\)/);
  assert.match(printing, /COALESCE\(o\.final_total_rm, 0\) = 0/);
  assert.match(printing, /payment_not_confirmed/);
});

test('customer card copy states that only Malaysian cards are supported', async () => {
  const checkout = await source('../mobile_app/lib/screens/order_confirmation_page.dart');
  assert.match(checkout, /Malaysia|Malaysian/);
  assert.match(checkout, /international/i);
});

test('manual receipt requests remain tenant, outlet, role, and printer guarded', async () => {
  const printing = await source('src/http/routes/operational-integrations.ts');
  assert.match(printing, /app\.post\('\/v1\/barista\/print-jobs'/);
  assert.match(printing, /canOperate\(request\)/);
  assert.match(printing, /o\.order_ref = :orderRef AND t\.code = :tenantCode/);
  assert.match(printing, /admin_user_store_assignments/);
  assert.match(printing, /pt\.store_id = o\.store_id/);
  assert.match(printing, /pt\.status = 'connected'/);
  assert.match(printing, /request_type/);
  assert.match(printing, /payment_not_confirmed/);
  assert.match(printing, /payment_mode/);
});

test('complimentary mobile orders can be cancelled without creating a refund', async () => {
  const barista = await source('src/http/routes/barista-staff.ts');
  const orders = await source('src/http/routes/admin-orders.ts');
  assert.match(barista, /LEFT JOIN payments p ON p\.order_id = o\.id/);
  assert.match(barista, /Number\(order\.final_total_rm \|\| 0\) <= 0/);
  assert.match(barista, /Number\(order\.token_amount_charged \|\| 0\) <= 0/);
  assert.match(barista, /if \(!isComplimentaryOrder\)/);
  const customerData = await source('src/http/routes/customer-data.ts');
  assert.match(customerData, /const isComplimentaryOrder = Number\(order\.final_total_rm \|\| 0\) <= 0/);
  assert.match(customerData, /!isComplimentaryOrder && order\.payment_mode === 'direct'/);
  assert.match(barista, /restoreVoucherForCancelledOrder/);
  assert.match(orders, /restoreVoucherForCancelledOrder/);
  const voucher = await source('src/services/order-voucher.ts');
  assert.match(voucher, /JOIN voucher_redemptions vr[\s\S]*vr\.user_voucher_id = uv\.id/);
  assert.match(voucher, /vr\.order_id = o\.id/);
});

test('counter print claim exposes the immutable itemised receipt contract', async () => {
  const printing = await source('src/http/routes/counter.ts');
  const claimRoute = printing.match(
    /app\.post\('\/v1\/counter\/direct-print-jobs\/claim'[\s\S]*?app\.post\('\/v1\/counter\/direct-print-jobs\/acknowledge'/,
  )?.[0];

  assert.ok(claimRoute, 'counter direct-print claim route must exist');
  assert.match(claimRoute, /j\.request_type/);
  assert.match(claimRoute, /request_type:\s*job\.request_type/);
  assert.match(claimRoute, /o\.is_guest/);
  assert.match(claimRoute, /is_guest:\s*Number\(job\.is_guest\)\s*===\s*1/);
  assert.match(claimRoute, /o\.fulfillment_type/);
  assert.match(claimRoute, /fulfillment_type:\s*job\.fulfillment_type/);

  assert.match(claimRoute, /o\.subtotal_rm/);
  assert.match(claimRoute, /o\.discount_total_rm/);
  assert.match(claimRoute, /o\.final_total_rm/);
  assert.match(claimRoute, /o\.gift_card_token_amount/);
  assert.match(claimRoute, /opc\.correction_token_amount/);
  assert.match(claimRoute, /subtotal_rm:\s*Number\(job\.subtotal_rm/);
  assert.match(claimRoute, /discount_total_rm:\s*Number\(job\.discount_total_rm/);
  assert.match(claimRoute, /final_total_rm:\s*Number\(job\.final_total_rm/);
  assert.match(claimRoute, /gift_card_token_amount:\s*Number\(job\.gift_card_token_amount/);
  assert.match(claimRoute, /price_correction_token_amount:\s*Number\(job\.price_correction_token_amount/);

  assert.match(claimRoute, /oi\.base_price_rm_snapshot/);
  assert.match(claimRoute, /oi\.line_subtotal_rm/);
  assert.match(claimRoute, /oi\.line_token_amount/);
  assert.match(claimRoute, /unit_price_rm:/);
  assert.match(claimRoute, /line_total_rm:/);
  assert.match(claimRoute, /unit_token_value:/);
  assert.match(claimRoute, /line_token_value:/);

  assert.match(
    claimRoute,
    /SELECT pmt\.payment_method FROM payments pmt[\s\S]*pmt\.order_id = o\.id[\s\S]*ORDER BY pmt\.id DESC LIMIT 1[\s\S]*AS payment_method/,
  );
  assert.match(
    claimRoute,
    /SELECT pmt\.provider_payment_ref FROM payments pmt[\s\S]*pmt\.order_id = o\.id[\s\S]*ORDER BY pmt\.id DESC LIMIT 1[\s\S]*AS payment_reference/,
  );
  assert.match(claimRoute, /payment_method:\s*job\.payment_method/);
  assert.match(claimRoute, /payment_reference:\s*job\.payment_reference/);
});

test('walk-in orders do not inherit loyalty tier or member identity in admin orders', async () => {
  const orders = await source('src/http/routes/admin-orders.ts');
  const adminWebOrders = await source('../admin_web/src/components/Orders.jsx');

  assert.match(orders, /o\.is_guest/);
  assert.match(orders, /CASE WHEN COALESCE\(o\.is_guest, 0\) = 1 THEN NULL ELSE/);
  assert.match(orders, /const isGuest = Number\(o\.is_guest\s*\|\|\s*0\)\s*===\s*1/);
  assert.match(orders, /tier:\s*isGuest\s*\?\s*null/);
  assert.match(orders, /memberId:\s*isGuest\s*\?\s*null/);
  assert.match(adminWebOrders, /!order\.isGuest/);
  assert.match(adminWebOrders, /!order\.isGuest\s*&&/);
});
