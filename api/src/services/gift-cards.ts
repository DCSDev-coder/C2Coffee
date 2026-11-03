import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

type GiftCardRedemptionRow = RowDataPacket & {
  gift_card_id: number | null;
  gift_card_amount_rm: string | number;
  gift_card_token_amount: string | number;
  currency: 'rm' | 'token';
  original_amount: string | number;
  remaining_amount: string | number;
  status: string;
};

/**
 * Returns stored value to the original card once an order refund is completed.
 * The transaction record makes this safe to call more than once in a retry.
 */
export async function restoreGiftCardForRefund(
  connection: PoolConnection,
  orderId: number,
  actorUserId: number,
  reason: string
): Promise<boolean> {
  const [rows] = await connection.execute<GiftCardRedemptionRow[]>(
    `SELECT o.gift_card_id, o.gift_card_amount_rm, o.gift_card_token_amount,
            gc.currency, gc.original_amount, gc.remaining_amount, gc.status
       FROM orders o
       JOIN gift_cards gc ON gc.id = o.gift_card_id
      WHERE o.id = :orderId
      LIMIT 1
      FOR UPDATE`,
    { orderId }
  );
  const row = rows[0];
  if (!row?.gift_card_id) return false;

  const amount = row.currency === 'rm'
    ? Number(row.gift_card_amount_rm)
    : Number(row.gift_card_token_amount);
  if (amount <= 0) return false;

  const [existing] = await connection.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT id FROM gift_card_transactions
      WHERE gift_card_id = :giftCardId AND order_id = :orderId AND transaction_type = 'reversed'
      LIMIT 1 FOR UPDATE`,
    { giftCardId: row.gift_card_id, orderId }
  );
  if (existing[0]) return false;

  const balanceAfter = Math.min(Number(row.original_amount), Number(row.remaining_amount) + amount);
  await connection.execute(
    `UPDATE gift_cards
        SET remaining_amount = :balanceAfter,
            status = CASE
              WHEN status = 'depleted' AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP()) THEN 'active'
              ELSE status
            END
      WHERE id = :giftCardId`,
    { balanceAfter, giftCardId: row.gift_card_id }
  );
  await connection.execute(
    `INSERT INTO gift_card_transactions
       (gift_card_id, transaction_type, amount, balance_after, order_id, actor_user_id, remarks, created_at)
     VALUES (:giftCardId, 'reversed', :amount, :balanceAfter, :orderId, :actorUserId, :reason, UTC_TIMESTAMP())`,
    { giftCardId: row.gift_card_id, amount, balanceAfter, orderId, actorUserId, reason }
  );
  return true;
}
