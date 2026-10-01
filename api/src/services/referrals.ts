import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getUtcConnection, mysqlPool } from '../db/mysql.js';
import { createUserNotification } from '../http/notifications.js';

export type ReferralReward = {
  type: 'voucher' | 'token';
  voucherTemplateId: number | null;
  tokenAmount: number | null;
};

export type ReferralProgramSnapshot = {
  programId: number;
  name: string;
  qualificationDays: number;
  monthlyReferrerLimit: number;
  friendReward: ReferralReward;
  referrerReward: ReferralReward;
};

export type ReferralRow = RowDataPacket & {
  id: number;
  referrer_user_id: number;
  referred_user_id: number;
  tenant_id: number;
  program_snapshot_json: string | ReferralProgramSnapshot | null;
  qualification_expires_at: Date | null;
};

export type ReferralRewardIssue = {
  issued: boolean;
  label?: string;
  reason?: 'token_account_unavailable' | 'token_balance_cap' | 'voucher_unavailable' | 'duplicate_issue' | 'invalid_reward';
};

export function settleReferralRewards(
  friend: ReferralRewardIssue,
  referrer: ReferralRewardIssue,
  referrerMonthlyLimitReached: boolean
): 'rewarded' | 'qualified' {
  // A cap is expected campaign behavior; other failed grants need staff follow-up.
  return friend.issued && (referrer.issued || referrerMonthlyLimitReached) ? 'rewarded' : 'qualified';
}

function parseProgramSnapshot(value: ReferralRow['program_snapshot_json']): ReferralProgramSnapshot | null {
  if (!value) return null;
  try {
    const snapshot = (typeof value === 'string' ? JSON.parse(value) : value) as ReferralProgramSnapshot;
    return snapshot?.programId && snapshot.friendReward && snapshot.referrerReward ? snapshot : null;
  } catch {
    return null;
  }
}

