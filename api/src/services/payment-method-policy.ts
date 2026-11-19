export const customerPaymentMethods = ['fpx', 'duitnow_qr', 'card', 'ewallet'] as const;
export type CustomerPaymentMethod = typeof customerPaymentMethods[number];

function validMethods(value: unknown): CustomerPaymentMethod[] {
  if (!Array.isArray(value)) return [];
  return customerPaymentMethods.filter((method) => value.includes(method));
}

export function normalizeCustomerPaymentMethods(value: unknown): CustomerPaymentMethod[] {
  return validMethods(value);
}

export function resolveConfiguredCustomerPaymentMethods(
  raw: unknown,
  deploymentAllowlist: readonly string[]
): CustomerPaymentMethod[] {
  const fallback = customerPaymentMethods.filter((method) => deploymentAllowlist.includes(method));
  if (raw === null || raw === undefined) return fallback;

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const configured = validMethods(parsed);
    return configured.filter((method) => fallback.includes(method));
  } catch {
    return [];
  }
}
