import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('direct printer configuration is restricted on both API entry points', async () => {
  const helper = await readFile(new URL('../src/lib/printer-network.ts', import.meta.url), 'utf8');
  const counter = await readFile(new URL('../src/http/routes/counter.ts', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../src/http/routes/operational-integrations.ts', import.meta.url), 'utf8');

  assert.match(helper, /first === 10/);
  assert.match(helper, /first === 172/);
  assert.match(helper, /first === 192 && second === 168/);
  assert.match(helper, /new Set\(\[9100\]\)/);
  assert.match(counter, /isAllowedDirectPrinterDestination/);
  assert.match(admin, /isAllowedDirectPrinterDestination/);
});
