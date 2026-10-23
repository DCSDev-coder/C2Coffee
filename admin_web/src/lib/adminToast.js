export const ADMIN_TOAST_EVENT = "c2-admin-toast";

export function showAdminToast(message, type = "success") {
  if (typeof window === "undefined" || !message) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(ADMIN_TOAST_EVENT, {
      detail: { message, type },
    }),
  );
}

export function showAdminSuccess(message = "Changes saved successfully.") {
  showAdminToast(message, "success");
}

export function showAdminError(message = "We could not complete this request. Please try again.") {
  showAdminToast(message, "error");
}
