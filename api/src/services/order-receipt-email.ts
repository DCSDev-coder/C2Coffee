import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { getUtcConnection, mysqlPool } from '../db/mysql.js';
import { sendOrderReceiptEmail } from './otp-email.js';

type DeliveryRow = RowDataPacket & {
  id: number;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  recipient_email: string;
};

type OrderRow = RowDataPacket & {
  order_ref: string;
  daily_order_number: number;
  store_name: string;
  pickup_slot_at: Date;
  paid_at: Date | null;
  created_at: Date;
  final_total_rm: string;
  token_amount_charged: number;
};

type ItemRow = RowDataPacket & {
  id: number;
  item_name_snapshot: string;
  quantity: number;
  line_subtotal_rm: string;
};

type ModifierRow = RowDataPacket & {
  order_item_id: number;
  modifier_group_name_snapshot: string;
  modifier_option_name_snapshot: string;
};

function normalizedEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() || '';
  return email.includes('@') ? email : null;
}

/** Queue one durable receipt delivery while the order transaction is open. */
export async function queueOrderReceiptEmail(
  connection: PoolConnection,
  { orderId, recipientEmail, force = false }: { orderId: number; recipientEmail: string | null; force?: boolean }
): Promise<boolean> {
  const email = normalizedEmail(recipientEmail);
  if (!email) return false;

  const [existing] = await connection.query<DeliveryRow[]>(
    `SELECT id, status, recipient_email
     FROM order_receipt_email_deliveries
     WHERE order_id = :orderId
     LIMIT 1
     FOR UPDATE`,
    { orderId }
  );
  const delivery = existing[0];
  if (!delivery) {
    await connection.execute(
      `INSERT INTO order_receipt_email_deliveries (order_id, recipient_email, status, queued_at)
       VALUES (:orderId, :recipientEmail, 'queued', UTC_TIMESTAMP())`,
      { orderId, recipientEmail: email }
    );
    return true;
  }

  if (!force || delivery.status === 'sending') return false;
  await connection.execute(
    `UPDATE order_receipt_email_deliveries
     SET recipient_email = :recipientEmail,
         status = 'queued',
         last_error_code = NULL,
         queued_at = UTC_TIMESTAMP()
     WHERE id = :id`,
    { id: delivery.id, recipientEmail: email }
  );
  return true;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur'
  }).format(value);
}

/** Claims and delivers a queued email without ever changing checkout outcome. */
export async function deliverQueuedOrderReceiptEmail(orderId: number): Promise<'sent' | 'skipped' | 'failed'> {
  const connection = await getUtcConnection();
  let delivery: DeliveryRow | undefined;
  try {
    await connection.beginTransaction();
    const [deliveries] = await connection.query<DeliveryRow[]>(
      `SELECT id, status, recipient_email
       FROM order_receipt_email_deliveries
       WHERE order_id = :orderId
       LIMIT 1
       FOR UPDATE`,
      { orderId }
    );
    delivery = deliveries[0];
    if (!delivery || delivery.status !== 'queued') {
      await connection.commit();
      return 'skipped';
    }
    await connection.execute(
      `UPDATE order_receipt_email_deliveries
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
    const [orders] = await mysqlPool.query<OrderRow[]>(
      `SELECT o.order_ref, o.daily_order_number, s.name AS store_name, o.pickup_slot_at,
              o.paid_at, o.created_at, CAST(o.final_total_rm AS CHAR) AS final_total_rm,
              o.token_amount_charged
       FROM orders o
       JOIN stores s ON s.id = o.store_id
       WHERE o.id = :orderId
       LIMIT 1`,
      { orderId }
    );
    const order = orders[0];
    if (!order || !delivery) throw new Error('receipt_order_not_found');

    const [items] = await mysqlPool.query<ItemRow[]>(
      `SELECT id, item_name_snapshot, quantity, CAST(line_subtotal_rm AS CHAR) AS line_subtotal_rm
       FROM order_items
       WHERE order_id = :orderId
       ORDER BY id ASC`,
      { orderId }
    );
    const itemIds = items.map((item) => item.id);
    const [modifiers] = itemIds.length === 0
      ? [[] as ModifierRow[]]
      : await mysqlPool.query<ModifierRow[]>(
          `SELECT order_item_id, modifier_group_name_snapshot, modifier_option_name_snapshot
           FROM order_item_modifiers
           WHERE order_item_id IN (:itemIds)
           ORDER BY id ASC`,
          { itemIds }
        );
    const modifiersByItem = new Map<number, string[]>();
    for (const modifier of modifiers) {
      const values = modifiersByItem.get(modifier.order_item_id) ?? [];
      values.push(`${modifier.modifier_group_name_snapshot}: ${modifier.modifier_option_name_snapshot}`);
      modifiersByItem.set(modifier.order_item_id, values);
    }

    const info = await sendOrderReceiptEmail({
      to: delivery.recipient_email,
      orderReference: order.order_ref,
      orderNumber: order.daily_order_number,
      storeName: order.store_name,
      orderedAt: formatDate(order.paid_at ?? order.created_at),
      pickupAt: formatDate(order.pickup_slot_at),
      items: items.map((item) => ({
        name: item.item_name_snapshot,
        quantity: item.quantity,
        totalRm: item.line_subtotal_rm,
        modifiers: modifiersByItem.get(item.id) ?? []
      })),
      totalRm: order.final_total_rm,
      tokens: order.token_amount_charged
    });
    await mysqlPool.execute(
      `UPDATE order_receipt_email_deliveries
       SET status = 'sent', provider_message_id = :messageId, sent_at = UTC_TIMESTAMP(), last_error_code = NULL
       WHERE id = :id AND status = 'sending'`,
      { id: delivery.id, messageId: info.messageId ?? null }
    );
    return 'sent';
  } catch {
    if (delivery) {
      await mysqlPool.execute(
        `UPDATE order_receipt_email_deliveries
         SET status = 'failed', last_error_code = 'smtp_delivery_failed'
         WHERE id = :id AND status = 'sending'`,
        { id: delivery.id }
      );
    }
    return 'failed';
  }
}
