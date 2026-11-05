import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getUtcConnection, mysqlPool } from '../db/mysql.js';
import { createUserNotification } from '../http/notifications.js';
import { consumeInventoryForOrder } from './inventory.js';
import { processOrderLoyalty } from './loyalty.js';
import { awardReferralForCollectedOrder } from './referrals.js';

const AUTO_COLLECT_DELAY_MINUTES = 60;
const AUTO_COLLECT_BATCH_SIZE = 100;

type ReadyOrderRow = RowDataPacket & {
  id: number;
  user_id: number;
  order_ref: string;
};

export type AutoCollectSweepResult = {
  claimed: number;
  failed: number;
};

/**
 * Finalises forgotten ready-for-pickup orders after one hour. The conditional
 * update is the claim, so overlapping API processes cannot award the same
 * order twice.
 */
export async function runAutoCollectSweep(): Promise<AutoCollectSweepResult> {
  const [candidates] = await mysqlPool.query<ReadyOrderRow[]>(
    `SELECT id, user_id, order_ref
       FROM orders
      WHERE status = 'ready_for_pickup'
        AND ready_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${AUTO_COLLECT_DELAY_MINUTES} MINUTE)
      ORDER BY ready_at ASC
      LIMIT ${AUTO_COLLECT_BATCH_SIZE}`
  );

  let claimed = 0;
  let failed = 0;

  for (const order of candidates) {
    const connection = await getUtcConnection();
    let didClaim = false;

    try {
      await connection.beginTransaction();
      const [claimResult] = await connection.execute<ResultSetHeader>(
        `UPDATE orders
            SET status = 'collected', collected_at = UTC_TIMESTAMP()
          WHERE id = :orderId
            AND status = 'ready_for_pickup'
            AND ready_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${AUTO_COLLECT_DELAY_MINUTES} MINUTE)`,
        { orderId: order.id }
      );

      if (claimResult.affectedRows === 0) {
        await connection.rollback();
        continue;
      }

      await connection.execute(
        `INSERT INTO order_status_history (
           order_id, from_status, to_status, changed_by_type, changed_by_id,
           reason, created_at
         ) VALUES (
           :orderId, 'ready_for_pickup', 'collected', 'system', NULL,
           'Automatically completed one hour after the order became ready for pickup.',
           UTC_TIMESTAMP()
         )`,
        { orderId: order.id }
      );

      await createUserNotification(connection, {
        userId: Number(order.user_id),
        type: 'order_collected',
        title: 'Order completed',
        body: 'Your order was automatically completed after remaining ready for pickup for one hour.',
        data: { order_id: order.id, order_ref: order.order_ref }
      });

      await consumeInventoryForOrder(connection, order.id);
      await processOrderLoyalty(order.id, Number(order.user_id), connection);
      await awardReferralForCollectedOrder(connection, Number(order.user_id), order.id);

      await connection.commit();
      didClaim = true;
      claimed++;
    } catch (error) {
      await connection.rollback();
      failed++;
      console.warn('[auto-collect] could not complete order', {
        orderRef: order.order_ref,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      connection.release();
    }

    if (!didClaim) continue;
  }

  return { claimed, failed };
}
