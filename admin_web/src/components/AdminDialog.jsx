import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle, ShieldCheck, X } from "lucide-react";
import { ADMIN_DIALOG_EVENT } from "../lib/adminDialog";

export default function AdminDialog() {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const open = (event) => {
      setDialog(event.detail);
      setValue(event.detail?.defaultValue || "");
    };
    window.addEventListener(ADMIN_DIALOG_EVENT, open);
    return () => window.removeEventListener(ADMIN_DIALOG_EVENT, open);
  }, []);

  useEffect(() => {
    if (dialog?.kind === "prompt") inputRef.current?.focus();
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        dialog.resolve(dialog.kind === "prompt" ? null : false);
        setDialog(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog]);

  if (!dialog) return null;

  const close = () => {
    dialog.resolve(dialog.kind === "prompt" ? null : false);
    setDialog(null);
  };
  const submit = (event) => {
    event.preventDefault();
    if (dialog.kind === "prompt" && dialog.required !== false && !value.trim()) return;
    dialog.resolve(dialog.kind === "prompt" ? value.trim() : true);
    setDialog(null);
  };
  const destructive = dialog.tone === "danger";
  const Icon = dialog.tone === "secure" ? ShieldCheck : destructive ? AlertTriangle : HelpCircle;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title" className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.35)]">
        <div className={`flex items-start gap-4 px-6 pb-5 pt-6 ${destructive ? "bg-red-50" : "bg-[#F0F7F5]"}`}>
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${destructive ? "bg-red-100 text-red-700" : "bg-[#DCEDE8] text-[#173F37]"}`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="admin-dialog-title" className="text-xl font-bold text-slate-900">{dialog.title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">{dialog.message}</p>
          </div>
          <button type="button" onClick={close} className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/80 hover:text-slate-700" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {dialog.kind === "prompt" && (
          <div className="px-6 pt-5">
            <label className="text-sm font-bold text-slate-800">
              {dialog.inputLabel}
              {dialog.multiline ? (
                <textarea ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} rows={4} maxLength={dialog.maxLength || 500} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#2E5E58] focus:ring-4 focus:ring-[#DCEDE8]" />
              ) : (
                <input ref={inputRef} type={dialog.inputType || "text"} value={value} onChange={(event) => setValue(event.target.value)} maxLength={dialog.maxLength || 500} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#2E5E58] focus:ring-4 focus:ring-[#DCEDE8]" />
              )}
            </label>
          </div>
        )}
        <div className="flex justify-end gap-3 px-6 py-5">
          <button type="button" onClick={close} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">{dialog.cancelLabel}</button>
          <button type="submit" disabled={dialog.kind === "prompt" && dialog.required !== false && !value.trim()} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${destructive ? "bg-red-700 hover:bg-red-800" : "bg-[#173F37] hover:bg-[#24594E]"}`}>{dialog.confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}