export async function issueReferralReward(
  connection: PoolConnection,
  userId: number,
  referralId: number,
  tenantId: number,
  side: 'friend' | 'referrer',
  reward: ReferralReward
): Promise<ReferralRewardIssue> {
  if (reward.type === 'token' && reward.tokenAmount) {
    const [accounts] = await connection.query<Array<RowDataPacket & { balance_available: number; balance_cap: number }>>(
      'SELECT balance_available, balance_cap FROM token_accounts WHERE user_id = :userId FOR UPDATE',
      { userId }
    );
    const account = accounts[0];
    if (!account) return { issued: false, reason: 'token_account_unavailable' };
    if (Number(account.balance_available) + reward.tokenAmount > Number(account.balance_cap)) {
      return { issued: false, reason: 'token_balance_cap' };
    }
    const balanceAfter = Number(account.balance_available) + reward.tokenAmount;
    await connection.execute(
      'UPDATE token_accounts SET balance_available = :balanceAfter, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId',
      { userId, balanceAfter }
    );
    await connection.execute(
      `INSERT INTO token_ledger (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
       VALUES (:userId, NULL, 'credit', 'referral_reward', :referralId, :amount, :balanceAfter, :remarks, UTC_TIMESTAMP())`,
      { userId, referralId, amount: reward.tokenAmount, balanceAfter, remarks: `Referral reward for ${side}` }
    );
    return { issued: true, label: `${reward.tokenAmount} free tokens` };
  }

  if (reward.type !== 'voucher' || !reward.voucherTemplateId) return { issued: false, reason: 'invalid_reward' };
  const [templates] = await connection.query<Array<RowDataPacket & { name: string }>>(
    `SELECT name FROM voucher_templates WHERE id = :voucherTemplateId AND tenant_id = :tenantId
       AND is_active = 1 AND (valid_until IS NULL OR valid_until > UTC_TIMESTAMP()) LIMIT 1`,
    { voucherTemplateId: reward.voucherTemplateId, tenantId }
  );
  if (!templates[0]) return { issued: false, reason: 'voucher_unavailable' };
  const issueCaseRef = `referral:${referralId}:${side}`;
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT IGNORE INTO user_vouchers (
      user_id, voucher_template_id, status, issued_by_type, issued_reason,
      issue_case_ref, issued_at, expires_at
    ) SELECT :userId, vt.id, 'active', 'system', 'Referral reward',
             :issueCaseRef, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL COALESCE(vt.expires_in_days, 30) DAY)
      FROM voucher_templates vt WHERE vt.id = :voucherTemplateId AND vt.is_active = 1`,
    { userId, voucherTemplateId: reward.voucherTemplateId, issueCaseRef }
  );
  return result.affectedRows
    ? { issued: true, label: templates[0].name }
    : { issued: false, reason: 'duplicate_issue' };
}

async function queueRewardRetry(
  connection: PoolConnection,
  referralId: number,
  tenantId: number,
  side: 'friend' | 'referrer',
  issue: ReferralRewardIssue
): Promise<void> {
  await connection.execute(
    `INSERT INTO referral_reward_jobs (
       referral_id, tenant_id, reward_side, status, attempt_count, next_attempt_at,
       last_failure_reason, last_error_message, created_at
     ) VALUES (
       :referralId, :tenantId, :side, 'pending', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE),
       :failureReason, :errorMessage, UTC_TIMESTAMP()
     ) ON DUPLICATE KEY UPDATE
       status = IF(status IN ('completed','waived'), status, 'pending'),
       attempt_count = attempt_count + 1,
       next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE),
       last_failure_reason = VALUES(last_failure_reason),
       last_error_message = VALUES(last_error_message)`,
    {
      referralId,
      tenantId,
      side,
      failureReason: issue.reason ?? 'invalid_reward',
      errorMessage: `Unable to issue ${side} referral reward.`
    }
  );
}

export async function issueFriendRewardAtClaim(
  connection: PoolConnection,
  referral: Pick<ReferralRow, 'id' | 'referrer_user_id' | 'referred_user_id' | 'tenant_id'>,
  program: ReferralProgramSnapshot
): Promise<ReferralRewardIssue> {
  const issue = await issueReferralReward(
    connection,
    referral.referred_user_id,
    referral.id,
    referral.tenant_id,
    'friend',
    program.friendReward
  );
  await connection.execute(
    `INSERT INTO referral_reward_outcomes (
       referral_id, friend_issued, friend_label, friend_failure_reason,
       referrer_issued, referrer_label, referrer_failure_reason
     ) VALUES (:referralId, :issued, :label, :reason, 0, NULL, NULL)
     ON DUPLICATE KEY UPDATE friend_issued = VALUES(friend_issued),
       friend_label = VALUES(friend_label), friend_failure_reason = VALUES(friend_failure_reason)`,
    {
      referralId: referral.id,
      issued: issue.issued ? 1 : 0,
      label: issue.label ?? null,
      reason: issue.reason ?? null
    }
  );
  if (!issue.issued) await queueRewardRetry(connection, referral.id, referral.tenant_id, 'friend', issue);
  if (issue.issued) {
    await createUserNotification(connection, {
      userId: referral.referred_user_id,
      type: 'referral_reward',
      title: 'Referral reward added',
      body: `${issue.label} is now available in your account.`,
      data: { referral_id: referral.id }
    });
  }
  return issue;
}

/** Finalizes the friend reward and issues the referrer reward after the first collected order. */
export async function awardReferralForCollectedOrder(
  connection: PoolConnection,
  referredUserId: number,
  orderId: number
): Promise<void> {
  const [rows] = await connection.query<Array<ReferralRow>>(
    `SELECT r.id, r.referrer_user_id, r.referred_user_id, s.tenant_id, r.program_snapshot_json, r.qualification_expires_at
     FROM referrals r JOIN orders o ON o.id = :orderId AND o.user_id = :referredUserId
     JOIN stores s ON s.id = o.store_id
     WHERE r.referred_user_id = :referredUserId AND r.status IN ('pending','qualified') LIMIT 1 FOR UPDATE`,
    { referredUserId, orderId }
  );
  const referral = rows[0];
  const program = referral && parseProgramSnapshot(referral.program_snapshot_json);
  if (!referral || !program) return;
  if (!referral.qualification_expires_at || referral.qualification_expires_at < new Date()) {
    await connection.execute(
      "UPDATE referrals SET status = 'rejected' WHERE id = :referralId AND status = 'pending'",
      { referralId: referral.id }
    );
    return;
  }

  const [priorCollections] = await connection.query<Array<RowDataPacket & { count: number }>>(
    `SELECT COUNT(*) AS count FROM orders WHERE user_id = :referredUserId AND id != :orderId AND status = 'collected'`,
    { referredUserId, orderId }
  );
  if (Number(priorCollections[0]?.count ?? 0) > 0) return;

  const [outcomeRows] = await connection.query<Array<RowDataPacket & { friend_issued: number }>>(
    'SELECT friend_issued FROM referral_reward_outcomes WHERE referral_id = :referralId LIMIT 1 FOR UPDATE',
    { referralId: referral.id }
  );
  const friendReward = outcomeRows[0]?.friend_issued === 1
    ? { issued: true }
    : await issueFriendRewardAtClaim(connection, referral, program);
  const [monthlyRows] = await connection.query<Array<RowDataPacket & { count: number }>>(
    `SELECT COUNT(*) AS count FROM referrals WHERE referrer_user_id = :referrerUserId
       AND referral_program_id = :programId AND status = 'rewarded'
       AND rewarded_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
    { referrerUserId: referral.referrer_user_id, programId: program.programId }
  );
  const referrerMonthlyLimitReached = Number(monthlyRows[0]?.count ?? 0) >= program.monthlyReferrerLimit;
  const referrerReward = !referrerMonthlyLimitReached
    ? await issueReferralReward(connection, referral.referrer_user_id, referral.id, referral.tenant_id, 'referrer', program.referrerReward)
    : { issued: false };
  const settlementStatus = settleReferralRewards(friendReward, referrerReward, referrerMonthlyLimitReached);
  if (!referrerReward.issued && !referrerMonthlyLimitReached) {
    await queueRewardRetry(connection, referral.id, referral.tenant_id, 'referrer', referrerReward);
  }
  await connection.execute(
    `UPDATE referrals SET status = :settlementStatus, qualified_order_id = :orderId,
       qualified_at = UTC_TIMESTAMP(),
       rewarded_at = CASE WHEN :settlementStatus = 'rewarded' THEN UTC_TIMESTAMP() ELSE NULL END
     WHERE id = :referralId AND status IN ('pending','qualified')`,
    { referralId: referral.id, orderId, settlementStatus }
  );
  await connection.execute(
    `INSERT INTO referral_reward_outcomes (
       referral_id, friend_issued, friend_label, friend_failure_reason,
       referrer_issued, referrer_label, referrer_failure_reason
     ) VALUES (
       :referralId, :friendIssued, :friendLabel, :friendReason,
       :referrerIssued, :referrerLabel, :referrerReason
     ) ON DUPLICATE KEY UPDATE
       referrer_issued = VALUES(referrer_issued), referrer_label = VALUES(referrer_label),
       referrer_failure_reason = VALUES(referrer_failure_reason)`,
    {
      referralId: referral.id,
      friendIssued: friendReward.issued ? 1 : 0,
      friendLabel: friendReward.label ?? null,
      friendReason: friendReward.reason ?? null,
      referrerIssued: referrerReward.issued ? 1 : 0,
      referrerLabel: referrerReward.label ?? null,
      referrerReason: referrerMonthlyLimitReached ? 'monthly_limit' : referrerReward.reason ?? null
    }
  );
  if (referrerReward.issued) await createUserNotification(connection, { userId: referral.referrer_user_id, type: 'referral_reward', title: 'Referral reward unlocked', body: `Your friend collected their first order. ${referrerReward.label} is now available.`, data: { referral_id: referral.id, referral_order_id: orderId } });
}

