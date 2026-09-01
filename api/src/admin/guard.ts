import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2';
import { mysqlPool } from '../db/mysql.js';
import { ApiError } from '../http/errors.js';
import { verifyAdminAccessToken } from './tokens.js';

export interface AdminAuthContext {
  adminUserId: number;
  tenantId: number;
  tenantCode: string;
  tenantName: string;
  tenantDisplayName: string;
  sessionId: number;
  accessTokenVersion: number;
  username: string;
  email: string | null;
  fullName: string;
  status: string;
  roles: string[];
  mustChangePassword: boolean;
  mustSetEmail: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    adminAuth: AdminAuthContext;
  }
}

export async function authenticateAdminRequest(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'missing_bearer_token', 'Your admin session is missing. Please sign in again.');
  }

  const token = authorization.slice('Bearer '.length).trim();

  let payload: Awaited<ReturnType<typeof verifyAdminAccessToken>>;
  try {
    payload = await verifyAdminAccessToken(token);
  } catch {
    throw new ApiError(401, 'invalid_access_token', 'Your admin session has expired. Please sign in again.');
  }

  const [rows] = await mysqlPool.query<
    Array<
      RowDataPacket & {
        id: number;
        tenant_id: number;
        username: string;
        email: string | null;
        full_name: string;
        status: string;
        tenant_code: string;
        tenant_name: string;
        tenant_display_name: string;
        access_token_version: number;
        must_change_password: number;
        must_set_email: number;
      }
    >
  >(
    `
      SELECT
        s.id,
        s.tenant_id,
        s.access_token_version,
        u.username,
        u.email,
        u.full_name,
        u.status,
        t.code AS tenant_code,
        t.name AS tenant_name,
        t.display_name AS tenant_display_name,
        u.must_change_password,
        u.must_set_email
      FROM admin_sessions s
      JOIN admin_users u ON u.id = s.admin_user_id
      JOIN admin_tenants t ON t.id = s.tenant_id
      WHERE s.id = :sessionId
        AND s.admin_user_id = :adminUserId
        AND s.revoked_at IS NULL
        AND s.expires_at > UTC_TIMESTAMP()
      LIMIT 1
    `,
    {
      sessionId: payload.sessionId,
      adminUserId: payload.adminUserId
    }
  );

  const session = rows[0];
  if (!session) {
    throw new ApiError(401, 'session_not_found', 'Your admin session is no longer available. Please sign in again.');
  }

  if (session.access_token_version !== payload.accessTokenVersion) {
    throw new ApiError(401, 'session_version_mismatch', 'Your admin session has been refreshed elsewhere. Please sign in again.');
  }

  if (!['active', 'invited'].includes(session.status)) {
    throw new ApiError(403, 'admin_not_active', 'Admin account is not active.');
  }

  const [roleRows] = await mysqlPool.query<Array<RowDataPacket & { code: string }>>(
    `
      SELECT ar.code
      FROM admin_user_roles aur
      JOIN admin_roles ar ON ar.id = aur.admin_role_id
      WHERE aur.admin_user_id = :adminUserId
      ORDER BY ar.code ASC
    `,
    { adminUserId: payload.adminUserId }
  );

  request.adminAuth = {
    adminUserId: payload.adminUserId,
    tenantId: session.tenant_id,
    tenantCode: session.tenant_code,
    tenantName: session.tenant_name,
    tenantDisplayName: session.tenant_display_name,
    sessionId: payload.sessionId,
    accessTokenVersion: payload.accessTokenVersion,
    username: session.username,
    email: session.email,
    fullName: session.full_name,
    status: session.status,
    roles: roleRows.map((role) => role.code),
    mustChangePassword: session.must_change_password === 1,
    mustSetEmail: session.must_set_email === 1 || !session.email
  };

  enforceBaristaRouteAccess(request);
}

function enforceBaristaRouteAccess(request: FastifyRequest): void {
  const roles = request.adminAuth.roles;
  const hasBroaderAdminRole = roles.some((role) => role !== 'barista');
  if (!roles.includes('barista') || hasBroaderAdminRole) {
    return;
  }

  const path = request.url.split('?')[0];
  const canReadOrders = request.method === 'GET' && path === '/v1/admin/orders';
  const canReadBaristaRoster = request.method === 'GET' && path === '/v1/admin/baristas';
  const canUpdateOrderStatus =
    request.method === 'PATCH' &&
    /^\/v1\/admin\/orders\/[^/]+\/status$/.test(path);
  const canUseOwnSession =
    (request.method === 'GET' && path === '/v1/admin/auth/me') ||
    (request.method === 'POST' && path === '/v1/admin/auth/logout');

  if (!canReadOrders && !canReadBaristaRoster && !canUpdateOrderStatus && !canUseOwnSession) {
    throw new ApiError(
      403,
      'barista_route_forbidden',
      'Barista accounts can only select staff and view or update orders.'
    );
  }
}

export function requireAdminRole(request: FastifyRequest, roleCode: string): void {
  if (!request.adminAuth?.roles.includes(roleCode)) {
    throw new ApiError(403, 'admin_forbidden', 'You do not have permission to perform this action.');
  }
}
