import crypto from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { env } from '../config/env.js';
import { getUtcConnection } from '../db/mysql.js';
import { ApiError } from '../http/errors.js';
import { createUserNotification } from '../http/notifications.js';
import type { ChipPurchase } from '../payments/chip-client.js';
import { creditGiftCardToWallet } from './gift-cards.js';
import { deliverPushToUser } from './push-delivery.js';

type PaymentRow = RowDataPacket & {
  payment_id: number;
  payment_status: string;
  gift_card_id: number;
  purchaser_user_id: number;
  purchase_ref: string;
  original_amount: string;
  remaining_amount: string;
  card_status: string;
  recipient_user_id: number | null;
};

function chipStatus(purchase: ChipPurchase): string {
  return typeof purchase.status === 'string' ? purchase.status.trim().toLowerCase() : 'unknown';
}

/** Settle an RM gift-card purchase only after CHIP confirms the exact payment. */
export async function settleChipGiftCardPurchase(purchaseId: string, purchase: ChipPurchase): Promise<{ received: true; activated?: boolean; duplicate?: boolean }> {
  const cents = Number(purchase.purchase?.total);
  if (purchase.id !== purchaseId || purchase.brand_id !== env.TOPUP_GATEWAY_BRAND_ID || purchase.purchase?.currency !== 'MYR' || !Number.isInteger(cents) || cents <= 0) {
    throw new ApiError(400, 'invalid_chip_callback', 'Invalid CHIP purchase data.');
  }

  const connection = await getUtcConnection();
  let committed = false;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<PaymentRow[]>(
      `SELECT p.id AS payment_id, p.status AS payment_status, gc.id AS gift_card_id,
              gc.purchaser_user_id, gc.recipient_user_id, gc.purchase_ref, CAST(gc.original_amount AS CHAR) AS original_amount,
              CAST(gc.remaining_amount AS CHAR) AS remaining_amount, gc.status AS card_status
         FROM payments p
         JOIN gift_cards gc ON gc.id = p.gift_card_id
        WHERE p.provider = 'chip' AND p.provider_bill_id = :purchaseId
        LIMIT 1 FOR UPDATE`,
      { purchaseId }
    );
    const payment = rows[0];
    if (!payment) throw new ApiError(404, 'gift_card_payment_not_found', 'Gift-card payment was not found.');
    const expectedCents = Math.round(Number(payment.original_amount) * 100);
    const status = chipStatus(purchase);
    const hash = crypto.createHash('sha256').update(JSON.stringify(purchase)).digest('hex');
    const revision = typeof purchase.updated_on === 'string' || typeof purchase.updated_on === 'number'
      ? String(purchase.updated_on)
      : hash.slice(0, 24);
    const eventId = `gift-card:${purchaseId}:${status}:${revision}`.slice(0, 255);

    const [existingEvents] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      `SELECT id FROM payment_events WHERE provider_event_id = :eventId LIMIT 1 FOR UPDATE`,
      { eventId }
    );
    if (existingEvents[0]) {
      await connection.commit();
      committed = true;
      return { received: true, duplicate: true };
    }

    if (payment.payment_status === 'paid' && ['active', 'depleted'].includes(payment.card_status)) {
      await connection.commit();
      committed = true;
      return { received: true, duplicate: true };
    }

    if (status !== 'paid' || cents !== expectedCents) {
      const terminal = ['failed', 'cancelled', 'error', 'payment_failure'].includes(status);
      if (status === 'paid') {
        await connection.execute(`UPDATE payments SET status = 'paid', paid_at = UTC_TIMESTAMP() WHERE id = :paymentId`, { paymentId: payment.payment_id });
        await connection.execute(`UPDATE gift_cards SET status = 'cancelled' WHERE id = :giftCardId AND status = 'pending_payment'`, { giftCardId: payment.gift_card_id });
      } else if (terminal) {
        await connection.execute(`UPDATE payments SET status = :status WHERE id = :paymentId`, {
          paymentId: payment.payment_id,
          status: status === 'cancelled' ? 'cancelled' : 'failed'
        });
        await connection.execute(`UPDATE gift_cards SET status = 'cancelled' WHERE id = :giftCardId AND status = 'pending_payment'`, { giftCardId: payment.gift_card_id });
      }
      await connection.execute(
        `INSERT INTO payment_events (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
         VALUES (:paymentId, :purchaseId, 'chip_gift_card_callback', :hash, UTC_TIMESTAMP(), :result, UTC_TIMESTAMP())`,
        { paymentId: payment.payment_id, purchaseId: eventId, hash, result: status === 'paid' ? 'amount_mismatch_needs_review' : terminal ? 'terminal_failure' : 'pending' }
      );
      await connection.commit();
      committed = true;
      return { received: true };
    }

    if (payment.card_status !== 'pending_payment') {
      await connection.execute(`UPDATE payments SET status = 'paid', paid_at = UTC_TIMESTAMP() WHERE id = :paymentId`, { paymentId: payment.payment_id });
      await connection.execute(`UPDATE gift_cards SET status = 'cancelled' WHERE id = :giftCardId AND status NOT IN ('depleted', 'cancelled', 'expired')`, { giftCardId: payment.gift_card_id });
      await connection.execute(
        `INSERT INTO payment_events (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
         VALUES (:paymentId, :eventId, 'chip_gift_card_paid', :hash, UTC_TIMESTAMP(), 'paid_needs_review', UTC_TIMESTAMP())`,
        { paymentId: payment.payment_id, eventId, hash }
      );
      await connection.commit();
      committed = true;
      return { received: true };
    }

    await connection.execute(`UPDATE payments SET status = 'paid', paid_at = UTC_TIMESTAMP() WHERE id = :paymentId`, { paymentId: payment.payment_id });
    await connection.execute(`UPDATE gift_cards SET status = 'active', paid_at = UTC_TIMESTAMP() WHERE id = :giftCardId AND status = 'pending_payment'`, { giftCardId: payment.gift_card_id });
    await connection.execute(
      `INSERT INTO gift_card_transactions (gift_card_id, transaction_type, amount, balance_after, actor_user_id, remarks, created_at)
       VALUES (:giftCardId, 'issued', :amount, :balanceAfter, :userId, :remarks, UTC_TIMESTAMP())`,
      { giftCardId: payment.gift_card_id, amount: payment.original_amount, balanceAfter: payment.remaining_amount, userId: payment.purchaser_user_id, remarks: `Paid gift card ${payment.purchase_ref}` }
    );
    let deliveredToWallet = false;
    if (payment.recipient_user_id) {
      try {
        await creditGiftCardToWallet(connection, payment.gift_card_id, Number(payment.recipient_user_id), payment.purchaser_user_id);
        deliveredToWallet = true;
      } catch (error) {
        if (!(error instanceof ApiError) || !['token_wallet_cap_exceeded', 'token_account_missing'].includes(error.code)) throw error;
        await createUserNotification(connection, {
          userId: Number(payment.recipient_user_id),
          type: 'gift_card_delivery_pending',
          title: 'Gift card waiting for wallet space',
          body: 'Your gift card is safe, but your C2 Token wallet needs enough available capacity before you claim it.',
          data: { gift_card_id: payment.gift_card_id, purchase_ref: payment.purchase_ref },
          deliveryKey: `gift_card_delivery_pending:${payment.gift_card_id}`
        });
      }
    }
    await connection.execute(
      `INSERT INTO payment_events (payment_id, provider_event_id, event_type, event_payload_hash, processed_at, process_result, created_at)
       VALUES (:paymentId, :eventId, 'chip_gift_card_paid', :hash, UTC_TIMESTAMP(), :result, UTC_TIMESTAMP())`,
      { paymentId: payment.payment_id, eventId, hash, result: deliveredToWallet ? 'delivered_to_wallet' : 'activated' }
    );
    if (payment.purchaser_user_id) {
      await createUserNotification(connection, {
        userId: payment.purchaser_user_id,
        type: 'gift_card_paid',
        title: deliveredToWallet ? 'Gift card delivered' : 'Gift card ready',
        body: deliveredToWallet ? 'Your RM gift card was added to the recipient’s C2 Token wallet.' : 'Your RM gift card is active and safely waiting for the recipient.',
        data: { gift_card_id: payment.gift_card_id, purchase_ref: payment.purchase_ref },
        deliveryKey: `gift_card_paid:${payment.gift_card_id}`
      });
    }
    await connection.commit();
    committed = true;
    if (payment.recipient_user_id) {
      const push = deliveredToWallet
        ? { title: 'Gift card added to your wallet', body: `${Number(payment.original_amount)} C2 Tokens are ready in your wallet.`, type: 'gift_card_received' }
        : { title: 'Gift card waiting for wallet space', body: 'Your gift card is safe. Make wallet space, then claim it from Gift Cards.', type: 'gift_card_delivery_pending' };
      void deliverPushToUser({
        userId: Number(payment.recipient_user_id),
        title: push.title,
        body: push.body,
        data: { type: push.type, gift_card_id: String(payment.gift_card_id) }
      }).catch((error) => console.warn('[gift-card-settlement] push delivery failed after commit', { giftCardId: payment.gift_card_id, error: error instanceof Error ? error.message : String(error) }));
    }
    return { received: true, activated: true };
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
