import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin startup uses the coordinated browser-wide refresh path', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../src/lib/adminApi.js', import.meta.url), 'utf8');

  assert.match(app, /refreshAdminSession\(\)/);
  assert.doesNotMatch(app, /adminRequest\(['"]\/v1\/admin\/auth\/refresh/);
  assert.match(api, /refreshSessionPromise/);
  assert.match(api, /navigator\.locks\?\.request/);
  assert.match(api, /c2-admin-session-refresh/);
});

test('admin login keeps credential failures out of the session refresh path', async () => {
  const login = await readFile(new URL('../src/components/Login.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../src/lib/adminApi.js', import.meta.url), 'utf8');

  assert.match(login, /catch \(error\)/);
  assert.match(login, /getSafeAdminLoginErrorMessage\(error\)/);
  assert.doesNotMatch(login, /error instanceof Error && error\.message/);
  assert.match(api, /shouldAttemptAdminSessionRefresh/);
  const formatter = api.slice(
    api.indexOf('function formatAdminErrorMessage'),
    api.indexOf('export async function loadAdminTenants'),
  );
  assert.ok(
    formatter.indexOf('case "invalid_admin_credentials"') <
      formatter.indexOf('response.status === 401'),
    'credential-specific errors must be formatted before generic session expiry',
  );
});
