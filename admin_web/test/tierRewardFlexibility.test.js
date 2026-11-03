import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('tier rewards use generic benefits, configurable quantities, and server generated codes', async () => {
  const source = await readFile(new URL('../src/components/TierManagement.jsx', import.meta.url), 'utf8');

  assert.match(source, /benefitType: 'Free'/);
  assert.match(source, /<option value="Free">Free item/);
  assert.doesNotMatch(source, /<option value="Free Drink">Free Drink<\/option>/);
  assert.doesNotMatch(source, /<option value="Free Food">Free Food<\/option>/);
  assert.match(source, /Items included per claim/);
  assert.match(source, /code: editingTierReward\?\.voucherCode \|\| 'AUTO'/);
  assert.match(source, /One claim per achievement or birthday reward period/);
});
