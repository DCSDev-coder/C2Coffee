import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';
import { createUserNotification } from '../http/notifications.js';
import { deliverPushToUser } from './push-delivery.js';

const REMINDER_DELAY_MINUTES = 10;
const REMINDER_BATCH_SIZE = 100;

type ReadyOrderRow = RowDataPacket & {
  id: number;
  user_id: number;
  order_ref: string;
};

export type PickupReminderSweepResult = {
  claimed: number;
  delivered: number;
  failed: number;
};

/**
 * Claims each eligible order before creating its in-app notification, so a
 * repeated sweep or a second API process cannot send the same reminder twice.
 */
export async function runPickupReminderSweep(): Promise<PickupReminderSweepResult> {
  const [candidates] = await mysqlPool.query<ReadyOrderRow[]>(
    `
      SELECT id, user_id, order_ref
      FROM orders
      WHERE status = 'ready_for_pickup'
        AND ready_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${REMINDER_DELAY_MINUTES} MINUTE)
        AND pickup_reminder_sent_at IS NULL
      ORDER BY ready_at ASC
      LIMIT ${REMINDER_BATCH_SIZE}
    `
  );

  let claimed = 0;
  let delivered = 0;
  let failed = 0;

  for (const order of candidates) {
    const connection = await mysqlPool.getConnection();
    let didClaim = false;

    try {
      await connection.beginTransaction();
      const [claimResult] = await connection.execute<ResultSetHeader>(
        `
          UPDATE orders
          SET pickup_reminder_sent_at = UTC_TIMESTAMP()
          WHERE id = :orderId
            AND status = 'ready_for_pickup'
            AND ready_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${REMINDER_DELAY_MINUTES} MINUTE)
            AND pickup_reminder_sent_at IS NULL
        `,
        { orderId: order.id }
      );

      if (claimResult.affectedRows === 0) {
        await connection.rollback();
        continue;
      }

      await createUserNotification(connection, {
        userId: Number(order.user_id),
        type: 'order_pickup_reminder',
        title: 'Your drink is ready for pickup',
        body: 'Your order is still waiting at the counter. Please collect it when you can.',
        data: { type: 'order_pickup_reminder', order_ref: order.order_ref }
      });
      await connection.commit();
      didClaim = true;
      claimed++;
    } catch (error) {
      await connection.rollback();
      failed++;
      console.warn('[pickup-reminders] could not create pickup reminder', {
        orderRef: order.order_ref,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      connection.release();
    }

    if (!didClaim) continue;

    try {
      await deliverPushToUser({
        userId: Number(order.user_id),
        title: 'Your drink is ready for pickup',
        body: 'Your order is still waiting at the counter. Please collect it when you can.',
        data: { type: 'order_pickup_reminder', order_ref: order.order_ref }
      });
      delivered++;
    } catch (error) {
      // The in-app notification is already durable; FCM failure must not make
      // the order eligible again or affect the order lifecycle.
      failed++;
      console.warn('[pickup-reminders] push delivery failed', {
        orderRef: order.order_ref,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return { claimed, delivered, failed };
}
