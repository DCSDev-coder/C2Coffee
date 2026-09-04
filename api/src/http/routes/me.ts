import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import sharp from 'sharp';
import { z } from 'zod';
import { authenticateRequest } from '../../auth/guard.js';
import { env } from '../../config/env.js';
import { mysqlPool } from '../../db/mysql.js';
import { saveMediaAsset } from '../../lib/media-assets.js';
import { generateOtpCode, hashSha256, otpMatches } from '../../lib/crypto.js';
import { ApiError } from '../errors.js';
import { ensureSignupIdentityAvailable } from '../services/signup-identity.js';
import { sendOtpEmail, sendSupportTicketEmail } from '../../services/otp-email.js';

const profileUpsertSchema = z.object({
  display_name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  birthday: z.string().trim().optional().or(z.literal('')),
  gender: z.string().trim().max(50).optional().or(z.literal('')),
  house_line: z.string().trim().max(255).optional().or(z.literal('')),
  street_line: z.string().trim().max(255).optional().or(z.literal('')),
  postcode: z.string().trim().max(20).optional().or(z.literal('')),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  state: z.string().trim().max(120).optional().or(z.literal('')),
  avatar_type: z.enum(['preset', 'uploaded']).optional(),
  avatar_value: z.string().trim().max(512).optional().or(z.literal(''))
});

const avatarUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  data_url: z.string().trim().min(1)
});

const accountClosureSchema = z.object({
  reason: z.string().trim().min(5).max(500),
  confirm: z.literal(true)
});

const supportAttachmentSchema = z.object({
  file_name: z.string().trim().min(1).max(120),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  data_url: z.string().trim().min(1)
});

const supportTicketSchema = z.object({
  category: z.string().trim().min(1).max(80),
  order_reference: z.string().trim().max(80).optional().or(z.literal('')),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000),
  attachments: z.array(supportAttachmentSchema).max(3).optional().default([])
});

const requestEmailChangeSchema = z.object({
  email: z.string().trim().email().max(255)
});

