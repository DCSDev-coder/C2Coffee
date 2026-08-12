import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateRequest } from '../../auth/guard.js';
import { env } from '../../config/env.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const profileUpsertSchema = z.object({
  display_name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  birthday: z.string().trim().optional().or(z.literal('')),
  gender: z.string().trim().max(50).optional().or(z.literal('')),
  house_line: z.string().trim().max(255).optional().or(z.literal('')),
  street_line: z.string().trim().max(255).optional().or(z.literal('')),
  postcode: z.string().trim().max(20).optional().or(z.literal('')),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  avatar_type: z.enum(['preset', 'uploaded']).optional(),
  avatar_value: z.string().trim().max(512).optional().or(z.literal(''))
});

const accountClosureSchema = z.object({
  reason: z.string().trim().min(5).max(500),
  confirm: z.literal(true)
});

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/me', { preHandler: authenticateRequest }, async (request) => {
    return {
      user: await getUserResponse(request.auth.userId)
    };
  });

  app.put('/v1/me/profile', { preHandler: authenticateRequest }, async (request) => {
    const payload = profileUpsertSchema.parse(request.body);

    await mysqlPool.execute(
      `
        INSERT INTO user_profiles (
          user_id,
          display_name,
          email,
          birthday,
          gender,
          house_line,
          street_line,
          postcode,
          city,
          avatar_type,
          avatar_value,
          created_at,
          updated_at
        )
        VALUES (
          :userId,
          :displayName,
          :email,
          :birthday,
          :gender,
          :houseLine,
          :streetLine,
          :postcode,
          :city,
          :avatarType,
          :avatarValue,
          UTC_TIMESTAMP(),
          UTC_TIMESTAMP()
        )
        ON DUPLICATE KEY UPDATE
          display_name = VALUES(display_name),
          email = VALUES(email),
          birthday = VALUES(birthday),
          gender = VALUES(gender),
          house_line = VALUES(house_line),
          street_line = VALUES(street_line),
          postcode = VALUES(postcode),
          city = VALUES(city),
          avatar_type = VALUES(avatar_type),
          avatar_value = VALUES(avatar_value),
          updated_at = UTC_TIMESTAMP()
      `,
      {
        userId: request.auth.userId,
        displayName: payload.display_name,
        email: nullableString(payload.email),
        birthday: nullableString(payload.birthday),
        gender: nullableString(payload.gender),
        houseLine: nullableString(payload.house_line),
        streetLine: nullableString(payload.street_line),
        postcode: nullableString(payload.postcode),
        city: nullableString(payload.city),
        avatarType: payload.avatar_type ?? 'preset',
        avatarValue: nullableString(payload.avatar_value)
      }
    );

    return {
      user: await getUserResponse(request.auth.userId)
    };
  });

  app.post('/v1/me/account-closure', { preHandler: authenticateRequest }, async (request) => {
    const payload = accountClosureSchema.parse(request.body);

    const [userRows] = await mysqlPool.query<Array<RowDataPacket & { status: string }>>(
      `
        SELECT status
        FROM users
        WHERE id = :userId
        LIMIT 1
      `,
      { userId: request.auth.userId }
    );

    const user = userRows[0];
    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User account was not found.');
    }

    if (user.status !== 'active') {
      throw new ApiError(409, 'account_not_closable', 'User account is not in an active state.');
    }

    await mysqlPool.execute(
      `
        UPDATE users
        SET status = 'deletion_requested',
            deletion_requested_at = UTC_TIMESTAMP(),
            closed_at = UTC_TIMESTAMP(),
            retention_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL :retentionYears YEAR),
            updated_at = UTC_TIMESTAMP()
        WHERE id = :userId
      `,
      {
        userId: request.auth.userId,
        retentionYears: env.ACCOUNT_RETENTION_YEARS
      }
    );

    await mysqlPool.execute(
      `
        UPDATE sessions
        SET revoked_at = UTC_TIMESTAMP(),
            revoke_reason = 'account_closure'
        WHERE user_id = :userId
          AND revoked_at IS NULL
      `,
      { userId: request.auth.userId }
    );

    const [retentionRows] = await mysqlPool.query<
      Array<RowDataPacket & { retention_until: Date }>
    >(
      `
        SELECT retention_until
        FROM users
        WHERE id = :userId
        LIMIT 1
      `,
      { userId: request.auth.userId }
    );

    return {
      status: 'deletion_requested',
      reason: payload.reason,
      retention_until: retentionRows[0]?.retention_until?.toISOString() ?? null,
      message:
        'Account closure requested. Required financial and audit records will be retained until the retention date.'
    };
  });
}

export async function getUserResponse(userId: number): Promise<{
  id: number;
  phone: string;
  display_name: string;
  status: string;
  email?: string | null;
  birthday?: string | null;
  gender?: string | null;
  address?: string | null;
}> {
  const [rows] = await mysqlPool.query<
    Array<
      RowDataPacket & {
        id: number;
        phone_e164: string;
        status: string;
        display_name: string | null;
        email: string | null;
        birthday: string | null;
        gender: string | null;
        house_line: string | null;
        street_line: string | null;
        postcode: string | null;
        city: string | null;
      }
    >
  >(
    `
      SELECT
        u.id,
        u.phone_e164,
        u.status,
        up.display_name,
        up.email,
        DATE_FORMAT(up.birthday, '%Y-%m-%d') AS birthday,
        up.gender,
        up.house_line,
        up.street_line,
        up.postcode,
        up.city
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = :userId
      LIMIT 1
    `,
    { userId }
  );

  const user = rows[0];
  if (!user) {
    throw new ApiError(404, 'user_not_found', 'User account was not found.');
  }

  const addressParts = [
    user.house_line,
    user.street_line,
    user.postcode ? `${user.postcode}${user.city ? ` ${user.city}` : ''}` : user.city
  ].filter(Boolean);

  return {
    id: user.id,
    phone: user.phone_e164,
    display_name: user.display_name ?? 'C2 Member',
    status: user.status,
    email: user.email,
    birthday: user.birthday,
    gender: user.gender,
    address: addressParts.length > 0 ? addressParts.join(', ') : null
  };
}

function nullableString(value?: string): string | null {
  if (!value) return null;
  return value.trim().length > 0 ? value.trim() : null;
}
