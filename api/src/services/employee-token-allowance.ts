import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../db/mysql.js';

export const MONTHLY_EMPLOYEE_ALLOWANCE = 200;

/** Returns only the customer-funded portion of a token order. */
export function calculatePersonalTokenRefund(tokenAmountCharged: number, allowanceUsed: number): number {
  return Math.max(0, Math.floor(Number(tokenAmountCharged) || 0) - Math.floor(Number(allowanceUsed) || 0));
}

export async function getEmployeeSubsidyStatus(userId: number, tenantId: number) {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const [membershipRows] = await connection.query<Array<RowDataPacket & { is_employee: number; subsidy_enabled: number }>>(
      `SELECT is_employee, subsidy_enabled FROM customer_tenant_memberships
       WHERE tenant_id = :tenantId AND user_id = :userId LIMIT 1 FOR UPDATE`,
      { tenantId, userId }
    );
    const membership = membershipRows[0];
    if (!membership || Number(membership.is_employee) !== 1) {
      await connection.commit();
      return { eligible: false, enabled: false, remaining: 0, granted: 0, used: 0 };
    }
    await ensureEmployeeAllowance(connection, userId, tenantId);
    const period = currentEmployeeAllowancePeriod();
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
     WHERE tenant_id = :tenantId AND user_id = :userId AND is_employee = 1`,
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

export async function ensureEmployeeAllowance(
  connection: PoolConnection,
  userId: number,
  tenantId: number
): Promise<void> {
  const period = currentEmployeeAllowancePeriod();
  const [membershipRows] = await connection.query<RowDataPacket[]>(
    `SELECT 1 FROM customer_tenant_memberships
      WHERE tenant_id = :tenantId AND user_id = :userId AND is_employee = 1
      LIMIT 1 FOR UPDATE`,
    { tenantId, userId }
  );
  if (!membershipRows[0]) return;

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
  const carriedForward = Math.min(MONTHLY_EMPLOYEE_ALLOWANCE, priorRemaining);
  const expiredAmount = Math.max(0, priorRemaining - carriedForward);
  const topUpAmount = MONTHLY_EMPLOYEE_ALLOWANCE - carriedForward;

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
    { tenantId, userId, periodStart: period.start, periodEnd: period.end, carriedForward, topUpAmount, monthlyCap: MONTHLY_EMPLOYEE_ALLOWANCE }
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
      { userId, allowanceId: issueResult.insertId, amount: expiredAmount, balanceAfterIssue, remarks: `Employee allowance capped for ${period.month}` }
    );
    if (topUpAmount > 0) await connection.execute(
      `INSERT INTO token_ledger
        (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
       VALUES (:userId, NULL, 'credit', 'employee_allowance_issue', :allowanceId, :amount,
               :balanceAfterIssue, :remarks, UTC_TIMESTAMP())`,
      { userId, allowanceId: issueResult.insertId, amount: topUpAmount, balanceAfterIssue, remarks: `Monthly employee allowance top-up ${period.month}` }
    );
  }
}

/** Issues the allowance when an employee opens the app for the first time each month. */
export async function issueCurrentEmployeeAllowancesForUser(userId: number): Promise<void> {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Array<RowDataPacket & { tenant_id: number }>>(
      `SELECT tenant_id FROM customer_tenant_memberships WHERE user_id = :userId AND is_employee = 1 FOR UPDATE`,
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
  const [membershipRows] = await connection.query<Array<RowDataPacket & { subsidy_enabled: number }>>(
    `SELECT subsidy_enabled FROM customer_tenant_memberships
     WHERE tenant_id = :tenantId AND user_id = :userId AND is_employee = 1 LIMIT 1 FOR UPDATE`,
    { tenantId, userId }
  );
  if (Number(membershipRows[0]?.subsidy_enabled ?? 0) !== 1) return 0;
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
    period_end: Date | null;
  }>>(
    `SELECT o.employee_allowance_tokens_used AS allowance_used,
            o.employee_allowance_tokens_refunded AS allowance_refunded,
            eta.id AS allowance_id, eta.remaining_amount, eta.granted_amount,
            eta.carried_forward_amount, eta.period_end
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
  if (!row?.allowance_id || allowanceUsed <= 0 || !row.period_end) return { allowanceUsed, restored: 0 };
  const periodEnd = new Date(row.period_end);
  periodEnd.setUTCHours(23, 59, 59, 999);
  if (periodEnd < new Date()) return { allowanceUsed, restored: 0 };
  const allowanceCap = Number(row.granted_amount) + Number(row.carried_forward_amount ?? 0);
  const alreadyRefunded = Number(row.allowance_refunded ?? 0);
  const restored = Math.min(Math.max(0, allowanceUsed - alreadyRefunded), Math.max(0, allowanceCap - Number(row.remaining_amount)));
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
