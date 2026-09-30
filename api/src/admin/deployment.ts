import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env.js';
import { mysqlPool } from '../db/mysql.js';
import { assertDeploymentTenants } from './deployment-policy.js';

export async function assertSingleCafeDeployment(): Promise<void> {
  // Include inactive tenants: shared global tables cannot isolate a second cafe.
  const [rows] = await mysqlPool.query<Array<RowDataPacket & { code: string; status: string }>>(
    'SELECT code, status FROM admin_tenants ORDER BY id LIMIT 2');
  assertDeploymentTenants(rows, env.DEPLOYMENT_TENANT_CODE);
}
