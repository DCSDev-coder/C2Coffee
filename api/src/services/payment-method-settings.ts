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

export const defaultCustomerPaymentMethodDescriptions: Record<CustomerPaymentMethod, string> = {
  fpx: 'Pay from a Malaysian bank account',
  duitnow_qr: 'Scan with a banking or wallet app',
  card: 'Malaysia-issued debit or credit card',
  ewallet: 'ShopeePay and other supported wallets'
};

export function normalizeCustomerPaymentMethodDescriptions(
  raw: unknown
): Record<CustomerPaymentMethod, string> {
  const result = { ...defaultCustomerPaymentMethodDescriptions };
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return result;
  }
  const source = parsed as Record<string, unknown>;
  for (const method of customerPaymentMethods) {
    const value = source[method];
    if (typeof value === 'string') {
      const trimmed = value.trim().slice(0, 160);
      if (trimmed.length > 0) {
        result[method] = trimmed;
      }
    }
  }
  return result;
}

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

export async function loadTenantPaymentMethodDescriptions(
  connection: DbExecutor,
  tenantId: number
): Promise<Record<CustomerPaymentMethod, string>> {
  const [rows] = await connection.execute<Array<RowDataPacket & { customer_payment_method_descriptions_json: unknown }>>(
    `SELECT customer_payment_method_descriptions_json
       FROM admin_tenants WHERE id = :tenantId LIMIT 1`,
    { tenantId }
  );
  return normalizeCustomerPaymentMethodDescriptions(
    rows[0]?.customer_payment_method_descriptions_json
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

export async function loadUserPaymentMethodDescriptions(
  connection: DbExecutor,
  userId: number
): Promise<Record<CustomerPaymentMethod, string>> {
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
  return tenantId
    ? loadTenantPaymentMethodDescriptions(connection, tenantId)
    : { ...defaultCustomerPaymentMethodDescriptions };
}

export function asChipPaymentMethods(methods: CustomerPaymentMethod[]): ChipPaymentMethod[] {
  return methods;
}
