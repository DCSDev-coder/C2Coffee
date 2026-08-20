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

export async function adminRequest(path, options = {}) {
  const { headers: optionHeaders, ...requestOptions } = options;
  const { accessToken } = loadAdminTokens();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(optionHeaders || {})
  };

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
