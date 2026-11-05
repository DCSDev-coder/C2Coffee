import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';
import { createUserNotification } from '../http/notifications.js';
import {
  formatTierName,
  getActiveLoyaltyTiers,
  getTierProgress,
  loadLoyaltyTiers
} from './loyalty-tiers.js';

type LoyaltyExecutor = PoolConnection | typeof mysqlPool;

export const LOYALTY_QUALIFICATION_DAYS = 365;

interface RefreshOptions {
  forceDowngrade?: boolean;
}

export interface LoyaltyTierRefreshResult {
  changed: boolean;
  tierChanged: boolean;
  upgraded: boolean;
  downgraded: boolean;
  previousTier: string;
  tier: string;
  previousQualifyingOrders: number;
  qualifyingOrders: number;
  reviewDueAt: Date;
}

export async function countQualifyingOrders(
  userId: number,
  connection: LoyaltyExecutor = mysqlPool
): Promise<number> {
  const [rows] = await connection.query<Array<RowDataPacket & { qualifying_orders: number }>>(
    `SELECT COUNT(DISTINCT order_id) AS qualifying_orders
       FROM loyalty_cup_events
      WHERE user_id = :userId
        AND effective_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${LOYALTY_QUALIFICATION_DAYS} DAY)
        AND reversed_at IS NULL`,
    { userId }
  );
  return Number(rows[0]?.qualifying_orders ?? 0);
}

async function revokeSupersededTierBenefits(
  userId: number,
  newTier: string,
  connection: LoyaltyExecutor
): Promise<void> {
  await connection.execute(
    `UPDATE user_tier_reward_entitlements
        SET status = 'revoked',
            revoked_reason = 'Superseded by the customer current tier',
            revoked_at = UTC_TIMESTAMP()
      WHERE user_id = :userId
        AND status = 'claimable'
        AND tier_code <> :newTier`,
    { userId, newTier }
  );

  await connection.execute(
    `UPDATE user_vouchers
        SET status = 'revoked',
            revoked_reason = 'Superseded by the customer current tier',
            revoked_at = UTC_TIMESTAMP()
      WHERE user_id = :userId
        AND status = 'active'
        AND redeemed_at IS NULL
        AND revoked_at IS NULL
        AND (issue_case_ref LIKE 'tier_claim:%' OR issue_case_ref LIKE 'tier_unlock:%')
        AND (tier_at_issue IS NULL OR tier_at_issue <> :newTier)`,
    { userId, newTier }
  );
}

