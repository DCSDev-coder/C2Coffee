import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AdminAccessTokenPayload {
  adminUserId: number;
  sessionId: number;
  accessTokenVersion: number;
}

export async function signAdminAccessToken(
  payload: AdminAccessTokenPayload
): Promise<string> {
  return jwt.sign(
    {
      sid: payload.sessionId,
      av: payload.accessTokenVersion
    },
    env.ACCESS_TOKEN_SECRET,
    {
      algorithm: 'HS256',
      subject: String(payload.adminUserId),
      expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`
    }
  );
}

export async function verifyAdminAccessToken(
  token: string
): Promise<AdminAccessTokenPayload> {
  const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET, {
    algorithms: ['HS256']
  }) as jwt.JwtPayload & {
    sid?: unknown;
    av?: unknown;
  };

  const adminUserId = Number(payload.sub);
  const sessionId = Number(payload.sid);
  const accessTokenVersion = Number(payload.av);

  if (
    !Number.isInteger(adminUserId) ||
    !Number.isInteger(sessionId) ||
    !Number.isInteger(accessTokenVersion)
  ) {
    throw new Error('Malformed admin access token payload.');
  }

  return { adminUserId, sessionId, accessTokenVersion };
}
