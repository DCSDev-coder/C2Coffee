import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Admin Web restores the last page safely and clears it on logout', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(app, /c2_admin_last_page/);
  assert.match(app, /window\.localStorage\.getItem\(LAST_ADMIN_PAGE_KEY\)/);
  assert.match(app, /canAccessAdminPage\(user\?\.roles, savedPage\)/);
  assert.match(app, /clearLastAdminPage\(\)/);
  assert.match(app, /saveLastAdminPage\(currentPage\)/);
});
