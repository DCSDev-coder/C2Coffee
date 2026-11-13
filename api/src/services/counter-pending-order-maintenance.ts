import type { RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../db/mysql.js';
import { releaseInventoryForOrder } from './inventory.js';

/** Cancel abandoned counter checkouts so the live queue cannot retain old pending orders. */
export async function expireStaleCounterPendingOrders(maxAgeMinutes = 30): Promise<{ cancelled: number }> {
  const connection = await mysqlPool.getConnection();
  let cancelled = 0;
  const cutoff = new Date(Date.now() - Math.max(5, Math.floor(maxAgeMinutes)) * 60_000);
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT o.id, o.status, p.id AS payment_id
         FROM orders o
         JOIN payments p ON p.order_id = o.id
        WHERE o.order_channel = 'counter'
          AND o.status = 'pending_payment'
          AND p.status IN ('pending', 'authorized')
          AND o.created_at < :cutoff
        ORDER BY o.id
        LIMIT 200
        FOR UPDATE`,
      { cutoff }
    );
    for (const row of rows) {
      await connection.execute(`UPDATE payments SET status = 'cancelled' WHERE id = :paymentId AND status IN ('pending', 'authorized')`, { paymentId: row.payment_id });
      await connection.execute(`UPDATE orders SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = :orderId AND status = 'pending_payment'`, { orderId: row.id });
      await connection.execute(
        `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at)
         VALUES (:orderId, 'pending_payment', 'cancelled', 'system', NULL, 'Counter payment expired before confirmation.', UTC_TIMESTAMP())`,
        { orderId: row.id }
      );
      await releaseInventoryForOrder(connection, Number(row.id));
      cancelled += 1;
    }
    await connection.commit();
    return { cancelled };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
