import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateCounterDevice } from '../../counter/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { generateOpaqueToken, hashSha256 } from '../../lib/crypto.js';
import { normalizePhoneE164 } from '../../lib/phone.js';
import { ApiError } from '../errors.js';
import { getBootstrapForUser } from './auth.js';

const lookupCustomerSchema = z.object({
  phone: z.string().trim().min(1).max(32)
});

type CounterSession = RowDataPacket & {
  id: number;
  user_id: number;
  tenant_id: number;
  counter_device_id: number;
};

function readCustomerSessionToken(request: FastifyRequest): string {
  const value = request.headers['x-counter-customer-session'];
  const token = Array.isArray(value) ? value[0] : value;
  if (!token?.trim()) {
    throw new ApiError(401, 'missing_counter_customer_session', 'Select a customer before continuing.');
  }
  return token.trim();
}

async function requireCounterCustomerSession(request: FastifyRequest): Promise<CounterSession> {
  const [sessions] = await mysqlPool.query<CounterSession[]>(
    `SELECT ccs.id, ccs.user_id, ccs.tenant_id, ccs.counter_device_id
     FROM counter_customer_sessions ccs
     JOIN users u ON u.id = ccs.user_id AND u.status = 'active' AND u.deleted_at IS NULL
     WHERE ccs.token_hash = :tokenHash
       AND ccs.counter_device_id = :deviceId
       AND ccs.tenant_id = :tenantId
       AND ccs.ended_at IS NULL
       AND ccs.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    {
      tokenHash: hashSha256(readCustomerSessionToken(request)),
      deviceId: request.counterAuth.deviceId,
      tenantId: request.counterAuth.tenantId
    }
  );
  if (!sessions[0]) {
    throw new ApiError(401, 'counter_customer_session_expired', 'Customer selection has expired. Please enter the phone number again.');
  }
  return sessions[0];
}

async function getCounterCustomerSummary(tenantId: number, userId: number) {
  const [profiles, bootstrap, vouchers] = await Promise.all([
    mysqlPool.query<Array<RowDataPacket & { display_name: string }>>(
      `SELECT up.display_name
       FROM user_profiles up
       JOIN customer_tenant_memberships ctm ON ctm.user_id = up.user_id
       WHERE up.user_id = :userId AND ctm.tenant_id = :tenantId
       LIMIT 1`,
      { tenantId, userId }
    ),
    getBootstrapForUser(userId),
    mysqlPool.query<Array<RowDataPacket & { id: number; name: string; expires_at: Date | null }>>(
      `SELECT uv.id, vt.name, uv.expires_at
       FROM user_vouchers uv
       JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
       WHERE uv.user_id = :userId
         AND uv.status = 'active'
         AND vt.tenant_id = :tenantId
         AND vt.is_active = 1
         AND (uv.expires_at IS NULL OR uv.expires_at > UTC_TIMESTAMP())
       ORDER BY uv.expires_at IS NULL DESC, uv.expires_at ASC, uv.id ASC
       LIMIT 20`,
      { tenantId, userId }
    )
  ]);

  const profile = profiles[0][0];
  if (!profile) throw new ApiError(404, 'counter_customer_not_found', 'No active customer account was found for this phone number.');

  return {
    customer: {
      display_name: profile.display_name,
      loyalty_tier: bootstrap.tier,
      token_balance: bootstrap.token_balance,
      active_vouchers: vouchers[0].map((voucher) => ({
        id: voucher.id,
        name: voucher.name,
        expires_at: voucher.expires_at
      }))
    }
  };
}

export async function registerCounterRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/counter/device', { preHandler: authenticateCounterDevice }, async (request) => ({
    device: {
      id: request.counterAuth.deviceId,
      label: request.counterAuth.label,
      store_id: request.counterAuth.storeId,
      tenant_id: request.counterAuth.tenantId
    }
  }));

  app.post('/v1/counter/customer-sessions', {
    preHandler: authenticateCounterDevice,
    config: { rateLimit: { max: 30, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    const phone = normalizePhoneE164(lookupCustomerSchema.parse(request.body).phone);
    const [customers] = await mysqlPool.query<Array<RowDataPacket & { user_id: number }>>(
      `SELECT ctm.user_id
       FROM customer_tenant_memberships ctm
       JOIN users u ON u.id = ctm.user_id AND u.phone_e164 = :phone
       WHERE ctm.tenant_id = :tenantId
         AND ctm.registration_status = 'registered'
         AND u.status = 'active'
         AND u.deleted_at IS NULL
       LIMIT 1`,
      { phone, tenantId: request.counterAuth.tenantId }
    );
    const customer = customers[0];
    if (!customer) {
      throw new ApiError(404, 'counter_customer_not_found', 'No active customer account was found for this phone number.');
    }

    const sessionToken = generateOpaqueToken();
    await mysqlPool.execute<ResultSetHeader>(
      `UPDATE counter_customer_sessions
       SET ended_at = UTC_TIMESTAMP()
       WHERE counter_device_id = :deviceId AND ended_at IS NULL`,
      { deviceId: request.counterAuth.deviceId }
    );
    await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO counter_customer_sessions (counter_device_id, tenant_id, user_id, token_hash, expires_at)
       VALUES (:deviceId, :tenantId, :userId, :tokenHash, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))`,
      {
        deviceId: request.counterAuth.deviceId,
        tenantId: request.counterAuth.tenantId,
        userId: customer.user_id,
        tokenHash: hashSha256(sessionToken)
      }
    );

    return reply.code(201).send({
      customer_session_token: sessionToken,
      expires_in_seconds: 600,
      ...(await getCounterCustomerSummary(request.counterAuth.tenantId, customer.user_id))
    });
  });

  app.get('/v1/counter/customer-session', { preHandler: authenticateCounterDevice }, async (request) => {
    const session = await requireCounterCustomerSession(request);
    return getCounterCustomerSummary(session.tenant_id, session.user_id);
  });

  app.delete('/v1/counter/customer-session', { preHandler: authenticateCounterDevice }, async (request) => {
    const session = await requireCounterCustomerSession(request);
    await mysqlPool.execute(
      'UPDATE counter_customer_sessions SET ended_at = UTC_TIMESTAMP() WHERE id = :sessionId',
      { sessionId: session.id }
    );
    return { ended: true };
  });
}
