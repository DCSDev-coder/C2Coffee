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
    case "invalid_current_password":
      return "Current password is incorrect.";
    case "admin_action_confirmation_failed":
      return "Current Admin Web password is incorrect.";
    case "counter_exit_password_mismatch":
      return "Counter exit password confirmation does not match.";
    case "counter_exit_password_matches_admin":
      return "Choose a counter exit password that is different from every administrator password.";
    case "refund_self_approval_forbidden":
      return "A different Super Admin must review this refund request.";
    case "provider_refund_reference_required":
      return "Complete the CHIP or payment-provider refund first, then enter its confirmed reference.";
    case "refund_quantity_exceeded":
      return "The selected quantity has already been refunded or exceeds the remaining refundable quantity.";
    case "refund_item_not_found":
      return "One of the selected order items is no longer available for refund.";
    case "refund_amount_zero":
      return "The selected items do not have a refundable payment value.";
    case "partial_refund_gift_card_not_supported":
      return "This order used a gift card. Use the full refund workflow so its value can be restored safely.";
    case "payment_not_refundable":
      return "The payment is not currently in a refundable state. Check its provider status first.";
    case "refund_already_requested":
      return "A refund request already exists for this order.";
    case "refund_already_reviewed":
      return "This refund request has already been reviewed.";
    case "admin_email_conflict":
      return "This email is already used by another administrator.";
    case "admin_email_already_verified":
      return "This recovery email is already verified.";
    case "admin_email_verification_invalid":
      return "The email-verification request or code is invalid.";
    case "admin_email_verification_expired":
      return "This verification code has expired. Request a new code.";
    case "admin_email_verification_blocked":
      return "Too many incorrect codes. Request a new code.";
    case "admin_email_verification_failed":
      return "We could not send the verification code. Please try again shortly.";
    case "password_reset_invalid":
      return "The password-reset request or code is invalid.";
    case "password_reset_expired":
      return "This verification code has expired. Request a new code.";
    case "password_reset_blocked":
      return "Too many incorrect codes. Request a new recovery code.";
    case "password_mismatch":
      return "New password confirmation does not match.";
    case "password_reused":
      return "Choose a new password that is different from your current password.";
    case "password_change_request_invalid":
      return "This password-change request is no longer valid.";
    case "password_change_code_expired":
      return "This verification code has expired. Request a new code.";
    case "password_change_code_blocked":
      return "Too many incorrect codes. Request a new code.";
    case "invalid_password_change_code":
      return "Verification code is incorrect.";
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
