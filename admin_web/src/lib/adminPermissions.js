const ALL_ADMIN_WEB_ROLES = ['super_admin', 'admin'];
const PAGE_ROLES = {
  'Barista Console': [...ALL_ADMIN_WEB_ROLES, 'barista'],
  'Barista Workspace': [...ALL_ADMIN_WEB_ROLES, 'barista'],
  Dashboard: [...ALL_ADMIN_WEB_ROLES, 'support_admin'],
  Orders: [...ALL_ADMIN_WEB_ROLES],
  Refunds: [...ALL_ADMIN_WEB_ROLES, 'support_admin'],
  Customers: [...ALL_ADMIN_WEB_ROLES, 'support_admin'],
  Menu: [...ALL_ADMIN_WEB_ROLES],
  'Options & Nutrition': [...ALL_ADMIN_WEB_ROLES],
  Inventory: [...ALL_ADMIN_WEB_ROLES],
  Marketing: [...ALL_ADMIN_WEB_ROLES],
  Voucher: [...ALL_ADMIN_WEB_ROLES],
  'Gift Cards': [...ALL_ADMIN_WEB_ROLES, 'support_admin'],
  'Referral Program': [...ALL_ADMIN_WEB_ROLES],
  'Promotional Add-ons': [...ALL_ADMIN_WEB_ROLES],
  'C2 Credit Ledger': [...ALL_ADMIN_WEB_ROLES],
  'Tier Management': [...ALL_ADMIN_WEB_ROLES],
  Finance: [...ALL_ADMIN_WEB_ROLES],
  ProductReport: [...ALL_ADMIN_WEB_ROLES],
  'Product Report': [...ALL_ADMIN_WEB_ROLES],
  'Barista Management': [...ALL_ADMIN_WEB_ROLES],
  'Staff Guides': [...ALL_ADMIN_WEB_ROLES],
  Operations: [...ALL_ADMIN_WEB_ROLES],
  'Admin Management': [...ALL_ADMIN_WEB_ROLES],
  Outlets: [...ALL_ADMIN_WEB_ROLES],
  'C2 Store Devices': [...ALL_ADMIN_WEB_ROLES],
  'Counter Devices': [...ALL_ADMIN_WEB_ROLES],
  Deployment: [...ALL_ADMIN_WEB_ROLES],
  'Audit Logs': [...ALL_ADMIN_WEB_ROLES],
  'Data Retention': [...ALL_ADMIN_WEB_ROLES],
  Settings: [...ALL_ADMIN_WEB_ROLES, 'support_admin']
};

// Keep browser navigation in sync with the API role guards. Super Admin always
// has full access; the lists above define the least-privileged access model.
export const ADMIN_ROLE_SECTIONS = {
  super_admin: 'All Admin Web sections',
  admin: 'All Admin Web sections; sensitive changes require Super Admin approval',
  support_admin: 'Customer lookup, gift-card lookup, and refund requests',
  barista: 'Barista Console and workspace only'
};

export function canAccessAdminPage(roles, page) {
  const normalizedRoles = Array.isArray(roles) ? roles : [];
  return normalizedRoles.includes('super_admin') || (PAGE_ROLES[page] || []).some((role) => normalizedRoles.includes(role));
}

export function firstAccessibleAdminPage(roles) {
  return Object.keys(PAGE_ROLES).find((page) => canAccessAdminPage(roles, page)) || 'Profile';
}
