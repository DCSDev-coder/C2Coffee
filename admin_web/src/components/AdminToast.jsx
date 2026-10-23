import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { ADMIN_TOAST_EVENT } from "../lib/adminToast";

const DISPLAY_DURATION_MS = 3200;

export default function AdminToast() {
  const [toast, setToast] = useState(null);
  const dismissTimer = useRef(null);

  useEffect(() => {
    const handleToast = (event) => {
      if (dismissTimer.current) {
        window.clearTimeout(dismissTimer.current);
      }

      setToast({
        message: event.detail?.message || "Changes saved successfully.",
        type: event.detail?.type || "success",
      });
      dismissTimer.current = window.setTimeout(() => {
        setToast(null);
        dismissTimer.current = null;
      }, DISPLAY_DURATION_MS);
    };

    window.addEventListener(ADMIN_TOAST_EVENT, handleToast);
    return () => {
      window.removeEventListener(ADMIN_TOAST_EVENT, handleToast);
      if (dismissTimer.current) {
        window.clearTimeout(dismissTimer.current);
      }
    };
  }, []);

  if (!toast) {
    return null;
  }

  const isError = toast.type === "error";
  const StatusIcon = isError ? AlertCircle : CheckCircle2;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[100] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex max-w-[min(92vw,42rem)] items-center gap-3 rounded-full border px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(23,63,55,0.28)] ${isError ? "border-red-200 bg-[#8F3428]" : "border-emerald-200 bg-[#173F37]"}`}
      >
        <StatusIcon className={`h-5 w-5 shrink-0 ${isError ? "text-red-100" : "text-emerald-300"}`} aria-hidden="true" />
        <span>{toast.message}</span>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="ml-1 rounded-full p-1 text-white/75 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss message"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
