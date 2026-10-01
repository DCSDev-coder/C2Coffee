import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';

type NotificationExecutor = PoolConnection | typeof mysqlPool;

export type CreateUserNotificationInput = {
  userId: number;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  deliveryKey?: string | null;
  readAt?: Date | null;
};

export async function createUserNotification(
  connection: NotificationExecutor,
  input: CreateUserNotificationInput
): Promise<number> {
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO notifications (
          user_id,
          type,
          title,
          body,
          data_json,
          delivery_key,
          sent_at,
          read_at,
          created_at
        )
        VALUES (
          :userId,
          :type,
          :title,
          :body,
          :dataJson,
          :deliveryKey,
          UTC_TIMESTAMP(),
          :readAt,
          UTC_TIMESTAMP()
        )
        ON DUPLICATE KEY UPDATE id = id
      `,
      {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        dataJson: input.data ? JSON.stringify(input.data) : null,
        deliveryKey: input.deliveryKey ?? null,
        readAt: input.readAt ?? null
      }
    );

    return result.insertId;
  } catch (error) {
    const err = error as { code?: string; sqlMessage?: string };
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn(
        `[notifications] skipped notification insert because the table is missing: ${err.sqlMessage ?? 'unknown SQL error'}`
      );
      return 0;
    }

    throw error;
  }
}
