import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../db/mysql.js';
import { createUserNotification } from '../http/notifications.js';
import { formatTierName, getActiveLoyaltyTiers, getTierProgress, loadLoyaltyTiers } from './loyalty-tiers.js';

export async function processOrderLoyalty(
  orderId: number,
  userId: number,
  connection: PoolConnection | typeof mysqlPool = mysqlPool
): Promise<void> {
  const tiers = await loadLoyaltyTiers(connection);
  const activeTiers = getActiveLoyaltyTiers(tiers);

  // 1. Sum qualifying cups for this order
  const [cupRows] = await connection.query<Array<RowDataPacket & { cups: number }>>(
    `
      SELECT COALESCE(SUM(quantity), 0) AS cups
      FROM order_items
      WHERE order_id = :orderId
        AND is_qualifying_cup = 1
    `,
    { orderId }
  );
  
  const cupsAwarded = Number(cupRows[0]?.cups ?? 0);

  // 2. If there are qualifying cups, insert a cup event. We'll use the first qualifying menu item id for the record.
  if (cupsAwarded > 0) {
    const [itemRows] = await connection.query<Array<RowDataPacket & { menu_item_id: number }>>(
      `
        SELECT menu_item_id
        FROM order_items
        WHERE order_id = :orderId
          AND is_qualifying_cup = 1
        LIMIT 1
      `,
      { orderId }
    );
    const menuItemId = itemRows[0]?.menu_item_id;

    if (menuItemId) {
      await connection.execute(
        `
          INSERT INTO loyalty_cup_events (
            user_id,
            order_id,
            menu_item_id,
            cups_awarded,
            effective_at
          )
          VALUES (
            :userId,
            :orderId,
            :menuItemId,
            :cupsAwarded,
            UTC_TIMESTAMP()
          )
        `,
        {
          userId,
          orderId,
          menuItemId,
          cupsAwarded
        }
      );
    }
  }

  // 3. Recalculate cups from the last 180 days
  const [totalRows] = await connection.query<Array<RowDataPacket & { total_cups: number }>>(
    `
      SELECT COALESCE(SUM(cups_awarded), 0) AS total_cups
      FROM loyalty_cup_events
      WHERE user_id = :userId
        AND effective_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 180 DAY)
        AND reversed_at IS NULL
    `,
    { userId }
  );

  const cupsLast180d = Number(totalRows[0]?.total_cups ?? 0);

  // 4. Determine new tier
  const tierProgress = getTierProgress(cupsLast180d, tiers);
  const newTier = tierProgress.tierCode;

  // 5. Fetch current snapshot
  const [snapshotRows] = await connection.query<
    Array<RowDataPacket & { tier_code: string; qualifying_cups_last_180d: number }>
  >(
    `
      SELECT tier_code, qualifying_cups_last_180d
      FROM loyalty_tier_snapshots
      WHERE user_id = :userId
      ORDER BY effective_at DESC, id DESC
      LIMIT 1
    `,
    { userId }
  );

  const currentSnapshot = snapshotRows[0];
  const currentTier = currentSnapshot?.tier_code ?? activeTiers[0]?.code ?? 'kawan';
  const currentCups = currentSnapshot?.qualifying_cups_last_180d ?? 0;

  // 6. If tier changed or cups changed (and we actually had cups awarded), insert new snapshot
  if (currentTier !== newTier || currentCups !== cupsLast180d) {
    let reason = 'recalculation';
    if (currentTier !== newTier) {
      reason = 'tier_upgrade'; // Or downgrade
    } else if (cupsAwarded > 0) {
      reason = 'order_purchase';
    }

    await connection.execute(
      `
        INSERT INTO loyalty_tier_snapshots (
          user_id,
          tier_code,
          qualifying_cups_last_180d,
          effective_at,
          reason_code
        )
        VALUES (
          :userId,
          :newTier,
          :cupsLast180d,
          UTC_TIMESTAMP(),
          :reason
        )
      `,
      {
        userId,
        newTier,
        cupsLast180d,
        reason
      }
    );

    const currentTierConfig = activeTiers.find((tier) => tier.code === currentTier);
    const newTierConfig = activeTiers.find((tier) => tier.code === newTier);
    const isTierUpgrade = currentTier !== newTier
      && newTierConfig !== undefined
      && (!currentTierConfig || newTierConfig.minCups > currentTierConfig.minCups);

    if (isTierUpgrade) {
      const fromLabel = formatTierName(tiers, currentTier);
      const toLabel = formatTierName(tiers, newTier);

      await createUserNotification(connection, {
        userId,
        type: 'tier_achieved',
        title: `Tier upgraded to ${toLabel}`,
        body: `Your C2 Coffee tier moved from ${fromLabel} to ${toLabel}.`,
        data: {
          previous_tier: currentTier,
          new_tier: newTier,
          qualifying_cups_last_180d: cupsLast180d
        }
      });

    }

    if (currentTier !== newTier) {
      await connection.execute(
        `
          UPDATE user_tier_reward_entitlements
          SET status = 'revoked',
              revoked_reason = 'Superseded by the customer current tier',
              revoked_at = UTC_TIMESTAMP()
          WHERE user_id = :userId
            AND status = 'claimable'
            AND tier_code <> :newTier
        `,
        { userId, newTier }
      );

      await connection.execute(
        `
          UPDATE user_vouchers
          SET status = 'revoked',
              revoked_reason = 'Superseded by the customer current tier',
              revoked_at = UTC_TIMESTAMP()
          WHERE user_id = :userId
            AND status = 'active'
            AND redeemed_at IS NULL
            AND revoked_at IS NULL
            AND (
              issue_case_ref LIKE 'tier_claim:%'
              OR issue_case_ref LIKE 'tier_unlock:%'
            )
            AND (tier_at_issue IS NULL OR tier_at_issue <> :newTier)
        `,
        { userId, newTier }
      );
    }

    // A tier benefit belongs only to the member's resulting/current tier. If
    // one order crosses multiple thresholds, do not expose every historical
    // tier as a cumulative claim list.
    const reachedCurrentTierReward = newTierConfig
      && ((newTierConfig.minCups === 0 && currentCups === 0 && cupsLast180d >= 1)
        || (newTierConfig.minCups > currentCups && newTierConfig.minCups <= cupsLast180d))
      && Boolean(newTierConfig.rewardConfig?.voucherTemplateIds.length);
    const unlockedTiers = reachedCurrentTierReward && newTierConfig
      ? [newTierConfig]
      : [];

    for (const tier of unlockedTiers) {
      const unlockedVoucherTemplateIds: number[] = [];

      for (const voucherTemplateId of (tier.rewardConfig?.voucherTemplateIds ?? []).slice(0, 1)) {
        const [entitlementResult] = await connection.execute<ResultSetHeader>(
          `
            INSERT IGNORE INTO user_tier_reward_entitlements (
              user_id, tenant_id, voucher_template_id, tier_code, status,
              issue_case_ref, source_order_id, unlocked_at
            )
            SELECT
              :userId,
              vt.tenant_id,
              vt.id,
              :tierCode,
              'claimable',
              :issueCaseRef,
              :orderId,
              UTC_TIMESTAMP()
            FROM voucher_templates vt
            JOIN orders o
              ON o.id = :orderId
             AND o.user_id = :userId
             AND o.store_id IS NOT NULL
            JOIN stores s
              ON s.id = o.store_id
             AND s.tenant_id = vt.tenant_id
            WHERE vt.id = :voucherTemplateId
              AND vt.is_active = 1
          `,
          {
            userId,
            orderId,
            voucherTemplateId,
            issueCaseRef: `tier_unlock:${tier.code}:${voucherTemplateId}`,
            tierCode: tier.code
          }
        );

        if (entitlementResult.affectedRows > 0) {
          unlockedVoucherTemplateIds.push(voucherTemplateId);
          await connection.execute(
            `INSERT INTO loyalty_order_reward_issues (
               order_id, user_id, user_voucher_id, tier_reward_entitlement_id,
               tier_code, reversal_status, created_at
             ) VALUES (
               :orderId, :userId, NULL, :entitlementId,
               :tierCode, 'active', UTC_TIMESTAMP()
             )`,
            {
              orderId,
              userId,
              entitlementId: entitlementResult.insertId,
              tierCode: tier.code
            }
          );
        }
      }

      if (unlockedVoucherTemplateIds.length > 0) {
        await createUserNotification(connection, {
          userId,
          type: 'tier_reward',
          title: tier.minCups === 0 ? 'First drink reward unlocked' : `${tier.name} reward unlocked`,
          body: unlockedVoucherTemplateIds.length === 1
            ? 'A tier reward is ready to claim in My Rewards.'
            : `${unlockedVoucherTemplateIds.length} tier rewards are ready to claim in My Rewards.`,
          data: {
            tier_code: tier.code,
            voucher_template_ids: unlockedVoucherTemplateIds
          }
        });
      }
    }
  }
}