const confirmEmailChangeSchema = z.object({
  request_id: z.string().uuid(),
  otp_code: z.string().trim().regex(/^\d{6}$/)
});

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/me', { preHandler: authenticateRequest }, async (request) => {
    return {
      user: await getUserResponse(request.auth.userId)
    };
  });

  app.put('/v1/me/profile', { preHandler: authenticateRequest }, async (request) => {
    const payload = profileUpsertSchema.parse(request.body);
    const normalizedEmail = nullableString(payload.email);

    const [currentRows] = await mysqlPool.query<
      Array<RowDataPacket & { email: string | null }>
    >(
      `SELECT email FROM user_profiles WHERE user_id = :userId LIMIT 1`,
      { userId: request.auth.userId }
    );
    const currentEmail = nullableString(currentRows[0]?.email);
    if ((normalizedEmail || '') !== (currentEmail || '')) {
      throw new ApiError(
        409,
        'email_change_verification_required',
        'Confirm the verification code sent to the new email address before changing it.'
      );
    }

    await ensureSignupIdentityAvailable({
      email: normalizedEmail,
      excludeUserId: request.auth.userId
    });

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
          state,
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
          :state,
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
          state = VALUES(state),
          avatar_type = VALUES(avatar_type),
          avatar_value = VALUES(avatar_value),
          updated_at = UTC_TIMESTAMP()
      `,
      {
        userId: request.auth.userId,
        displayName: payload.display_name,
        email: normalizedEmail,
        birthday: nullableString(payload.birthday),
        gender: nullableString(payload.gender),
        houseLine: nullableString(payload.house_line),
        streetLine: nullableString(payload.street_line),
        postcode: nullableString(payload.postcode),
        city: nullableString(payload.city),
        state: nullableString(payload.state),
        avatarType: payload.avatar_type ?? 'preset',
        avatarValue: nullableString(payload.avatar_value)
      }
    );

    return {
      user: await getUserResponse(request.auth.userId)
    };
  });

  app.post('/v1/me/avatar', { preHandler: authenticateRequest, bodyLimit: 7 * 1024 * 1024 }, async (request) => {
    const payload = avatarUploadSchema.parse(request.body);
    const base64Payload = payload.data_url.includes('base64,')
      ? payload.data_url.split('base64,').pop() || ''
      : payload.data_url;
    const content = Buffer.from(base64Payload, 'base64');

    if (content.length === 0 || content.length > 5 * 1024 * 1024) {
      throw new ApiError(400, 'invalid_avatar_upload', 'Avatar image must be between 1 byte and 5 MB.');
    }

    let optimizedContent: Buffer;
    try {
      optimizedContent = await sharp(content, { limitInputPixels: 16_000_000 })
        .rotate()
        .resize({ width: 512, height: 512, fit: 'cover', position: 'attention' })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch {
      throw new ApiError(400, 'invalid_avatar_upload', 'Please upload a valid PNG, JPEG, or WebP image.');
    }

    const assetPath = `/assets/avatars/customer-${request.auth.userId}.webp`;

    await saveMediaAsset({
      assetPath,
      fileName: `${payload.file_name.replace(/\.[^.]+$/, '') || 'avatar'}.webp`,
      mimeType: 'image/webp',
      content: optimizedContent
    });

    await mysqlPool.execute(
      `
        UPDATE user_profiles
        SET avatar_type = 'uploaded',
            avatar_value = :assetPath,
            updated_at = UTC_TIMESTAMP()
        WHERE user_id = :userId
      `,
      { assetPath, userId: request.auth.userId }
    );

    return { user: await getUserResponse(request.auth.userId) };
  });

  app.post('/v1/me/support-tickets', { preHandler: authenticateRequest, bodyLimit: 12 * 1024 * 1024 }, async (request) => {
    const payload = supportTicketSchema.parse(request.body);
    const [users] = await mysqlPool.query<
      Array<RowDataPacket & { display_name: string | null; email: string | null; phone_e164: string }>
    >(
      `
        SELECT up.display_name, up.email, u.phone_e164
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE u.id = :userId
        LIMIT 1
      `,
      { userId: request.auth.userId }
    );
    const customer = users[0];
    if (!customer) {
      throw new ApiError(404, 'user_not_found', 'User account was not found.');
    }

    const ticketNumber = `C2-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const orderReference = nullableString(payload.order_reference);
    if (['Billing & Payment Claims', 'Order & Store Pickup Issue'].includes(payload.category) && !orderReference) {
      throw new ApiError(400, 'order_reference_required', 'An order reference is required for this type of inquiry.');
    }
    if (orderReference) {
      const [orders] = await mysqlPool.execute<Array<RowDataPacket & { id: number }>>(
        `SELECT id FROM orders WHERE order_ref = :orderReference AND user_id = :userId LIMIT 1`,
        { orderReference, userId: request.auth.userId }
      );
      if (!orders[0]) {
        throw new ApiError(400, 'invalid_order_reference', 'Enter an order reference from your own order history.');
      }
    }

    let uploadedBytes = 0;
    const storedAttachments: Array<{
      asset_path: string;
      file_name: string;
      mime_type: string;
      size_bytes: number;
    }> = [];
    const emailAttachments: Array<{ fileName: string; mimeType: string; content: Buffer }> = [];

    for (const attachment of payload.attachments) {
      const match = /^data:[^;]+;base64,([A-Za-z0-9+/=]+)$/.exec(attachment.data_url);
      if (!match) {
        throw new ApiError(400, 'invalid_support_attachment', 'Each attachment must be a valid image or video file.');
      }
      const source = Buffer.from(match[1], 'base64') as Buffer<ArrayBuffer>;
      if (source.length === 0 || source.length > 5 * 1024 * 1024) {
        throw new ApiError(400, 'invalid_support_attachment', 'Each attachment must be between 1 byte and 5 MB.');
      }
      uploadedBytes += source.length;
      if (uploadedBytes > 8 * 1024 * 1024) {
        throw new ApiError(400, 'support_attachments_too_large', 'Attachments must not exceed 8 MB in total.');
      }

      let content = source;
      let mimeType = attachment.mime_type;
      let fileName = attachment.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (mimeType.startsWith('image/')) {
        try {
          content = (await sharp(source, { limitInputPixels: 16_000_000 })
            .rotate()
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82, effort: 4 })
            .toBuffer()) as Buffer<ArrayBuffer>;
        } catch {
          throw new ApiError(400, 'invalid_support_attachment', 'Please upload a valid PNG, JPEG, or WebP image.');
        }
        mimeType = 'image/webp';
        fileName = `${fileName.replace(/\.[^.]+$/, '') || 'evidence'}.webp`;
      }

      const extension = mimeType === 'image/webp'
        ? 'webp'
        : mimeType === 'video/quicktime'
          ? 'mov'
          : 'mp4';
      const assetPath = `/assets/support/${ticketNumber}/${crypto.randomUUID()}.${extension}`;
      await saveMediaAsset({ assetPath, fileName, mimeType, content });
      storedAttachments.push({
        asset_path: assetPath,
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: content.length
      });
      emailAttachments.push({ fileName, mimeType, content });
    }

    const [insert] = await mysqlPool.execute<ResultSetHeader>(
      `
        INSERT INTO customer_support_tickets (
          ticket_number, user_id, category, order_reference, subject, message, attachments_json, email_delivery_status
        ) VALUES (
          :ticketNumber, :userId, :category, :orderReference, :subject, :message, :attachmentsJson, 'pending'
        )
      `,
      {
        ticketNumber,
        userId: request.auth.userId,
        category: payload.category,
        orderReference,
        subject: payload.subject,
        message: payload.message,
        attachmentsJson: storedAttachments.length > 0 ? JSON.stringify(storedAttachments) : null
      }
    );

    let emailDelivered = false;
    try {
      await sendSupportTicketEmail({
        ticketNumber,
        customerName: customer.display_name || 'C2 Member',
        customerEmail: customer.email,
        customerPhone: customer.phone_e164,
        category: payload.category,
        orderReference,
        subject: payload.subject,
        message: payload.message,
        attachments: emailAttachments
      });
      emailDelivered = true;
    } catch (error) {
      request.log.error({ err: error, ticketNumber }, 'Failed to forward support ticket email.');
    }

    await mysqlPool.execute(
      `UPDATE customer_support_tickets SET email_delivery_status = :status WHERE id = :id`,
      { status: emailDelivered ? 'sent' : 'failed', id: insert.insertId }
    );

    return {
      ticket_number: ticketNumber,
      email_delivered: emailDelivered,
      message: emailDelivered
        ? 'Your request has been received by C2 Support.'
        : 'Your request has been recorded. C2 Support will review it shortly.'
    };
  });

  app.post('/v1/me/email-change/request', { preHandler: authenticateRequest }, async (request) => {
    const payload = requestEmailChangeSchema.parse(request.body);
    const newEmail = payload.email.trim().toLowerCase();
    const [users] = await mysqlPool.query<Array<RowDataPacket & { email: string | null }>>(
      `SELECT email FROM user_profiles WHERE user_id = :userId LIMIT 1`,
      { userId: request.auth.userId }
    );
    const currentEmail = nullableString(users[0]?.email)?.toLowerCase();
    if (currentEmail === newEmail) {
      throw new ApiError(409, 'email_change_not_needed', 'That is already your current email address.');
    }

    await ensureSignupIdentityAvailable({ email: newEmail, excludeUserId: request.auth.userId });

    const requestId = crypto.randomUUID();
    const otpCode = generateOtpCode();
    await mysqlPool.execute(
      `UPDATE customer_email_change_otps SET status = 'cancelled' WHERE user_id = :userId AND status = 'pending'`,
      { userId: request.auth.userId }
    );
    await mysqlPool.execute(
      `
        INSERT INTO customer_email_change_otps (
          request_id, user_id, new_email, otp_hash, expires_at, requested_at
        ) VALUES (
          :requestId, :userId, :newEmail, :otpHash,
          DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE), UTC_TIMESTAMP()
        )
      `,
      { requestId, userId: request.auth.userId, newEmail, otpHash: hashSha256(otpCode) }
    );

    try {
      if (env.OTP_DELIVERY_MODE === 'email') {
        await sendOtpEmail({
          to: newEmail,
          otpCode,
          subject: 'Confirm your new C2 Coffee email address',
          heading: 'Your C2 Coffee email-change code is:'
        });
      } else if (env.OTP_DELIVERY_MODE === 'log') {
        request.log.warn({ requestId, newEmail, otpCode }, 'Email-change OTP generated in log delivery mode.');
      }
    } catch {
      await mysqlPool.execute(
        `UPDATE customer_email_change_otps SET status = 'cancelled' WHERE request_id = :requestId`,
        { requestId }
      );
      throw new ApiError(503, 'email_change_delivery_failed', 'We could not send the verification code right now. Please try again shortly.');
    }

    return {
      request_id: requestId,
      expires_in_seconds: 600,
      ...(env.NODE_ENV !== 'production' || env.OTP_DEBUG_EXPOSE_CODE ? { debug_otp_code: otpCode } : {})
    };
  });

  app.post('/v1/me/email-change/confirm', { preHandler: authenticateRequest }, async (request) => {
    const payload = confirmEmailChangeSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<Array<RowDataPacket & {
        id: number; new_email: string; otp_hash: string; expires_at: Date; attempts_used: number; max_attempts: number; status: string;
      }>>(
        `
          SELECT id, new_email, otp_hash, expires_at, attempts_used, max_attempts, status
          FROM customer_email_change_otps
          WHERE request_id = :requestId AND user_id = :userId
          LIMIT 1 FOR UPDATE
        `,
        { requestId: payload.request_id, userId: request.auth.userId }
      );
      const change = rows[0];
      if (!change || change.status !== 'pending') {
        throw new ApiError(401, 'email_change_request_invalid', 'Email-change request is no longer valid.');
      }
      if (new Date(change.expires_at).getTime() <= Date.now()) {
        await connection.execute(`UPDATE customer_email_change_otps SET status = 'expired' WHERE id = :id`, { id: change.id });
        throw new ApiError(401, 'email_change_code_expired', 'This verification code has expired. Request a new code.');
      }
      if (change.attempts_used >= change.max_attempts) {
        await connection.execute(`UPDATE customer_email_change_otps SET status = 'blocked' WHERE id = :id`, { id: change.id });
        throw new ApiError(429, 'email_change_code_blocked', 'Too many incorrect attempts. Request a new code.');
      }
      if (!otpMatches(payload.otp_code, change.otp_hash)) {
        const attempts = change.attempts_used + 1;
        await connection.execute(
          `UPDATE customer_email_change_otps SET attempts_used = :attempts, status = CASE WHEN :attempts >= max_attempts THEN 'blocked' ELSE status END WHERE id = :id`,
          { attempts, id: change.id }
        );
        throw new ApiError(401, 'invalid_email_change_code', 'Verification code is incorrect.');
      }

      await ensureSignupIdentityAvailable({ email: change.new_email, excludeUserId: request.auth.userId });
      await connection.execute(
        `UPDATE user_profiles SET email = :email, updated_at = UTC_TIMESTAMP() WHERE user_id = :userId`,
        { email: change.new_email, userId: request.auth.userId }
      );
      await connection.execute(
        `UPDATE customer_email_change_otps SET status = 'consumed', consumed_at = UTC_TIMESTAMP() WHERE id = :id`,
        { id: change.id }
      );
      await connection.commit();
      return { user: await getUserResponse(request.auth.userId) };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
  state?: string | null;
  avatar_type?: 'preset' | 'uploaded';
  avatar_value?: string | null;
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
        state: string | null;
        avatar_type: 'preset' | 'uploaded' | null;
        avatar_value: string | null;
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
        , up.state
        , up.avatar_type
        , up.avatar_value
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
    address: addressParts.length > 0 ? addressParts.join(', ') : null,
    state: user.state,
    avatar_type: user.avatar_type ?? 'preset',
    avatar_value: user.avatar_value
  };
}

function nullableString(value?: string | null): string | null {
  if (!value) return null;
  return value.trim().length > 0 ? value.trim() : null;
}
