import type { PoolConnection } from 'mysql2/promise';

type ComplimentaryOrderLike = {
  final_total_rm?: number | string | null;
  token_amount_charged?: number | string | null;
  payment_mode?: string | null;
  voucher_id?: number | string | null;
};

export function isComplimentaryOrder(order: ComplimentaryOrderLike): boolean {
  const finalTotalRm = Number(order.final_total_rm || 0);
  const tokenAmountCharged = Number(order.token_amount_charged || 0);

  return (finalTotalRm <= 0 && tokenAmountCharged <= 0) ||
    (order.payment_mode === 'token' && order.voucher_id != null && tokenAmountCharged <= 0);
}

export async function restoreVoucherForCancelledOrder(
  connection: PoolConnection,
  orderId: number,
): Promise<void> {
  await connection.execute(
    `UPDATE user_vouchers uv
        JOIN orders o ON o.voucher_id = uv.id
           JOIN voucher_redemptions vr
             ON vr.user_voucher_id = uv.id
            AND vr.order_id = o.id
       SET uv.status = 'active',
           uv.redeemed_at = NULL
        WHERE o.id = :orderId
          AND o.user_id = uv.user_id
          AND (
            (
              COALESCE(o.final_total_rm, 0) <= 0
              AND COALESCE(o.token_amount_charged, 0) <= 0
            )
            OR (
              o.payment_mode = 'token'
              AND o.voucher_id IS NOT NULL
              AND COALESCE(o.token_amount_charged, 0) <= 0
            )
          )
          AND uv.status = 'redeemed'
          AND uv.redeemed_at IS NOT NULL`,
    { orderId },
  );
}
