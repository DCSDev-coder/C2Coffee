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
