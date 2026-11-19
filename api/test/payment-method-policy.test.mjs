import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveConfiguredCustomerPaymentMethods
} from '../dist/services/payment-method-policy.js';

const deploymentAllowlist = ['fpx', 'duitnow_qr', 'card'];

test('missing tenant settings preserve the deployment payment allowlist', () => {
  assert.deepEqual(
    resolveConfiguredCustomerPaymentMethods(null, deploymentAllowlist),
    deploymentAllowlist
  );
});

test('an empty tenant setting fails closed', () => {
  assert.deepEqual(
    resolveConfiguredCustomerPaymentMethods([], deploymentAllowlist),
    []
  );
});

test('malformed tenant settings fail closed', () => {
  assert.deepEqual(
    resolveConfiguredCustomerPaymentMethods('{not-json', deploymentAllowlist),
    []
  );
});

test('an explicit non-empty tenant selection remains authoritative', () => {
  assert.deepEqual(
    resolveConfiguredCustomerPaymentMethods(['fpx', 'card'], deploymentAllowlist),
    ['fpx', 'card']
  );
});

test('tenant settings cannot enable a method outside the deployment allowlist', () => {
  assert.deepEqual(
    resolveConfiguredCustomerPaymentMethods(['fpx', 'ewallet'], deploymentAllowlist),
    ['fpx']
  );
});
