import type { ResultSetHeader } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';

/**
 * Converges overdue active voucher rows to their real terminal state.
 *
 * This is intentionally idempotent and never deletes a voucher or changes its
 * redemption/revocation timestamps. It only repairs rows whose status remained
 * active after their expiry time passed.
 */
export async function expireStaleUserVouchers(): Promise<number> {
  const [result] = await mysqlPool.execute<ResultSetHeader>(
    `UPDATE user_vouchers
        SET status = CASE
          WHEN revoked_at IS NOT NULL THEN 'revoked'
          WHEN redeemed_at IS NOT NULL THEN 'redeemed'
          ELSE 'expired'
        END
      WHERE status = 'active'
        AND expires_at <= UTC_TIMESTAMP()`
  );
  return Number(result.affectedRows || 0);
}
