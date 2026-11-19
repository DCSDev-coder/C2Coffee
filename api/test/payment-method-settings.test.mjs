import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('payment method settings are tenant scoped and editable by operations admins', async () => {
  const migration = await source('src/db/migrations/159_add_customer_payment_method_settings.sql');
  const recoveryMigration = await source('src/db/migrations/161_recover_empty_customer_payment_methods.sql');
  const routes = await source('src/http/routes/admin-payment-methods.ts');
  assert.match(migration, /customer_payment_methods_json/);
  assert.match(recoveryMigration, /JSON_LENGTH\(customer_payment_methods_json\) = 0/);
  assert.match(routes, /GET.*admin\/payment-methods|\/v1\/admin\/payment-methods/);
  assert.match(routes, /PUT.*admin\/payment-methods|\/v1\/admin\/payment-methods/);
  assert.match(routes, /super_admin.*admin/);
  assert.match(routes, /TOPUP_GATEWAY_ALLOWED_METHODS/);
  assert.match(routes, /getActiveChipMethods/);
  assert.match(routes, /admin_audit_logs/);
});

test('customer payment methods are filtered by tenant settings and provider availability', async () => {
  const settings = await source('src/services/payment-method-settings.ts');
  const chip = await source('src/payments/chip-client.ts');
  const topups = await source('src/http/routes/topups.ts');
  const giftCards = await source('src/http/routes/gift-cards.ts');
  assert.match(settings, /customer_payment_methods_json/);
  assert.match(settings, /DEPLOYMENT_TENANT_CODE/);
  assert.match(settings, /registration_status = 'registered'/);
  assert.doesNotMatch(settings, /SELECT id FROM admin_tenants WHERE status = 'active'/);
  assert.match(chip, /approvedMethods/);
  assert.match(topups, /loadUserPaymentMethodSettings/);
  assert.match(giftCards, /loadTenantPaymentMethodSettings/);
});

test('admin payment-method controls explain provider review versus customer availability', async () => {
  const settings = await source('../admin_web/src/components/Settings.jsx');
  assert.match(settings, /Payment methods/);
  assert.match(settings, /Customer availability/);
  assert.match(settings, /International cards are not supported yet/);
  assert.match(settings, /isPaymentMethodsLoaded/);
  assert.match(settings, /Select at least one payment method/);
});
