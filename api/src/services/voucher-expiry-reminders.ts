import type { RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';
import { createUserNotification } from '../http/notifications.js';
import { deliverPushToUser } from './push-delivery.js';

type ExpiringVoucherRow = RowDataPacket & {
  user_id: number;
  voucher_id: number;
  voucher_name: string;
};

// Runs on startup and daily. The delivery key makes repeated runs safe.
export async function runVoucherExpiryReminderSweep(): Promise<void> {
  const [vouchers] = await mysqlPool.query<ExpiringVoucherRow[]>(`
    SELECT uv.user_id, uv.id AS voucher_id, vt.name AS voucher_name
    FROM user_vouchers uv
    JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
    WHERE uv.status = 'active'
      AND uv.redeemed_at IS NULL
      AND uv.revoked_at IS NULL
      AND uv.expires_at > UTC_TIMESTAMP()
      AND uv.expires_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
  `);

  for (const voucher of vouchers) {
    const inserted = await createUserNotification(mysqlPool, {
      userId: Number(voucher.user_id),
      type: 'voucher_expiring',
      title: 'Reward expiring soon',
      body: `${voucher.voucher_name} expires within 24 hours.`,
      data: { type: 'voucher_expiring', voucher_id: voucher.voucher_id },
      deliveryKey: `voucher-${voucher.voucher_id}-24h`
    });
    if (inserted === 0) continue;

    try {
      await deliverPushToUser({
        userId: Number(voucher.user_id),
        title: 'Reward expiring soon',
        body: `${voucher.voucher_name} expires within 24 hours.`,
        data: { type: 'voucher_expiring', voucher_id: String(voucher.voucher_id) }
      });
    } catch (error) {
      console.warn('[voucher-expiry-reminders] push delivery failed', {
        voucherId: voucher.voucher_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
