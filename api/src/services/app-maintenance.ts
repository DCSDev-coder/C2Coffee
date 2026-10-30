import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env.js';
import { mysqlPool } from '../db/mysql.js';
import { ApiError } from '../http/errors.js';

export type AppMaintenanceState = {
  enabled: boolean;
  allow_employee_bypass: boolean;
  is_employee: boolean;
  blocked: boolean;
  title: string;
  message: string;
  expected_end_at: string | null;
};

type MaintenanceRow = RowDataPacket & {
  enabled: number;
  allow_employee_bypass: number;
  title: string;
  message: string;
  expected_end_at: Date | string | null;
  is_employee: number;
};

function formatDate(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function loadMaintenanceForUser(userId: number): Promise<AppMaintenanceState> {
  const [rows] = await mysqlPool.query<MaintenanceRow[]>(
    `SELECT COALESCE(mm.enabled, 0) AS enabled,
            COALESCE(mm.allow_employee_bypass, 1) AS allow_employee_bypass,
            COALESCE(mm.title, 'C2 Coffee is under maintenance') AS title,
            COALESCE(mm.message, 'We are making improvements. Please check back soon.') AS message,
            mm.expected_end_at,
            COALESCE(ctm.is_employee, 0) AS is_employee
       FROM admin_tenants t
       LEFT JOIN app_maintenance_mode mm ON mm.tenant_id = t.id
       LEFT JOIN customer_tenant_memberships ctm
         ON ctm.tenant_id = t.id AND ctm.user_id = :userId
      WHERE t.code = :tenantCode AND t.status = 'active'
      LIMIT 1`,
    { tenantCode: env.DEPLOYMENT_TENANT_CODE, userId }
  );
  const row = rows[0];
  const enabled = Number(row?.enabled ?? 0) === 1;
  const allowEmployeeBypass = Number(row?.allow_employee_bypass ?? 1) === 1;
  const isEmployee = Number(row?.is_employee ?? 0) === 1;
  return {
    enabled,
    allow_employee_bypass: allowEmployeeBypass,
    is_employee: isEmployee,
    blocked: enabled && !(allowEmployeeBypass && isEmployee),
    title: row?.title ?? 'C2 Coffee is under maintenance',
    message: row?.message ?? 'We are making improvements. Please check back soon.',
    expected_end_at: formatDate(row?.expected_end_at ?? null)
  };
}

export async function assertCustomerAccess(userId: number): Promise<AppMaintenanceState> {
  const state = await loadMaintenanceForUser(userId);
  if (state.blocked) {
    throw new ApiError(503, 'app_maintenance_mode', state.message);
  }
  return state;
}
