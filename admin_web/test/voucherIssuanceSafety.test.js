import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('manual voucher issuance is retry safe and prevents repeat submissions', async () => {
  const vouchers = await readFile(new URL('../src/components/Vouchers.jsx', import.meta.url), 'utf8');

  assert.match(vouchers, /setIssueRequestKey/);
  assert.match(vouchers, /issueCaseRef: `admin:\$\{issueRequestKey\}`/);
  assert.match(vouchers, /if \(issueInProgress\) return/);
  assert.match(vouchers, /disabled=\{issueInProgress\}/);
});
