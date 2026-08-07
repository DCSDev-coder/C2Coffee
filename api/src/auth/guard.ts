import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2';
import { mysqlPool } from '../db/mysql.js';
import { ApiError } from '../http/errors.js';
import { verifyAccessToken } from './tokens.js';

export interface AuthContext {
  userId: number;
  sessionId: number;
  accessTokenVersion: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export async function authenticateRequest(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'missing_bearer_token', 'Missing Bearer token.');
  }

  const token = authorization.slice('Bearer '.length).trim();

  let payload: AuthContext;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new ApiError(401, 'invalid_access_token', 'Access token is invalid or expired.');
  }

  const [rows] = await mysqlPool.query<
    Array<RowDataPacket & {
      id: number;
      user_id: number;
      access_token_version: number;
      status: string;
    }>
  >(
    `
      SELECT
        s.id,
        s.user_id,
        s.access_token_version,
        u.status
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = :sessionId
        AND s.user_id = :userId
        AND s.revoked_at IS NULL
        AND s.expires_at > UTC_TIMESTAMP()
      LIMIT 1
    `,
    {
      sessionId: payload.sessionId,
      userId: payload.userId
    }
  );

  const session = rows[0];
  if (!session) {
    throw new ApiError(401, 'session_not_found', 'Session is invalid or expired.');
  }

  if (session.access_token_version !== payload.accessTokenVersion) {
    throw new ApiError(401, 'session_version_mismatch', 'Session is no longer valid.');
  }

  if (session.status !== 'active') {
    throw new ApiError(403, 'user_not_active', 'User account is not active.');
  }

  request.auth = payload;
}
