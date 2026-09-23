import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

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

type ReferralRow = RowDataPacket & {
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

async function issueReward(
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

/** Awards both campaign rewards exactly once after a friend's first collected order. */
export async function awardReferralForCollectedOrder(
  connection: PoolConnection,
  referredUserId: number,
  orderId: number
): Promise<void> {
  const [rows] = await connection.query<Array<ReferralRow>>(
    `SELECT r.id, r.referrer_user_id, r.referred_user_id, s.tenant_id, r.program_snapshot_json, r.qualification_expires_at
     FROM referrals r JOIN orders o ON o.id = :orderId AND o.user_id = :referredUserId
     JOIN stores s ON s.id = o.store_id
     WHERE r.referred_user_id = :referredUserId AND r.status = 'pending' LIMIT 1 FOR UPDATE`,
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

  const friendReward = await issueReward(connection, referral.referred_user_id, referral.id, referral.tenant_id, 'friend', program.friendReward);
  const [monthlyRows] = await connection.query<Array<RowDataPacket & { count: number }>>(
    `SELECT COUNT(*) AS count FROM referrals WHERE referrer_user_id = :referrerUserId
       AND referral_program_id = :programId AND status = 'rewarded'
       AND rewarded_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
    { referrerUserId: referral.referrer_user_id, programId: program.programId }
  );
  const referrerMonthlyLimitReached = Number(monthlyRows[0]?.count ?? 0) >= program.monthlyReferrerLimit;
  const referrerReward = !referrerMonthlyLimitReached
    ? await issueReward(connection, referral.referrer_user_id, referral.id, referral.tenant_id, 'referrer', program.referrerReward)
    : { issued: false };
  const settlementStatus = settleReferralRewards(friendReward, referrerReward, referrerMonthlyLimitReached);
  await connection.execute(
    `UPDATE referrals SET status = :settlementStatus, qualified_order_id = :orderId,
       qualified_at = UTC_TIMESTAMP(),
       rewarded_at = CASE WHEN :settlementStatus = 'rewarded' THEN UTC_TIMESTAMP() ELSE NULL END
     WHERE id = :referralId AND status = 'pending'`,
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
       friend_issued = VALUES(friend_issued), friend_label = VALUES(friend_label),
       friend_failure_reason = VALUES(friend_failure_reason),
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
  if (friendReward.issued) await createUserNotification(connection, { userId: referral.referred_user_id, type: 'referral_reward', title: 'Referral reward unlocked', body: `${friendReward.label} is now available.`, data: { referral_id: referral.id, referral_order_id: orderId } });
  if (referrerReward.issued) await createUserNotification(connection, { userId: referral.referrer_user_id, type: 'referral_reward', title: 'Referral reward unlocked', body: `Your friend collected their first order. ${referrerReward.label} is now available.`, data: { referral_id: referral.id, referral_order_id: orderId } });
}
