import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env.js';
import type { ChipPaymentMethod } from '../payments/chip-client.js';
import {
  customerPaymentMethods,
  normalizeCustomerPaymentMethods,
  resolveConfiguredCustomerPaymentMethods,
  type CustomerPaymentMethod
} from './payment-method-policy.js';

export { customerPaymentMethods, normalizeCustomerPaymentMethods } from './payment-method-policy.js';
export type { CustomerPaymentMethod } from './payment-method-policy.js';

type DbExecutor = Pick<PoolConnection, 'execute'>;

export const customerPaymentMethodLabels: Record<CustomerPaymentMethod, string> = {
  fpx: 'FPX Online Banking',
  duitnow_qr: 'DuitNow QR',
  card: 'Local cards (Malaysia)',
  ewallet: 'E-wallets'
};

export async function loadTenantPaymentMethodSettings(
  connection: DbExecutor,
  tenantId: number
): Promise<CustomerPaymentMethod[]> {
  const [rows] = await connection.execute<Array<RowDataPacket & { customer_payment_methods_json: unknown }>>(
    `SELECT customer_payment_methods_json
       FROM admin_tenants WHERE id = :tenantId LIMIT 1`,
    { tenantId }
  );
  const raw = rows[0]?.customer_payment_methods_json;
  return resolveConfiguredCustomerPaymentMethods(
    raw,
    env.TOPUP_GATEWAY_ALLOWED_METHODS as readonly string[]
  );
}

export async function loadUserPaymentMethodSettings(
  connection: DbExecutor,
  userId: number
): Promise<CustomerPaymentMethod[]> {
  const [rows] = await connection.execute<Array<RowDataPacket & { tenant_id: number }>>(
    `SELECT ctm.tenant_id
       FROM customer_tenant_memberships ctm
       JOIN admin_tenants t ON t.id = ctm.tenant_id
      WHERE ctm.user_id = :userId
        AND ctm.registration_status = 'registered'
        AND t.status = 'active'
        AND t.code = :tenantCode
      LIMIT 1`,
    { userId, tenantCode: env.DEPLOYMENT_TENANT_CODE }
  );
  const tenantId = Number(rows[0]?.tenant_id ?? 0);
  return tenantId ? loadTenantPaymentMethodSettings(connection, tenantId) : [];
}

export function asChipPaymentMethods(methods: CustomerPaymentMethod[]): ChipPaymentMethod[] {
  return methods;
}
