import type { RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';
import { assertChipConfigured, getChipPurchase } from '../payments/chip-client.js';
import { chipTerminalFailure, settleChipTopUpPurchase } from '../services/chip-topup-settlement.js';

type PendingChipPayment = RowDataPacket & {
  provider_bill_id: string;
};

function requestedLimit(): number {
  const argument = process.argv.find((value) => value.startsWith('--limit='));
  const parsed = Number(argument?.split('=')[1] ?? 100);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 500 ? parsed : 100;
}

async function main(): Promise<void> {
  assertChipConfigured();
  const limit = requestedLimit();

  const [releaseResult] = await mysqlPool.execute(
    `UPDATE token_wallet_cap_reservations r
     JOIN token_topups tt ON tt.id = r.topup_id
     JOIN payments p ON p.topup_id = tt.id AND p.provider = 'chip'
     SET r.status = 'released', r.release_reason = 'checkout_expired', r.released_at = UTC_TIMESTAMP()
     WHERE r.status = 'active' AND r.expires_at <= UTC_TIMESTAMP()
       AND tt.status = 'pending_payment' AND p.status IN ('pending', 'authorized')`
  );
  const released = 'affectedRows' in releaseResult ? Number(releaseResult.affectedRows) : 0;

  const [rows] = await mysqlPool.query<PendingChipPayment[]>(
    `SELECT p.provider_bill_id
     FROM payments p
     JOIN token_topups tt ON tt.id = p.topup_id
     LEFT JOIN token_wallet_cap_reservations r ON r.topup_id = tt.id
     WHERE p.provider = 'chip' AND p.provider_bill_id IS NOT NULL
       AND p.status IN ('pending', 'authorized')
       AND tt.status = 'pending_payment'
       AND (p.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY) OR r.status = 'needs_review')
       AND NOT EXISTS (
         SELECT 1 FROM payment_events pe
         WHERE pe.payment_id = p.id AND pe.process_result = 'rejected'
       )
     GROUP BY p.provider_bill_id
     ORDER BY MIN(p.id) ASC
     LIMIT ${limit}`
  );

  let credited = 0;
  let terminal = 0;
  let needsReview = 0;
  let unchanged = 0;
  let failed = 0;
  const eventSource = `reconcile-${new Date().toISOString().slice(0, 16)}`;

  for (const row of rows) {
    try {
      const purchase = await getChipPurchase(row.provider_bill_id);
      if (purchase.status !== 'paid' && !chipTerminalFailure(purchase.status)) {
        unchanged += 1;
        continue;
      }
      const result = await settleChipTopUpPurchase(row.provider_bill_id, purchase, { eventSource });
      if (result.credited) credited += 1;
      else if (result.needs_review) needsReview += 1;
      else if (result.terminal) terminal += 1;
      else unchanged += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Unknown reconciliation error';
      console.error(`FAIL ${row.provider_bill_id} - ${message}`);
    }
  }

  console.log(JSON.stringify({ scanned: rows.length, released, credited, terminal, needs_review: needsReview, unchanged, failed }));
  if (failed > 0) process.exitCode = 1;
}

void main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown reconciliation error';
    console.error(`FATAL ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mysqlPool.end();
  });
