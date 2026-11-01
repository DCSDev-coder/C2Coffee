import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('explicit logout blocks refresh-cookie session restoration until login', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../src/lib/adminApi.js', import.meta.url), 'utf8');

  assert.match(api, /markAdminExplicitlyLoggedOut\(\)/);
  assert.match(api, /c2_admin_explicit_logout/);
  assert.match(api, /logoutAdminSession/);
  assert.match(app, /if \(wasAdminExplicitlyLoggedOut\(\)\)/);
  assert.match(app, /clearAdminExplicitLogout\(\)/);
});
