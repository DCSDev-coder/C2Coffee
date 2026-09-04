import type { FastifyInstance } from 'fastify';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { signAdminAccessToken } from '../../admin/tokens.js';
import { env } from '../../config/env.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { generateOpaqueToken, generateOtpCode, hashSha256, otpMatches } from '../../lib/crypto.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { sendOtpEmail } from '../../services/otp-email.js';

const adminLoginSchema = z.object({
  tenant_code: z.string().trim().min(1).max(80),
  identifier: z.string().trim().min(1).max(255),
  password: z.string().trim().min(8).max(200)
});

const adminSetupSchema = z.object({
  email: z.string().trim().email().max(255),
  new_password: z.string().trim().min(8).max(200),
  confirm_password: z.string().trim().min(8).max(200)
});

const adminCreateSchema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().trim().min(8).max(200),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  full_name: z.string().trim().min(1).max(255).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  role_codes: z.array(z.string().trim().min(1).max(50)).min(1).optional(),
  confirmation_password: z.string().trim().min(8).max(200)
});

const adminUpdateSchema = z.object({
  username: z.string().trim().min(3).max(80).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  full_name: z.string().trim().min(1).max(255).optional().or(z.literal('')),
  password: z.string().trim().min(8).max(200).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  role_codes: z.array(z.string().trim().min(1).max(50)).min(1).optional(),
  confirmation_password: z.string().trim().min(8).max(200)
});

const adminDeactivateSchema = z.object({
  confirmation_password: z.string().trim().min(8).max(200)
});

function toStoredAdminStatus(status: 'active' | 'inactive'): 'active' | 'deactivated' {
  return status === 'inactive' ? 'deactivated' : 'active';
}

function toAdminResponseStatus(status: string): string {
  return status === 'deactivated' ? 'inactive' : status;
}

type AdminLifecycleSnapshot = {
  username: string;
  email: string | null;
  full_name: string;
  status: string;
  role_codes: string[];
};

