import assert from 'node:assert/strict';
import test from 'node:test';

import { allocateSubsidyEligibleDrinkTokens } from '../dist/services/subsidy-checkout-policy.js';
import {
  calculatePersonalTokenRefund,
  ensureEmployeeAllowance,
  restoreEmployeeAllowanceForRefund,
  restoreCurrentAllowanceForRoleChange,
} from '../dist/services/employee-token-allowance.js';

test('all configured drink spend remains subsidy eligible without deductions', () => {
  assert.equal(
    allocateSubsidyEligibleDrinkTokens({
      totalTokens: 10,
      drinkTokens: 10,
      priorDeductions: 0,
    }),
    10,
  );
});

test('voucher and gift-card deductions cannot redirect subsidy to non-drinks', () => {
  assert.equal(
    allocateSubsidyEligibleDrinkTokens({
      totalTokens: 10,
      drinkTokens: 10,
      priorDeductions: 10,
    }),
    0,
  );
  assert.equal(
    allocateSubsidyEligibleDrinkTokens({
      totalTokens: 15,
      drinkTokens: 10,
      priorDeductions: 5,
    }),
    5,
  );
});

test('food and merchandise remain ineligible for subsidy', () => {
  assert.equal(
    allocateSubsidyEligibleDrinkTokens({
      totalTokens: 10,
      drinkTokens: 0,
      priorDeductions: 0,
    }),
    0,
  );
});

test('cancellation returns personal C2 Credit separately from restored subsidy', () => {
  assert.equal(calculatePersonalTokenRefund(10, 10), 0);
  assert.equal(calculatePersonalTokenRefund(15, 10), 5);
  assert.equal(calculatePersonalTokenRefund(0, 0), 0);
});

test('returning to a finite role restores only the exact amount revoked this month', async () => {
  const queryResults = [
    [[{ id: 17, granted_amount: 200, carried_forward_amount: 0 }]],
    [[{ id: 91 }]],
    [[{ net_used: 5 }]],
    [[{ balance_available: 5, balance_cap: 500 }]],
  ];
  const executions = [];
  const connection = {
    async query() {
      return queryResults.shift();
    },
    async execute(sql, params) {
      executions.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };

  const restored = await restoreCurrentAllowanceForRoleChange(
    connection,
    9,
    3,
    'employee',
  );

  assert.equal(restored, 195);
  assert.equal(executions.length, 3);
  assert.match(executions[0].sql, /status = CASE WHEN :restored = 0 THEN 'fully_spent' ELSE 'active' END/);
  assert.equal(executions[0].params.restored, 195);
  assert.equal(executions[1].params.balanceAfterRestore, 200);
  assert.match(executions[2].sql, /employee_allowance_role_restore/);
  assert.equal(executions[2].params.amount, 195);
});

test('a subsidy refund is recorded while the finite allowance is temporarily revoked', async () => {
  const executions = [];
  const connection = {
    async query() {
      return [[{
        allowance_used: 10,
        allowance_id: 17,
        remaining_amount: 0,
        granted_amount: 200,
        carried_forward_amount: 0,
        allowance_refunded: 0,
        allowance_was_unlimited: 0,
        period_end: new Date('2099-11-30T00:00:00.000Z'),
        allowance_status: 'revoked',
      }]];
    },
    async execute(sql, params) {
      executions.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };

  const result = await restoreEmployeeAllowanceForRefund(connection, 88);

  assert.deepEqual(result, { allowanceUsed: 10, restored: 0 });
  assert.equal(executions.length, 2);
  assert.match(executions[0].sql, /refunded_amount = refunded_amount \+ :restored/);
  assert.match(executions[0].sql, /status = 'revoked'/);
  assert.match(executions[1].sql, /employee_allowance_tokens_refunded/);
  assert.equal(executions[1].params.restored, 10);
});

test('a subsidy refund on an active allowance restores both remaining_amount and token_accounts.balance_available', async () => {
  const queryResults = [
    [[{
      user_id: 21,
      order_ref: 'C2-20261109-001',
      allowance_used: 15,
      allowance_id: 17,
      remaining_amount: 185,
      granted_amount: 200,
      carried_forward_amount: 0,
      allowance_refunded: 0,
      allowance_was_unlimited: 0,
      period_end: new Date('2099-11-30T00:00:00.000Z'),
      allowance_status: 'active',
    }]],
    [[{ balance_available: 185, balance_cap: 500 }]],
  ];
  const executions = [];
  const connection = {
    async query() {
      return queryResults.shift();
    },
    async execute(sql, params) {
      executions.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };

  const result = await restoreEmployeeAllowanceForRefund(connection, 105);

  assert.deepEqual(result, { allowanceUsed: 15, restored: 15 });
  assert.equal(executions.length, 4);
  assert.match(executions[0].sql, /remaining_amount = remaining_amount \+ :restored/);
  assert.equal(executions[0].params.restored, 15);
  assert.match(executions[1].sql, /employee_allowance_tokens_refunded = employee_allowance_tokens_refunded \+ :restored/);
  assert.match(executions[2].sql, /UPDATE token_accounts/);
  assert.equal(executions[2].params.balanceAfterRestore, 200);
  assert.match(executions[3].sql, /INSERT INTO token_ledger/);
  assert.equal(executions[3].params.amount, 15);
  assert.equal(executions[3].params.balanceAfterRestore, 200);
});

test('ensureEmployeeAllowance reconciles desynchronized wallet balance when balance_available is below active remaining_amount', async () => {
  const queryResults = [
    [[{ subsidy_role: 'employee' }]],
    [[{ monthly_amount: 200 }]],
    [[]], // restoreCurrentAllowanceForRoleChange: no revoked allowance
    [[{ id: 17, remaining_amount: 200, status: 'active' }]],
    [[{ balance_available: 185, balance_cap: 500 }]],
  ];
  const executions = [];
  const connection = {
    async query() {
      return queryResults.shift();
    },
    async execute(sql, params) {
      executions.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };

  await ensureEmployeeAllowance(connection, 21, 1);

  assert.equal(executions.length, 3);
  assert.match(executions[0].sql, /INSERT IGNORE INTO token_accounts/);
  assert.match(executions[1].sql, /UPDATE token_accounts/);
  assert.equal(executions[1].params.reconciledBalance, 200);
  assert.match(executions[2].sql, /INSERT INTO token_ledger/);
  assert.equal(executions[2].params.amount, 15);
});
