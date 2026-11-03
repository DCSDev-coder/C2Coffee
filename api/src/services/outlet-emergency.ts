import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';

type Executor = PoolConnection | typeof mysqlPool;

export async function autoReopenEmergencyClosures(
  executor: Executor,
  storeId?: number
): Promise<number> {
  const [due] = await executor.query<RowDataPacket[]>(
    `SELECT id, store_id
       FROM outlet_emergency_closures
      WHERE status = 'active'
        AND expected_reopen_at IS NOT NULL
        AND expected_reopen_at <= UTC_TIMESTAMP()
        AND (:storeId IS NULL OR store_id = :storeId)
      FOR UPDATE`,
    { storeId: storeId ?? null }
  );
  for (const closure of due) {
    await executor.execute(
      `UPDATE outlet_emergency_closures
          SET status = 'auto_reopened', reopened_at = UTC_TIMESTAMP()
        WHERE id = :closureId AND status = 'active'`,
      { closureId: closure.id }
    );
    await executor.execute(
      `UPDATE stores SET temporarily_closed = 0, updated_at = UTC_TIMESTAMP()
        WHERE id = :storeId`,
      { storeId: closure.store_id }
    );
  }
  return due.length;
}
