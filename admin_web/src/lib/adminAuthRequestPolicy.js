export const ADMIN_LOGIN_PATH = "/v1/admin/auth/login";
export const ADMIN_REFRESH_PATH = "/v1/admin/auth/refresh";
export const ADMIN_COMPLETE_SETUP_PATH = "/v1/admin/auth/complete-setup";

const nonRefreshableAuthPaths = new Set([
  ADMIN_LOGIN_PATH,
  ADMIN_REFRESH_PATH,
  ADMIN_COMPLETE_SETUP_PATH,
]);

export function shouldAttachStoredAdminAccessToken(path) {
  return path !== ADMIN_LOGIN_PATH && path !== ADMIN_REFRESH_PATH;
}

export function shouldAttemptAdminSessionRefresh({
  path,
  status,
  retryOnUnauthorized,
}) {
  return (
    status === 401 &&
    retryOnUnauthorized &&
    !nonRefreshableAuthPaths.has(path)
  );
}

export function getSafeAdminLoginErrorMessage(error) {
  if (error?.code === "rate_limit_exceeded" || error?.status === 429) {
    return "Too many sign-in attempts. Please wait a few minutes before trying again.";
  }

  if (error?.code === "network_error" || Number(error?.status) >= 500) {
    return "Unable to reach the admin service. Please try again.";
  }

  // Do not reveal whether the tenant, username, password, account status, or
  // request shape caused the rejection. The API applies the same policy.
  return "The admin username or password is incorrect.";
}
