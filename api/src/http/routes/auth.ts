import type { FastifyInstance } from 'fastify';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { generateOpaqueToken, generateOtpCode, hashSha256, otpMatches } from '../../lib/crypto.js';
import { normalizePhoneE164 } from '../../lib/phone.js';
import { signAccessToken } from '../../auth/tokens.js';
import { authenticateRequest } from '../../auth/guard.js';

const requestOtpSchema = z.object({
  phone: z.string().min(1),
  device_fingerprint: z.string().trim().min(8).max(255),
  preferred_channel: z.enum(['whatsapp', 'sms'])
});

const verifyOtpSchema = z.object({
  request_id: z.string().trim().min(1),
  phone: z.string().min(1),
  otp_code: z.string().trim().regex(/^\d{6}$/),
  device_fingerprint: z.string().trim().min(8).max(255)
});

const refreshSchema = z.object({
  refresh_token: z.string().trim().min(32)
});

interface DeviceRecord {
  id: number;
  user_id: number | null;
}

interface UserProfileSummary {
  id: number;
  phone: string;
  display_name: string;
  status: string;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/auth/request-otp', async (request) => {
    const payload = requestOtpSchema.parse(request.body);
    const phone = normalizePhoneE164(payload.phone);
    const device = await findOrCreateDevice(payload.device_fingerprint);

    const [latestRows] = await mysqlPool.query<Array<RowDataPacket & { requested_at: Date }>>(
      `
        SELECT requested_at
        FROM auth_otps
        WHERE phone_e164 = :phone
        ORDER BY id DESC
        LIMIT 1
      `,
      { phone }
    );

    const latestRequest = latestRows[0];
    if (latestRequest) {
      const elapsedSeconds =
        Math.floor((Date.now() - new Date(latestRequest.requested_at).getTime()) / 1000);
      if (elapsedSeconds < env.OTP_RESEND_SECONDS) {
        throw new ApiError(
          429,
          'otp_cooldown_active',
          `Please wait ${env.OTP_RESEND_SECONDS - elapsedSeconds} seconds before requesting another OTP.`
        );
      }
    }

    await mysqlPool.execute(
      `
        UPDATE auth_otps
        SET status = 'cancelled', consumed_at = UTC_TIMESTAMP()
        WHERE phone_e164 = :phone
          AND status = 'pending'
      `,
      { phone }
    );

    const otpCode = generateOtpCode();
    const [insertResult] = await mysqlPool.execute<ResultSetHeader>(
      `
        INSERT INTO auth_otps (
          phone_e164,
          device_id,
          channel,
          otp_hash,
          expires_at,
          max_attempts,
          requested_at
        )
        VALUES (
          :phone,
          :deviceId,
          :channel,
          :otpHash,
          DATE_ADD(UTC_TIMESTAMP(), INTERVAL :expirySeconds SECOND),
          :maxAttempts,
          UTC_TIMESTAMP()
        )
      `,
      {
        phone,
        deviceId: device.id,
        channel: payload.preferred_channel,
        otpHash: hashSha256(otpCode),
        expirySeconds: env.OTP_EXPIRY_SECONDS,
        maxAttempts: env.OTP_MAX_ATTEMPTS
      }
    );

    await mysqlPool.execute(
      `
        INSERT INTO otp_request_logs (
          phone_e164,
          device_fingerprint,
          channel_requested,
          result_code,
          created_at
        )
        VALUES (
          :phone,
          :deviceFingerprint,
          :channelRequested,
          'accepted',
          UTC_TIMESTAMP()
        )
      `,
      {
        phone,
        deviceFingerprint: payload.device_fingerprint,
        channelRequested: payload.preferred_channel
      }
    );

    if (env.OTP_DELIVERY_MODE === 'log') {
      app.log.warn(
        {
          phone,
          requestId: insertResult.insertId,
          channel: payload.preferred_channel,
          otpCode
        },
        'OTP generated in log delivery mode. No provider dispatch was attempted.'
      );
    }

