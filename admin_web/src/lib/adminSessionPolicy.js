const terminalSessionCodes = new Set([
  'invalid_refresh_token',
  'invalid_access_token',
  'session_not_found',
  'session_version_mismatch',
  'admin_not_active',
]);

// Only the server can establish that a refresh session is no longer usable.
export function isTerminalAdminSessionFailure(error) {
  return error?.status === 401 || terminalSessionCodes.has(error?.code);
}
