import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authenticateAdminRequest } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';

const pushTokenSchema = z.object({
  platform: z.enum(['android', 'ios', 'web']),
  push_token: z.string().trim().min(20).max(512)
});

const deactivatePushTokenSchema = z.object({
  push_token: z.string().trim().min(20).max(512)
});

/** Staff devices are registered separately from customer-owned devices. */
export async function registerAdminPushRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/admin/devices/push-token', { preHandler: authenticateAdminRequest }, async (request) => {
    const payload = pushTokenSchema.parse(request.body ?? {});

    await mysqlPool.execute(
      `INSERT INTO admin_push_tokens (
         admin_user_id, tenant_id, platform, push_token, status, created_at, last_seen_at
       ) VALUES (
         :adminUserId, :tenantId, :platform, :pushToken, 'active', UTC_TIMESTAMP(), UTC_TIMESTAMP()
       )
       ON DUPLICATE KEY UPDATE
         admin_user_id = VALUES(admin_user_id),
         tenant_id = VALUES(tenant_id),
         platform = VALUES(platform),
         status = 'active',
         last_seen_at = UTC_TIMESTAMP()`,
      {
        adminUserId: request.adminAuth.adminUserId,
        tenantId: request.adminAuth.tenantId,
        platform: payload.platform,
        pushToken: payload.push_token
      }
    );

    return { registered: true };
  });

  app.post('/v1/admin/devices/push-token/deactivate', { preHandler: authenticateAdminRequest }, async (request) => {
    const payload = deactivatePushTokenSchema.parse(request.body ?? {});

    await mysqlPool.execute(
      `UPDATE admin_push_tokens
       SET status = 'inactive', last_seen_at = UTC_TIMESTAMP()
       WHERE admin_user_id = :adminUserId
         AND push_token = :pushToken`,
      { adminUserId: request.adminAuth.adminUserId, pushToken: payload.push_token }
    );

    return { deactivated: true };
  });
}
