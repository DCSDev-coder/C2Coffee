import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  closeChipPurchaseSafely,
  describeMobilePaymentState
} from '../dist/services/mobile-order-payment-state.js';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('pending_execute after CHIP rejects cancellation becomes a safe specific 409', async () => {
  let rechecks = 0;

  await assert.rejects(
    closeChipPurchaseSafely('purchase-1', {
      cancelPurchase: async () => {
        const error = new Error('CHIP cancel returned HTTP 400');
        error.statusCode = 502;
        error.code = 'topup_gateway_error';
        throw error;
      },
      getPurchase: async () => {
        rechecks += 1;
        return { id: 'purchase-1', status: 'pending_execute' };
      }
    }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'payment_still_processing');
      assert.doesNotMatch(error.message, /CHIP|HTTP 400|gateway/i);
      return true;
    }
  );

  assert.equal(rechecks, 1);
});

test('mobile payment states expose additive safe action capabilities', () => {
  assert.deepEqual(
    describeMobilePaymentState({
      providerStatus: 'pending_execute',
      localPaymentStatus: 'pending',
      hasCheckoutUrl: true
    }),
    {
      state: 'payment_processing',
      can_continue: true,
      can_change_method: true,
      can_cancel: false
    }
  );

  assert.deepEqual(
    describeMobilePaymentState({
      providerStatus: 'expired',
      localPaymentStatus: 'pending',
      hasCheckoutUrl: false
    }),
    {
      state: 'payment_expired',
      can_continue: false,
      can_change_method: true,
      can_cancel: true
    }
  );

  assert.deepEqual(
    describeMobilePaymentState({
      providerStatus: 'paid',
      localPaymentStatus: 'paid',
      hasCheckoutUrl: false
    }),
    {
      state: 'payment_paid',
      can_continue: false,
      can_change_method: false,
      can_cancel: false
    }
  );

  assert.equal(
    describeMobilePaymentState({
      providerStatus: 'partially_refunded',
      localPaymentStatus: 'pending',
      hasCheckoutUrl: false
    }).state,
    'payment_paid'
  );
});

test('old order-list clients trigger throttled best-effort direct-payment reconciliation', async () => {
  const routes = await source('src/http/routes/customer-data.ts');
  const reconciliation = await source('src/services/chip-mobile-order-reconciliation.ts');

  assert.match(routes, /reconcilePendingMobileOrdersForUser/);
  assert.match(routes, /Unable to reconcile pending mobile orders during order listing/);
  assert.match(reconciliation, /o\.order_channel = 'mobile'/);
  assert.match(reconciliation, /o\.payment_mode = 'direct'/);
  assert.match(reconciliation, /o\.status = 'pending_payment'/);
  assert.match(reconciliation, /o\.status = 'cancelled'/);
  assert.match(reconciliation, /chip_customer_recovery_detach/);
  assert.match(reconciliation, /INTERVAL 7 DAY/);
  assert.match(reconciliation, /status IN \('pending', 'authorized', 'cancelled'\)/);
  assert.match(reconciliation, /provider_checked_at <= DATE_SUB\(UTC_TIMESTAMP\(\), INTERVAL 30 SECOND\)/);
  assert.match(reconciliation, /UPDATE payments[\s\S]*provider_checked_at = UTC_TIMESTAMP\(\)/);
  assert.match(reconciliation, /settleChipMobilePurchase/);
  assert.match(reconciliation, /scheduled_mobile_reconcile/);
  assert.match(reconciliation, /'mobile'/);
  assert.match(reconciliation, /runMobileOrderPaymentReconciliationSweep/);
  assert.match(reconciliation, /finalizeExpiredMobileOrder/);
  assert.match(reconciliation, /review_required/);
});

test('payment status remains backward compatible and adds normalized state, actions, and enabled methods', async () => {
  const routes = await source('src/http/routes/customer-data.ts');
  const paymentRoute = routes.match(
    /app\.get\('\/v1\/orders\/:orderId\/payment'[\s\S]*?app\.post\('\/v1\/orders\/:orderId\/payment\/retry'/
  )?.[0];

  assert.ok(paymentRoute, 'customer payment-status route must exist');
  assert.match(paymentRoute, /status:/);
  assert.match(paymentRoute, /checkout_url:/);
  assert.match(paymentRoute, /payment_method:/);
  assert.match(paymentRoute, /amount_rm:/);
  assert.match(paymentRoute, /expires_at:/);
  assert.match(paymentRoute, /payment_state:/);
  assert.match(paymentRoute, /can_continue:/);
  assert.match(paymentRoute, /can_change_method:/);
  assert.match(paymentRoute, /can_cancel:/);
  assert.match(paymentRoute, /enabled_methods:/);
  assert.match(paymentRoute, /provider_temporarily_unavailable/);
});

test('scheduled mobile reconciliation is registered and admin review is explicit', async () => {
  const server = await source('src/server.ts');
  const orders = await source('src/http/routes/admin-orders.ts');
  const adminUi = await readFile(new URL('../../admin_web/src/components/Orders.jsx', import.meta.url), 'utf8');

  assert.match(server, /runMobileOrderPaymentReconciliationSweep/);
  assert.match(server, /mobileOrderPaymentReconciliationTimer/);
  assert.match(orders, /paymentReviewRequired/);
  assert.match(orders, /paymentRecoveryReviewRequired/);
  assert.match(orders, /chip_customer_recovery_detach/);
  assert.match(adminUi, /Payment review required/);
  assert.match(adminUi, /Provider payment review/);
});

test('existing barista and printing payment gates remain enforced', async () => {
  const orders = await source('src/http/routes/admin-orders.ts');
  const printing = await source('src/http/routes/print-connectors.ts');

  assert.match(orders, /payment_gate\.status IN \('paid', 'partially_refunded'\)/);
  assert.match(printing, /pmt\.status IN \('paid', 'partially_refunded'\)/);
  assert.match(printing, /payment_not_confirmed/);
});