    const response: Record<string, unknown> = {
      request_id: String(insertResult.insertId),
      channel: payload.preferred_channel,
      expires_in_seconds: env.OTP_EXPIRY_SECONDS,
      resend_in_seconds: env.OTP_RESEND_SECONDS,
      secondary_channel_available: 'sms'
    };

    if (env.NODE_ENV !== 'production' || env.OTP_DEBUG_EXPOSE_CODE) {
      response.debug_otp_code = otpCode;
    }

    return response;
  });

  app.post('/v1/auth/verify-otp', async (request) => {
    const payload = verifyOtpSchema.parse(request.body);
    const requestId = Number(payload.request_id);
    const phone = normalizePhoneE164(payload.phone);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      throw new ApiError(400, 'invalid_request_id', 'OTP request ID is invalid.');
    }

    const connection = await mysqlPool.getConnection();
    let transactionClosed = false;

    try {
      await connection.beginTransaction();

      const device = await findOrCreateDevice(payload.device_fingerprint, connection);

      const [otpRows] = await connection.query<
        Array<
          RowDataPacket & {
            id: number;
            phone_e164: string;
            device_id: number | null;
            otp_hash: string;
            expires_at: Date;
            attempts_used: number;
            max_attempts: number;
            status: string;
          }
        >
      >(
        `
          SELECT *
          FROM auth_otps
          WHERE id = :id
          LIMIT 1
          FOR UPDATE
        `,
        { id: requestId }
      );

      const otpRow = otpRows[0];
      if (!otpRow || otpRow.phone_e164 !== phone) {
        throw new ApiError(401, 'otp_not_found', 'OTP request is invalid.');
      }

      if (otpRow.device_id && otpRow.device_id !== device.id) {
        throw new ApiError(401, 'device_mismatch', 'OTP request does not match this device.');
      }

      if (otpRow.status !== 'pending') {
        throw new ApiError(401, 'otp_not_pending', 'OTP is no longer valid.');
      }

      if (new Date(otpRow.expires_at).getTime() <= Date.now()) {
        await connection.execute(
          `
            UPDATE auth_otps
            SET status = 'expired'
            WHERE id = :id
          `,
          { id: otpRow.id }
        );
        await connection.commit();
        transactionClosed = true;
        throw new ApiError(401, 'otp_expired', 'OTP has expired. Please request a new code.');
      }

      if (!otpMatches(payload.otp_code, otpRow.otp_hash)) {
        const attemptsUsed = otpRow.attempts_used + 1;
        const nextStatus = attemptsUsed >= otpRow.max_attempts ? 'blocked' : 'pending';

        await connection.execute(
          `
            UPDATE auth_otps
            SET attempts_used = :attemptsUsed,
                status = :status
            WHERE id = :id
          `,
          {
            attemptsUsed,
            status: nextStatus,
            id: otpRow.id
          }
        );

        await connection.commit();
        transactionClosed = true;

        throw new ApiError(
          401,
          nextStatus === 'blocked' ? 'otp_blocked' : 'otp_invalid',
          nextStatus === 'blocked'
            ? 'Too many failed OTP attempts. Please request a new code.'
            : 'OTP code is incorrect.'
        );
      }

      await connection.execute(
        `
          UPDATE auth_otps
          SET status = 'verified',
              verified_at = UTC_TIMESTAMP(),
              consumed_at = UTC_TIMESTAMP()
          WHERE id = :id
        `,
        { id: otpRow.id }
      );

      const user = await findOrCreateUserForPhone(phone, device.id, connection);

      if (user.status !== 'active') {
        throw new ApiError(403, 'user_not_active', 'User account is not active.');
      }

      const refreshToken = generateOpaqueToken();
      const refreshTokenHash = hashSha256(refreshToken);
      const [sessionInsert] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO sessions (
            user_id,
            device_id,
            refresh_token_hash,
            access_token_version,
            issued_at,
            expires_at
          )
          VALUES (
            :userId,
            :deviceId,
            :refreshTokenHash,
            1,
            UTC_TIMESTAMP(),
            DATE_ADD(UTC_TIMESTAMP(), INTERVAL :refreshDays DAY)
          )
        `,
        {
          userId: user.id,
          deviceId: device.id,
          refreshTokenHash,
          refreshDays: env.REFRESH_TOKEN_TTL_DAYS
        }
      );

      const accessToken = await signAccessToken({
        userId: user.id,
        sessionId: sessionInsert.insertId,
        accessTokenVersion: 1
      });

      const bootstrap = await getBootstrapForUser(user.id, connection);

      await connection.commit();
      transactionClosed = true;

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          phone: user.phone,
          display_name: user.display_name,
          status: user.status
        },
        bootstrap
      };
    } catch (error) {
      if (!transactionClosed) {
        await connection.rollback();
      }
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/auth/refresh', async (request) => {
    const payload = refreshSchema.parse(request.body);
    const refreshTokenHash = hashSha256(payload.refresh_token);

    const [rows] = await mysqlPool.query<
      Array<
        RowDataPacket & {
          id: number;
          user_id: number;
          access_token_version: number;
          status: string;
        }
      >
    >(
      `
        SELECT
          s.id,
          s.user_id,
          s.access_token_version,
          u.status
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.refresh_token_hash = :refreshTokenHash
          AND s.revoked_at IS NULL
          AND s.expires_at > UTC_TIMESTAMP()
        LIMIT 1
      `,
      { refreshTokenHash }
    );

    const session = rows[0];
    if (!session || session.status !== 'active') {
      throw new ApiError(401, 'invalid_refresh_token', 'Refresh token is invalid or expired.');
    }

    const nextRefreshToken = generateOpaqueToken();
    const nextRefreshTokenHash = hashSha256(nextRefreshToken);

    await mysqlPool.execute(
      `
        UPDATE sessions
        SET refresh_token_hash = :refreshTokenHash,
            issued_at = UTC_TIMESTAMP(),
            expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL :refreshDays DAY)
        WHERE id = :sessionId
      `,
      {
        refreshTokenHash: nextRefreshTokenHash,
        refreshDays: env.REFRESH_TOKEN_TTL_DAYS,
        sessionId: session.id
      }
    );

    const accessToken = await signAccessToken({
      userId: session.user_id,
      sessionId: session.id,
      accessTokenVersion: session.access_token_version
    });

    return {
      access_token: accessToken,
      refresh_token: nextRefreshToken
    };
  });

  app.post('/v1/auth/logout', { preHandler: authenticateRequest }, async (request, reply) => {
    await mysqlPool.execute(
      `
        UPDATE sessions
        SET revoked_at = UTC_TIMESTAMP(),
            revoke_reason = 'logout_current_device'
        WHERE id = :sessionId
          AND revoked_at IS NULL
      `,
      { sessionId: request.auth.sessionId }
    );

    return reply.status(204).send();
  });

  app.post('/v1/auth/logout-all', { preHandler: authenticateRequest }, async (request, reply) => {
    await mysqlPool.execute(
      `
        UPDATE sessions
        SET revoked_at = UTC_TIMESTAMP(),
            revoke_reason = 'logout_all_devices'
        WHERE user_id = :userId
          AND revoked_at IS NULL
      `,
      { userId: request.auth.userId }
    );

    return reply.status(204).send();
  });
}

async function findOrCreateDevice(
  deviceFingerprint: string,
  connection: PoolConnection | typeof mysqlPool = mysqlPool
): Promise<DeviceRecord> {
  const [existingRows] = await connection.query<Array<RowDataPacket & DeviceRecord>>(
    `
      SELECT id, user_id
      FROM devices
      WHERE device_fingerprint = :deviceFingerprint
      ORDER BY id ASC
      LIMIT 1
    `,
    { deviceFingerprint }
  );

  const existing = existingRows[0];
  if (existing) {
    await connection.execute(
      `
        UPDATE devices
        SET last_seen_at = UTC_TIMESTAMP()
        WHERE id = :id
      `,
      { id: existing.id }
    );
    return existing;
  }

  const [insertResult] = await connection.execute<ResultSetHeader>(
    `
      INSERT INTO devices (
        user_id,
        device_fingerprint,
        platform,
        last_seen_at,
        created_at
      )
      VALUES (
        NULL,
        :deviceFingerprint,
        'unknown',
        UTC_TIMESTAMP(),
        UTC_TIMESTAMP()
      )
    `,
    { deviceFingerprint }
  );

  return { id: insertResult.insertId, user_id: null };
}

async function findOrCreateUserForPhone(
  phone: string,
  deviceId: number,
  connection: PoolConnection
): Promise<UserProfileSummary> {
  const [existingRows] = await connection.query<
    Array<
      RowDataPacket & {
        id: number;
        phone_e164: string;
        display_name: string | null;
        status: string;
      }
    >
  >(
    `
      SELECT
        u.id,
        u.phone_e164,
        u.status,
        up.display_name
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.phone_e164 = :phone
      LIMIT 1
      FOR UPDATE
    `,
    { phone }
  );

  const existing = existingRows[0];
  if (existing) {
    await connection.execute(
      `
        UPDATE devices
        SET user_id = :userId,
            last_seen_at = UTC_TIMESTAMP()
        WHERE id = :deviceId
      `,
      {
        userId: existing.id,
        deviceId
      }
    );

    return {
      id: existing.id,
      phone: existing.phone_e164,
      display_name: existing.display_name ?? 'C2 Member',
      status: existing.status
    };
  }

  const [userInsert] = await connection.execute<ResultSetHeader>(
    `
      INSERT INTO users (
        phone_e164,
        status,
        created_at,
        updated_at
      )
      VALUES (
        :phone,
        'active',
        UTC_TIMESTAMP(),
        UTC_TIMESTAMP()
      )
    `,
    { phone }
  );

  await connection.execute(
    `
      INSERT INTO user_profiles (
        user_id,
        display_name,
        avatar_type,
        created_at,
        updated_at
      )
      VALUES (
        :userId,
        'C2 Member',
        'preset',
        UTC_TIMESTAMP(),
        UTC_TIMESTAMP()
      )
    `,
    { userId: userInsert.insertId }
  );

  await connection.execute(
    `
      INSERT INTO token_accounts (
        user_id,
        balance_available,
        balance_reserved,
        balance_cap,
        created_at,
        updated_at
      )
      VALUES (
        :userId,
        0,
        0,
        500,
        UTC_TIMESTAMP(),
        UTC_TIMESTAMP()
      )
    `,
    { userId: userInsert.insertId }
  );

  await connection.execute(
    `
      UPDATE devices
      SET user_id = :userId,
          last_seen_at = UTC_TIMESTAMP()
      WHERE id = :deviceId
    `,
    {
      userId: userInsert.insertId,
      deviceId
    }
  );

  return {
    id: userInsert.insertId,
    phone,
    display_name: 'C2 Member',
    status: 'active'
  };
}

async function getBootstrapForUser(
  userId: number,
  connection: PoolConnection | typeof mysqlPool = mysqlPool
): Promise<{ token_balance: number; tier: string }> {
  const [tokenRows] = await connection.query<
    Array<RowDataPacket & { balance_available: number }>
  >(
    `
      SELECT balance_available
      FROM token_accounts
      WHERE user_id = :userId
      LIMIT 1
    `,
    { userId }
  );

  const [tierRows] = await connection.query<
    Array<RowDataPacket & { tier_code: string }>
  >(
    `
      SELECT tier_code
      FROM loyalty_tier_snapshots
      WHERE user_id = :userId
      ORDER BY effective_at DESC, id DESC
      LIMIT 1
    `,
    { userId }
  );

  return {
    token_balance: tokenRows[0]?.balance_available ?? 0,
    tier: tierRows[0]?.tier_code ?? 'kawan'
  };
}
