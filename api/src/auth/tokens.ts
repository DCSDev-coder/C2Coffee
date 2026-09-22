import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const tokenIssuer = 'c2coffee-api';
const customerTokenAudience = 'c2coffee-customer-api';

export interface AccessTokenPayload {
  userId: number;
  sessionId: number;
  accessTokenVersion: number;
}

export async function signAccessToken(
  payload: AccessTokenPayload
): Promise<string> {
  return jwt.sign(
    {
      sid: payload.sessionId,
      av: payload.accessTokenVersion
    },
    env.ACCESS_TOKEN_SECRET,
    {
      algorithm: 'HS256',
      subject: String(payload.userId),
      issuer: tokenIssuer,
      audience: customerTokenAudience,
      expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`
    }
  );
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET, {
    algorithms: ['HS256'],
    issuer: tokenIssuer,
    audience: customerTokenAudience
  }) as jwt.JwtPayload & {
    sid?: unknown;
    av?: unknown;
  };

  const userId = Number(payload.sub);
  const sessionId = Number(payload.sid);
  const accessTokenVersion = Number(payload.av);

  if (
    !Number.isInteger(userId) ||
    !Number.isInteger(sessionId) ||
    !Number.isInteger(accessTokenVersion)
  ) {
    throw new Error('Malformed access token payload.');
  }

  return { userId, sessionId, accessTokenVersion };
}
