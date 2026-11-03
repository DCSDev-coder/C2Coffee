import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { createUserNotification } from '../http/notifications.js';
import { ApiError } from '../http/errors.js';

export async function creditGiftCardToWallet(
  connection: PoolConnection,
  giftCardId: number,
  userId: number,
  actorUserId: number | null = userId,
): Promise<number> {
  const [cards] = await connection.execute<Array<RowDataPacket & { id: number; currency: 'rm' | 'token'; remaining_amount: string; status: string; recipient_user_id: number | null }>>(
    `SELECT id, currency, CAST(remaining_amount AS CHAR) AS remaining_amount, status, recipient_user_id
       FROM gift_cards WHERE id = :giftCardId LIMIT 1 FOR UPDATE`, { giftCardId });
  const card = cards[0];
  if (!card || card.status !== 'active') throw new ApiError(409, 'gift_card_unavailable', 'This gift card is not available.');
  if (card.recipient_user_id && Number(card.recipient_user_id) !== userId) throw new ApiError(403, 'gift_card_recipient_mismatch', 'This gift card belongs to another customer.');
  const amount = Number(card.remaining_amount);
  if (!Number.isInteger(amount)) throw new ApiError(409, 'gift_card_fractional_value', 'This legacy gift card requires an administrator review before it can be converted to C2 Tokens.');
  if (amount <= 0) throw new ApiError(409, 'gift_card_depleted', 'This gift card has no remaining value.');
  const [accounts] = await connection.execute<Array<RowDataPacket & { balance_available: number; balance_cap: number }>>(
    `SELECT balance_available, balance_cap FROM token_accounts WHERE user_id = :userId LIMIT 1 FOR UPDATE`, { userId });
  const account = accounts[0];
  if (!account) throw new ApiError(409, 'token_account_missing', 'The recipient does not have a token wallet yet.');
  const nextBalance = Number(account.balance_available) + amount;
  if (nextBalance > Number(account.balance_cap)) throw new ApiError(409, 'token_wallet_cap_exceeded', 'The recipient wallet cannot receive this gift card because its token limit would be exceeded.');
  await connection.execute(`UPDATE token_accounts SET balance_available = :nextBalance, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`, { nextBalance, userId });
  await connection.execute(
    `INSERT INTO token_ledger (user_id, token_lot_id, direction, source_type, source_id, amount, balance_after, remarks, created_at)
     VALUES (:userId, NULL, 'credit', 'gift_card_redemption', :giftCardId, :amount, :nextBalance, :remarks, UTC_TIMESTAMP())`,
    { userId, giftCardId, amount, nextBalance, remarks: `Gift card wallet credit ${giftCardId}` },
  );
  await connection.execute(`UPDATE gift_cards SET remaining_amount = 0, status = 'depleted', recipient_user_id = :userId, claimed_at = COALESCE(claimed_at, UTC_TIMESTAMP()) WHERE id = :giftCardId`, { userId, giftCardId });
  await connection.execute(
    `INSERT INTO gift_card_transactions (gift_card_id, transaction_type, amount, balance_after, actor_user_id, remarks, created_at)
     VALUES (:giftCardId, 'redeemed', :amount, 0, :actorUserId, 'Converted to recipient C2 Token wallet', UTC_TIMESTAMP())`,
    { giftCardId, amount, actorUserId },
  );
  await createUserNotification(connection, {
    userId,
    type: 'gift_card_received',
    title: 'Gift card added to your wallet',
    body: `${amount} C2 Tokens were added to your wallet.`,
    data: { gift_card_id: giftCardId, amount, balance_after: nextBalance },
    deliveryKey: `gift_card_received:${giftCardId}:${userId}`,
  });
  return nextBalance;
}

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
