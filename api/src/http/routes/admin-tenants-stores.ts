import type { FastifyInstance } from 'fastify';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest, requireAdminRole, requireAnyAdminRole } from '../../admin/guard.js';
import { requireAdminActionConfirmation } from '../../admin/action-confirmation.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { assertOutletPublication } from '../../admin/outlet-policy.js';


type StoreInput = {
  code: string;
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postcode: string;
  timezone: string;
  supports_pickup: boolean;
  pickup_lead_minutes: number;
  is_customer_facing: boolean;
};

const storeFields = {
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{1,49}$/, 'Use 2-50 uppercase letters, numbers, or hyphens.'),
  name: z.string().trim().min(2).max(255),
  address_line_1: z.string().trim().min(2).max(255),
  address_line_2: z.string().trim().max(255).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  postcode: z.string().trim().min(2).max(20),
  timezone: z.string().trim().min(2).max(100).refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }, 'Enter a valid timezone.').default('Asia/Kuala_Lumpur'),
  supports_pickup: z.boolean().default(true),
  pickup_lead_minutes: z.coerce.number().int().min(0).max(240).default(15),
  is_customer_facing: z.boolean().default(false)
};

const createStoreSchema = z.object({
  ...storeFields,
  confirmation_password: z.string().trim().min(8).max(200)
});

const updateStoreSchema = z.object({
  name: storeFields.name.optional(),
  address_line_1: storeFields.address_line_1.optional(),
  address_line_2: storeFields.address_line_2.optional(),
  city: storeFields.city.optional(),
  state: storeFields.state.optional(),
  postcode: storeFields.postcode.optional(),
  timezone: storeFields.timezone.optional(),
  supports_pickup: z.boolean().optional(),
  pickup_lead_minutes: z.coerce.number().int().min(0).max(240).optional(),
  is_customer_facing: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  confirmation_password: z.string().trim().min(8).max(200)
}).refine((value) => Object.keys(value).some((key) => !['confirmation_password'].includes(key)), {
  message: 'Choose at least one outlet field to update.'
});

function storeParams(tenantId: number, store: StoreInput) {
  return {
    tenantId,
    code: store.code,
    name: store.name,
    addressLine1: store.address_line_1,
    addressLine2: store.address_line_2 || null,
    city: store.city,
    state: store.state,
    postcode: store.postcode,
    timezone: store.timezone,
    supportsPickup: store.supports_pickup ? 1 : 0,
    pickupLeadMinutes: store.pickup_lead_minutes,
    isCustomerFacing: store.is_customer_facing ? 1 : 0
  };
}

