import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';

export async function issueRefundReplacementVoucher(
  connection: PoolConnection,
  input: { orderId: number; userId: number; issueCaseRef: string; reason: string }
): Promise<boolean> {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT IGNORE INTO user_vouchers (
       user_id, voucher_template_id, status, issued_by_type, issued_reason,
       issue_case_ref, issued_at, expires_at
     )
     SELECT :userId, uv.voucher_template_id, 'active', 'system', :reason,
            :issueCaseRef, UTC_TIMESTAMP(),
            CASE
              WHEN vt.valid_until IS NULL THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL COALESCE(vt.expires_in_days, 30) DAY)
              ELSE LEAST(vt.valid_until, DATE_ADD(UTC_TIMESTAMP(), INTERVAL COALESCE(vt.expires_in_days, 30) DAY))
            END
     FROM voucher_redemptions vr
     JOIN user_vouchers uv ON uv.id = vr.user_voucher_id
     JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
     WHERE vr.order_id = :orderId
       AND uv.user_id = :userId
       AND vt.is_active = 1
       AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
     LIMIT 1`,
    input
  );
  return result.affectedRows > 0;
}
