import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest } from '../../admin/guard.js';
import { env } from '../../config/env.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { getActiveChipMethods } from '../../payments/chip-client.js';
import {
  asChipPaymentMethods,
  customerPaymentMethodLabels,
  customerPaymentMethods,
  loadTenantPaymentMethodDescriptions,
  loadTenantPaymentMethodSettings,
  normalizeCustomerPaymentMethodDescriptions,
  normalizeCustomerPaymentMethods,
  type CustomerPaymentMethod
} from '../../services/payment-method-settings.js';

const settingsSchema = z.object({
  methods: z.array(z.enum(customerPaymentMethods))
    .min(1, 'Select at least one payment method.')
    .max(customerPaymentMethods.length),
  descriptions: z.record(z.enum(customerPaymentMethods), z.string().trim().max(160)).optional()
});

async function audit(connection: PoolConnection, request: FastifyRequest, methods: string[]): Promise<void> {
  await connection.execute(
    `INSERT INTO admin_audit_logs
      (admin_user_id, effective_roles_json, action_code, target_type, target_id, after_json, ip_address, user_agent, created_at)
     VALUES (:adminUserId, :roles, 'customer_payment_methods_updated', 'admin_tenants', :tenantId, :afterJson, :ipAddress, :userAgent, UTC_TIMESTAMP())`,
    {
      adminUserId: request.adminAuth.adminUserId,
      roles: JSON.stringify(request.adminAuth.roles),
      tenantId: request.adminAuth.tenantId,
      afterJson: JSON.stringify({ methods }),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null
    }
  );
}

function requirePaymentSettingsAdmin(request: FastifyRequest): void {
  if (!request.adminAuth.roles.some((role) => ['super_admin', 'admin'].includes(role))) {
    throw new ApiError(403, 'admin_forbidden', 'You do not have permission to manage payment methods.');
  }
}

function response(
  methods: CustomerPaymentMethod[],
  activeMethods: ReadonlyMap<CustomerPaymentMethod, string[]>,
  descriptions: Record<CustomerPaymentMethod, string>
) {
  return {
    methods: customerPaymentMethods.map((method) => ({
      code: method,
      label: customerPaymentMethodLabels[method],
      description: descriptions[method],
      enabled: methods.includes(method),
      deployment_enabled: env.TOPUP_GATEWAY_ALLOWED_METHODS.includes(method),
      provider_active: activeMethods.has(method),
      available: env.TOPUP_GATEWAY_ALLOWED_METHODS.includes(method) && activeMethods.has(method),
      provider_review_note: method === 'card' ? 'Only Malaysian-issued cards are currently supported.' : null
    })),
    enabled_methods: methods
  };
}

export async function registerAdminPaymentMethodRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/payment-methods', { preHandler: authenticateAdminRequest }, async (request) => {
    requirePaymentSettingsAdmin(request);
    const connection = await getUtcConnection();
    try {
      const methods = await loadTenantPaymentMethodSettings(connection, request.adminAuth.tenantId);
      const descriptions = await loadTenantPaymentMethodDescriptions(connection, request.adminAuth.tenantId);
      const activeMethods = await getActiveChipMethods(
        100,
        asChipPaymentMethods(normalizeCustomerPaymentMethods(env.TOPUP_GATEWAY_ALLOWED_METHODS))
      );
      return response(methods, activeMethods, descriptions);
    } finally {
      connection.release();
    }
  });

  app.put('/v1/admin/payment-methods', { preHandler: authenticateAdminRequest }, async (request) => {
    requirePaymentSettingsAdmin(request);
    const payload = settingsSchema.parse(request.body);
    const methods = normalizeCustomerPaymentMethods(payload.methods);
    if (methods.length !== payload.methods.length) {
      throw new ApiError(400, 'invalid_payment_methods', 'Choose only supported customer payment methods.');
    }
    const outsideDeploymentPolicy = methods.filter(
      (method) => !env.TOPUP_GATEWAY_ALLOWED_METHODS.includes(method)
    );
    if (outsideDeploymentPolicy.length > 0) {
      throw new ApiError(400, 'payment_method_not_enabled', 'A selected payment method is not enabled for this deployment.');
    }
    const activeMethods = await getActiveChipMethods(100, asChipPaymentMethods(methods));
    const inactiveMethods = methods.filter((method) => !activeMethods.has(method));
    if (inactiveMethods.length > 0) {
      throw new ApiError(400, 'payment_method_not_active', 'A selected payment method is not active with CHIP yet.');
    }
    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      const existingDescriptions = await loadTenantPaymentMethodDescriptions(connection, request.adminAuth.tenantId);
      const descriptions = payload.descriptions
        ? normalizeCustomerPaymentMethodDescriptions({ ...existingDescriptions, ...payload.descriptions })
        : existingDescriptions;
      await connection.execute(
        `UPDATE admin_tenants
            SET customer_payment_methods_json = :methods,
                customer_payment_method_descriptions_json = :descriptions
          WHERE id = :tenantId`,
        {
          methods: JSON.stringify(asChipPaymentMethods(methods)),
          descriptions: JSON.stringify(descriptions),
          tenantId: request.adminAuth.tenantId
        }
      );
      await audit(connection, request, methods);
      await connection.commit();
      return response(methods, activeMethods, descriptions);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
