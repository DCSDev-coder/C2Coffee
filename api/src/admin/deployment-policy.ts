import { ApiError } from '../http/errors.js';

export function assertDeploymentTenants(tenants: Array<{ code: string; status: string }>, expectedCode: string): void {
  if (tenants.length !== 1 || tenants[0].code !== expectedCode || tenants[0].status !== 'active') {
    throw new ApiError(503, 'deployment_tenant_mismatch',
      'This deployment requires exactly one active cafe matching DEPLOYMENT_TENANT_CODE. Contact the operator.');
  }
}
