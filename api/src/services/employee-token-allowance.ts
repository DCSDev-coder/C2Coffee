import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../db/mysql.js';

export const MONTHLY_EMPLOYEE_ALLOWANCE = 200;
export const MONTHLY_INTERN_ALLOWANCE = 100;
export type SubsidyRole = 'none' | 'employee' | 'intern' | 'boss';
export type SubsidyAllowanceMode = 'none' | 'monthly' | 'unlimited';

type SubsidyPolicy = {
  role: SubsidyRole;
  allowanceMode: SubsidyAllowanceMode;
  monthlyAmount: number | null;
};

function defaultMonthlyAllowance(role: SubsidyRole): number | null {
  if (role === 'employee') return MONTHLY_EMPLOYEE_ALLOWANCE;
  if (role === 'intern') return MONTHLY_INTERN_ALLOWANCE;
  return null;
}

async function getSubsidyPolicy(
  connection: PoolConnection,
  tenantId: number,
  role: SubsidyRole,
  periodStart: string
): Promise<SubsidyPolicy> {
  if (role === 'boss') return { role, allowanceMode: 'unlimited', monthlyAmount: null };
  const fallback = defaultMonthlyAllowance(role);
  if (fallback === null) return { role: 'none', allowanceMode: 'none', monthlyAmount: null };
  const [rows] = await connection.query<Array<RowDataPacket & { monthly_amount: number }>>(
    `SELECT monthly_amount
       FROM tenant_subsidy_policies
      WHERE tenant_id = :tenantId AND subsidy_role = :subsidyRole
        AND effective_period_start <= :periodStart
      ORDER BY effective_period_start DESC, id DESC
      LIMIT 1`,
    { tenantId, subsidyRole: role, periodStart }
  );
  return {
    role,
    allowanceMode: 'monthly',
    monthlyAmount: Math.max(0, Number(rows[0]?.monthly_amount ?? fallback))
  };
}

/** Returns only the customer-funded portion of a token order. */
export function calculatePersonalTokenRefund(tokenAmountCharged: number, allowanceUsed: number): number {
  return Math.max(0, Math.floor(Number(tokenAmountCharged) || 0) - Math.floor(Number(allowanceUsed) || 0));
}

