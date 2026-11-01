import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('Admin Manual covers the operational pages and inventory workflow', async () => {
  const manual = await source('src/data/adminManual.js');
  const staffGuides = await source('src/components/StaffGuides.jsx');

  for (const page of ['Dashboard', 'Orders', 'Menu', 'Inventory', 'Voucher', 'Finance', 'Staff Guides', 'Settings']) {
    assert.match(manual, new RegExp(`page: '${page}'`));
  }
  assert.match(manual, /Create and submit a purchase order/);
  assert.match(manual, /When stock arrives/);
  assert.match(manual, /Set Product usage/);
  assert.match(manual, /batch, expiry/);
  assert.match(staffGuides, /Search the manual/);
  assert.match(staffGuides, /adminManualSections/);
});
