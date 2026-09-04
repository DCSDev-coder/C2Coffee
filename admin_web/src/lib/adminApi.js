const ACCESS_TOKEN_KEY = 'c2_admin_access_token';
const REFRESH_TOKEN_KEY = 'c2_admin_refresh_token';
const ADMIN_REFRESH_PATH = '/v1/admin/auth/refresh';
const ADMIN_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://api.c2coffeeandcandle.com')
  .replace(/\/$/, '');

let refreshSessionPromise = null;

export function getAdminApiBaseUrl() {
  return ADMIN_API_BASE_URL;
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

function buildAdminError(message, code = 'unexpected_error', status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function broadcastAdminSessionExpired() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event('c2-admin-session-expired'));
}

async function refreshAdminSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const { refreshToken } = loadAdminTokens();
  if (!refreshToken) {
    return null;
  }

  if (!refreshSessionPromise) {
    refreshSessionPromise = (async () => {
      let response;
      try {
        response = await fetch(`${getAdminApiBaseUrl()}${ADMIN_REFRESH_PATH}`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
      } catch {
        throw buildAdminError('We could not refresh your admin session. Please try again.', 'network_error', 503);
      }

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const body = isJson ? await response.json().catch(() => null) : null;

      if (!response.ok) {
        const code = body?.error?.code || 'invalid_refresh_token';
        const message = code === 'invalid_refresh_token'
          ? 'Your admin session has expired. Please sign in again.'
          : body?.error?.message || 'We could not refresh your admin session. Please sign in again.';

        clearAdminTokens();
        broadcastAdminSessionExpired();

        throw buildAdminError(message, code, response.status);
      }

      saveAdminTokens({
        accessToken: body?.access_token || '',
        refreshToken: body?.refresh_token || refreshToken
      });

      return body;
    })().finally(() => {
      refreshSessionPromise = null;
    });
  }

  return refreshSessionPromise;
}

function formatAdminErrorMessage(body, response) {
  const code = body?.error?.code || 'unexpected_error';
  const message = body?.error?.message || '';

  if (response.status === 401 || ['invalid_access_token', 'missing_bearer_token', 'session_not_found', 'session_version_mismatch'].includes(code)) {
    return 'Your admin session has expired. Please sign in again.';
  }

  if (code === 'unexpected_error') {
    return 'We could not complete this request. Please try again.';
  }

  return message || 'We could not complete this request. Please try again.';
}

export async function loadAdminTenants() {
  const response = await adminRequest('/v1/admin/tenants');
  return response.tenants || [];
}

export function requestAdminPasswordChange(payload) {
  return adminRequest('/v1/admin/auth/password-change/request', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function confirmAdminPasswordChange(payload) {
  return adminRequest('/v1/admin/auth/password-change/confirm', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function loadAdminMenu() {
  return adminRequest('/v1/admin/menu');
}

export async function loadAdminHomeFeatured() {
  return adminRequest('/v1/admin/home-featured');
}

export async function saveAdminHomeFeatured(section, itemIds) {
  return adminRequest('/v1/admin/home-featured', {
    method: 'PUT',
    body: JSON.stringify({ section, itemIds })
  });
}

export async function loadAdminProductReport(selectedDate = null) {
  const query = selectedDate ? `?selected_date=${encodeURIComponent(selectedDate.toISOString())}` : '';
  return adminRequest(`/v1/admin/reports/products${query}`);
}

export async function loadAdminCustomers() {
  return adminRequest('/v1/admin/customers');
}

export async function loadAdminOrders(params = {}) {
  const query = params.limit ? `?limit=${encodeURIComponent(params.limit)}` : '';
  return adminRequest(`/v1/admin/orders${query}`);
}

export async function loadAdminDashboard(date = null) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return adminRequest(`/v1/admin/dashboard${query}`);
}

export async function loadAdminRefunds(params = {}) {
  const query = params.limit ? `?limit=${encodeURIComponent(params.limit)}` : '';
  return adminRequest(`/v1/admin/refunds${query}`);
}

export async function createAdminRefund(orderId, reason) {
  return adminRequest('/v1/admin/refunds', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, reason })
  });
}

export async function reviewAdminRefund(refundRef, decision) {
  return adminRequest(`/v1/admin/refunds/${encodeURIComponent(refundRef)}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ decision })
  });
}

export async function loadAdminVouchers() {
  return adminRequest('/v1/admin/vouchers');
}

export async function loadAdminAuditLogs(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.search) {
    searchParams.set('search', params.search);
  }
  if (params.targetType) {
    searchParams.set('target_type', params.targetType);
  }
  if (params.actionCode) {
    searchParams.set('action_code', params.actionCode);
  }
  if (params.selectedDate instanceof Date && !Number.isNaN(params.selectedDate.getTime())) {
    searchParams.set('selected_date', params.selectedDate.toISOString());
  }
  if (params.limit) {
    searchParams.set('limit', String(params.limit));
  }

  const query = searchParams.toString();
  return adminRequest(`/v1/admin/audit-logs${query ? `?${query}` : ''}`);
}

export async function loadAdminMarketingBanners(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.search) {
    searchParams.set('search', params.search);
  }
  if (params.bannerType) {
    searchParams.set('banner_type', params.bannerType);
  }
  if (params.placement) {
    searchParams.set('placement', params.placement);
  }
  if (params.isActive !== undefined && params.isActive !== null && params.isActive !== '') {
    searchParams.set('is_active', params.isActive ? '1' : '0');
  }

  const query = searchParams.toString();
  return adminRequest(`/v1/admin/marketing/banners${query ? `?${query}` : ''}`);
}

export async function createAdminMarketingBanner(payload) {
  return adminRequest('/v1/admin/marketing/banners', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAdminMarketingBanner(bannerId, payload) {
  return adminRequest(`/v1/admin/marketing/banners/${bannerId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteAdminMarketingBanner(bannerId) {
  return adminRequest(`/v1/admin/marketing/banners/${bannerId}`, {
    method: 'DELETE'
  });
}

export async function loadAdminLoyaltyOverview(limit = 50) {
  return adminRequest(`/v1/admin/loyalty/overview?limit=${encodeURIComponent(limit)}`);
}

export async function adjustAdminCustomerTokens(customerId, payload) {
  return adminRequest(`/v1/admin/loyalty/customers/${customerId}/adjustment`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function loadAdminFinanceOverview() {
  return adminRequest('/v1/admin/finance/overview');
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

export async function deleteAdminCustomer(customerId, payload) {
  return adminRequest(`/v1/admin/customers/${customerId}`, {
    method: 'DELETE',
    body: JSON.stringify(payload)
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

export async function adminRequest(path, options = {}, retryOnUnauthorized = true) {
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

  let response;
  try {
    response = await fetch(`${getAdminApiBaseUrl()}${path}`, {
      ...requestOptions,
      headers
    });
  } catch {
    throw buildAdminError('We could not reach the admin service. Please check your connection and try again.', 'network_error', 503);
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json().catch(() => null) : null;

  if (response.status === 401 && retryOnUnauthorized && path !== ADMIN_REFRESH_PATH) {
    try {
      await refreshAdminSession();
      return adminRequest(path, options, false);
    } catch (refreshError) {
      if (refreshError instanceof Error) {
        throw refreshError;
      }

      throw buildAdminError('Your admin session has expired. Please sign in again.', 'invalid_refresh_token', 401);
    }
  }

  if (!response.ok) {
    const message = formatAdminErrorMessage(body, response);
    const code = body?.error?.code || 'unexpected_error';
    throw buildAdminError(message, code, response.status);
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