export async function getEmployeeSubsidyStatus(userId: number, tenantId: number) {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const [membershipRows] = await connection.query<Array<RowDataPacket & { is_employee: number; subsidy_enabled: number; subsidy_role: SubsidyRole }>>(
      `SELECT is_employee, subsidy_enabled, subsidy_role FROM customer_tenant_memberships
       WHERE tenant_id = :tenantId AND user_id = :userId LIMIT 1 FOR UPDATE`,
      { tenantId, userId }
    );
    const membership = membershipRows[0];
    const role: SubsidyRole = membership?.subsidy_role ?? (Number(membership?.is_employee) === 1 ? 'employee' : 'none');
    if (!membership || role === 'none') {
      await connection.commit();
      return { eligible: false, enabled: false, role: 'none', allowance_mode: 'none', remaining: 0, granted: 0, used: 0 };
    }
    const period = currentEmployeeAllowancePeriod();
    const nextPeriod = nextEmployeeAllowancePeriod();
    const policy = await getSubsidyPolicy(connection, tenantId, role, period.start);
    if (policy.allowanceMode === 'unlimited') {
      const [usageRows] = await connection.query<Array<RowDataPacket & { used: number }>>(
        `SELECT COALESCE(SUM(employee_allowance_tokens_used), 0) AS used
           FROM orders o
           JOIN stores s ON s.id = o.store_id
          WHERE o.user_id = :userId AND s.tenant_id = :tenantId
            AND o.created_at >= :periodStartUtc AND o.created_at < :periodEndExclusiveUtc`,
        {
          userId,
          tenantId,
          periodStartUtc: `${period.start} 00:00:00`,
          periodEndExclusiveUtc: `${nextPeriod.start} 00:00:00`
        }
      );
      await connection.commit();
      return {
        eligible: true,
        enabled: Number(membership.subsidy_enabled) !== 0,
        role,
        allowance_mode: 'unlimited',
        remaining: null,
        granted: null,
        used: Number(usageRows[0]?.used ?? 0),
        period_start: period.start,
        period_end: period.end
      };
    }
    await ensureEmployeeAllowance(connection, userId, tenantId);
    const [allowanceRows] = await connection.query<Array<RowDataPacket & { remaining_amount: number; granted_amount: number; carried_forward_amount: number }>>(
      `SELECT remaining_amount, granted_amount, carried_forward_amount
       FROM employee_token_allowances WHERE tenant_id = :tenantId AND user_id = :userId
       AND period_start = :periodStart LIMIT 1`,
      { tenantId, userId, periodStart: period.start }
    );
    const allowance = allowanceRows[0];
    const granted = Number(allowance?.granted_amount ?? 0) + Number(allowance?.carried_forward_amount ?? 0);
    await connection.commit();
    return {
      eligible: true,
      enabled: Number(membership.subsidy_enabled) !== 0,
      role,
      allowance_mode: 'monthly',
      remaining: Number(allowance?.remaining_amount ?? 0),
      granted,
      used: Math.max(0, granted - Number(allowance?.remaining_amount ?? 0)),
      period_start: period.start,
      period_end: period.end
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function setEmployeeSubsidyEnabled(userId: number, tenantId: number, enabled: boolean): Promise<void> {
  await mysqlPool.execute(
    `UPDATE customer_tenant_memberships SET subsidy_enabled = :enabled
     WHERE tenant_id = :tenantId AND user_id = :userId AND subsidy_role <> 'none'`,
    { enabled: enabled ? 1 : 0, tenantId, userId }
  );
}

type AllowanceRow = RowDataPacket & {
  id: number;
  remaining_amount: number;
  granted_amount: number;
  carried_forward_amount: number;
};

export function currentEmployeeAllowancePeriod(): { start: string; end: string; month: string } {
  const now = new Date();
  const malaysiaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = malaysiaNow.getUTCFullYear();
  const monthIndex = malaysiaNow.getUTCMonth();
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    month: start.toISOString().slice(0, 7)
  };
}

export function nextEmployeeAllowancePeriod(): { start: string; end: string; month: string } {
  const current = currentEmployeeAllowancePeriod();
  const [year, month] = current.start.split('-').map(Number);
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    month: start.toISOString().slice(0, 7)
  };
}

