import React, { useEffect, useState } from "react";
import { FileText, KeyRound, Palette, ShieldCheck, Store } from "lucide-react";
import {
  loadAdminAppearance,
  loadAdminStore,
  updateAdminAppearance,
  updateAdminStoreName,
} from "../lib/adminApi";

const defaultAppearance = {
  primary_color: "#2E5E58",
  secondary_color: "#D4AF7A",
  text_color: "#2C2C2C",
  background_color: "#FFFFFF",
  muted_text_color: "#6B7280",
};

const contrastRatio = (first, second) => {
  const luminance = (hex) => {
    const channels = String(hex)
      .replace("#", "")
      .match(/^[0-9A-Fa-f]{6}$/)
      ? String(hex).replace("#", "").match(/.{2}/g)
      : null;
    if (!channels) return null;
    const linearChannels = channels
      .map((channel) => parseInt(channel, 16) / 255)
      .map((value) =>
        value <= 0.03928
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4,
      );
    return linearChannels[0] * 0.2126 + linearChannels[1] * 0.7152 + linearChannels[2] * 0.0722;
  };
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  if (firstLuminance === null || secondLuminance === null) return 0;
  const [lighter, darker] = [firstLuminance, secondLuminance].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
};

const Settings = ({ setCurrentPage, currentUser }) => {
  const canViewAuditLogs =
    Array.isArray(currentUser?.roles) &&
    currentUser.roles.includes("super_admin");
  const canManageStore =
    Array.isArray(currentUser?.roles) &&
    currentUser.roles.some((role) =>
      ["super_admin", "operations_admin"].includes(role),
    );
  const [storeName, setStoreName] = useState("");
  const [storeMessage, setStoreMessage] = useState("");
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [appearance, setAppearance] = useState(defaultAppearance);
  const [appearanceMessage, setAppearanceMessage] = useState("");
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);

  useEffect(() => {
    if (!canManageStore) return;
    loadAdminStore()
      .then(({ store }) => setStoreName(store?.name || ""))
      .catch(() =>
        setStoreMessage(
          "The outlet name could not be loaded. Please refresh and try again.",
        ),
      );
  }, [canManageStore]);

  useEffect(() => {
    if (!canViewAuditLogs) return;
    loadAdminAppearance()
      .then(({ appearance: value }) =>
        setAppearance({
          ...defaultAppearance,
          ...Object.fromEntries(
            Object.entries(value || {}).filter(([, color]) => Boolean(color)),
          ),
        }),
      )
      .catch(() =>
        setAppearanceMessage(
          "The app appearance could not be loaded. Please refresh and try again.",
        ),
      );
  }, [canViewAuditLogs]);

  const saveStoreName = async () => {
    const name = storeName.trim();
    if (name.length < 2) {
      setStoreMessage("Enter an outlet name with at least two characters.");
      return;
    }
    setIsSavingStore(true);
    setStoreMessage("");
    try {
      const { store } = await updateAdminStoreName(name);
      setStoreName(store?.name || name);
      setStoreMessage(
        "Outlet name saved. This updates the customer app label only.",
      );
    } catch {
      setStoreMessage("The outlet name could not be saved. Please try again.");
    } finally {
      setIsSavingStore(false);
    }
  };

  const saveAppearance = async () => {
    setIsSavingAppearance(true);
    setAppearanceMessage("");
    try {
      const { appearance: saved } = await updateAdminAppearance(appearance);
      setAppearance({
        ...appearance,
        ...Object.fromEntries(
          Object.entries(saved || {}).filter(([, color]) => Boolean(color)),
        ),
      });
      setAppearanceMessage(
        "App appearance saved. Customers receive it after their next app refresh or sign-in.",
      );
    } catch {
      setAppearanceMessage(
        "The app appearance could not be saved. Use a valid six-digit colour and try again.",
      );
    } finally {
      setIsSavingAppearance(false);
    }
  };

  const textContrast = contrastRatio(
    appearance.text_color,
    appearance.background_color,
  );
  const mutedContrast = contrastRatio(
    appearance.muted_text_color,
    appearance.background_color,
  );
  const hasAccessibleText = textContrast >= 4.5 && mutedContrast >= 4.5;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 lg:p-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Account security and system records.
        </p>

        <section className="mt-7 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1F3A34] text-white">
              <ShieldCheck size={23} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Account Security
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Change your password with an email verification code.
              </p>
              <button
                onClick={() => setCurrentPage?.("Profile")}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white hover:bg-[#2E5E58]"
              >
                <KeyRound size={16} /> Open Account Security
              </button>
            </div>
          </div>
        </section>

        {canManageStore && (
          <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1F3A34] text-white">
                <Store size={23} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-gray-900">
                  Customer Outlet
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  C2 Coffee currently accepts customer orders for one outlet.
                  You can change its displayed name here; location routing is
                  managed separately.
                </p>
                <label
                  className="mt-4 block text-sm font-bold text-gray-700"
                  htmlFor="customer-outlet-name"
                >
                  Displayed outlet name
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input
                    id="customer-outlet-name"
                    value={storeName}
                    onChange={(event) => setStoreName(event.target.value)}
                    maxLength={120}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#2E5E58]"
                  />
                  <button
                    type="button"
                    disabled={isSavingStore}
                    onClick={saveStoreName}
                    className="rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingStore ? "Saving..." : "Save name"}
                  </button>
                </div>
                {storeMessage && (
                  <p className="mt-2 text-sm text-gray-600" role="status">
                    {storeMessage}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {canViewAuditLogs && (
          <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1F3A34] text-white">
                <Palette size={23} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-gray-900">
                  App Appearance
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Primary controls actions, supporting controls selected
                  surfaces, text controls headings and labels, and background
                  and muted text complete the customer app palette.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {[
                    ["primary_color", "Primary colour"],
                    ["secondary_color", "Supporting colour"],
                    ["text_color", "Text colour"],
                    ["background_color", "Background colour"],
                    ["muted_text_color", "Muted text colour"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="block text-sm font-bold text-gray-700"
                    >
                      {label}
                      <span className="mt-2 flex items-center gap-2 rounded-lg border border-gray-300 p-1.5">
                        <input
                          type="color"
                          value={appearance[key]}
                          onChange={(event) =>
                            setAppearance((current) => ({
                              ...current,
                              [key]: event.target.value.toUpperCase(),
                            }))
                          }
                          className="h-9 w-11 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        <input
                          value={appearance[key]}
                          maxLength={7}
                          onChange={(event) =>
                            setAppearance((current) => ({
                              ...current,
                              [key]: event.target.value.toUpperCase(),
                            }))
                          }
                          className="min-w-0 flex-1 border-0 px-2 py-1 text-sm uppercase outline-none"
                          aria-label={`${label} hex value`}
                        />
                      </span>
                    </label>
                  ))}
                </div>
                <div
                  className="mt-5 rounded-xl border p-4"
                  style={{
                    backgroundColor: appearance.background_color,
                    borderColor: appearance.secondary_color,
                  }}
                >
                  <p
                    className="font-serif text-xl font-bold"
                    style={{ color: appearance.text_color }}
                  >
                    Customer app preview
                  </p>
                  <p className="mt-1 text-sm" style={{ color: appearance.muted_text_color }}>
                    Body and muted wording remain readable on this background.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span
                      className="rounded-full px-3 py-1 text-sm font-bold"
                      style={{
                        backgroundColor: appearance.secondary_color,
                        color: appearance.text_color,
                      }}
                    >
                      Selected
                    </span>
                    <span
                      className="rounded-lg px-3 py-2 text-sm font-bold text-white"
                      style={{ backgroundColor: appearance.primary_color }}
                    >
                      Main action
                    </span>
                    <span
                      className={hasAccessibleText ? "text-emerald-700" : "text-red-700"}
                    >
                      Text {textContrast.toFixed(1)}:1 · Muted {mutedContrast.toFixed(1)}:1
                    </span>
                  </div>
                  {!hasAccessibleText && (
                    <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
                      Text and muted text must each have at least 4.5:1 contrast against the background.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isSavingAppearance || !hasAccessibleText}
                  onClick={saveAppearance}
                  className="mt-4 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingAppearance ? "Saving..." : "Save appearance"}
                </button>
                {appearanceMessage && (
                  <p className="mt-2 text-sm text-gray-600" role="status">
                    {appearanceMessage}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {canViewAuditLogs && (
          <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1F3A34] text-white">
                <FileText size={23} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Audit Logs</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Review recorded administrative activity, including password
                  changes.
                </p>
                <button
                  onClick={() => setCurrentPage?.("Audit Logs")}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#1F3A34] px-4 py-2 text-sm font-bold text-[#1F3A34] hover:bg-[#F3F7F5]"
                >
                  View Audit Logs
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Settings;
