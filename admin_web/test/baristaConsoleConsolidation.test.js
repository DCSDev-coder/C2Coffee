import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ADMIN_ROLE_SECTIONS, canAccessAdminPage } from '../src/lib/adminPermissions.js';

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('Barista Workspace is consolidated into a single Barista Console navigation entry', async () => {
  const sidebar = await source('src/components/Sidebar.jsx');
  const app = await source('src/App.jsx');

  assert.match(sidebar, /name:\s*'Barista Console'/);
  assert.doesNotMatch(sidebar, /name:\s*'Barista Workspace'/);
  assert.match(app, /currentPage === 'Barista Console'/);
  assert.doesNotMatch(app, /currentPage === 'Barista Workspace'/);
  assert.equal(canAccessAdminPage(['admin'], 'Barista Console'), true);
  assert.equal(canAccessAdminPage(['barista'], 'Barista Console'), true);
  assert.equal(canAccessAdminPage(['barista'], 'Barista Workspace'), false);
  assert.equal(ADMIN_ROLE_SECTIONS.barista, 'Barista Console only');
});

test('Barista Console exposes counter_app barista views in read-only mode for admins', async () => {
  const consoleSource = await source('src/components/BaristaConsole.jsx');
  const viewsSource = await source('src/components/BaristaConsoleViews.jsx');

  for (const tab of ['Orders', 'History', 'Menu', 'Tasks', 'Marketing', 'Inventory', 'Timetable & Guides']) {
    assert.ok(consoleSource.includes(`label: '${tab}'`), `Missing tab ${tab}`);
  }

  assert.match(consoleSource, /Read-only view/);
  assert.match(viewsSource, /OrderHistoryView/);
  assert.match(viewsSource, /MenuAvailabilityView/);
  assert.match(viewsSource, /SideWorkView/);
  assert.match(viewsSource, /MarketingDrinksView/);
  assert.match(viewsSource, /BaristaInventoryView/);
  assert.match(viewsSource, /TimetableAndGuidesView/);
});
