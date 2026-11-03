export function getRetryAfterSeconds(body, response) {
  const headerValue = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(headerValue) && headerValue > 0) {
    return Math.ceil(headerValue);
  }

  const message = body?.error?.message || body?.message || "";
  const match = String(message).match(/retry in (\d+) (second|minute|hour)/i);
  if (!match) return 0;

  const value = Number(match[1]);
  const multiplier = match[2].toLowerCase() === "hour"
    ? 3600
    : match[2].toLowerCase() === "minute"
      ? 60
      : 1;
  return Number.isFinite(value) ? value * multiplier : 0;
}

export function formatAdminErrorMessage(body, response) {
  if (
    response?.status === 413 ||
    body?.statusCode === 413 ||
    body?.code === "FST_ERR_CTP_BODY_TOO_LARGE" ||
    body?.error === "Payload Too Large"
  ) {
    return "The uploaded file is too large for the server. Please compress or resize the image before uploading.";
  }

  const code = body?.error?.code || body?.code || "unexpected_error";

  switch (code) {
    case "invalid_admin_credentials":
      return "The admin username or password is incorrect.";
    case "admin_not_active":
      return "This admin account is not active.";
    case "rate_limit_exceeded": {
      const retryAfterSeconds = getRetryAfterSeconds(body, response);
      return retryAfterSeconds > 0
        ? `Too many requests. Please try again in about ${Math.ceil(retryAfterSeconds / 60)} minute${Math.ceil(retryAfterSeconds / 60) === 1 ? "" : "s"}.`
        : "Too many requests. Please wait a few minutes before trying again.";
    }
    case "forbidden":
      return "Your account does not have permission for this action.";
    case "referral_program_busy":
      return "Referral Program data is temporarily locked. Please try again shortly.";
    case "printer_not_ready":
      return "The receipt printer is not ready. Please check its connector.";
    case "validation_error":
      return "Please review the information and try again.";
    case "voucher_employee_only":
      return "This voucher is for employees only. In Customers, choose the customer menu, select Set employee, tick Employee account, then save with your admin password.";
    case "voucher_limit_per_user_reached":
      return "This customer has already received the maximum allowed number of this voucher.";
    case "voucher_has_issuances":
      return "This voucher has already been issued. Create a new voucher to change its reward rules.";
    case "customer_not_found":
      return "No active customer account was found for that phone number.";
    default:
      break;
  }

  if (
    response?.status === 401 ||
    [
      "invalid_access_token",
      "missing_bearer_token",
      "session_not_found",
      "session_version_mismatch",
    ].includes(code)
  ) {
    return "Your admin session has expired. Please sign in again.";
  }

  return "We could not complete this request. Please try again.";
}