export async function ensureEmployeeAllowance(
  connection: PoolConnection,
  userId: number,
  tenantId: number,
  createdByAdminId?: number
): Promise<void> {
  const period = currentEmployeeAllowancePeriod();
  const [membershipRows] = await connection.query<Array<RowDataPacket & { subsidy_role: SubsidyRole }>>(
    `SELECT subsidy_role FROM customer_tenant_memberships
      WHERE tenant_id = :tenantId AND user_id = :userId AND subsidy_role IN ('employee', 'intern')
      LIMIT 1 FOR UPDATE`,
    { tenantId, userId }
  );
  if (!membershipRows[0]) return;
  const policy = await getSubsidyPolicy(connection, tenantId, membershipRows[0].subsidy_role, period.start);
  if (policy.allowanceMode !== 'monthly' || policy.monthlyAmount === null) return;
  await restoreCurrentAllowanceForRoleChange(
    connection,
    userId,
    tenantId,
    membershipRows[0].subsidy_role,
    createdByAdminId
  );

  const [existingRows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM employee_token_allowances
      WHERE tenant_id = :tenantId AND user_id = :userId AND period_start = :periodStart
      LIMIT 1 FOR UPDATE`,
    { tenantId, userId, periodStart: period.start }
  );
  if (existingRows[0]) return;

  const [priorRows] = await connection.query<Array<RowDataPacket & { remaining_amount: number }>>(
    `SELECT id, remaining_amount FROM employee_token_allowances
      WHERE tenant_id = :tenantId AND user_id = :userId
        AND period_start < :periodStart AND remaining_amount > 0
        AND status IN ('active', 'fully_spent')
      FOR UPDATE`,
    { tenantId, userId, periodStart: period.start }
  );
  const priorRemaining = priorRows.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0);
  const carriedForward = Math.min(policy.monthlyAmount, priorRemaining);
  const expiredAmount = Math.max(0, priorRemaining - carriedForward);
  const topUpAmount = policy.monthlyAmount - carriedForward;

  const [accountRows] = await connection.query<Array<RowDataPacket & { balance_available: number; balance_cap: number }>>(
    `SELECT balance_available, balance_cap FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
    { userId }
  );
  const account = accountRows[0];
  if (!account) throw new Error('Employee token account was not found.');
  const balanceAfterIssue = Number(account.balance_available) - expiredAmount + topUpAmount;
  if (balanceAfterIssue < 0) throw new Error('Employee allowance records do not match the token account.');

  if (priorRows.length > 0) {
    await connection.execute(
      `UPDATE employee_token_allowances
          SET remaining_amount = 0, status = 'expired', updated_at = UTC_TIMESTAMP()
        WHERE tenant_id = :tenantId AND user_id = :userId AND period_start < :periodStart
          AND remaining_amount > 0`,
      { tenantId, userId, periodStart: period.start }
    );
  }

  const [issueResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO employee_token_allowances
      (tenant_id, user_id, period_start, period_end, carried_forward_amount,
       granted_amount, remaining_amount)
     VALUES (:tenantId, :userId, :periodStart, :periodEnd, :carriedForward,
             :topUpAmount, :monthlyCap)`,
    { tenantId, userId, periodStart: period.start, periodEnd: period.end, carriedForward, topUpAmount, monthlyCap: policy.monthlyAmount }
  );

  if (issueResult.affectedRows > 0) {
    const balanceCap = Math.max(Number(account.balance_cap), balanceAfterIssue);
    await connection.execute(
      `UPDATE token_accounts SET balance_available = :balanceAfterIssue, balance_cap = :balanceCap, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`,
      { balanceAfterIssue, balanceCap, userId }
    );
    if (expiredAmount > 0) await connection.execute(
      `INSERT INTO token_ledger
        (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
       VALUES (:userId, NULL, 'debit', 'employee_allowance_expiry', :allowanceId, :amount,
               :balanceAfterIssue, :remarks, UTC_TIMESTAMP())`,
      { userId, allowanceId: issueResult.insertId, amount: expiredAmount, balanceAfterIssue, remarks: `Company subsidy allowance capped for ${period.month}` }
    );
    if (topUpAmount > 0) await connection.execute(
      `INSERT INTO token_ledger
        (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
       VALUES (:userId, NULL, 'credit', 'employee_allowance_issue', :allowanceId, :amount,
               :balanceAfterIssue, :remarks, UTC_TIMESTAMP())`,
      { userId, allowanceId: issueResult.insertId, amount: topUpAmount, balanceAfterIssue, remarks: `Monthly ${membershipRows[0].subsidy_role} subsidy top-up ${period.month}` }
    );
  }
}

/** Issues the allowance when an employee opens the app for the first time each month. */
export async function issueCurrentEmployeeAllowancesForUser(userId: number): Promise<void> {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Array<RowDataPacket & { tenant_id: number }>>(
      `SELECT tenant_id FROM customer_tenant_memberships WHERE user_id = :userId AND subsidy_role IN ('employee', 'intern') FOR UPDATE`,
      { userId }
    );
    for (const row of rows) await ensureEmployeeAllowance(connection, userId, Number(row.tenant_id));
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Removes only the unused finite allowance when moving to Boss or no subsidy. */
export async function revokeCurrentAllowanceForRoleChange(
  connection: PoolConnection,
  userId: number,
  tenantId: number,
  nextRole: SubsidyRole,
  createdByAdminId?: number
): Promise<number> {
  if (nextRole !== 'boss' && nextRole !== 'none') return 0;
  const period = currentEmployeeAllowancePeriod();
  const [allowanceRows] = await connection.query<Array<RowDataPacket & { id: number; remaining_amount: number }>>(
    `SELECT id, remaining_amount
       FROM employee_token_allowances
      WHERE tenant_id = :tenantId AND user_id = :userId
        AND period_start = :periodStart AND status IN ('active', 'fully_spent')
      LIMIT 1 FOR UPDATE`,
    { tenantId, userId, periodStart: period.start }
  );
  const allowance = allowanceRows[0];
  if (!allowance) return 0;
  const revoked = Number(allowance.remaining_amount);
  const [accountRows] = await connection.query<Array<RowDataPacket & { balance_available: number }>>(
    `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
    { userId }
  );
  const balanceAfterRevocation = Number(accountRows[0]?.balance_available ?? 0) - revoked;
  if (balanceAfterRevocation < 0) throw new Error('Company subsidy balance is inconsistent with the customer wallet.');
  await connection.execute(
    `UPDATE employee_token_allowances
        SET remaining_amount = 0, status = 'revoked', updated_at = UTC_TIMESTAMP()
      WHERE id = :allowanceId`,
    { allowanceId: allowance.id }
  );
  if (revoked > 0) {
    await connection.execute(
      `UPDATE token_accounts
          SET balance_available = :balanceAfterRevocation, updated_at = UTC_TIMESTAMP()
        WHERE user_id = :userId`,
      { userId, balanceAfterRevocation }
    );
  }
  await connection.execute(
    `INSERT INTO token_ledger
      (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after,
       remarks, created_by_admin_id, created_at)
     VALUES (:userId, NULL, 'debit', 'employee_allowance_role_revoke', :allowanceId, :amount,
             :balanceAfterRevocation, :remarks, :createdByAdminId, UTC_TIMESTAMP())`,
    {
      userId,
      allowanceId: allowance.id,
      amount: revoked,
      balanceAfterRevocation,
      remarks: `Unused company subsidy revoked when role changed to ${nextRole}`,
      createdByAdminId: createdByAdminId ?? null
    }
  );
  return revoked;
}

/** Restores the exact unused amount removed by the latest finite-to-unlimited role change. */
export async function restoreCurrentAllowanceForRoleChange(
  connection: PoolConnection,
  userId: number,
  tenantId: number,
  nextRole: SubsidyRole,
  createdByAdminId?: number
): Promise<number> {
  if (nextRole !== 'employee' && nextRole !== 'intern') return 0;
  const period = currentEmployeeAllowancePeriod();
  const [allowanceRows] = await connection.query<Array<RowDataPacket & {
    id: number;
    granted_amount: number;
    carried_forward_amount: number;
  }>>(
    `SELECT id, granted_amount, carried_forward_amount
       FROM employee_token_allowances
      WHERE tenant_id = :tenantId AND user_id = :userId
        AND period_start = :periodStart AND status = 'revoked'
      LIMIT 1 FOR UPDATE`,
    { tenantId, userId, periodStart: period.start }
  );
  const allowance = allowanceRows[0];
  if (!allowance) return 0;

  const [revocationRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
    `SELECT id
       FROM token_ledger
      WHERE user_id = :userId
        AND direction = 'debit'
        AND source_type IN ('employee_allowance_expiry', 'employee_allowance_role_revoke')
        AND source_id = :allowanceId
        AND remarks LIKE 'Unused company subsidy revoked when role changed to %'
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE`,
    { userId, allowanceId: allowance.id }
  );
  if (!revocationRows[0]) return 0;
  const issuedCap = Number(allowance.granted_amount) + Number(allowance.carried_forward_amount ?? 0);
  const [usageRows] = await connection.query<Array<RowDataPacket & { net_used: number }>>(
    `SELECT COALESCE(SUM(GREATEST(
              o.employee_allowance_tokens_used - o.employee_allowance_tokens_refunded,
              0
            )), 0) AS net_used
       FROM orders o
       JOIN stores s ON s.id = o.store_id
      WHERE o.user_id = :userId
        AND s.tenant_id = :tenantId
        AND o.employee_allowance_was_unlimited = 0
        AND o.created_at >= :periodStart
        AND o.created_at < DATE_ADD(:periodEnd, INTERVAL 1 DAY)`,
    {
      userId,
      tenantId,
      periodStart: period.start,
      periodEnd: period.end
    }
  );
  const restored = Math.max(0, issuedCap - Number(usageRows[0]?.net_used ?? 0));
  const [accountRows] = await connection.query<Array<RowDataPacket & { balance_available: number; balance_cap: number }>>(
    `SELECT balance_available, balance_cap
       FROM token_accounts
      WHERE user_id = :userId
      LIMIT 1 FOR UPDATE`,
    { userId }
  );
  const account = accountRows[0];
  if (!account) throw new Error('Employee token account was not found.');
  const balanceAfterRestore = Number(account.balance_available) + restored;

  await connection.execute(
    `UPDATE employee_token_allowances
        SET remaining_amount = :restored,
            status = CASE WHEN :restored = 0 THEN 'fully_spent' ELSE 'active' END,
            updated_at = UTC_TIMESTAMP()
      WHERE id = :allowanceId AND status = 'revoked'`,
    { restored, allowanceId: allowance.id }
  );
  if (restored > 0) {
    await connection.execute(
      `UPDATE token_accounts
          SET balance_available = :balanceAfterRestore,
              balance_cap = GREATEST(balance_cap, :balanceAfterRestore),
              updated_at = UTC_TIMESTAMP()
        WHERE user_id = :userId`,
      { userId, balanceAfterRestore }
    );
    await connection.execute(
      `INSERT INTO token_ledger
        (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after,
         remarks, created_by_admin_id, created_at)
       VALUES (:userId, NULL, 'credit', 'employee_allowance_role_restore', :allowanceId, :amount,
               :balanceAfterRestore, :remarks, :createdByAdminId, UTC_TIMESTAMP())`,
      {
        userId,
        allowanceId: allowance.id,
        amount: restored,
        balanceAfterRestore,
        remarks: `Unused company subsidy restored when role changed to ${nextRole}`,
        createdByAdminId: createdByAdminId ?? null
      }
    );
  }
  return restored;
}

/** Ensures the current monthly allowance exists and consumes it atomically. */
export async function consumeEmployeeAllowance(
  connection: PoolConnection,
  userId: number,
  tenantId: number,
  orderId: number,
  requestedAmount: number
): Promise<number> {
  if (requestedAmount <= 0) return 0;
  const period = currentEmployeeAllowancePeriod();
  const [membershipRows] = await connection.query<Array<RowDataPacket & { subsidy_enabled: number; subsidy_role: SubsidyRole }>>(
    `SELECT subsidy_enabled, subsidy_role FROM customer_tenant_memberships
     WHERE tenant_id = :tenantId AND user_id = :userId AND subsidy_role <> 'none' LIMIT 1 FOR UPDATE`,
    { tenantId, userId }
  );
  if (Number(membershipRows[0]?.subsidy_enabled ?? 0) !== 1) return 0;
  const role = membershipRows[0]?.subsidy_role ?? 'none';
  if (role === 'boss') {
    const [accountRows] = await connection.query<Array<RowDataPacket & { balance_available: number }>>(
      `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
      { userId }
    );
    const balanceAfterSpend = Number(accountRows[0]?.balance_available ?? 0);
    await connection.execute(
      `INSERT INTO token_ledger
        (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
       VALUES (:userId, NULL, 'debit', 'employee_allowance_spend', :orderId, :amount,
               :balanceAfterSpend, :remarks, UTC_TIMESTAMP())`,
      { userId, orderId, amount: requestedAmount, balanceAfterSpend, remarks: `Unlimited boss subsidy for order ${orderId}` }
    );
    return requestedAmount;
  }
  await ensureEmployeeAllowance(connection, userId, tenantId);

  const [rows] = await connection.query<AllowanceRow[]>(
    `SELECT id, remaining_amount
       FROM employee_token_allowances
      WHERE tenant_id = :tenantId AND user_id = :userId
        AND period_start = :periodStart AND status = 'active'
      LIMIT 1 FOR UPDATE`,
    { tenantId, userId, periodStart: period.start }
  );
  const allowance = rows[0];
  if (!allowance) return 0;

  const used = Math.min(requestedAmount, Number(allowance.remaining_amount));
  if (used <= 0) return 0;
  const remaining = Number(allowance.remaining_amount) - used;
  await connection.execute(
    `UPDATE employee_token_allowances
        SET remaining_amount = :remaining,
            status = CASE WHEN :remaining = 0 THEN 'fully_spent' ELSE 'active' END,
            updated_at = UTC_TIMESTAMP()
      WHERE id = :allowanceId`,
    { allowanceId: allowance.id, remaining }
  );
  const [accountRows] = await connection.query<Array<RowDataPacket & { balance_available: number }>>(
    `SELECT balance_available FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`,
    { userId }
  );
  const balanceAfterSpend = Number(accountRows[0]?.balance_available ?? 0) - used;
  if (balanceAfterSpend < 0) throw new Error('Employee allowance balance is unavailable.');
  await connection.execute(
    `UPDATE token_accounts SET balance_available = :balanceAfterSpend, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`,
    { balanceAfterSpend, userId }
  );
  await connection.execute<ResultSetHeader>(
    `INSERT INTO token_ledger
      (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
     SELECT :userId, NULL, 'debit', 'employee_allowance_spend', :orderId, :amount,
            :balanceAfterSpend, :remarks, UTC_TIMESTAMP()
       FROM token_accounts WHERE user_id = :userId`,
    { userId, orderId, amount: used, balanceAfterSpend, remarks: `Employee monthly allowance for order ${orderId}` }
  );
  return used;
}

/** Restores company-funded tokens only to the original still-active month. */
export async function restoreEmployeeAllowanceForRefund(
  connection: PoolConnection,
  orderId: number
): Promise<{ allowanceUsed: number; restored: number }> {
  const [rows] = await connection.query<Array<RowDataPacket & {
    allowance_used: number;
    allowance_id: number | null;
    remaining_amount: number | null;
    granted_amount: number | null;
    carried_forward_amount: number | null;
    allowance_refunded: number | null;
    allowance_was_unlimited: number;
    period_end: Date | null;
    allowance_status: 'active' | 'fully_spent' | 'expired' | 'revoked' | null;
  }>>(
    `SELECT o.employee_allowance_tokens_used AS allowance_used,
            o.employee_allowance_tokens_refunded AS allowance_refunded,
            o.employee_allowance_was_unlimited AS allowance_was_unlimited,
            eta.id AS allowance_id, eta.remaining_amount, eta.granted_amount,
            eta.carried_forward_amount, eta.period_end, eta.status AS allowance_status
       FROM orders o
       JOIN stores s ON s.id = o.store_id
       LEFT JOIN employee_token_allowances eta
         ON eta.tenant_id = s.tenant_id
        AND eta.user_id = o.user_id
        AND DATE(o.created_at) BETWEEN eta.period_start AND eta.period_end
      WHERE o.id = :orderId
      LIMIT 1 FOR UPDATE`,
    { orderId }
  );
  const row = rows[0];
  const allowanceUsed = Number(row?.allowance_used ?? 0);
  if (Number(row?.allowance_was_unlimited ?? 0) === 1 || !row?.allowance_id || allowanceUsed <= 0 || !row.period_end) return { allowanceUsed, restored: 0 };
  const periodEnd = new Date(row.period_end);
  periodEnd.setUTCHours(23, 59, 59, 999);
  if (periodEnd < new Date()) return { allowanceUsed, restored: 0 };
  const allowanceCap = Number(row.granted_amount) + Number(row.carried_forward_amount ?? 0);
  const alreadyRefunded = Number(row.allowance_refunded ?? 0);
  const restored = Math.min(Math.max(0, allowanceUsed - alreadyRefunded), Math.max(0, allowanceCap - Number(row.remaining_amount)));
  if (restored > 0 && row.allowance_status === 'revoked') {
    await connection.execute(
      `UPDATE employee_token_allowances
          SET refunded_amount = refunded_amount + :restored,
              updated_at = UTC_TIMESTAMP()
        WHERE id = :allowanceId AND status = 'revoked'`,
      { restored, allowanceId: row.allowance_id }
    );
    await connection.execute(
      `UPDATE orders
          SET employee_allowance_tokens_refunded = employee_allowance_tokens_refunded + :restored
        WHERE id = :orderId`,
      { restored, orderId }
    );
    return { allowanceUsed, restored: 0 };
  }
  if (restored > 0) {
    await connection.execute(
      `UPDATE employee_token_allowances
          SET remaining_amount = remaining_amount + :restored,
              refunded_amount = refunded_amount + :restored,
              status = 'active', updated_at = UTC_TIMESTAMP()
        WHERE id = :allowanceId`,
      { restored, allowanceId: row.allowance_id }
    );
    await connection.execute(
      `UPDATE orders SET employee_allowance_tokens_refunded = employee_allowance_tokens_refunded + :restored
        WHERE id = :orderId`,
      { restored, orderId }
    );
  }
  return { allowanceUsed, restored };
}
