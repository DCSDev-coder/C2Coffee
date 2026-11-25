import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('finance excludes zero-token orders from personal funding and reads recorded allowance balances', async () => {
  const source = await readFile(new URL('../src/http/routes/admin-orders.ts', import.meta.url), 'utf8');
  const funding = source.slice(source.indexOf('AS token_orders,'), source.indexOf('AS allowance_order_value_rm'));
  assert.match(funding, /o\.token_amount_charged > 0[\s\S]*?personal_token_order_value_rm/);
  assert.doesNotMatch(funding, /THEN o\.final_total_rm\s+ELSE 0/);
  assert.match(source, /FROM employee_token_allowances a[\s\S]*?t\.code = :tenantCode AND a\.status = 'active'/);
  assert.match(source, /recordedActiveBalanceTokens: Number\(allowanceBalanceRows/);
});
