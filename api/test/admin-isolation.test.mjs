import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { assertDeploymentTenants } from '../dist/admin/deployment-policy.js';
import { assertOutletPublication } from '../dist/admin/outlet-policy.js';
import { assertTenantAccountEditable, assertTenantRoleAssignment } from '../dist/admin/role-policy.js';
import { chipMethodLabel, isTrustedChipCheckoutUrl, verifyChipSignature } from '../dist/payments/chip-client.js';
import { chipTerminalFailure } from '../dist/services/chip-topup-settlement.js';
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

test('CHIP checkout redirects stay on an HTTPS CHIP host', () => {
  assert.equal(isTrustedChipCheckoutUrl('https://gate.chip-in.asia/p/abc'), true);
  assert.equal(isTrustedChipCheckoutUrl('https://chip-in.asia/p/abc'), true);
  assert.equal(isTrustedChipCheckoutUrl('http://gate.chip-in.asia/p/abc'), false);
  assert.equal(isTrustedChipCheckoutUrl('https://chip-in.asia.evil.test/p/abc'), false);
  assert.equal(isTrustedChipCheckoutUrl('https://user:pass@gate.chip-in.asia/p/abc'), false);
});

test('CHIP callback signature verifies the exact raw body', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const body = Buffer.from('{"id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","status":"paid"}');
  const signature = crypto.sign('RSA-SHA256', body, privateKey).toString('base64');

  assert.equal(verifyChipSignature(body, signature, publicKey.export({ type: 'spki', format: 'pem' })), true);
  assert.equal(verifyChipSignature(Buffer.from(`${body.toString()} `), signature, publicKey.export({ type: 'spki', format: 'pem' })), false);
  assert.equal(verifyChipSignature(body, 'not-valid-base64!', publicKey.export({ type: 'spki', format: 'pem' })), false);
});

test('CHIP customer payment methods use receipt-safe labels', () => {
  assert.equal(chipMethodLabel('fpx'), 'FPX Online Banking');
  assert.equal(chipMethodLabel('duitnow_qr'), 'DuitNow QR');
  assert.equal(chipMethodLabel('card'), 'Credit or debit card');
  assert.equal(chipMethodLabel('ewallet'), 'E-wallet');
});

test('CHIP terminal failures are separated from retryable states', () => {
  assert.equal(chipTerminalFailure('cancelled'), 'cancelled');
  assert.equal(chipTerminalFailure('error'), 'failed');
  assert.equal(chipTerminalFailure('pending'), null);
  assert.equal(chipTerminalFailure('paid'), null);
});

test('counter activation codes are human-readable and carry sufficient random data', () => {
  const first = generateDeviceActivationCode();
  const second = generateDeviceActivationCode();
  assert.match(first, /^C2-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
  assert.notEqual(first, second);
});
