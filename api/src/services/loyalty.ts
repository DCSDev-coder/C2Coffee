import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../db/mysql.js';
import { createUserNotification } from '../http/notifications.js';
import { formatTierName, getActiveLoyaltyTiers, loadLoyaltyTiers } from './loyalty-tiers.js';
import { refreshUserLoyaltyTier } from './loyalty-tier-maintenance.js';

export async function processOrderLoyalty(
  orderId: number,
  userId: number,
  connection: PoolConnection | typeof mysqlPool = mysqlPool
): Promise<void> {
  const [fundingRows] = await connection.query<Array<RowDataPacket & { employee_allowance_tokens_used: number }>>(
    `SELECT employee_allowance_tokens_used FROM orders WHERE id = :orderId LIMIT 1`,
    { orderId }
  );
  if (Number(fundingRows[0]?.employee_allowance_tokens_used ?? 0) > 0) return;

  const tiers = await loadLoyaltyTiers(connection);
  const activeTiers = getActiveLoyaltyTiers(tiers);

  // One completed order earns one cup only when it contains a qualifying drink.
  const [cupRows] = await connection.query<Array<RowDataPacket & { menu_item_id: number | null }>>(
    `
      SELECT MIN(menu_item_id) AS menu_item_id
      FROM order_items
      WHERE order_id = :orderId
        AND is_qualifying_cup = 1
    `,
    { orderId }
  );
  
  const menuItemId = Number(cupRows[0]?.menu_item_id ?? 0);
  if (menuItemId > 0) {
    await connection.execute<ResultSetHeader>(
      `
        INSERT IGNORE INTO loyalty_cup_events (
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
          1,
          UTC_TIMESTAMP()
        )
      `,
      {
        userId,
        orderId,
        menuItemId
      }
    );
  }

  // The legacy API field name remains for mobile compatibility. Its value is
  // now the number of qualifying drink orders in the preceding 12 months.
  // Upgrades happen immediately, while inactivity downgrades wait for review.
  const tierRefresh = await refreshUserLoyaltyTier(userId, connection);
  const cupsLast180d = tierRefresh.qualifyingOrders;
  const currentCups = tierRefresh.previousQualifyingOrders;
  const currentTier = tierRefresh.previousTier;
  const newTier = tierRefresh.tier;

  if (tierRefresh.changed) {
    const newTierConfig = activeTiers.find((tier) => tier.code === newTier);

    if (tierRefresh.upgraded) {
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

      for (const voucherTemplateId of tier.rewardConfig?.voucherTemplateIds ?? []) {
        // limit_per_user on a tier reward template = number of claims granted
        // per unlock (e.g. "RM1 OFF x5"). Each claim gets its own entitlement.
        const [limitRows] = await connection.query<Array<RowDataPacket & { limit_per_user: number | null }>>(
          'SELECT limit_per_user FROM voucher_templates WHERE id = :voucherTemplateId LIMIT 1',
          { voucherTemplateId }
        );
        const claimCount = Math.max(1, Math.min(20, Number(limitRows[0]?.limit_per_user ?? 1) || 1));

        for (let claimNumber = 1; claimNumber <= claimCount; claimNumber += 1) {
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
              issueCaseRef: claimNumber === 1
                ? `tier_unlock:${tier.code}:${voucherTemplateId}`
                : `tier_unlock:${tier.code}:${voucherTemplateId}:${claimNumber}`,
              tierCode: tier.code
            }
          );

          if (entitlementResult.affectedRows > 0) {
            if (!unlockedVoucherTemplateIds.includes(voucherTemplateId)) {
              unlockedVoucherTemplateIds.push(voucherTemplateId);
            }
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

  // Refunds are an integrity correction rather than ordinary inactivity, so
  // they may remove a tier immediately if the reversed order caused it.
  await refreshUserLoyaltyTier(userId, connection, { forceDowngrade: true });
  return { cupsReversed, rewardNeedsReview };
}