async function requireAdminActionConfirmation(
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

async function requireAnotherActiveSuperAdmin(
  connection: PoolConnection,
  tenantId: number,
  excludedAdminUserId: number
): Promise<void> {
  const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(
    `SELECT u.id
     FROM admin_users u
     JOIN admin_user_roles aur ON aur.admin_user_id = u.id
     JOIN admin_roles ar ON ar.id = aur.admin_role_id
     WHERE u.tenant_id = :tenantId
       AND u.status = 'active'
       AND ar.code = 'super_admin'
       AND u.id <> :excludedAdminUserId
     FOR UPDATE`,
    { tenantId, excludedAdminUserId }
  );
  if (rows.length === 0) {
    throw new ApiError(409, 'last_super_admin', 'At least one active Super Admin must remain.');
  }
}

async function writeAdminLifecycleAudit(
  connection: PoolConnection,
  request: {
    adminAuth: { adminUserId: number; roles: string[] };
    ip: string;
    headers: { 'user-agent'?: string | string[] | undefined };
  },
  actionCode: string,
  targetId: number,
  before: AdminLifecycleSnapshot | null,
  after: AdminLifecycleSnapshot | null
): Promise<void> {
  await connection.execute(
    `INSERT INTO admin_audit_logs (
       admin_user_id, effective_roles_json, action_code, target_type, target_id,
       before_json, after_json, ip_address, user_agent, created_at
     ) VALUES (
       :adminUserId, :roles, :actionCode, 'admin_user', :targetId,
       :beforeJson, :afterJson, :ipAddress, :userAgent, UTC_TIMESTAMP()
     )`,
    {
      adminUserId: request.adminAuth.adminUserId,
      roles: JSON.stringify(request.adminAuth.roles),
      actionCode,
      targetId,
      beforeJson: before ? JSON.stringify(before) : null,
      afterJson: after ? JSON.stringify(after) : null,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null
    }
  );
}

const adminRefreshSchema = z.object({
  refresh_token: z.string().trim().min(32)
});

const requestPasswordChangeSchema = z.object({
  current_password: z.string().min(8).max(200),
  new_password: z.string().min(8).max(200),
  confirm_password: z.string().min(8).max(200)
});

const confirmPasswordChangeSchema = z.object({
  request_id: z.string().uuid(),
  otp_code: z.string().trim().regex(/^\d{6}$/)
});

export async function registerAdminAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/tenants', async () => {
    const [rows] = await mysqlPool.query<
      Array<
        RowDataPacket & {
          code: string;
          name: string;
          display_name: string;
          logo_asset_path: string | null;
          primary_color: string | null;
          secondary_color: string | null;
        }
      >
    >(
      `
        SELECT
          code,
          name,
          display_name,
          logo_asset_path,
          primary_color,
          secondary_color
        FROM admin_tenants
        WHERE status = 'active'
        ORDER BY display_name ASC
      `
    );

    return {
      tenants: rows.map((tenant) => ({
        code: tenant.code,
        name: tenant.name,
        display_name: tenant.display_name,
        logo_asset_path: tenant.logo_asset_path,
        primary_color: tenant.primary_color,
        secondary_color: tenant.secondary_color
      }))
    };
  });

  app.post('/v1/admin/auth/login', async (request) => {
    const payload = adminLoginSchema.parse(request.body);

    const [rows] = await mysqlPool.query<
      Array<
        RowDataPacket & {
          id: number;
          tenant_id: number;
          username: string;
          email: string | null;
          full_name: string;
          password_hash: string | null;
          status: string;
          must_change_password: number;
          must_set_email: number;
          tenant_code: string;
          tenant_name: string;
          tenant_display_name: string;
        }
      >
    >(
      `
        SELECT
          u.id,
          u.tenant_id,
          u.username,
          u.email,
          u.full_name,
          u.password_hash,
          u.status,
          u.must_change_password,
          u.must_set_email,
          t.code AS tenant_code,
          t.name AS tenant_name,
          t.display_name AS tenant_display_name
        FROM admin_users u
        JOIN admin_tenants t ON t.id = u.tenant_id
        WHERE t.code = :tenantCode
          AND (u.username = :identifier OR u.email = :identifier)
        LIMIT 1
      `,
      {
        tenantCode: payload.tenant_code,
        identifier: payload.identifier
      }
    );

    const admin = rows[0];
    if (!admin || !admin.password_hash) {
      throw new ApiError(401, 'invalid_admin_credentials', 'Admin username or password is incorrect.');
    }

    const passwordMatches = await verifyPassword(payload.password, admin.password_hash);
    if (!passwordMatches) {
      throw new ApiError(401, 'invalid_admin_credentials', 'Admin username or password is incorrect.');
    }

    if (!['active', 'invited'].includes(admin.status)) {
      throw new ApiError(403, 'admin_not_active', 'Admin account is not active.');
    }

    const session = await createAdminSession(admin.id, admin.tenant_id);

    await mysqlPool.execute(
      `
        UPDATE admin_users
        SET last_login_at = UTC_TIMESTAMP(),
            updated_at = UTC_TIMESTAMP()
        WHERE id = :adminUserId
      `,
      { adminUserId: admin.id }
    );

    const user = await getAdminUserResponse(admin.id);
    const isBaristaAccount =
      user.roles.length === 1 && user.roles[0] === 'barista';

    return {
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      setup_required:
        !isBaristaAccount &&
        (admin.must_change_password === 1 ||
          admin.must_set_email === 1 ||
          !admin.email),
      tenant: {
        code: admin.tenant_code,
        name: admin.tenant_name,
        display_name: admin.tenant_display_name
      },
      user,
      session: session.responseSession
    };
  });

  app.post('/v1/admin/auth/refresh', async (request) => {
    const payload = adminRefreshSchema.parse(request.body);
    const refreshTokenHash = hashSha256(payload.refresh_token);

    const [rows] = await mysqlPool.query<
      Array<
        RowDataPacket & {
          id: number;
          admin_user_id: number;
          tenant_id: number;
          access_token_version: number;
          status: string;
        }
      >
    >(
      `
        SELECT
          s.id,
          s.admin_user_id,
          s.tenant_id,
          s.access_token_version,
          u.status
        FROM admin_sessions s
        JOIN admin_users u ON u.id = s.admin_user_id
        WHERE s.refresh_token_hash = :refreshTokenHash
          AND s.revoked_at IS NULL
          AND s.expires_at > UTC_TIMESTAMP()
        LIMIT 1
      `,
      { refreshTokenHash }
    );

    const session = rows[0];
    if (!session || !['active', 'invited'].includes(session.status)) {
      throw new ApiError(401, 'invalid_refresh_token', 'Your sign-in session has expired. Please sign in again.');
    }

    const nextRefreshToken = generateOpaqueToken();
    const nextRefreshTokenHash = hashSha256(nextRefreshToken);

    await mysqlPool.execute(
      `
        UPDATE admin_sessions
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

    const accessToken = await signAdminAccessToken({
      adminUserId: session.admin_user_id,
      sessionId: session.id,
      accessTokenVersion: session.access_token_version
    });

    return {
      access_token: accessToken,
      refresh_token: nextRefreshToken,
      user: await getAdminUserResponse(session.admin_user_id)
    };
  });

  app.post('/v1/admin/auth/complete-setup', { preHandler: authenticateAdminRequest }, async (request) => {
    const payload = adminSetupSchema.parse(request.body);

    if (payload.new_password !== payload.confirm_password) {
      throw new ApiError(400, 'password_mismatch', 'New password confirmation does not match.');
    }

    const nextPasswordHash = await hashPassword(payload.new_password);

    await mysqlPool.execute(
      `
        UPDATE admin_users
        SET email = :email,
            password_hash = :passwordHash,
            must_change_password = 0,
            must_set_email = 0,
            status = 'active',
            activated_at = COALESCE(activated_at, UTC_TIMESTAMP()),
            updated_at = UTC_TIMESTAMP()
        WHERE id = :adminUserId
      `,
      {
        email: payload.email,
        passwordHash: nextPasswordHash,
        adminUserId: request.adminAuth.adminUserId
      }
    );

    return {
      user: await getAdminUserResponse(request.adminAuth.adminUserId),
      setup_required: false
    };
  });

  app.post('/v1/admin/auth/logout', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    await mysqlPool.execute(
      `
        UPDATE admin_sessions
        SET revoked_at = UTC_TIMESTAMP(),
            revoke_reason = 'logout_current_device'
        WHERE id = :sessionId
          AND revoked_at IS NULL
      `,
      { sessionId: request.adminAuth.sessionId }
    );

    return reply.status(204).send();
  });

  app.post('/v1/admin/auth/password-change/request', { preHandler: authenticateAdminRequest }, async (request) => {
    const payload = requestPasswordChangeSchema.parse(request.body);
    if (payload.new_password !== payload.confirm_password) {
      throw new ApiError(400, 'password_mismatch', 'New password confirmation does not match.');
    }
    if (payload.current_password === payload.new_password) {
      throw new ApiError(400, 'password_reused', 'Choose a new password that is different from your current password.');
    }

    const [rows] = await mysqlPool.query<Array<RowDataPacket & { email: string | null; password_hash: string | null }>>(
      `SELECT email, password_hash FROM admin_users WHERE id = :adminUserId LIMIT 1`,
      { adminUserId: request.adminAuth.adminUserId }
    );
    const admin = rows[0];
    if (!admin?.email) {
      throw new ApiError(409, 'admin_email_required', 'Add a valid admin email address before changing the password.');
    }
    if (!admin.password_hash || !(await verifyPassword(payload.current_password, admin.password_hash))) {
      throw new ApiError(401, 'invalid_current_password', 'Current password is incorrect.');
    }

    const requestId = crypto.randomUUID();
    const otpCode = generateOtpCode();
    await mysqlPool.execute(
      `UPDATE admin_password_change_otps SET status = 'cancelled' WHERE admin_user_id = :adminUserId AND status = 'pending'`,
      { adminUserId: request.adminAuth.adminUserId }
    );
    await mysqlPool.execute(
      `
        INSERT INTO admin_password_change_otps (
          request_id, admin_user_id, otp_hash, new_password_hash, expires_at, requested_at
        ) VALUES (
          :requestId, :adminUserId, :otpHash, :newPasswordHash,
          DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE), UTC_TIMESTAMP()
        )
      `,
      {
        requestId,
        adminUserId: request.adminAuth.adminUserId,
        otpHash: hashSha256(otpCode),
        newPasswordHash: await hashPassword(payload.new_password)
      }
    );

    try {
      await sendOtpEmail({
        to: admin.email,
        otpCode,
        subject: 'Confirm your C2 Coffee Admin password change',
        heading: 'Your C2 Coffee Admin password-change code is:'
      });
    } catch {
      await mysqlPool.execute(
        `UPDATE admin_password_change_otps SET status = 'cancelled' WHERE request_id = :requestId`,
        { requestId }
      );
      throw new ApiError(503, 'password_change_email_failed', 'We could not send the verification code. Please try again shortly.');
    }

    return { request_id: requestId, expires_in_seconds: 600 };
  });

  app.post('/v1/admin/auth/password-change/confirm', { preHandler: authenticateAdminRequest }, async (request) => {
    const payload = confirmPasswordChangeSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<Array<RowDataPacket & {
        id: number; otp_hash: string; new_password_hash: string; expires_at: Date; attempts_used: number; max_attempts: number; status: string;
      }>>(
        `
          SELECT id, otp_hash, new_password_hash, expires_at, attempts_used, max_attempts, status
          FROM admin_password_change_otps
          WHERE request_id = :requestId AND admin_user_id = :adminUserId
          LIMIT 1 FOR UPDATE
        `,
        { requestId: payload.request_id, adminUserId: request.adminAuth.adminUserId }
      );
      const change = rows[0];
      if (!change || change.status !== 'pending') {
        throw new ApiError(401, 'password_change_request_invalid', 'Password-change request is no longer valid.');
      }
      if (new Date(change.expires_at).getTime() <= Date.now()) {
        await connection.execute(`UPDATE admin_password_change_otps SET status = 'expired' WHERE id = :id`, { id: change.id });
        throw new ApiError(401, 'password_change_code_expired', 'This verification code has expired. Request a new code.');
      }
      if (change.attempts_used >= change.max_attempts) {
        await connection.execute(`UPDATE admin_password_change_otps SET status = 'blocked' WHERE id = :id`, { id: change.id });
        throw new ApiError(429, 'password_change_code_blocked', 'Too many incorrect attempts. Request a new code.');
      }
      if (!otpMatches(payload.otp_code, change.otp_hash)) {
        const attempts = change.attempts_used + 1;
        await connection.execute(
          `UPDATE admin_password_change_otps SET attempts_used = :attempts, status = CASE WHEN :attempts >= max_attempts THEN 'blocked' ELSE status END WHERE id = :id`,
          { attempts, id: change.id }
        );
        throw new ApiError(401, 'invalid_password_change_code', 'Verification code is incorrect.');
      }

      await connection.execute(
        `UPDATE admin_users SET password_hash = :passwordHash, must_change_password = 0, updated_at = UTC_TIMESTAMP() WHERE id = :adminUserId`,
        { passwordHash: change.new_password_hash, adminUserId: request.adminAuth.adminUserId }
      );
      await connection.execute(
        `UPDATE admin_password_change_otps SET status = 'consumed', consumed_at = UTC_TIMESTAMP() WHERE id = :id`,
        { id: change.id }
      );
      await connection.execute(
        `UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP(), revoke_reason = 'password_changed' WHERE admin_user_id = :adminUserId AND revoked_at IS NULL`,
        { adminUserId: request.adminAuth.adminUserId }
      );
      await connection.execute(
        `INSERT INTO admin_audit_logs (admin_user_id, effective_roles_json, action_code, target_type, target_id, ip_address, user_agent, created_at) VALUES (:adminUserId, :roles, 'password_changed', 'admin_user', :adminUserId, :ipAddress, :userAgent, UTC_TIMESTAMP())`,
        {
          adminUserId: request.adminAuth.adminUserId,
          roles: JSON.stringify(request.adminAuth.roles),
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null
        }
      );
      await connection.commit();
      return { password_changed: true, reauthentication_required: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/auth/me', { preHandler: authenticateAdminRequest }, async (request) => {
    return {
      tenant: {
        id: request.adminAuth.tenantId,
        code: request.adminAuth.tenantCode,
        name: request.adminAuth.tenantName,
        display_name: request.adminAuth.tenantDisplayName
      },
      user: await getAdminUserResponse(request.adminAuth.adminUserId)
    };
  });

  app.post('/v1/admin/users', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');

    const payload = adminCreateSchema.parse(request.body);
    const normalizedFullName = payload.full_name?.trim() || payload.username;
    const passwordHash = await hashPassword(payload.password);
    const roleCodes = Array.from(
      new Set((payload.role_codes?.length ? payload.role_codes : ['support_admin']).map((role) => role.trim()))
    );
    const isBaristaAccount = roleCodes.length === 1 && roleCodes[0] === 'barista';
    const setupRequired = !isBaristaAccount && !payload.email;

    const connection = await mysqlPool.getConnection();
    await connection.query("SET time_zone = '+00:00'");

    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);

      if (isBaristaAccount) {
        const [existingBaristaAccounts] = await connection.query<RowDataPacket[]>(
          `SELECT u.id
           FROM admin_users u
           JOIN admin_user_roles ur ON ur.admin_user_id = u.id
           JOIN admin_roles r ON r.id = ur.admin_role_id
           WHERE u.tenant_id = :tenantId
             AND r.code = 'barista'
           LIMIT 1`,
          { tenantId: request.adminAuth.tenantId }
        );

        if (existingBaristaAccounts.length > 0) {
          throw new ApiError(
            409,
            'barista_account_exists',
            'This tenant already has a Barista App account. Update that shared account instead.'
          );
        }
      }

      const [insertResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO admin_users (
            tenant_id,
            username,
            email,
            full_name,
            password_hash,
            status,
            must_change_password,
            must_set_email,
            invited_at,
            activated_at,
            created_at,
            updated_at
          )
          VALUES (
            :tenantId,
            :username,
            :email,
            :fullName,
            :passwordHash,
            :status,
            :mustChangePassword,
            :mustSetEmail,
            UTC_TIMESTAMP(),
            NULL,
            UTC_TIMESTAMP(),
            UTC_TIMESTAMP()
          )
        `,
        {
          tenantId: request.adminAuth.tenantId,
          username: payload.username,
          email: nullableString(payload.email),
          fullName: normalizedFullName,
          passwordHash,
          status: toStoredAdminStatus(payload.status),
          mustChangePassword: isBaristaAccount ? 0 : 1,
          mustSetEmail: setupRequired ? 1 : 0
        }
      );

      const adminUserId = insertResult.insertId;

      const [roleRows] = await connection.query<Array<RowDataPacket & { id: number; code: string }>>(
        `
          SELECT id, code
          FROM admin_roles
        `
      );

      const foundRoleCodes = new Set(roleRows.map((role) => role.code));
      const missingRoleCodes = roleCodes.filter((role) => !foundRoleCodes.has(role));
      if (missingRoleCodes.length > 0) {
        throw new ApiError(400, 'invalid_admin_role', `Unknown admin role(s): ${missingRoleCodes.join(', ')}.`);
      }

      for (const role of roleRows.filter((row) => roleCodes.includes(row.code))) {
        await connection.execute(
          `
            INSERT INTO admin_user_roles (
              admin_user_id,
              admin_role_id,
              assigned_by_admin_id,
              assigned_at
            )
            VALUES (
              :adminUserId,
              :adminRoleId,
              :assignedByAdminId,
              UTC_TIMESTAMP()
            )
            ON DUPLICATE KEY UPDATE
              assigned_by_admin_id = VALUES(assigned_by_admin_id),
              assigned_at = VALUES(assigned_at)
          `,
          {
            adminUserId,
            adminRoleId: role.id,
            assignedByAdminId: request.adminAuth.adminUserId
          }
        );
      }

      await writeAdminLifecycleAudit(
        connection,
        request,
        'admin_user_created',
        adminUserId,
        null,
        {
          username: payload.username,
          email: nullableString(payload.email),
          full_name: normalizedFullName,
          status: toStoredAdminStatus(payload.status),
          role_codes: roleCodes
        }
      );

      await connection.commit();

      return {
        user: await getAdminUserResponse(adminUserId),
        setup_required: setupRequired
      };
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'admin_conflict', 'Admin username or email already exists for this tenant.');
      }
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/admin/users', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');

    const [rows] = await mysqlPool.query<
      Array<
        RowDataPacket & {
          id: number;
          username: string;
          email: string | null;
          full_name: string;
          status: string;
          last_login_at: Date | null;
          roles: string | null;
        }
      >
    >(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          u.full_name,
          u.status,
          u.last_login_at,
          GROUP_CONCAT(ar.code SEPARATOR ',') as roles
        FROM admin_users u
        LEFT JOIN admin_user_roles aur ON aur.admin_user_id = u.id
        LEFT JOIN admin_roles ar ON ar.id = aur.admin_role_id
        WHERE u.tenant_id = :tenantId
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `,
      { tenantId: request.adminAuth.tenantId }
    );

    return {
      users: rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        full_name: row.full_name,
        status: toAdminResponseStatus(row.status),
        last_login_at: row.last_login_at ? row.last_login_at.toISOString() : null,
        roles: row.roles ? row.roles.split(',') : []
      }))
    };
  });

  app.put('/v1/admin/users/:id', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');
    
    const params = request.params as { id: string };
    const adminUserId = parseInt(params.id, 10);
    if (isNaN(adminUserId)) throw new ApiError(400, 'invalid_id', 'Invalid admin user ID.');

    const payload = adminUpdateSchema.parse(request.body);
    
    const connection = await mysqlPool.getConnection();
    await connection.query("SET time_zone = '+00:00'");

    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);

      const [existingRows] = await connection.query<Array<RowDataPacket & {
        id: number;
        username: string;
        email: string | null;
        full_name: string;
        status: string;
      }>>(
        `SELECT id, username, email, full_name, status
         FROM admin_users
         WHERE id = :adminUserId AND tenant_id = :tenantId
         LIMIT 1
         FOR UPDATE`,
        { adminUserId, tenantId: request.adminAuth.tenantId }
      );
      const existing = existingRows[0];
      if (!existing) {
        throw new ApiError(404, 'admin_not_found', 'Admin account was not found.');
      }

      const [existingRoleRows] = await connection.query<Array<RowDataPacket & { code: string }>>(
        `SELECT ar.code
         FROM admin_user_roles aur
         JOIN admin_roles ar ON ar.id = aur.admin_role_id
         WHERE aur.admin_user_id = :adminUserId
         FOR UPDATE`,
        { adminUserId }
      );
      const existingRoleCodes = existingRoleRows.map((row) => row.code);
      const nextRoleCodes = payload.role_codes
        ? Array.from(new Set(payload.role_codes.map((role) => role.trim())))
        : existingRoleCodes;
      const nextStatus = payload.status === undefined
        ? existing.status
        : toStoredAdminStatus(payload.status);
      const removesActiveSuperAdmin =
        existing.status === 'active' &&
        existingRoleCodes.includes('super_admin') &&
        (nextStatus !== 'active' || !nextRoleCodes.includes('super_admin'));

      if (removesActiveSuperAdmin) {
        await requireAnotherActiveSuperAdmin(connection, request.adminAuth.tenantId, adminUserId);
      }
      
      const updates: string[] = [];
      const queryParams: Record<string, any> = { adminUserId };

      if (payload.username !== undefined) {
        updates.push('username = :username');
        queryParams.username = payload.username;
      }
      if (payload.email !== undefined) {
        updates.push('email = :email');
        queryParams.email = nullableString(payload.email);
      }
      if (payload.full_name !== undefined) {
        updates.push('full_name = :fullName');
        queryParams.fullName = payload.full_name.trim() || payload.username || '';
      }
      if (payload.status !== undefined) {
        updates.push('status = :status');
        queryParams.status = toStoredAdminStatus(payload.status);
      }
      if (payload.password !== undefined) {
        updates.push('password_hash = :passwordHash');
        queryParams.passwordHash = await hashPassword(payload.password);
      }

      if (updates.length > 0) {
        updates.push('updated_at = UTC_TIMESTAMP()');
        await connection.execute(
          `UPDATE admin_users SET ${updates.join(', ')} WHERE id = :adminUserId`,
          queryParams
        );
      }

      if (payload.role_codes) {
        const roleCodes = nextRoleCodes;
        
        const [roleRows] = await connection.query<Array<RowDataPacket & { id: number; code: string }>>(
          `SELECT id, code FROM admin_roles`
        );
        
        const foundRoleCodes = new Set(roleRows.map((r) => r.code));
        const missingRoleCodes = roleCodes.filter((r) => !foundRoleCodes.has(r));
        if (missingRoleCodes.length > 0) {
          throw new ApiError(400, 'invalid_admin_role', `Unknown admin role(s): ${missingRoleCodes.join(', ')}.`);
        }

        // Delete existing roles
        await connection.execute('DELETE FROM admin_user_roles WHERE admin_user_id = :adminUserId', { adminUserId });

        // Insert new roles
        for (const role of roleRows.filter((row) => roleCodes.includes(row.code))) {
          await connection.execute(
            `
              INSERT INTO admin_user_roles (admin_user_id, admin_role_id, assigned_by_admin_id, assigned_at)
              VALUES (:adminUserId, :adminRoleId, :assignedByAdminId, UTC_TIMESTAMP())
            `,
            {
              adminUserId,
              adminRoleId: role.id,
              assignedByAdminId: request.adminAuth.adminUserId
            }
          );
        }
      }

      if (payload.password !== undefined) {
        await connection.execute(
          `UPDATE admin_sessions
           SET revoked_at = UTC_TIMESTAMP(), revoke_reason = 'password_changed_by_admin'
           WHERE admin_user_id = :adminUserId AND revoked_at IS NULL`,
          { adminUserId }
        );
      }

      await writeAdminLifecycleAudit(
        connection,
        request,
        'admin_user_updated',
        adminUserId,
        {
          username: existing.username,
          email: existing.email,
          full_name: existing.full_name,
          status: existing.status,
          role_codes: existingRoleCodes
        },
        {
          username: payload.username ?? existing.username,
          email: payload.email === undefined ? existing.email : nullableString(payload.email),
          full_name: payload.full_name === undefined
            ? existing.full_name
            : payload.full_name.trim() || payload.username || existing.username,
          status: nextStatus,
          role_codes: nextRoleCodes
        }
      );

      await connection.commit();
      return { user: await getAdminUserResponse(adminUserId) };
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'admin_conflict', 'Admin username or email already exists for this tenant.');
      }
      throw error;
    } finally {
      connection.release();
    }
  });

  app.delete('/v1/admin/users/:id', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');

    const params = request.params as { id: string };
    const adminUserId = parseInt(params.id, 10);
    if (isNaN(adminUserId)) throw new ApiError(400, 'invalid_id', 'Invalid admin user ID.');
    const payload = adminDeactivateSchema.parse(request.body);

    if (adminUserId === request.adminAuth.adminUserId) {
      throw new ApiError(400, 'invalid_action', 'You cannot deactivate your own account.');
    }

    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);

      const [existingRows] = await connection.query<Array<RowDataPacket & {
        id: number;
        username: string;
        email: string | null;
        full_name: string;
        status: string;
      }>>(
        `SELECT id, username, email, full_name, status
         FROM admin_users
         WHERE id = :adminUserId AND tenant_id = :tenantId
         LIMIT 1
         FOR UPDATE`,
        { adminUserId, tenantId: request.adminAuth.tenantId }
      );
      const existing = existingRows[0];
      if (!existing) {
        throw new ApiError(404, 'admin_not_found', 'Admin account was not found.');
      }

      const [roleRows] = await connection.query<Array<RowDataPacket & { code: string }>>(
        `SELECT ar.code
         FROM admin_user_roles aur
         JOIN admin_roles ar ON ar.id = aur.admin_role_id
         WHERE aur.admin_user_id = :adminUserId
         FOR UPDATE`,
        { adminUserId }
      );
      const roleCodes = roleRows.map((row) => row.code);
      if (existing.status === 'active' && roleCodes.includes('super_admin')) {
        await requireAnotherActiveSuperAdmin(connection, request.adminAuth.tenantId, adminUserId);
      }

      await connection.execute(
        `UPDATE admin_users
         SET status = 'deactivated', updated_at = UTC_TIMESTAMP()
         WHERE id = :adminUserId`,
        { adminUserId }
      );
      await connection.execute(
        `UPDATE admin_sessions
         SET revoked_at = UTC_TIMESTAMP(), revoke_reason = 'admin_deactivated'
         WHERE admin_user_id = :adminUserId AND revoked_at IS NULL`,
        { adminUserId }
      );
      await writeAdminLifecycleAudit(
        connection,
        request,
        'admin_user_deactivated',
        adminUserId,
        {
          username: existing.username,
          email: existing.email,
          full_name: existing.full_name,
          status: existing.status,
          role_codes: roleCodes
        },
        {
          username: existing.username,
          email: existing.email,
          full_name: existing.full_name,
          status: 'deactivated',
          role_codes: roleCodes
        }
      );
      await connection.commit();
      return { success: true, deactivated: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}

async function createAdminSession(
  adminUserId: number,
  tenantId: number
): Promise<{
  accessToken: string;
  refreshToken: string;
  responseSession: { session_id: number; expires_at_days: number };
}> {
  const refreshToken = generateOpaqueToken();
  const refreshTokenHash = hashSha256(refreshToken);

  const [sessionInsert] = await mysqlPool.execute<ResultSetHeader>(
    `
      INSERT INTO admin_sessions (
        admin_user_id,
        tenant_id,
        refresh_token_hash,
        access_token_version,
        issued_at,
        expires_at
      )
      VALUES (
        :adminUserId,
        :tenantId,
        :refreshTokenHash,
        1,
        UTC_TIMESTAMP(),
        DATE_ADD(UTC_TIMESTAMP(), INTERVAL :refreshDays DAY)
      )
    `,
    {
      adminUserId,
      tenantId,
      refreshTokenHash,
      refreshDays: env.REFRESH_TOKEN_TTL_DAYS
    }
  );

  const accessToken = await signAdminAccessToken({
    adminUserId,
    sessionId: sessionInsert.insertId,
    accessTokenVersion: 1
  });

  return {
    accessToken,
    refreshToken,
    responseSession: {
      session_id: sessionInsert.insertId,
      expires_at_days: env.REFRESH_TOKEN_TTL_DAYS
    }
  };
}

async function getAdminUserResponse(adminUserId: number): Promise<{
  id: number;
  tenant_id: number;
  tenant_code: string;
  tenant_name: string;
  tenant_display_name: string;
  username: string;
  email: string | null;
  full_name: string;
  status: string;
  last_login_at: string | null;
  must_change_password: boolean;
  must_set_email: boolean;
  roles: string[];
}> {
  const [rows] = await mysqlPool.query<
    Array<
      RowDataPacket & {
        id: number;
        tenant_id: number;
        tenant_code: string;
        tenant_name: string;
        tenant_display_name: string;
        username: string;
        email: string | null;
        full_name: string;
        status: string;
        last_login_at: Date | null;
        must_change_password: number;
        must_set_email: number;
      }
    >
  >(
    `
      SELECT
        u.id,
        u.tenant_id,
        t.code AS tenant_code,
        t.name AS tenant_name,
        t.display_name AS tenant_display_name,
        u.username,
        u.email,
        u.full_name,
        u.status,
        u.last_login_at,
        u.must_change_password,
        u.must_set_email
      FROM admin_users u
      JOIN admin_tenants t ON t.id = u.tenant_id
      WHERE u.id = :adminUserId
      LIMIT 1
    `,
    { adminUserId }
  );

  const admin = rows[0];
  if (!admin) {
    throw new ApiError(404, 'admin_not_found', 'Admin account was not found.');
  }

  const [roleRows] = await mysqlPool.query<Array<RowDataPacket & { code: string }>>(
    `
      SELECT ar.code
      FROM admin_user_roles aur
      JOIN admin_roles ar ON ar.id = aur.admin_role_id
      WHERE aur.admin_user_id = :adminUserId
      ORDER BY ar.code ASC
    `,
    { adminUserId }
  );

  return {
    id: admin.id,
    tenant_id: admin.tenant_id,
    tenant_code: admin.tenant_code,
    tenant_name: admin.tenant_name,
    tenant_display_name: admin.tenant_display_name,
    username: admin.username,
    email: admin.email,
    full_name: admin.full_name,
    status: toAdminResponseStatus(admin.status),
    last_login_at: admin.last_login_at ? admin.last_login_at.toISOString() : null,
    must_change_password: admin.must_change_password === 1,
    must_set_email: admin.must_set_email === 1 || !admin.email,
    roles: roleRows.map((role) => role.code)
  };
}

function nullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
