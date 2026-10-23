export const ADMIN_DIALOG_EVENT = "c2-admin-dialog";

function requestDialog(detail) {
  if (typeof window === "undefined") {
    return Promise.resolve(detail.kind === "prompt" ? null : false);
  }
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(ADMIN_DIALOG_EVENT, {
      detail: { ...detail, resolve },
    }));
  });
}

export function requestAdminConfirm(options) {
  const normalized = typeof options === "string" ? { message: options } : options;
  return requestDialog({
    kind: "confirm",
    title: "Please confirm",
    confirmLabel: "Confirm",
    cancelLabel: "Back",
    tone: "warning",
    ...normalized,
  });
}

export function requestAdminPrompt(options) {
  const normalized = typeof options === "string" ? { message: options } : options;
  return requestDialog({
    kind: "prompt",
    title: "Additional information",
    confirmLabel: "Continue",
    cancelLabel: "Back",
    inputLabel: "Details",
    inputType: "text",
    defaultValue: "",
    ...normalized,
  });
}
