import type { RowDataPacket } from 'mysql2/promise';
import { assertSingleCafeDeployment } from '../admin/deployment.js';
import { env } from '../config/env.js';
import { mysqlPool } from '../db/mysql.js';

async function main(): Promise<void> {
  await assertSingleCafeDeployment();
  const [storeRows] = await mysqlPool.query<Array<RowDataPacket & { total: number; published: number }>>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN s.status = 'active' AND s.is_customer_facing = 1 THEN 1 ELSE 0 END) AS published
     FROM stores s JOIN admin_tenants t ON t.id = s.tenant_id
     WHERE t.code = :tenantCode`, { tenantCode: env.DEPLOYMENT_TENANT_CODE });
  const [orphanRows] = await mysqlPool.query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total FROM customer_tenant_memberships ctm
     LEFT JOIN users u ON u.id = ctm.user_id
     LEFT JOIN admin_tenants t ON t.id = ctm.tenant_id
     WHERE u.id IS NULL OR t.id IS NULL`);
  const stores = storeRows[0];
  const orphanMemberships = Number(orphanRows[0]?.total ?? 0);
  if (Number(stores?.published ?? 0) > 1) {
    throw new Error('More than one active customer-facing outlet exists. Resolve routing before deployment.');
  }
  if (orphanMemberships > 0) {
    throw new Error(`Found ${orphanMemberships} orphan customer tenant memberships. Resolve them before deployment.`);
  }
  console.log(`PASS cafe=${env.DEPLOYMENT_TENANT_CODE} outlets=${Number(stores?.total ?? 0)} customer_outlets=${Number(stores?.published ?? 0)} orphan_memberships=0`);
}

try {
  await main();
} finally {
  await mysqlPool.end();
}
