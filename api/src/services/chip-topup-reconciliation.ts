import type { RowDataPacket } from 'mysql2/promise';

import { env } from '../config/env.js';
import { mysqlPool } from '../db/mysql.js';
import { cancelChipPurchase, getChipPurchase } from '../payments/chip-client.js';
import { chipTerminalFailure, settleChipTopUpPurchase } from './chip-topup-settlement.js';

type PendingChipTopUp = RowDataPacket & {
  payment_id: number;
  provider_bill_id: string;
  expires_at: Date | null;
};

export type ChipTopUpReconciliationResult = {
  scanned: number;
  released: number;
  settled: number;
  unchanged: number;
  failed: number;
};

function needsSettlement(status: unknown): boolean {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return ['paid', 'refunded', 'partially_refunded'].includes(normalized) || chipTerminalFailure(normalized) !== null;
}

export async function runChipTopUpReconciliationSweep(limit = 25): Promise<ChipTopUpReconciliationResult> {
  if (!env.TOPUP_GATEWAY_ENABLED || env.TOPUP_GATEWAY_PROVIDER !== 'chip') {
    return { scanned: 0, released: 0, settled: 0, unchanged: 0, failed: 0 };
  }

  const safeLimit = Number.isInteger(limit) ? Math.min(100, Math.max(1, limit)) : 25;
  const [rows] = await mysqlPool.query<PendingChipTopUp[]>(
    `SELECT p.id AS payment_id, p.provider_bill_id, tt.expires_at
     FROM payments p
     JOIN token_topups tt ON tt.id = p.topup_id
     WHERE p.provider = 'chip' AND p.provider_bill_id IS NOT NULL
       AND (
         (p.status IN ('pending', 'authorized') AND tt.status = 'pending_payment')
         OR (p.status = 'paid' AND tt.status = 'paid'
             AND (p.provider_checked_at IS NULL OR p.provider_checked_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)))
         OR tt.status = 'refund_needs_review'
       )
       AND p.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
     ORDER BY CASE WHEN tt.status = 'pending_payment' THEN 0 ELSE 1 END,
              COALESCE(p.provider_checked_at, p.created_at) ASC, p.id ASC
     LIMIT ${safeLimit}`
  );

  let released = 0;
  let settled = 0;
  let unchanged = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      let purchase = await getChipPurchase(row.provider_bill_id);
      await mysqlPool.execute(
        `UPDATE payments SET provider_checked_at = UTC_TIMESTAMP() WHERE id = :paymentId`,
        { paymentId: row.payment_id }
      );
      if (!needsSettlement(purchase.status) && row.expires_at && row.expires_at.getTime() <= Date.now()) {
        purchase = await cancelChipPurchase(row.provider_bill_id);
      }
      if (!needsSettlement(purchase.status)) {
        unchanged += 1;
        continue;
      }
      await settleChipTopUpPurchase(row.provider_bill_id, purchase, {
        eventSource: 'scheduled_reconcile'
      });
      if (row.expires_at && row.expires_at.getTime() <= Date.now()) released += 1;
      settled += 1;
    } catch {
      failed += 1;
    }
  }

  return { scanned: rows.length, released, settled, unchanged, failed };
}
