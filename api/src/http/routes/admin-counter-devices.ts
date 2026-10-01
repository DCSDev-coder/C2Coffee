import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { requireAdminActionConfirmation } from '../../admin/action-confirmation.js';
import { mysqlPool } from '../../db/mysql.js';
import { generateDeviceActivationCode, hashSha256 } from '../../lib/crypto.js';
import { ApiError } from '../errors.js';

const createDeviceSchema = z.object({
  label: z.string().trim().min(2).max(120),
  store_id: z.coerce.number().int().positive(),
  confirmation_password: z.string().min(8).max(200)
});

const updateDeviceSchema = z.object({
  label: z.string().trim().min(2).max(120).optional(),
  status: z.enum(['active', 'inactive', 'revoked']).optional(),
  confirmation_password: z.string().min(8).max(200)
}).refine((value) => value.label !== undefined || value.status !== undefined, {
  message: 'Provide a label or status to update.'
});

function activationExpiry(): Date {
  return new Date(Date.now() + 30 * 60 * 1000);
}

export async function registerAdminCounterDeviceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/counter-devices', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const [devices] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT cd.id, cd.label, cd.status, cd.store_id, store.name AS store_name,
              cd.last_seen_at, cd.activated_at, cd.activation_expires_at,
              cd.created_at, cd.updated_at
       FROM counter_devices cd
       JOIN stores store ON store.id = cd.store_id
       WHERE cd.tenant_id = :tenantId
       ORDER BY cd.created_at DESC`,
      { tenantId: request.adminAuth.tenantId }
    );
    return { devices };
  });

  app.post('/v1/admin/counter-devices', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const payload = createDeviceSchema.parse(request.body);
    const tenantId = request.adminAuth.tenantId;
    const activationCode = generateDeviceActivationCode();
    const expiresAt = activationExpiry();
    const connection = await mysqlPool.getConnection();
    let deviceId: number;
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      const [stores] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM stores WHERE id = :storeId AND tenant_id = :tenantId AND status = 'active' FOR UPDATE`,
        { tenantId, storeId: payload.store_id });
      if (!stores[0]) throw new ApiError(400, 'counter_store_unavailable', 'Choose an active store in this cafe.');
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO counter_devices
         (tenant_id, store_id, label, token_hash, activation_code_hash, activation_expires_at, created_by_admin_user_id)
         VALUES (:tenantId, :storeId, :label, NULL, :activationCodeHash, :activationExpiresAt, :adminUserId)`,
        { tenantId, storeId: payload.store_id, label: payload.label,
          activationCodeHash: hashSha256(activationCode), activationExpiresAt: expiresAt,
          adminUserId: request.adminAuth.adminUserId });
      deviceId = result.insertId;
      await connection.execute(
        `INSERT INTO admin_audit_logs
         (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent)
         VALUES (:adminUserId, :roles, 'counter_device_created', 'counter_device', :deviceId, :afterJson, :ipAddress, :userAgent)`,
        { adminUserId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), deviceId,
          afterJson: JSON.stringify({ label: payload.label, store_id: payload.store_id, status: 'active' }),
          ipAddress: request.ip, userAgent: request.headers['user-agent'] ?? null });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'counter_device_conflict', 'A counter device with this label already exists.');
      }
      throw error;
    } finally { connection.release(); }

    return reply.code(201).send({
      device: { id: deviceId, label: payload.label, store_id: payload.store_id, status: 'active' },
      activation_code: activationCode,
      activation_expires_at: expiresAt.toISOString()
    });
  });

  app.patch('/v1/admin/counter-devices/:id', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const payload = updateDeviceSchema.parse(request.body);
    const deviceId = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      const [existingRows] = await connection.query<RowDataPacket[]>(
        `SELECT id, status FROM counter_devices
         WHERE id = :deviceId AND tenant_id = :tenantId FOR UPDATE`,
        { deviceId, tenantId: request.adminAuth.tenantId }
      );
      const existing = existingRows[0];
      if (!existing) throw new ApiError(404, 'counter_device_not_found', 'Counter device was not found.');
      if (existing.status === 'revoked' && payload.status && payload.status !== 'revoked') {
        throw new ApiError(409, 'counter_device_revoked', 'Issue a new activation code to reactivate a revoked device.');
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE counter_devices
         SET label = COALESCE(:label, label),
             status = COALESCE(:status, status),
             token_hash = CASE WHEN :status = 'revoked' THEN NULL ELSE token_hash END,
             activation_code_hash = CASE WHEN :status = 'revoked' THEN NULL ELSE activation_code_hash END,
             activation_expires_at = CASE WHEN :status = 'revoked' THEN NULL ELSE activation_expires_at END,
             updated_at = UTC_TIMESTAMP()
         WHERE id = :deviceId AND tenant_id = :tenantId`,
        { deviceId, tenantId: request.adminAuth.tenantId, label: payload.label ?? null, status: payload.status ?? null });
      if (!result.affectedRows) throw new ApiError(404, 'counter_device_not_found', 'Counter device was not found.');
      if (payload.status === 'revoked') {
        await connection.execute(
          `UPDATE counter_customer_sessions SET ended_at = UTC_TIMESTAMP()
           WHERE counter_device_id = :deviceId AND ended_at IS NULL`,
          { deviceId }
        );
      }
      await connection.execute(
        `INSERT INTO admin_audit_logs
         (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent)
         VALUES (:adminUserId, :roles, 'counter_device_updated', 'counter_device', :deviceId, :afterJson, :ipAddress, :userAgent)`,
        { adminUserId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), deviceId,
          afterJson: JSON.stringify({ label: payload.label, status: payload.status }),
          ipAddress: request.ip, userAgent: request.headers['user-agent'] ?? null });
      await connection.commit();
      return { updated: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  });

  app.post('/v1/admin/counter-devices/:id/rotate-token', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const payload = z.object({ confirmation_password: z.string().min(8).max(200) }).parse(request.body);
    const deviceId = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const activationCode = generateDeviceActivationCode();
    const expiresAt = activationExpiry();
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE counter_devices
         SET token_hash = NULL, activation_code_hash = :activationCodeHash,
             activation_expires_at = :activationExpiresAt, activated_at = NULL,
             status = 'active', updated_at = UTC_TIMESTAMP()
         WHERE id = :deviceId AND tenant_id = :tenantId`,
        { deviceId, tenantId: request.adminAuth.tenantId,
          activationCodeHash: hashSha256(activationCode), activationExpiresAt: expiresAt });
      if (!result.affectedRows) throw new ApiError(404, 'counter_device_not_found', 'Counter device was not found.');
      await connection.execute(
        `UPDATE counter_customer_sessions SET ended_at = UTC_TIMESTAMP()
         WHERE counter_device_id = :deviceId AND ended_at IS NULL`,
        { deviceId }
      );
      await connection.execute(
        `INSERT INTO admin_audit_logs
         (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent)
         VALUES (:adminUserId, :roles, 'counter_device_token_rotated', 'counter_device', :deviceId, :afterJson, :ipAddress, :userAgent)`,
        { adminUserId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), deviceId,
          afterJson: JSON.stringify({ status: 'active' }), ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null });
      await connection.commit();
      return { activation_code: activationCode, activation_expires_at: expiresAt.toISOString() };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  });
}
