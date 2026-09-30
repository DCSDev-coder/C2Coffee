import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';
import { env } from '../config/env.js';
import { hashSha256 } from '../lib/crypto.js';
import { ApiError } from '../http/errors.js';

export interface CounterAuthContext {
  deviceId: number;
  tenantId: number;
  storeId: number;
  label: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    counterAuth: CounterAuthContext;
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
    `SELECT cd.id AS deviceId, cd.tenant_id AS tenantId, cd.store_id AS storeId, cd.label
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
  void mysqlPool.execute(
    'UPDATE counter_devices SET last_seen_at = UTC_TIMESTAMP() WHERE id = :deviceId',
    { deviceId: device.deviceId }
  ).catch((error) => request.log.warn({ error, deviceId: device.deviceId }, 'counter device heartbeat update failed'));
}
