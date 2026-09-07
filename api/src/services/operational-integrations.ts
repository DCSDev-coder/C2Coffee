export const integrationProviders = ['manual', 'storehub', 'feedme', 'local_print_bridge'] as const;
export type IntegrationProvider = (typeof integrationProviders)[number];

export const integrationCapabilities = [
  'attendance_sync',
  'sales_import',
  'refund_import',
  'customer_lookup',
  'loyalty_sync',
  'receipt_printing'
] as const;
export type IntegrationCapability = (typeof integrationCapabilities)[number];

export type IntegrationStatus = 'not_configured' | 'pending' | 'connected' | 'disabled';

export const defaultCapabilities: Record<IntegrationProvider, IntegrationCapability[]> = {
  manual: [],
  storehub: [],
  feedme: [],
  local_print_bridge: ['receipt_printing']
};

export function parseCapabilities(value: unknown): IntegrationCapability[] {
  if (!Array.isArray(value)) return [];
  return value.filter((capability): capability is IntegrationCapability =>
    typeof capability === 'string' && integrationCapabilities.includes(capability as IntegrationCapability)
  );
}
