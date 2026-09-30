import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { env } from '../config/env.js';
import { mysqlPool } from '../db/mysql.js';
import { hashPassword } from '../lib/password.js';

const input = z.object({
  name: z.string().trim().min(2).max(255),
  displayName: z.string().trim().min(2).max(255),
  adminUsername: z.string().trim().min(3).max(80),
  adminEmail: z.string().trim().email().max(255),
  adminFullName: z.string().trim().min(2).max(255),
  temporaryPassword: z.string().min(12).max(200)
}).parse({
  name: process.env.CAFE_BOOTSTRAP_NAME,
  displayName: process.env.CAFE_BOOTSTRAP_DISPLAY_NAME,
  adminUsername: process.env.CAFE_BOOTSTRAP_ADMIN_USERNAME,
  adminEmail: process.env.CAFE_BOOTSTRAP_ADMIN_EMAIL,
  adminFullName: process.env.CAFE_BOOTSTRAP_ADMIN_FULL_NAME,
  temporaryPassword: process.env.CAFE_BOOTSTRAP_TEMP_PASSWORD
});

const connection = await mysqlPool.getConnection();
try {
  await connection.beginTransaction();
  const [tenants] = await connection.query<Array<RowDataPacket & { id: number; code: string }>>(
    'SELECT id, code FROM admin_tenants FOR UPDATE');
  const [counts] = await connection.query<Array<RowDataPacket & { users: number; stores: number; orders: number }>>(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM stores) AS stores,
            (SELECT COUNT(*) FROM orders) AS orders`);
  if (tenants.length !== 1 || tenants[0].code !== 'c2coffee') {
    throw new Error('Initialization requires one untouched c2coffee placeholder tenant.');
  }
  if (Number(counts[0].users) || Number(counts[0].stores) || Number(counts[0].orders)) {
    throw new Error('Initialization is only allowed on a fresh database with no customers, outlets, or orders.');
  }
  const tenantId = tenants[0].id;
  await connection.execute(
    `UPDATE admin_tenants SET code = :code, name = :name, display_name = :displayName,
       logo_asset_path = NULL, primary_color = NULL, secondary_color = NULL, updated_at = UTC_TIMESTAMP()
     WHERE id = :tenantId`,
    { tenantId, code: env.DEPLOYMENT_TENANT_CODE, name: input.name, displayName: input.displayName });
  const [admins] = await connection.query<Array<RowDataPacket & { id: number }>>(
    'SELECT id FROM admin_users WHERE tenant_id = :tenantId FOR UPDATE', { tenantId });
  if (admins.length !== 1) throw new Error('Initialization requires exactly one bootstrap admin account.');
  await connection.execute(
    `UPDATE admin_users SET username = :username, email = :email, full_name = :fullName,
       password_hash = :passwordHash, status = 'active', must_change_password = 1,
       must_set_email = 0, updated_at = UTC_TIMESTAMP() WHERE id = :adminUserId`,
    { adminUserId: admins[0].id, username: input.adminUsername, email: input.adminEmail,
      fullName: input.adminFullName, passwordHash: await hashPassword(input.temporaryPassword) });
  await connection.execute(
    `UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP(), revoke_reason = 'cafe_deployment_initialized'
     WHERE tenant_id = :tenantId AND revoked_at IS NULL`, { tenantId });
  await connection.commit();
  console.log(`Initialized dedicated cafe deployment: ${env.DEPLOYMENT_TENANT_CODE}. The admin must change the temporary password at first sign-in.`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await mysqlPool.end();
}
