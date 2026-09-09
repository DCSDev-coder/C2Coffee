import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const updateStoreSchema = z.object({
  name: z.string().trim().min(2).max(120)
});

type StoreRow = RowDataPacket & {
  id: number;
  name: string;
  pickup_lead_minutes: number;
};

async function getCustomerFacingStore(tenantId: number): Promise<StoreRow> {
  const [stores] = await mysqlPool.query<StoreRow[]>(
    `SELECT id, name, pickup_lead_minutes
     FROM stores
     WHERE tenant_id = :tenantId AND status = 'active' AND is_customer_facing = 1
     ORDER BY id ASC
     LIMIT 1`,
    { tenantId }
  );
  if (!stores[0]) {
    throw new ApiError(409, 'customer_store_not_configured', 'No customer-facing outlet is configured.');
  }
  return stores[0];
}

export async function registerAdminStoreRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/store', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    return { store: await getCustomerFacingStore(request.adminAuth.tenantId) };
  });

  app.patch('/v1/admin/store', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const { name } = updateStoreSchema.parse(request.body);
    const store = await getCustomerFacingStore(request.adminAuth.tenantId);
    await mysqlPool.execute<ResultSetHeader>(
      'UPDATE stores SET name = :name, updated_at = UTC_TIMESTAMP() WHERE id = :storeId',
      { name, storeId: store.id }
    );
    return { store: { ...store, name } };
  });
}
