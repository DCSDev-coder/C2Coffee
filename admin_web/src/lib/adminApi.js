import { buildFinanceOverview } from '../utils/reporting';

const ACCESS_TOKEN_KEY = 'c2_admin_access_token';
const REFRESH_TOKEN_KEY = 'c2_admin_refresh_token';

export function getAdminApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || 'https://api.c2coffeeandcandle.com';
}

export function loadAdminTokens() {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null };
  }

  return {
    accessToken: window.localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: window.localStorage.getItem(REFRESH_TOKEN_KEY)
  };
}

export function saveAdminTokens({ accessToken, refreshToken }) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearAdminTokens() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function loadAdminTenants() {
  const response = await adminRequest('/v1/admin/tenants');
  return response.tenants || [];
}

export async function loadAdminMenu() {
  return adminRequest('/v1/admin/menu');
}

export async function loadAdminCustomers() {
  return adminRequest('/v1/admin/customers');
}

export async function loadAdminOrders() {
  return adminRequest('/v1/admin/orders');
}

export async function loadAdminRefunds() {
  return adminRequest('/v1/admin/refunds');
}

export async function loadAdminLoyaltyOverview(limit = 50) {
  return adminRequest(`/v1/admin/loyalty/overview?limit=${encodeURIComponent(limit)}`);
}

export async function loadAdminFinanceOverview() {
  const [ordersResponse, refundsResponse] = await Promise.all([
    loadAdminOrders(),
    loadAdminRefunds()
  ]);

  return buildFinanceOverview(
    Array.isArray(ordersResponse?.orders) ? ordersResponse.orders : [],
    Array.isArray(refundsResponse?.refunds) ? refundsResponse.refunds : []
  );
}

export async function loadAdminTierConfigs() {
  return adminRequest('/v1/admin/loyalty/tiers');
}

export async function createAdminTier(payload) {
  return adminRequest('/v1/admin/loyalty/tiers', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAdminTier(tierId, payload) {
  return adminRequest(`/v1/admin/loyalty/tiers/${tierId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteAdminTier(tierId) {
  return adminRequest(`/v1/admin/loyalty/tiers/${tierId}`, {
    method: 'DELETE'
  });
}

export async function createAdminCustomer(payload) {
  return adminRequest('/v1/admin/customers', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAdminCustomer(customerId, payload) {
  return adminRequest(`/v1/admin/customers/${customerId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteAdminCustomer(customerId) {
  return adminRequest(`/v1/admin/customers/${customerId}`, {
    method: 'DELETE'
  });
}

export async function createAdminMenuItem(payload) {
  return adminRequest('/v1/admin/menu/items', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function createAdminMenuSubcategory(payload) {
  return adminRequest('/v1/admin/menu/subcategories', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function createAdminMenuCategory(payload) {
  return adminRequest('/v1/admin/menu/categories', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAdminMenuCategory(categoryId, payload) {
  return adminRequest(`/v1/admin/menu/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function updateAdminMenuSubcategory(subcategoryId, payload) {
  return adminRequest(`/v1/admin/menu/subcategories/${subcategoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteAdminMenuCategory(categoryId) {
  return adminRequest(`/v1/admin/menu/categories/${categoryId}`, {
    method: 'DELETE'
  });
}

export async function deleteAdminMenuSubcategory(subcategoryId) {
  return adminRequest(`/v1/admin/menu/subcategories/${subcategoryId}`, {
    method: 'DELETE'
  });
}

export async function updateAdminMenuItem(menuItemId, payload) {
  return adminRequest(`/v1/admin/menu/items/${menuItemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteAdminMenuItem(menuItemId) {
  return adminRequest(`/v1/admin/menu/items/${menuItemId}`, {
    method: 'DELETE'
  });
}

export async function uploadAdminMenuImage(file) {
  const dataUrl = await readFileAsDataUrl(file);
  return adminRequest('/v1/admin/menu/uploads', {
    method: 'POST',
    body: JSON.stringify({
      file_name: file.name,
      mime_type: file.type || 'image/png',
      data_url: dataUrl
    })
  });
}

export async function adminRequest(path, options = {}) {
  const { headers: optionHeaders, ...requestOptions } = options;
  const { accessToken } = loadAdminTokens();
  const headers = {
    Accept: 'application/json',
    ...(optionHeaders || {})
  };

  const hasBody = requestOptions.body !== undefined && requestOptions.body !== null;
  const isFormData = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;

  if (hasBody && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${getAdminApiBaseUrl()}${path}`, {
    ...requestOptions,
    headers
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message = body?.error?.message || 'Unexpected admin API error.';
    const code = body?.error?.code || 'unexpected_error';
    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    throw error;
  }

  return body;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
}
