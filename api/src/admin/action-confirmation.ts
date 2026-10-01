import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { ApiError } from '../http/errors.js';
import { verifyPassword } from '../lib/password.js';

/** Verify the acting administrator inside the same transaction as the mutation. */
export async function requireAdminActionConfirmation(
  connection: PoolConnection,
  adminUserId: number,
  confirmationPassword: string
): Promise<void> {
  const [rows] = await connection.query<Array<RowDataPacket & { password_hash: string | null }>>(
    `SELECT password_hash FROM admin_users WHERE id = :adminUserId LIMIT 1 FOR UPDATE`,
    { adminUserId }
  );
  const admin = rows[0];
  if (!admin?.password_hash || !(await verifyPassword(confirmationPassword, admin.password_hash))) {
    throw new ApiError(401, 'admin_action_confirmation_failed', 'Current password confirmation is incorrect.');
  }
}
