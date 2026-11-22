import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';
import { getUtcConnection } from '../db/mysql.js';
import { getChipPurchase } from '../payments/chip-client.js';
import { settleChipMobilePurchase } from './chip-counter-settlement.js';
import { releaseInventoryForOrder } from './inventory.js';
import {
  isTerminalChipPurchaseStatus,
  normalizeChipPurchaseStatus
} from './mobile-order-payment-state.js';

type ReconciliationLogger = {
  warn: (context: Record<string, unknown>, message: string) => void;
};

type ReconciliationDatabase = Pick<typeof mysqlPool, 'query' | 'execute'>;

type PendingMobilePaymentRow = RowDataPacket & {
  payment_id: number;
  order_id: number;
  payment_status: string;
  provider_bill_id: string;
  expires_at: Date | null;
};

export type MobileOrderReconciliationResult = {
  scanned: number;
  settled: number;
  finalized: number;
  review_required: number;
  failed: number;
};

async function finalizeExpiredMobileOrder(orderId: number): Promise<boolean> {
  const connection = await getUtcConnection();
  let committed = false;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<RowDataPacket & {
      payment_id: number;
      payment_status: string;
      order_status: string;
    }>>(
      `SELECT p.id AS payment_id, p.status AS payment_status, o.status AS order_status
         FROM orders o
         JOIN payments p ON p.id = (
           SELECT p2.id FROM payments p2 WHERE p2.order_id = o.id ORDER BY p2.id DESC LIMIT 1
         )
        WHERE o.id = :orderId AND o.status = 'pending_payment'
          AND o.payment_mode = 'direct'
          AND p.status IN ('failed', 'cancelled')
          AND p.expires_at IS NOT NULL AND p.expires_at <= UTC_TIMESTAMP()
        LIMIT 1 FOR UPDATE`,
      { orderId }
    );
    const row = rows[0];
    if (!row) {
      await connection.rollback();
      return false;
    }

    const nextOrderStatus = row.payment_status === 'cancelled' ? 'cancelled' : 'payment_failed';
    await connection.execute(
      `UPDATE orders
          SET status = :nextOrderStatus,
              cancelled_at = CASE WHEN :nextOrderStatus = 'cancelled' THEN UTC_TIMESTAMP() ELSE cancelled_at END,
              updated_at = UTC_TIMESTAMP()
        WHERE id = :orderId AND status = 'pending_payment'`,
      { orderId, nextOrderStatus }
    );
    await connection.execute(
      `INSERT INTO order_status_history
         (order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at)
       VALUES (:orderId, 'pending_payment', :nextOrderStatus, 'system', NULL,
               'Direct payment expired without confirmation.', UTC_TIMESTAMP())`,
      { orderId, nextOrderStatus }
    );
    await releaseInventoryForOrder(connection, orderId);
    await connection.commit();
    committed = true;
    return true;
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function reconcilePendingMobileOrdersForUser(
  userId: number,
  logger: ReconciliationLogger,
  dependencies: {
    database?: ReconciliationDatabase;
    getPurchase?: typeof getChipPurchase;
    settlePurchase?: typeof settleChipMobilePurchase;
  } = {}
): Promise<{ scanned: number; settled: number; failed: number }> {
  const database = dependencies.database ?? mysqlPool;
  const getPurchase = dependencies.getPurchase ?? getChipPurchase;
  const settlePurchase = dependencies.settlePurchase ?? settleChipMobilePurchase;

  const [rows] = await database.query<PendingMobilePaymentRow[]>(
    `SELECT p.id AS payment_id, p.order_id, p.status AS payment_status,
            p.provider_bill_id, p.expires_at
       FROM payments p
       JOIN orders o ON o.id = p.order_id
      WHERE o.user_id = :userId
        AND o.order_channel = 'mobile'
        AND o.payment_mode = 'direct'
        AND o.status = 'pending_payment'
        AND p.provider = 'chip'
        AND p.status IN ('pending', 'authorized')
        AND p.provider_bill_id IS NOT NULL
        AND (p.provider_checked_at IS NULL
             OR p.provider_checked_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 SECOND))
      ORDER BY COALESCE(p.provider_checked_at, p.created_at) ASC, p.id ASC
      LIMIT 3`,
    { userId }
  );

  let settled = 0;
  let failed = 0;
  for (const row of rows) {
    const [claim] = await database.execute<ResultSetHeader>(
      `UPDATE payments
          SET provider_checked_at = UTC_TIMESTAMP()
        WHERE id = :paymentId
          AND status IN ('pending', 'authorized')
          AND (provider_checked_at IS NULL
               OR provider_checked_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 SECOND))`,
      { paymentId: row.payment_id }
    );
    if (claim.affectedRows !== 1) continue;

    try {
      const purchase = await getPurchase(row.provider_bill_id);
      if (isTerminalChipPurchaseStatus(normalizeChipPurchaseStatus(purchase))) {
        await settlePurchase(row.provider_bill_id, purchase, 'customer_order_list_refresh');
        settled += 1;
      }
    } catch (error) {
      failed += 1;
      logger.warn(
        { paymentId: row.payment_id, providerPurchaseId: row.provider_bill_id, err: error },
        'Unable to reconcile pending mobile order payment'
      );
    }
  }

  return { scanned: rows.length, settled, failed };
}

/**
 * Reconciles mobile direct orders even when the customer never reopens the app.
 * Terminal provider failures are finalized only after the server-authoritative
 * payment window expires; provider uncertainty remains blocked and visible for
 * admin review rather than being guessed as failed.
 */
export async function runMobileOrderPaymentReconciliationSweep(
  limit = 100
): Promise<MobileOrderReconciliationResult> {
  const safeLimit = Number.isInteger(limit) ? Math.min(200, Math.max(1, limit)) : 100;
  const [rows] = await mysqlPool.query<PendingMobilePaymentRow[]>(
    `SELECT p.id AS payment_id, p.order_id, p.status AS payment_status, p.provider_bill_id, p.expires_at
       FROM payments p
       JOIN orders o ON o.id = p.order_id
      WHERE o.order_channel = 'mobile'
        AND o.payment_mode = 'direct'
        AND p.provider = 'chip'
        AND (
          (o.status = 'pending_payment' AND p.status IN ('pending', 'authorized') AND (
            p.provider_bill_id IS NULL
            OR p.provider_checked_at IS NULL
            OR p.provider_checked_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 SECOND)
            OR p.expires_at <= UTC_TIMESTAMP()
          ))
          OR (o.status = 'pending_payment' AND p.status IN ('failed', 'cancelled') AND p.expires_at <= UTC_TIMESTAMP())
          OR (o.status = 'cancelled' AND p.status = 'cancelled'
              AND p.provider_bill_id IS NOT NULL
              AND p.provider_checked_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 SECOND)
              AND EXISTS (
                SELECT 1
                FROM payment_events recovery_event
                WHERE recovery_event.payment_id = p.id
                  AND recovery_event.event_type = 'chip_customer_recovery_detach'
                  AND recovery_event.process_result = 'detached_pending_provider_review'
                  AND recovery_event.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
              ))
        )
      ORDER BY COALESCE(p.provider_checked_at, p.created_at) ASC, p.id ASC
      LIMIT ${safeLimit}`
  );

  let settled = 0;
  let finalized = 0;
  let reviewRequired = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      if (!row.provider_bill_id) {
        if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
          const [failedPayment] = await mysqlPool.execute<ResultSetHeader>(
            `UPDATE payments SET status = 'failed', failed_at = UTC_TIMESTAMP()
               WHERE id = :paymentId AND status IN ('pending', 'authorized')`,
            { paymentId: row.payment_id }
          );
          if (failedPayment.affectedRows === 1 && await finalizeExpiredMobileOrder(Number(row.order_id))) {
            finalized += 1;
          }
        }
        continue;
      }

      if (['pending', 'authorized', 'cancelled'].includes(row.payment_status)) {
        const [claim] = await mysqlPool.execute<ResultSetHeader>(
          `UPDATE payments
              SET provider_checked_at = UTC_TIMESTAMP()
            WHERE id = :paymentId
              AND status IN ('pending', 'authorized', 'cancelled')
              AND (provider_checked_at IS NULL
                   OR provider_checked_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 SECOND)
                   OR expires_at <= UTC_TIMESTAMP())`,
          { paymentId: row.payment_id }
        );
        if (claim.affectedRows !== 1) continue;
      }

      const purchase = await getChipPurchase(row.provider_bill_id);
      const providerStatus = normalizeChipPurchaseStatus(purchase);
      if (isTerminalChipPurchaseStatus(providerStatus)) {
        await settleChipMobilePurchase(row.provider_bill_id, purchase, 'scheduled_mobile_reconcile');
        settled += 1;
        if (row.expires_at && row.expires_at.getTime() <= Date.now() &&
            ['failed', 'cancelled', 'expired', 'overdue', 'error', 'payment_failure', 'blocked'].includes(providerStatus) &&
            await finalizeExpiredMobileOrder(Number(row.order_id))) {
          finalized += 1;
        }
      } else if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
        reviewRequired += 1;
      }
    } catch (error) {
      failed += 1;
      // Provider uncertainty is intentionally not converted to failure.
      // The next sweep or an admin review can safely retry reconciliation.
      console.warn('[mobile-order-payment-reconciliation] payment check failed', {
        paymentId: row.payment_id,
        orderId: row.order_id,
        error
      });
    }
  }

  return {
    scanned: rows.length,
    settled,
    finalized,
    review_required: reviewRequired,
    failed
  };
}