/** Reverse cups from a refunded order and persist the recalculated tier. */
export async function reverseOrderLoyalty(
  orderId: number,
  userId: number,
  connection: PoolConnection,
  adminUserId: number
): Promise<{ cupsReversed: number; rewardNeedsReview: boolean }> {
  const [rewardIssues] = await connection.query<Array<RowDataPacket & {
    issue_id: number;
    voucher_id: number | null;
    voucher_status: string | null;
    entitlement_id: number | null;
    entitlement_status: string | null;
  }>>(
    `SELECT lori.id AS issue_id, lori.user_voucher_id AS voucher_id,
            uv.status AS voucher_status,
            lori.tier_reward_entitlement_id AS entitlement_id,
            utre.status AS entitlement_status
     FROM loyalty_order_reward_issues lori
     LEFT JOIN user_vouchers uv ON uv.id = lori.user_voucher_id
     LEFT JOIN user_tier_reward_entitlements utre
       ON utre.id = lori.tier_reward_entitlement_id
     WHERE lori.order_id = :orderId AND lori.user_id = :userId
       AND lori.reversal_status = 'active'
     FOR UPDATE`,
    { orderId, userId }
  );
  let rewardNeedsReview = false;
  for (const issue of rewardIssues) {
    if (issue.entitlement_status === 'claimable' && issue.entitlement_id !== null) {
      await connection.execute(
        `UPDATE user_tier_reward_entitlements
         SET status = 'revoked', revoked_reason = 'Qualifying order refunded',
             revoked_at = UTC_TIMESTAMP()
         WHERE id = :entitlementId AND status = 'claimable'`,
        { entitlementId: issue.entitlement_id }
      );
      await connection.execute(
        `UPDATE loyalty_order_reward_issues
         SET reversal_status = 'reversed', reversal_reason = 'Unclaimed tier reward revoked after refund',
             reversed_by_admin_id = :adminUserId, reversed_at = UTC_TIMESTAMP()
         WHERE id = :issueId`,
        { adminUserId, issueId: issue.issue_id }
      );
    } else if (issue.voucher_status === 'active' && issue.voucher_id !== null) {
      await connection.execute(
        `UPDATE user_vouchers
         SET status = 'revoked', revoked_by_admin_id = :adminUserId,
             revoked_reason = 'Qualifying order refunded', revoked_at = UTC_TIMESTAMP()
         WHERE id = :voucherId AND status = 'active'`,
        { adminUserId, voucherId: issue.voucher_id }
      );
      await connection.execute(
        `UPDATE loyalty_order_reward_issues
         SET reversal_status = 'reversed', reversal_reason = 'Qualifying order refunded',
             reversed_by_admin_id = :adminUserId, reversed_at = UTC_TIMESTAMP()
         WHERE id = :issueId`,
        { adminUserId, issueId: issue.issue_id }
      );
      if (issue.entitlement_id !== null) {
        await connection.execute(
          `UPDATE user_tier_reward_entitlements
           SET status = 'revoked', revoked_reason = 'Qualifying order refunded',
               revoked_at = UTC_TIMESTAMP()
           WHERE id = :entitlementId AND status = 'claimed'`,
          { entitlementId: issue.entitlement_id }
        );
      }
    } else if (
      issue.voucher_status === 'redeemed'
      || issue.entitlement_status === 'claimed'
      || (issue.voucher_status === null && issue.entitlement_status === null)
    ) {
      rewardNeedsReview = true;
      await connection.execute(
        `UPDATE loyalty_order_reward_issues
         SET reversal_status = 'needs_review',
             reversal_reason = :reason, reversed_by_admin_id = :adminUserId,
             reversed_at = UTC_TIMESTAMP()
         WHERE id = :issueId`,
        {
          adminUserId,
          issueId: issue.issue_id,
          reason: issue.voucher_status === 'redeemed' || issue.entitlement_status === 'claimed'
            ? 'Tier reward voucher was already redeemed'
            : 'Tier reward entitlement could not be located'
        }
      );
    } else {
      await connection.execute(
        `UPDATE loyalty_order_reward_issues
         SET reversal_status = 'reversed', reversal_reason = 'Voucher was already inactive',
             reversed_by_admin_id = :adminUserId, reversed_at = UTC_TIMESTAMP()
         WHERE id = :issueId`,
        { adminUserId, issueId: issue.issue_id }
      );
    }
  }

  const [events] = await connection.query<Array<RowDataPacket & { cups_awarded: number }>>(
    `SELECT cups_awarded
     FROM loyalty_cup_events
     WHERE order_id = :orderId AND user_id = :userId AND reversed_at IS NULL
     FOR UPDATE`,
    { orderId, userId }
  );
  const cupsReversed = events.reduce((total, event) => total + Number(event.cups_awarded), 0);
  if (cupsReversed <= 0) return { cupsReversed: 0, rewardNeedsReview };

  await connection.execute(
    `UPDATE loyalty_cup_events
     SET reversed_at = UTC_TIMESTAMP(), reversal_reason = 'Order refunded'
     WHERE order_id = :orderId AND user_id = :userId AND reversed_at IS NULL`,
    { orderId, userId }
  );

  const tiers = await loadLoyaltyTiers(connection);
  const [totals] = await connection.query<Array<RowDataPacket & { total_cups: number }>>(
    `SELECT COALESCE(SUM(cups_awarded), 0) AS total_cups
     FROM loyalty_cup_events
     WHERE user_id = :userId
       AND effective_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 180 DAY)
       AND reversed_at IS NULL`,
    { userId }
  );
  const cupsLast180d = Number(totals[0]?.total_cups ?? 0);
  const tier = getTierProgress(cupsLast180d, tiers).tierCode;
  await connection.execute(
    `INSERT INTO loyalty_tier_snapshots (
       user_id, tier_code, qualifying_cups_last_180d, effective_at, reason_code
     ) VALUES (
       :userId, :tier, :cupsLast180d, UTC_TIMESTAMP(), 'refund_reversal'
     )`,
    { userId, tier, cupsLast180d }
  );
  return { cupsReversed, rewardNeedsReview };
}
