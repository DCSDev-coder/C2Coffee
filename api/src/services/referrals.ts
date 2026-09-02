import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { createUserNotification } from '../http/notifications.js';

type ReferralRow = RowDataPacket & {
  id: number;
  referrer_user_id: number;
};

type ReferralRewardTemplateRow = RowDataPacket & {
  id: number;
  name: string;
};

/** Awards the configured referral voucher once a referred customer collects their first order. */
export async function awardReferralForCollectedOrder(
  connection: PoolConnection,
  referredUserId: number,
  orderId: number
): Promise<void> {
  const [referralRows] = await connection.query<Array<ReferralRow>>(
    `
      SELECT id, referrer_user_id
      FROM referrals
      WHERE referred_user_id = :referredUserId
        AND status = 'pending'
      LIMIT 1
      FOR UPDATE
    `,
    { referredUserId }
  );
  const referral = referralRows[0];
  if (!referral) return;

  const [templateRows] = await connection.query<Array<ReferralRewardTemplateRow>>(
    `
      SELECT id, name
      FROM voucher_templates
      WHERE is_active = 1
        AND is_referral_reward = 1
        AND (valid_until IS NULL OR valid_until > UTC_TIMESTAMP())
      LIMIT 1
      FOR UPDATE
    `
  );
  const template = templateRows[0];

  // Keep the referral pending until the admin has configured a referral reward.
  if (!template) return;

  const issueCaseRef = `referral:${referral.id}`;
  await connection.execute(
    `
      INSERT INTO user_vouchers (
        user_id, voucher_template_id, status, issued_by_type, issued_reason,
        issue_case_ref, issued_at, expires_at
      )
      SELECT
        :referrerUserId, vt.id, 'active', 'system', 'Referral first collected order',
        :issueCaseRef, UTC_TIMESTAMP(),
        DATE_ADD(UTC_TIMESTAMP(), INTERVAL COALESCE(vt.expires_in_days, 30) DAY)
      FROM voucher_templates vt
      WHERE vt.id = :templateId
        AND NOT EXISTS (
          SELECT 1
          FROM user_vouchers uv
          WHERE uv.issue_case_ref = :issueCaseRef
        )
    `,
    {
      referrerUserId: referral.referrer_user_id,
      templateId: template.id,
      issueCaseRef
    }
  );

  await connection.execute(
    `
      UPDATE referrals
      SET status = 'rewarded',
          qualified_order_id = :orderId,
          qualified_at = UTC_TIMESTAMP(),
          rewarded_at = UTC_TIMESTAMP()
      WHERE id = :referralId
        AND status = 'pending'
    `,
    { referralId: referral.id, orderId }
  );

  await createUserNotification(connection, {
    userId: referral.referrer_user_id,
    type: 'referral_reward',
    title: 'Referral reward unlocked',
    body: `Your friend collected their first order. ${template.name} is now in My Rewards.`,
    data: { referral_id: referral.id, referral_order_id: orderId }
  });
}
