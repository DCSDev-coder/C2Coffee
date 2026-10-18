import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CalendarClock, Plus, X } from "lucide-react";

import {
  cancelAdminPaymentServiceNotice,
  createAdminPaymentServiceNotice,
  loadAdminPaymentServiceNotices,
} from "../lib/adminApi";

const EMPTY_FORM = {
  title: "Payment service maintenance",
  message: "",
  startsAt: "",
  endsAt: "",
  paymentMethods: ["fpx", "duitnow_qr"],
};

const PAYMENT_METHODS = [
  { value: "fpx", label: "Online Banking (FPX)" },
  { value: "duitnow_qr", label: "DuitNow QR" },
];

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function methodLabel(value) {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label || value;
}

export default function PaymentServiceNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const visibleNotices = useMemo(
    () => notices.filter((notice) => notice.status === "active" && new Date(notice.ends_at).getTime() > Date.now()),
    [notices],
  );

  async function loadNotices() {
    setLoading(true);
    setError("");
    try {
      const response = await loadAdminPaymentServiceNotices();
      setNotices(Array.isArray(response?.notices) ? response.notices : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load payment notices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotices();
  }, []);

  function toggleMethod(value) {
    setForm((current) => ({
      ...current,
      paymentMethods: current.paymentMethods.includes(value)
        ? current.paymentMethods.filter((method) => method !== value)
        : [...current.paymentMethods, value],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (form.paymentMethods.length === 0) {
      setError("Select at least one affected payment method.");
      return;
    }
    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      setError("Enter a valid end time after the maintenance start time.");
      return;
    }

    setSaving(true);
    try {
      await createAdminPaymentServiceNotice({
        title: form.title.trim(),
        message: form.message.trim(),
        payment_methods: form.paymentMethods,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      });
      setSuccess("Customer notice published and push delivery started.");
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadNotices();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to publish the payment notice.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelNotice(notice) {
    if (!window.confirm("Cancel this customer payment notice? It will disappear from the mobile app.")) return;
    setError("");
    setSuccess("");
    try {
      await cancelAdminPaymentServiceNotice(notice.id);
      setSuccess("Payment service notice cancelled.");
      await loadNotices();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel the payment notice.");
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm">
      <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
            <BellRing size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Payment service notices</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Publish scheduled FPX or DuitNow QR downtime. Customers receive an operational push, a popup, and a pinned inbox notice until the end time.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162A26]"
        >
          <Plus size={16} /> Schedule notice
        </button>
      </div>

      {(error || success) && (
        <div className={`mx-5 mb-4 rounded-lg px-4 py-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {error || success}
        </div>
      )}

      <div className="border-t border-amber-200 bg-white/70 px-5 py-4">
        {loading ? (
          <p className="text-sm text-gray-500">Loading payment notices…</p>
        ) : visibleNotices.length === 0 ? (
          <p className="text-sm text-gray-500">No active or upcoming payment downtime notices.</p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {visibleNotices.map((notice) => (
              <article key={notice.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{notice.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{notice.message}</p>
                  </div>
                  <button type="button" onClick={() => void cancelNotice(notice)} className="text-xs font-semibold text-red-600 hover:text-red-700">
                    Cancel
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                  <CalendarClock size={15} />
                  <span>{formatDateTime(notice.starts_at)} – {formatDateTime(notice.ends_at)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(notice.payment_methods || []).map((method) => (
                    <span key={method} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      {methodLabel(method)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Schedule payment downtime</h3>
                <p className="mt-1 text-sm text-gray-500">Times are entered in your local timezone and saved safely as UTC.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Title
                <input required maxLength={160} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Customer message
                <textarea required maxLength={600} rows={3} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} placeholder="Example: DuitNow QR will be unavailable while CHIP performs scheduled maintenance." className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal" />
              </label>
              <fieldset>
                <legend className="text-sm font-semibold text-gray-700">Affected payment methods</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {PAYMENT_METHODS.map((method) => (
                    <label key={method.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
                      <input type="checkbox" checked={form.paymentMethods.includes(method.value)} onChange={() => toggleMethod(method.value)} />
                      {method.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Starts
                  <input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal" />
                </label>
                <label className="block text-sm font-semibold text-gray-700">
                  Ends
                  <input required type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal" />
                </label>
              </div>
              <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 shrink-0" size={17} />
                This is an operational notice and is sent even when a customer has disabled marketing updates.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
              <button disabled={saving} type="submit" className="rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Publishing…" : "Publish notice"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
