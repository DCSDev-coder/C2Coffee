const PAGE_ROLES = {
  Dashboard: ['super_admin', 'operations_admin', 'marketing_admin', 'support_admin'],
  Orders: ['super_admin', 'operations_admin'],
  Refunds: ['super_admin', 'operations_admin'],
  Customers: ['super_admin', 'support_admin'],
  Menu: ['super_admin', 'marketing_admin'],
  Marketing: ['super_admin', 'marketing_admin'],
  Voucher: ['super_admin', 'marketing_admin'],
  'Loyalty & Tokens': ['super_admin'],
  'Tier Management': ['super_admin'],
  Finance: ['super_admin'],
  ProductReport: ['super_admin', 'marketing_admin'],
  'Product Report': ['super_admin', 'marketing_admin'],
  'Barista Management': ['super_admin', 'operations_admin'],
  'Admin Management': ['super_admin'],
  'Audit Logs': ['super_admin'],
  Settings: ['super_admin', 'operations_admin', 'marketing_admin', 'support_admin']
};

export function canAccessAdminPage(roles, page) {
  const normalizedRoles = Array.isArray(roles) ? roles : [];
  return normalizedRoles.includes('super_admin') || (PAGE_ROLES[page] || []).some((role) => normalizedRoles.includes(role));
}

export function firstAccessibleAdminPage(roles) {
  return Object.keys(PAGE_ROLES).find((page) => canAccessAdminPage(roles, page)) || 'Profile';
}
