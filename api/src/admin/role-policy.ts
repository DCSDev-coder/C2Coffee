import { ApiError } from '../http/errors.js';

// Keep legacy codes accepted during the migration window; migration 160
// converts their assignments to the consolidated `admin` role.
const tenantRoles = new Set(['super_admin', 'admin', 'operations_admin', 'marketing_admin', 'support_admin', 'barista']);

export function assertTenantRoleAssignment(roles: string[]): void {
  if (roles.some((role) => !tenantRoles.has(role))) {
    throw new ApiError(403, 'admin_forbidden', 'Platform permissions cannot be assigned through tenant account management.');
  }
}

export function assertTenantAccountEditable(existingRoles: string[]): void {
  if (existingRoles.includes('platform_admin')) {
    throw new ApiError(403, 'admin_forbidden', 'Platform accounts must be managed by the platform operator.');
  }
}
