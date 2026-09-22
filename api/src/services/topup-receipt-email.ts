import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getUtcConnection, mysqlPool } from '../db/mysql.js';
import { sendTopUpReceiptEmail } from './otp-email.js';

type DeliveryRow = RowDataPacket & {
  id: number;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  recipient_email: string;
  payment_method: string;
  provider_bill_id: string;
};

type TopUpRow = RowDataPacket & {
  topup_ref: string;
  token_amount: number;
  rm_amount: string;
  paid_at: Date | null;
  created_at: Date;
};

function normalizedEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() || '';
  return email.includes('@') ? email : null;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur'
  }).format(value);
}

/** Queue one receipt in the payment transaction, making repeated callbacks safe. */
export async function queueTopUpReceiptEmail(
  connection: PoolConnection,
  { topupId, recipientEmail, paymentMethod, providerBillId }: {
    topupId: number;
    recipientEmail: string | null;
    paymentMethod: string;
    providerBillId: string;
  }
): Promise<boolean> {
  const email = normalizedEmail(recipientEmail);
  if (!email || !providerBillId.trim()) return false;

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT IGNORE INTO topup_receipt_email_deliveries
       (topup_id, recipient_email, payment_method, provider_bill_id, status, queued_at)
     VALUES (:topupId, :recipientEmail, :paymentMethod, :providerBillId, 'queued', UTC_TIMESTAMP())`,
    { topupId, recipientEmail: email, paymentMethod, providerBillId }
  );
  return result.affectedRows === 1;
}

/** Claims and delivers a queued receipt without changing the payment outcome. */
export async function deliverQueuedTopUpReceiptEmail(topupId: number): Promise<'sent' | 'skipped' | 'failed'> {
  const connection = await getUtcConnection();
  let delivery: DeliveryRow | undefined;
  try {
    await connection.beginTransaction();
    const [deliveries] = await connection.query<DeliveryRow[]>(
      `SELECT id, status, recipient_email, payment_method, provider_bill_id
       FROM topup_receipt_email_deliveries
       WHERE topup_id = :topupId
       LIMIT 1 FOR UPDATE`,
      { topupId }
    );
    delivery = deliveries[0];
    if (!delivery || delivery.status !== 'queued') {
      await connection.commit();
      return 'skipped';
    }
    await connection.execute(
      `UPDATE topup_receipt_email_deliveries
       SET status = 'sending', attempt_count = attempt_count + 1, last_error_code = NULL
       WHERE id = :id`,
      { id: delivery.id }
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  try {
    const [topups] = await mysqlPool.query<TopUpRow[]>(
      `SELECT topup_ref, token_amount, CAST(rm_amount AS CHAR) AS rm_amount, paid_at, created_at
       FROM token_topups
       WHERE id = :topupId AND status = 'paid'
       LIMIT 1`,
      { topupId }
    );
    const topup = topups[0];
    if (!topup || !delivery) throw new Error('receipt_topup_not_found');

    const info = await sendTopUpReceiptEmail({
      to: delivery.recipient_email,
      topUpReference: topup.topup_ref,
      providerBillId: delivery.provider_bill_id,
      paymentMethod: delivery.payment_method,
      paidAt: formatDate(topup.paid_at ?? topup.created_at),
      amountRm: topup.rm_amount,
      tokens: topup.token_amount
    });
    await mysqlPool.execute(
      `UPDATE topup_receipt_email_deliveries
       SET status = 'sent', provider_message_id = :messageId, sent_at = UTC_TIMESTAMP(), last_error_code = NULL
       WHERE id = :id AND status = 'sending'`,
      { id: delivery.id, messageId: info.messageId ?? null }
    );
    return 'sent';
  } catch {
    if (delivery) {
      await mysqlPool.execute(
        `UPDATE topup_receipt_email_deliveries
         SET status = 'failed', last_error_code = 'smtp_delivery_failed'
         WHERE id = :id AND status = 'sending'`,
        { id: delivery.id }
      );
    }
    return 'failed';
  }
}