export async function retryReferralRewardJob(
  connection: PoolConnection,
  jobId: number,
  tenantId: number
): Promise<{ completed: boolean; issue: ReferralRewardIssue }> {
  const [rows] = await connection.query<Array<RowDataPacket & {
    job_id: number;
    referral_id: number;
    reward_side: 'friend' | 'referrer';
    attempt_count: number;
    referrer_user_id: number;
    referred_user_id: number;
    qualified_order_id: number | null;
    program_snapshot_json: string | ReferralProgramSnapshot | null;
  }>>(
    `SELECT j.id AS job_id, j.referral_id, j.reward_side, j.attempt_count,
            r.referrer_user_id, r.referred_user_id, r.qualified_order_id, r.program_snapshot_json
     FROM referral_reward_jobs j
     JOIN referrals r ON r.id = j.referral_id
     WHERE j.id = :jobId AND j.tenant_id = :tenantId
       AND j.status IN ('pending','retrying','needs_review')
     LIMIT 1 FOR UPDATE`,
    { jobId, tenantId }
  );
  const job = rows[0];
  if (!job) return { completed: false, issue: { issued: false, reason: 'invalid_reward' } };
  const program = parseProgramSnapshot(job.program_snapshot_json);
  if (!program || (job.reward_side === 'referrer' && !job.qualified_order_id)) {
    const issue: ReferralRewardIssue = { issued: false, reason: 'invalid_reward' };
    await queueRewardRetry(connection, job.referral_id, tenantId, job.reward_side, issue);
    return { completed: false, issue };
  }

  await connection.execute(
    `UPDATE referral_reward_jobs SET status = 'retrying' WHERE id = :jobId`,
    { jobId }
  );
  const userId = job.reward_side === 'friend' ? job.referred_user_id : job.referrer_user_id;
  const reward = job.reward_side === 'friend' ? program.friendReward : program.referrerReward;
  const issue = await issueReferralReward(connection, userId, job.referral_id, tenantId, job.reward_side, reward);

  if (!issue.issued) {
    await connection.execute(
      `UPDATE referral_reward_jobs
       SET status = IF(attempt_count >= 2, 'needs_review', 'pending'),
           attempt_count = attempt_count + 1,
           next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 MINUTE),
           last_failure_reason = :reason,
           last_error_message = :message
       WHERE id = :jobId`,
      { jobId, reason: issue.reason ?? 'invalid_reward', message: `Unable to issue ${job.reward_side} referral reward.` }
    );
    return { completed: false, issue };
  }

  const outcomeColumn = job.reward_side === 'friend' ? 'friend' : 'referrer';
  await connection.execute(
    `UPDATE referral_reward_outcomes
     SET ${outcomeColumn}_issued = 1, ${outcomeColumn}_label = :label,
         ${outcomeColumn}_failure_reason = NULL
     WHERE referral_id = :referralId`,
    { referralId: job.referral_id, label: issue.label ?? null }
  );
  await connection.execute(
    `UPDATE referral_reward_jobs
     SET status = 'completed', attempt_count = attempt_count + 1,
         next_attempt_at = NULL, last_failure_reason = NULL, last_error_message = NULL,
         resolved_at = UTC_TIMESTAMP()
     WHERE id = :jobId`,
    { jobId }
  );
  await connection.execute(
    `UPDATE referrals r
     JOIN referral_reward_outcomes o ON o.referral_id = r.id
     SET r.status = 'rewarded', r.rewarded_at = UTC_TIMESTAMP()
     WHERE r.id = :referralId AND o.friend_issued = 1 AND o.referrer_issued = 1`,
    { referralId: job.referral_id }
  );
  await createUserNotification(connection, {
    userId,
    type: 'referral_reward',
    title: 'Referral reward added',
    body: `${issue.label} is now available.`,
    data: { referral_id: job.referral_id, retry_job_id: jobId }
  });
  return { completed: true, issue };
}

export async function runReferralRewardRetrySweep(limit = 25): Promise<{ processed: number; completed: number; failed: number }> {
  const [jobs] = await mysqlPool.query<Array<RowDataPacket & { id: number; tenant_id: number }>>(
    `SELECT id, tenant_id FROM referral_reward_jobs
     WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= UTC_TIMESTAMP())
     ORDER BY created_at ASC LIMIT :limit`,
    { limit }
  );
  let completed = 0;
  let failed = 0;
  for (const job of jobs) {
    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      const result = await retryReferralRewardJob(connection, Number(job.id), Number(job.tenant_id));
      await connection.commit();
      if (result.completed) completed += 1;
      else failed += 1;
    } catch (error) {
      await connection.rollback();
      failed += 1;
      await mysqlPool.execute(
        `UPDATE referral_reward_jobs
         SET status = 'needs_review', attempt_count = attempt_count + 1,
             last_error_message = :message, next_attempt_at = NULL
         WHERE id = :jobId AND status IN ('pending','retrying')`,
        { jobId: job.id, message: error instanceof Error ? error.message.slice(0, 500) : 'Unexpected retry failure.' }
      );
    } finally {
      connection.release();
    }
  }
  return { processed: jobs.length, completed, failed };
}
