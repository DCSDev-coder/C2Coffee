import { ApiError } from '../http/errors.js';

const tenantRoles = new Set(['super_admin', 'operations_admin', 'marketing_admin', 'support_admin', 'barista']);

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