export async function refreshUserLoyaltyTier(
  userId: number,
  connection: LoyaltyExecutor = mysqlPool,
  options: RefreshOptions = {}
): Promise<LoyaltyTierRefreshResult> {
  const tiers = await loadLoyaltyTiers(connection);
  const activeTiers = getActiveLoyaltyTiers(tiers);
  const qualifyingOrders = await countQualifyingOrders(userId, connection);
  const candidateTier = getTierProgress(qualifyingOrders, tiers).tierCode;

  const [snapshotRows] = await connection.query<Array<RowDataPacket & {
    tier_code: string;
    qualifying_cups_last_180d: number;
  }>>(
    `SELECT tier_code, qualifying_cups_last_180d
       FROM loyalty_tier_snapshots
      WHERE user_id = :userId
      ORDER BY effective_at DESC, id DESC
      LIMIT 1`,
    { userId }
  );

  const snapshot = snapshotRows[0];
  const baseTier = activeTiers[0]?.code ?? 'kawan';
  const snapshotTier = snapshot?.tier_code ?? baseTier;
  const previousQualifyingOrders = Number(snapshot?.qualifying_cups_last_180d ?? 0);

  await connection.execute(
    `INSERT IGNORE INTO user_loyalty_tier_status (
       user_id, tier_code, cycle_started_at, review_due_at
     ) VALUES (
       :userId, :tierCode, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 YEAR)
     )`,
    { userId, tierCode: snapshotTier }
  );

  const [statusRows] = await connection.query<Array<RowDataPacket & {
    tier_code: string;
    review_due_at: Date;
    review_is_due: number;
  }>>(
    `SELECT tier_code, review_due_at, review_due_at <= UTC_TIMESTAMP() AS review_is_due
       FROM user_loyalty_tier_status
      WHERE user_id = :userId
      LIMIT 1
      FOR UPDATE`,
    { userId }
  );

  const status = statusRows[0];
  const currentTier = status?.tier_code ?? snapshotTier;
  const currentConfig = activeTiers.find((tier) => tier.code === currentTier);
  const candidateConfig = activeTiers.find((tier) => tier.code === candidateTier);
  const candidateIsHigher = Boolean(
    currentConfig && candidateConfig && candidateConfig.minCups > currentConfig.minCups
  );
  const candidateIsLower = Boolean(
    currentConfig && candidateConfig && candidateConfig.minCups < currentConfig.minCups
  );
  const reviewIsDue = Boolean(status?.review_is_due);
  const annualReview = reviewIsDue || (options.forceDowngrade === true && candidateIsLower);

  let nextTier = currentTier;
  let reasonCode = 'annual_tier_progress';
  let resetAnnualCycle = false;

  if (candidateIsHigher) {
    nextTier = candidateTier;
    reasonCode = 'tier_upgrade';
    resetAnnualCycle = true;
  } else if (annualReview) {
    nextTier = candidateTier;
    reasonCode = candidateIsLower ? 'annual_tier_downgrade' : 'annual_tier_retained';
    resetAnnualCycle = true;
  } else if (candidateIsLower) {
    // Inactivity never removes a tier during its protected 12-month period.
    reasonCode = 'annual_tier_protected';
  }

  const tierChanged = currentTier !== nextTier;
  const changed = tierChanged || previousQualifyingOrders !== qualifyingOrders || resetAnnualCycle;
  if (changed) {
    await connection.execute(
      `INSERT INTO loyalty_tier_snapshots (
         user_id, tier_code, qualifying_cups_last_180d, effective_at, reason_code
       ) VALUES (
         :userId, :nextTier, :qualifyingOrders, UTC_TIMESTAMP(), :reasonCode
       )`,
      { userId, nextTier, qualifyingOrders, reasonCode }
    );
  }

  if (resetAnnualCycle) {
    await connection.execute(
      `UPDATE user_loyalty_tier_status
          SET tier_code = :nextTier,
              cycle_started_at = UTC_TIMESTAMP(),
              review_due_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 YEAR),
              last_reviewed_at = IF(:annualReview = 1, UTC_TIMESTAMP(), last_reviewed_at)
        WHERE user_id = :userId`,
      { userId, nextTier, annualReview: annualReview ? 1 : 0 }
    );
  }

  if (tierChanged) {
    await revokeSupersededTierBenefits(userId, nextTier, connection);
  }

  if (reviewIsDue) {
    const tierLabel = formatTierName(tiers, nextTier);
    await createUserNotification(connection, {
      userId,
      type: tierChanged ? 'annual_tier_update' : 'annual_tier_renewed',
      title: tierChanged ? 'Your annual tier review is complete' : `${tierLabel} tier renewed`,
      body: tierChanged
        ? `Your activity was reviewed and your ${tierLabel} tier is now protected for another year.`
        : `You kept your ${tierLabel} tier. It is protected for another year.`,
      data: {
        previous_tier: currentTier,
        new_tier: nextTier,
        qualifying_orders_last_12_months: qualifyingOrders
      },
      deliveryKey: `annual_tier_review:${userId}:${new Date(status.review_due_at).toISOString()}`
    });
  }

  const [updatedStatusRows] = await connection.query<Array<RowDataPacket & { review_due_at: Date }>>(
    `SELECT review_due_at FROM user_loyalty_tier_status WHERE user_id = :userId LIMIT 1`,
    { userId }
  );

  return {
    changed,
    tierChanged,
    upgraded: candidateIsHigher && tierChanged,
    downgraded: candidateIsLower && tierChanged,
    previousTier: currentTier,
    tier: nextTier,
    previousQualifyingOrders,
    qualifyingOrders,
    reviewDueAt: updatedStatusRows[0]?.review_due_at ?? new Date()
  };
}

export async function runLoyaltyTierMaintenanceSweep(
  batchSize = 500
): Promise<{ processed: number; changed: number; downgraded: number }> {
  let lastUserId = 0;
  let processed = 0;
  let changed = 0;
  let downgraded = 0;
  const limit = Math.max(1, Math.min(2000, Math.trunc(batchSize)));

  while (true) {
    const [rows] = await mysqlPool.query<Array<RowDataPacket & { user_id: number }>>(
      `SELECT user_id
         FROM (
           SELECT user_id FROM loyalty_tier_snapshots
           UNION
           SELECT user_id FROM loyalty_cup_events
         ) loyalty_users
        WHERE user_id > :lastUserId
        ORDER BY user_id ASC
        LIMIT ${limit}`,
      { lastUserId }
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      const userId = Number(row.user_id);
      const connection = await mysqlPool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await refreshUserLoyaltyTier(userId, connection);
        await connection.commit();
        processed += 1;
        if (result.changed) changed += 1;
        if (result.downgraded) downgraded += 1;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      lastUserId = userId;
    }
  }

  return { processed, changed, downgraded };
}
