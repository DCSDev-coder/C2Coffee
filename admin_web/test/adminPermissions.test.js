import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessAdminPage } from '../src/lib/adminPermissions.js';

test('only cafe super admins see deployment information', () => {
  assert.equal(canAccessAdminPage(['super_admin'], 'Deployment'), true);
  assert.equal(canAccessAdminPage(['operations_admin'], 'Deployment'), false);
  assert.equal(canAccessAdminPage(['platform_admin'], 'Deployment'), false);
});

test('outlet management is restricted to operations and super admins', () => {
  assert.equal(canAccessAdminPage(['super_admin'], 'Outlets'), true);
  assert.equal(canAccessAdminPage(['operations_admin'], 'Outlets'), true);
  assert.equal(canAccessAdminPage(['marketing_admin'], 'Outlets'), false);
});

test('counter device management is restricted to operations and super admins', () => {
  assert.equal(canAccessAdminPage(['super_admin'], 'Counter Devices'), true);
  assert.equal(canAccessAdminPage(['operations_admin'], 'Counter Devices'), true);
  assert.equal(canAccessAdminPage(['marketing_admin'], 'Counter Devices'), false);
  assert.equal(canAccessAdminPage(['barista'], 'Counter Devices'), false);
});

test('data retention cleanup is restricted to super admins', () => {
  assert.equal(canAccessAdminPage(['super_admin'], 'Data Retention'), true);
  assert.equal(canAccessAdminPage(['operations_admin'], 'Data Retention'), false);
  assert.equal(canAccessAdminPage(['marketing_admin'], 'Data Retention'), false);
  assert.equal(canAccessAdminPage(['support_admin'], 'Data Retention'), false);
});
