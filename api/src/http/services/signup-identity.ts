import type { PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

export async function ensureSignupIdentityAvailable({
  phone,
  email,
  excludeUserId,
  connection = mysqlPool
}: {
  phone?: string | null;
  email?: string | null;
  excludeUserId?: number;
  connection?: PoolConnection | typeof mysqlPool;
}): Promise<void> {
  const normalizedPhone = phone?.trim() || null;
  const normalizedEmail = email?.trim().toLowerCase() || null;

  const [rows] = await connection.query<
    Array<
      RowDataPacket & {
        phone_conflict: number;
        email_conflict: number;
      }
    >
  >(
    `
      SELECT
        MAX(CASE WHEN :phone IS NOT NULL AND u.phone_e164 = :phone THEN 1 ELSE 0 END) AS phone_conflict,
        MAX(CASE WHEN :email IS NOT NULL AND up.email = :email THEN 1 ELSE 0 END) AS email_conflict
      FROM user_profiles up
      JOIN users u ON u.id = up.user_id
      WHERE u.deleted_at IS NULL
        AND (:excludeUserId IS NULL OR up.user_id <> :excludeUserId)
        AND ((:phone IS NOT NULL AND u.phone_e164 = :phone) OR (:email IS NOT NULL AND up.email = :email))
    `,
    {
      phone: normalizedPhone,
      email: normalizedEmail,
      excludeUserId: excludeUserId ?? null
    }
  );

  const row = rows[0];
  const phoneTaken = Number(row?.phone_conflict ?? 0) > 0;
  const emailTaken = Number(row?.email_conflict ?? 0) > 0;

  if (phoneTaken && emailTaken) {
    throw new ApiError(
      409,
      'signup_phone_email_conflict',
      'That phone number and email are already in use. Please choose different details.'
    );
  }

  if (phoneTaken) {
    throw new ApiError(
      409,
      'signup_phone_taken',
      'That phone number is already in use. Please choose another one.'
    );
  }

  if (emailTaken) {
    throw new ApiError(
      409,
      'signup_email_taken',
      'That email address is already in use. Please choose another one.'
    );
  }
}
