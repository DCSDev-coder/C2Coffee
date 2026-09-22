const PAGE_ROLES = {
  'Barista Console': ['super_admin', 'operations_admin', 'barista'],
  'Barista Workspace': ['super_admin', 'operations_admin', 'barista'],
  Dashboard: ['super_admin', 'operations_admin', 'marketing_admin', 'support_admin'],
  Orders: ['super_admin', 'operations_admin'],
  Refunds: ['super_admin', 'operations_admin', 'support_admin'],
  Customers: ['super_admin', 'support_admin'],
  Menu: ['super_admin', 'marketing_admin', 'operations_admin'],
  'Options & Nutrition': ['super_admin', 'marketing_admin', 'operations_admin'],
  Marketing: ['super_admin', 'marketing_admin'],
  Voucher: ['super_admin', 'marketing_admin'],
  'Token Ledger': ['super_admin'],
  'Tier Management': ['super_admin'],
  Finance: ['super_admin'],
  ProductReport: ['super_admin', 'marketing_admin'],
  'Product Report': ['super_admin', 'marketing_admin'],
  'Barista Management': ['super_admin', 'operations_admin'],
  'Staff Guides': ['super_admin', 'operations_admin'],
  Operations: ['super_admin', 'operations_admin'],
  'Admin Management': ['super_admin'],
  'Audit Logs': ['super_admin'],
  Settings: ['super_admin', 'operations_admin', 'marketing_admin', 'support_admin']
};

// Keep browser navigation in sync with the API role guards. Super Admin always
// has full access; the lists above define the least-privileged access model.
export const ADMIN_ROLE_SECTIONS = {
  super_admin: 'All Admin Web sections',
  operations_admin: 'Orders, refunds, menu setup, barista operations, and staff guides',
  marketing_admin: 'Menu, campaigns, vouchers, tiers, and product reports',
  support_admin: 'Customer lookup and refund requests',
  barista: 'Barista Console and workspace only'
};

export function canAccessAdminPage(roles, page) {
  const normalizedRoles = Array.isArray(roles) ? roles : [];
  return normalizedRoles.includes('super_admin') || (PAGE_ROLES[page] || []).some((role) => normalizedRoles.includes(role));
}

export function firstAccessibleAdminPage(roles) {
  return Object.keys(PAGE_ROLES).find((page) => canAccessAdminPage(roles, page)) || 'Profile';
}