async function listTenantStores(tenantId: number) {
  const [stores] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT id, code, name, status, is_customer_facing, timezone, address_line_1, address_line_2,
            city, state, postcode, supports_pickup, pickup_lead_minutes, created_at, updated_at
     FROM stores WHERE tenant_id = :tenantId ORDER BY name ASC, id ASC`,
    { tenantId }
  );
  return stores.map((store) => ({
    ...store,
    is_customer_facing: store.is_customer_facing === 1,
    supports_pickup: store.supports_pickup === 1,
    pickup_lead_minutes: Number(store.pickup_lead_minutes)
  }));
}

async function lockTenant(connection: PoolConnection, tenantId: number): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM admin_tenants WHERE id = :tenantId AND status = 'active' FOR UPDATE", { tenantId });
  if (!rows.length) throw new ApiError(403, 'tenant_not_active', 'Tenant is inactive.');
}

export async function registerAdminTenantStoreRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/platform/tenants', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const [tenants] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT t.id, t.code, t.name, t.display_name, t.status, t.logo_asset_path, t.primary_color, t.secondary_color,
              COUNT(DISTINCT s.id) AS store_count, COUNT(DISTINCT u.id) AS admin_count
       FROM admin_tenants t
       LEFT JOIN stores s ON s.tenant_id = t.id
       LEFT JOIN admin_users u ON u.tenant_id = t.id AND u.status <> 'deleted'
       WHERE t.id = :tenantId GROUP BY t.id ORDER BY t.display_name ASC`,
      { tenantId: request.adminAuth.tenantId }
    );
    return { tenants: tenants.map((tenant) => ({ ...tenant, store_count: Number(tenant.store_count), admin_count: Number(tenant.admin_count) })) };
  });

  // Keep explicit rejections for older clients; cafes must never share this database.
  for (const method of ['POST', 'PATCH'] as const) {
    app.route({
      method,
      url: method === 'POST' ? '/v1/admin/platform/tenants' : '/v1/admin/platform/tenants/:id',
      preHandler: authenticateAdminRequest,
      handler: async (request) => {
        requireAdminRole(request, 'super_admin');
        throw new ApiError(409, 'separate_deployment_required',
          'Independent cafes require a separate backend and database. Manage branches using Outlets.');
      }
    });
  }

  app.get('/v1/admin/stores', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    return { stores: await listTenantStores(request.adminAuth.tenantId) };
  });

  app.post('/v1/admin/stores', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const payload = createStoreSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      await lockTenant(connection, request.adminAuth.tenantId);
      assertOutletPublication(null, { is_customer_facing: payload.is_customer_facing, status: 'active' });
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO stores (tenant_id, code, name, status, is_customer_facing, timezone, address_line_1, address_line_2, city, state, postcode, supports_pickup, pickup_lead_minutes)
         VALUES (:tenantId, :code, :name, 'active', :isCustomerFacing, :timezone, :addressLine1, :addressLine2, :city, :state, :postcode, :supportsPickup, :pickupLeadMinutes)`,
        storeParams(request.adminAuth.tenantId, payload)
      );
      await connection.execute(
        `INSERT INTO admin_audit_logs
         (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent)
         VALUES (:adminUserId, :roles, 'outlet_created', 'store', :storeId, :afterJson, :ipAddress, :userAgent)`,
        { adminUserId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles),
          storeId: result.insertId, afterJson: JSON.stringify({ ...payload, confirmation_password: undefined }),
          ipAddress: request.ip, userAgent: request.headers['user-agent'] ?? null }
      );
      await connection.commit();
      return reply.code(201).send({ store_id: result.insertId });
    } catch (error) { await connection.rollback(); if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw new ApiError(409, 'store_conflict', 'An outlet with this code already exists in this tenant.'); throw error; } finally { connection.release(); }
  });

  app.patch('/v1/admin/stores/:id', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const storeId = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const payload = updateStoreSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      await lockTenant(connection, request.adminAuth.tenantId);
      const [existingRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM stores WHERE id = :storeId AND tenant_id = :tenantId FOR UPDATE',
        { storeId, tenantId: request.adminAuth.tenantId });
      const existing = existingRows[0];
      if (!existing) throw new ApiError(404, 'store_not_found', 'Outlet was not found.');
      assertOutletPublication({ is_customer_facing: existing.is_customer_facing === 1, status: existing.status },
        { is_customer_facing: payload.is_customer_facing ?? existing.is_customer_facing === 1, status: payload.status ?? existing.status });
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE stores SET name = COALESCE(:name, name), address_line_1 = COALESCE(:addressLine1, address_line_1), address_line_2 = CASE WHEN :updateAddressLine2 THEN :addressLine2 ELSE address_line_2 END, city = COALESCE(:city, city), state = COALESCE(:state, state), postcode = COALESCE(:postcode, postcode), timezone = COALESCE(:timezone, timezone), supports_pickup = COALESCE(:supportsPickup, supports_pickup), pickup_lead_minutes = COALESCE(:pickupLeadMinutes, pickup_lead_minutes), is_customer_facing = COALESCE(:isCustomerFacing, is_customer_facing), status = COALESCE(:status, status), updated_at = UTC_TIMESTAMP()
         WHERE id = :storeId AND tenant_id = :tenantId`,
        { storeId, tenantId: request.adminAuth.tenantId, name: payload.name ?? null, addressLine1: payload.address_line_1 ?? null, updateAddressLine2: payload.address_line_2 !== undefined, addressLine2: payload.address_line_2 === undefined ? null : payload.address_line_2 || null, city: payload.city ?? null, state: payload.state ?? null, postcode: payload.postcode ?? null, timezone: payload.timezone ?? null, supportsPickup: payload.supports_pickup === undefined ? null : payload.supports_pickup ? 1 : 0, pickupLeadMinutes: payload.pickup_lead_minutes ?? null, isCustomerFacing: payload.is_customer_facing === undefined ? null : payload.is_customer_facing ? 1 : 0, status: payload.status ?? null }
      );
      if (!result.affectedRows) throw new ApiError(404, 'store_not_found', 'Outlet was not found.');
      await connection.execute(
        `INSERT INTO admin_audit_logs
         (admin_user_id, effective_roles_json, action_code, target_type, target_id, before_json, after_json, ip_address, user_agent)
         VALUES (:adminUserId, :roles, 'outlet_updated', 'store', :storeId, :beforeJson, :afterJson, :ipAddress, :userAgent)`,
        { adminUserId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), storeId,
          beforeJson: JSON.stringify(existing), afterJson: JSON.stringify({ ...payload, confirmation_password: undefined }),
          ipAddress: request.ip, userAgent: request.headers['user-agent'] ?? null }
      );
      await connection.commit();
      return { updated: true };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });
}
