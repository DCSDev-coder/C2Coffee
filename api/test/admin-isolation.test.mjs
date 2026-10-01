import assert from 'node:assert/strict';
import test from 'node:test';

import { assertDeploymentTenants } from '../dist/admin/deployment-policy.js';
import { assertOutletPublication } from '../dist/admin/outlet-policy.js';
import { assertTenantAccountEditable, assertTenantRoleAssignment } from '../dist/admin/role-policy.js';
import { isTrustedBillplzCheckoutUrl } from '../dist/payments/billplz-security.js';
import { generateDeviceActivationCode } from '../dist/lib/crypto.js';

test('deployment accepts exactly one configured active cafe', () => {
  assert.doesNotThrow(() => assertDeploymentTenants([{ code: 'c2coffee', status: 'active' }], 'c2coffee'));
});

test('deployment rejects empty, mismatched, inactive, and multi-cafe databases', () => {
  for (const tenants of [
    [],
    [{ code: 'other-cafe', status: 'active' }],
    [{ code: 'c2coffee', status: 'inactive' }],
    [{ code: 'c2coffee', status: 'active' }, { code: 'other-cafe', status: 'inactive' }]
  ]) assert.throws(() => assertDeploymentTenants(tenants, 'c2coffee'), { code: 'deployment_tenant_mismatch' });
});

test('tenant account management cannot assign or edit platform roles', () => {
  assert.doesNotThrow(() => assertTenantRoleAssignment(['super_admin', 'barista']));
  assert.throws(() => assertTenantRoleAssignment(['platform_admin']), { code: 'admin_forbidden' });
  assert.throws(() => assertTenantAccountEditable(['platform_admin']), { code: 'admin_forbidden' });
});

test('active outlets can be independently published or unpublished', () => {
  assert.doesNotThrow(() => assertOutletPublication(null, { is_customer_facing: false, status: 'active' }));
  assert.doesNotThrow(() => assertOutletPublication(null, { is_customer_facing: true, status: 'active' }));
  assert.doesNotThrow(() => assertOutletPublication(
    { is_customer_facing: true, status: 'active' },
    { is_customer_facing: false, status: 'active' }
  ));
});

test('inactive outlets cannot remain available in the customer app', () => {
  assert.throws(() => assertOutletPublication(
    { is_customer_facing: true, status: 'active' },
    { is_customer_facing: true, status: 'inactive' }
  ), { code: 'customer_store_conflict' });
});

test('Billplz checkout redirects stay on the configured HTTPS gateway host', () => {
  const gateway = 'https://www.billplz-sandbox.com';
  assert.equal(isTrustedBillplzCheckoutUrl('https://www.billplz-sandbox.com/bills/abc', gateway), true);
  assert.equal(isTrustedBillplzCheckoutUrl('http://www.billplz-sandbox.com/bills/abc', gateway), false);
  assert.equal(isTrustedBillplzCheckoutUrl('https://billplz-sandbox.com.evil.test/bills/abc', gateway), false);
  assert.equal(isTrustedBillplzCheckoutUrl('https://user:pass@www.billplz-sandbox.com/bills/abc', gateway), false);
});

test('counter activation codes are human-readable and carry sufficient random data', () => {
  const first = generateDeviceActivationCode();
  const second = generateDeviceActivationCode();
  assert.match(first, /^C2-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
  assert.notEqual(first, second);
});
