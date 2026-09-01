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

    // Award every configured threshold crossed by this order. The unique
    // issue-case key prevents reissuing if a member later drops and requalifies.
    const unlockedTiers = activeTiers.filter((tier) =>
      tier.minCups > currentCups
      && tier.minCups <= cupsLast180d
      && Boolean(tier.rewardConfig?.voucherTemplateId)
    );

    for (const tier of unlockedTiers) {
      const voucherTemplateId = tier.rewardConfig?.voucherTemplateId;
      if (!voucherTemplateId) continue;

      const [issueResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT IGNORE INTO user_vouchers (
            user_id,
            voucher_template_id,
            status,
            issued_by_type,
            issued_reason,
            issue_case_ref,
            tier_at_issue,
            issued_at,
            expires_at
          )
          SELECT
            :userId,
            vt.id,
            'active',
            'system',
            :issuedReason,
            :issueCaseRef,
            :tierCode,
            UTC_TIMESTAMP(),
            DATE_ADD(UTC_TIMESTAMP(), INTERVAL COALESCE(vt.expires_in_days, 30) DAY)
          FROM voucher_templates vt
          WHERE vt.id = :voucherTemplateId
            AND vt.is_active = 1
        `,
        {
          userId,
          voucherTemplateId,
          issuedReason: `Tier unlock reward: ${tier.name}`,
          issueCaseRef: `tier_unlock:${tier.code}`,
          tierCode: tier.code
        }
      );

      if (issueResult.affectedRows > 0) {
        await createUserNotification(connection, {
          userId,
          type: 'tier_reward',
          title: `${tier.name} reward unlocked`,
          body: 'A tier reward voucher has been added to your account.',
          data: {
            tier_code: tier.code,
            voucher_template_id: voucherTemplateId
          }
        });
      }
    }
  }
}
