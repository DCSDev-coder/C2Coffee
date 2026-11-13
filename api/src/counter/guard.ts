import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';
import { env } from '../config/env.js';
import { hashSha256 } from '../lib/crypto.js';
import { ApiError } from '../http/errors.js';
import { verifyAdminAccessToken } from '../admin/tokens.js';
import { getUtcConnection } from '../db/mysql.js';
import { resolveBaristaShiftAccess } from '../services/barista-shift-access.js';

export interface CounterAuthContext {
  deviceId: number;
  tenantId: number;
  tenantCode: string;
  storeId: number;
  label: string;
}

export interface CounterOrderContext {
  priceChannel: 'counter' | 'barista';
  adminUserId: number | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    counterAuth: CounterAuthContext;
    counterOrderContext: CounterOrderContext;
  }
}

export async function authenticateCounterDevice(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'missing_counter_device_token', 'Counter device authentication is required.');
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new ApiError(401, 'invalid_counter_device_token', 'Counter device authentication is invalid.');
  }

  const [rows] = await mysqlPool.query<Array<RowDataPacket & CounterAuthContext>>(
    `SELECT cd.id AS deviceId, cd.tenant_id AS tenantId, tenant.code AS tenantCode,
            cd.store_id AS storeId, cd.label
     FROM counter_devices cd
     JOIN admin_tenants tenant ON tenant.id = cd.tenant_id AND tenant.status = 'active' AND tenant.code = :tenantCode
     JOIN stores store ON store.id = cd.store_id AND store.tenant_id = cd.tenant_id AND store.status = 'active'
     WHERE cd.token_hash = :tokenHash AND cd.status = 'active'
     LIMIT 1`,
    { tokenHash: hashSha256(token), tenantCode: env.DEPLOYMENT_TENANT_CODE }
  );

  const device = rows[0];
  if (!device) {
    throw new ApiError(401, 'invalid_counter_device_token', 'Counter device authentication is invalid.');
  }

  request.counterAuth = device;
  try {
    await mysqlPool.execute(
      'UPDATE counter_devices SET last_seen_at = UTC_TIMESTAMP() WHERE id = :deviceId',
      { deviceId: device.deviceId }
    );
  } catch (error) {
    request.log.warn({ error, deviceId: device.deviceId }, 'counter device heartbeat update failed');
  }
}

export async function authenticateCounterOrderContext(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const header = request.headers['x-barista-access-token'];
  const token = (Array.isArray(header) ? header[0] : header)?.trim();
  if (!token) {
    request.counterOrderContext = { priceChannel: 'counter', adminUserId: null };
    return;
  }

  let payload: Awaited<ReturnType<typeof verifyAdminAccessToken>>;
  try {
    payload = await verifyAdminAccessToken(token);
  } catch {
    throw new ApiError(401, 'invalid_barista_order_token', 'The barista order-entry session has expired. Reopen Take Order.');
  }

  const connection = await getUtcConnection();
  try {
    const [rows] = await connection.query<Array<RowDataPacket & {
      tenant_id: number;
      access_token_version: number;
      status: string;
      role_code: string;
    }>>(
      `SELECT s.tenant_id, s.access_token_version, u.status, ar.code AS role_code
         FROM admin_sessions s
         JOIN admin_users u ON u.id = s.admin_user_id AND u.tenant_id = s.tenant_id
         JOIN admin_user_roles aur ON aur.admin_user_id = u.id
         JOIN admin_roles ar ON ar.id = aur.admin_role_id
        WHERE s.id = :sessionId AND s.admin_user_id = :adminUserId
          AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()`,
      { sessionId: payload.sessionId, adminUserId: payload.adminUserId }
    );
    const session = rows[0];
    const allowedRole = rows.some((row) => ['barista', 'operations_admin', 'super_admin'].includes(row.role_code));
    if (!session || session.status !== 'active' ||
        session.access_token_version !== payload.accessTokenVersion ||
        Number(session.tenant_id) !== request.counterAuth.tenantId || !allowedRole) {
      throw new ApiError(403, 'barista_order_forbidden', 'This staff session cannot take orders for this outlet.');
    }
    const access = await resolveBaristaShiftAccess(connection, {
      tenantId: request.counterAuth.tenantId,
      tenantCode: request.counterAuth.tenantCode,
      storeId: request.counterAuth.storeId
    });
    if (!access.can_prepare_orders) {
      throw new ApiError(409, 'barista_order_locked', access.message);
    }
    request.counterOrderContext = {
      priceChannel: 'barista',
      adminUserId: payload.adminUserId
    };
  } finally {
    connection.release();
  }
}
