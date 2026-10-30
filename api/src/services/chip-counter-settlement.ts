import crypto from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { env } from '../config/env.js';
import { getUtcConnection } from '../db/mysql.js';
import { ApiError } from '../http/errors.js';
import type { ChipPurchase } from '../payments/chip-client.js';
import { releaseInventoryForOrder } from './inventory.js';

type PaymentRow = RowDataPacket & {
  payment_id: number;
  payment_status: string;
  order_id: number;
  order_ref: string;
  order_status: string;
  store_id: number;
  amount_rm: string;
  voucher_id: number | null;
  discount_total_rm: string;
};

function normalizedStatus(purchase: ChipPurchase): string {
  return typeof purchase.status === 'string' ? purchase.status.trim().toLowerCase() : 'unknown';
}

function terminalFailure(status: string): 'failed' | 'cancelled' | null {
  if (status === 'cancelled') return 'cancelled';
  if (['error', 'failed', 'payment_failure'].includes(status)) return 'failed';
  return null;
}

async function settleChipOrderPurchase(
  purchaseId: string,
  purchase: ChipPurchase,
  eventSource = 'callback',
  orderChannel: 'counter' | 'mobile' = 'counter'
): Promise<Record<string, unknown>> {
  const amountCents = Number(purchase.purchase?.total);
  const status = normalizedStatus(purchase);
  if (
    purchase.id !== purchaseId ||
    purchase.brand_id !== env.TOPUP_GATEWAY_BRAND_ID ||
    purchase.purchase?.currency !== 'MYR' ||
    !Number.isInteger(amountCents) ||
    amountCents <= 0
  ) {
    throw new ApiError(400, 'invalid_chip_callback', 'Invalid CHIP purchase data.');
  }

  const connection = await getUtcConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<PaymentRow[]>(
      `SELECT p.id AS payment_id, p.status AS payment_status,
              o.id AS order_id, o.order_ref, o.status AS order_status, o.store_id,
              CAST(p.amount_rm AS CHAR) AS amount_rm, o.voucher_id,
              CAST(o.discount_total_rm AS CHAR) AS discount_total_rm
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.provider = 'chip' AND p.provider_bill_id = :purchaseId
         AND o.order_channel = :orderChannel
       LIMIT 1 FOR UPDATE`,
      { purchaseId, orderChannel }
    );
    const payment = rows[0];
    if (!payment) throw new ApiError(404, 'chip_payment_not_found', 'Counter payment was not found.');

    const eventRef = `chip:${orderChannel}:${eventSource}:${purchaseId}:${status}:${String(purchase.updated_on ?? '')}`;
    const [events] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      'SELECT id FROM payment_events WHERE provider_event_id = :eventRef LIMIT 1 FOR UPDATE',
      { eventRef }
    );
    if (events[0]) {
      await connection.commit();
      return { received: true, duplicate: true, order_ref: payment.order_ref };
    }

    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(purchase)).digest('hex');
    const amountMatches = amountCents === Math.round(Number(payment.amount_rm) * 100);
    const failure = terminalFailure(status);

    if (status === 'paid' && amountMatches) {
      await connection.execute(
        `UPDATE payments SET status = 'paid', paid_at = UTC_TIMESTAMP()
         WHERE id = :paymentId AND status IN ('pending', 'authorized')`,
        { paymentId: payment.payment_id }
      );
      await connection.execute(
        `UPDATE orders SET status = 'paid', paid_at = UTC_TIMESTAMP()
         WHERE id = :orderId AND status = 'pending_payment'`,
        { orderId: payment.order_id }
      );
      if (payment.order_status === 'pending_payment') await connection.execute(
        `INSERT INTO order_status_history
           (order_id, from_status, to_status, changed_by_type, changed_by_id, reason, created_at)
         VALUES (:orderId, 'pending_payment', 'paid', 'system', NULL,
                 'CHIP counter payment verified.', UTC_TIMESTAMP())`,
        { orderId: payment.order_id }
      );

      if (payment.voucher_id && payment.order_status === 'pending_payment') {
        const [redeemed] = await connection.execute<ResultSetHeader>(
          `UPDATE user_vouchers SET status = 'redeemed', redeemed_at = UTC_TIMESTAMP()
           WHERE id = :voucherId AND status = 'active'`,
          { voucherId: payment.voucher_id }
        );
        if (redeemed.affectedRows !== 1) {
          throw new ApiError(409, 'voucher_redemption_conflict', 'The selected voucher is no longer available.');
        }
        await connection.execute(
          `INSERT INTO voucher_redemptions
             (user_voucher_id, order_id, discount_rm, discount_token_amount, created_at)
           VALUES (:voucherId, :orderId, :discount, NULL, UTC_TIMESTAMP())`,
          { voucherId: payment.voucher_id, orderId: payment.order_id, discount: payment.discount_total_rm }
        );
      }

      if (payment.order_status === 'pending_payment') {
        const [printers] = await connection.execute<RowDataPacket[]>(
          `SELECT pt.id, pt.tenant_code
         FROM printer_targets pt
         JOIN stores s ON s.id = :storeId
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE pt.tenant_code = t.code AND pt.store_id = s.id
           AND pt.delivery_mode = 'android_direct' AND pt.status = 'connected'
           AND pt.is_default = 1 AND pt.network_host IS NOT NULL
           AND pt.network_port IS NOT NULL AND pt.direct_print_device_key IS NOT NULL
         LIMIT 1`,
          { storeId: payment.store_id }
        );
        if (printers[0]) {
          await connection.execute<ResultSetHeader>(
            `INSERT INTO print_jobs
             (job_ref, tenant_code, order_id, printer_target_id, requested_by_admin_user_id, request_type)
           VALUES (:jobRef, :tenantCode, :orderId, :printerTargetId, NULL, 'original')`,
            {
              jobRef: crypto.randomUUID(),
              tenantCode: printers[0].tenant_code,
              orderId: payment.order_id,
              printerTargetId: printers[0].id
            }
          );
        }
      }
    } else if (failure) {
      await connection.execute(
        `UPDATE payments SET status = :status,
             failed_at = CASE WHEN :status = 'failed' THEN UTC_TIMESTAMP() ELSE failed_at END
         WHERE id = :paymentId AND status IN ('pending', 'authorized')`,
        { paymentId: payment.payment_id, status: failure }
      );
      await connection.execute(
        `UPDATE orders SET status = :orderStatus,
             cancelled_at = CASE WHEN :orderStatus = 'cancelled' THEN UTC_TIMESTAMP() ELSE cancelled_at END
         WHERE id = :orderId AND status = 'pending_payment'`,
        {
          orderId: payment.order_id,
          orderStatus: failure === 'cancelled' ? 'cancelled' : 'payment_failed'
        }
      );
      if (
        payment.order_status === 'pending_payment' &&
        ['pending', 'authorized'].includes(payment.payment_status)
      ) {
        await releaseInventoryForOrder(connection, payment.order_id);
      }
    }

    await connection.execute(
      `INSERT INTO payment_events
         (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
       VALUES (:paymentId, :eventRef, :eventType, :payloadHash, UTC_TIMESTAMP(), :result, UTC_TIMESTAMP())`,
      {
        paymentId: payment.payment_id,
        eventRef,
        eventType: status === 'paid' && !amountMatches ? 'amount_mismatch' : `chip_${status}`,
        payloadHash,
        result: status === 'paid' && amountMatches ? 'paid' : failure ?? 'not_paid'
      }
    );
    await connection.commit();
    return {
      received: true,
      order_ref: payment.order_ref,
      status: status === 'paid' && amountMatches ? 'paid' : failure ?? 'pending'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function settleChipCounterPurchase(
  purchaseId: string,
  purchase: ChipPurchase,
  eventSource = 'callback'
): Promise<Record<string, unknown>> {
  return settleChipOrderPurchase(purchaseId, purchase, eventSource, 'counter');
}

export async function settleChipMobilePurchase(
  purchaseId: string,
  purchase: ChipPurchase,
  eventSource = 'callback'
): Promise<Record<string, unknown>> {
  return settleChipOrderPurchase(purchaseId, purchase, eventSource, 'mobile');
}
