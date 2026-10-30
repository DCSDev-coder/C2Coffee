import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { createUserNotification } from '../notifications.js';
import { deliverPushToCustomerTenant } from '../../services/push-delivery.js';

const maintenanceSchema = z.object({
  enabled: z.coerce.boolean(),
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(600),
  expected_end_at: z.string().datetime({ offset: true }).nullable().optional()
}).superRefine((value, context) => {
  if (value.enabled && value.expected_end_at && new Date(value.expected_end_at).getTime() <= Date.now()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expected_end_at'], message: 'Expected end must be in the future.' });
  }
});

type MaintenanceRow = RowDataPacket & { enabled: number; title: string; message: string; expected_end_at: Date | string | null };

async function audit(connection: PoolConnection, request: FastifyRequest, after: unknown): Promise<void> {
  await connection.execute(
    `INSERT INTO admin_audit_logs
      (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent, created_at)
     VALUES (:adminUserId, :roles, 'app_maintenance_updated', 'app_maintenance_mode', :tenantId, :afterJson, :ipAddress, :userAgent, UTC_TIMESTAMP())`,
    {
      adminUserId: request.adminAuth.adminUserId,
      roles: JSON.stringify(request.adminAuth.roles),
      tenantId: request.adminAuth.tenantId,
      afterJson: JSON.stringify(after),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null
    }
  );
}

function response(row?: Partial<MaintenanceRow>) {
  return {
    enabled: Number(row?.enabled ?? 0) === 1,
    allow_employee_bypass: true,
    title: row?.title ?? 'C2 Coffee is under maintenance',
    message: row?.message ?? 'We are making improvements. Please check back soon.',
    expected_end_at: row?.expected_end_at ? new Date(row.expected_end_at).toISOString() : null
  };
}

export async function registerAdminMaintenanceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/maintenance', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const [rows] = await mysqlPool.query<MaintenanceRow[]>(
      `SELECT enabled, title, message, expected_end_at FROM app_maintenance_mode WHERE tenant_id = :tenantId LIMIT 1`,
      { tenantId: request.adminAuth.tenantId }
    );
    return { maintenance: response(rows[0]) };
  });

  app.put('/v1/admin/maintenance', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const payload = maintenanceSchema.parse(request.body);
    const connection = await getUtcConnection();
    let wasEnabled = false;
    try {
      await connection.beginTransaction();
      const [previousRows] = await connection.query<MaintenanceRow[]>(
        `SELECT enabled FROM app_maintenance_mode WHERE tenant_id = :tenantId LIMIT 1 FOR UPDATE`,
        { tenantId: request.adminAuth.tenantId }
      );
      wasEnabled = Number(previousRows[0]?.enabled ?? 0) === 1;
      await connection.execute(
        `INSERT INTO app_maintenance_mode
          (tenant_id, enabled, allow_employee_bypass, title, message, expected_end_at, updated_by_admin_user_id)
         VALUES (:tenantId, :enabled, 1, :title, :message, :expectedEndAt, :adminUserId)
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), allow_employee_bypass = 1,
           title = VALUES(title), message = VALUES(message), expected_end_at = VALUES(expected_end_at),
           updated_by_admin_user_id = VALUES(updated_by_admin_user_id), updated_at = UTC_TIMESTAMP()`,
        {
          tenantId: request.adminAuth.tenantId,
          enabled: payload.enabled ? 1 : 0,
          title: payload.title,
          message: payload.message,
          expectedEndAt: payload.expected_end_at ? new Date(payload.expected_end_at) : null,
          adminUserId: request.adminAuth.adminUserId
        }
      );
      await audit(connection, request, payload);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (wasEnabled && !payload.enabled) {
      const deliveryKey = `maintenance-resumed-${request.adminAuth.tenantId}-${Date.now()}`;
      const [users] = await mysqlPool.query<Array<RowDataPacket & { user_id: number }>>(
        `SELECT DISTINCT ctm.user_id
           FROM customer_tenant_memberships ctm JOIN users u ON u.id = ctm.user_id
          WHERE ctm.tenant_id = :tenantId AND u.status = 'active' AND ctm.registration_status = 'registered'`,
        { tenantId: request.adminAuth.tenantId }
      );
      for (const user of users) {
        await createUserNotification(mysqlPool, {
          userId: Number(user.user_id), type: 'maintenance_resumed',
          title: 'C2 Coffee is back online',
          body: 'Maintenance is complete. You can order again now.',
          data: { destination: 'home' }, deliveryKey
        });
      }
      await deliverPushToCustomerTenant({
        tenantId: request.adminAuth.tenantId,
        title: 'C2 Coffee is back online',
        body: 'Maintenance is complete. You can order again now.',
        data: { type: 'maintenance_resumed' },
        respectMarketingPreference: false
      });
    }
    return { maintenance: { ...payload, allow_employee_bypass: true } };
  });
}
