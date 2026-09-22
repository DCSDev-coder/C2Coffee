import React, { useEffect, useState } from "react";
import { FileText, KeyRound, Palette, ShieldCheck, Smartphone, Store } from "lucide-react";
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

const appearanceFields = [
  ["primary_color", "Primary colour"],
  ["secondary_color", "Supporting colour"],
  ["text_color", "Text colour"],
  ["background_color", "Background colour"],
  ["muted_text_color", "Muted text colour"],
];

const normalizeTierAppearances = (tiers, fallback) =>
  Array.isArray(tiers)
    ? tiers.map((tier) => ({
        ...fallback,
        ...tier,
      }))
    : [];

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
  const [tierAppearances, setTierAppearances] = useState([]);
  const [tierAppearancesAvailable, setTierAppearancesAvailable] = useState(null);
  const [previewTierId, setPreviewTierId] = useState(null);
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
      .then(({ appearance: value, tier_appearances: tiers }) => {
        const nextAppearance = {
          ...defaultAppearance,
          ...Object.fromEntries(
            Object.entries(value || {}).filter(([, color]) => Boolean(color)),
          ),
        };
        const nextTierAppearances = normalizeTierAppearances(
          tiers,
          nextAppearance,
        );
        setAppearance(nextAppearance);
        setTierAppearances(nextTierAppearances);
        setTierAppearancesAvailable(Array.isArray(tiers));
        setPreviewTierId(nextTierAppearances[0]?.tier_id ?? null);
      })
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
      const { appearance: saved, tier_appearances: savedTiers } =
        await updateAdminAppearance({
          ...appearance,
          tier_appearances: tierAppearances.map((tier) =>
            Object.fromEntries([
              ["tier_id", tier.tier_id],
              ...appearanceFields.map(([key]) => [key, tier[key]]),
            ]),
          ),
        });
      const nextAppearance = {
        ...appearance,
        ...Object.fromEntries(
          Object.entries(saved || {}).filter(([, color]) => Boolean(color)),
        ),
      };
      setAppearance(nextAppearance);
      setTierAppearances(normalizeTierAppearances(savedTiers, nextAppearance));
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

  const selectedTierAppearance =
    tierAppearances.find((tier) => tier.tier_id === previewTierId) || null;
  const previewAppearance = selectedTierAppearance || appearance;
  const previewTierName = selectedTierAppearance?.name || "Customer";
  const paletteContrast = (palette) => ({
    text: contrastRatio(palette.text_color, palette.background_color),
    muted: contrastRatio(palette.muted_text_color, palette.background_color),
  });
  const previewContrast = paletteContrast(previewAppearance);
  const isAccessiblePalette = (palette) => {
    const contrast = paletteContrast(palette);
    return contrast.text >= 4.5 && contrast.muted >= 4.5;
  };
  const hasAccessibleText = [appearance, ...tierAppearances].every(
    isAccessiblePalette,
  );

  const updateTierAppearance = (key, value) => {
    if (!selectedTierAppearance) return;
    setTierAppearances((current) =>
      current.map((tier) =>
        tier.tier_id === selectedTierAppearance.tier_id
          ? { ...tier, [key]: value.toUpperCase() }
          : tier,
      ),
    );
  };

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
                  Set a fallback palette and an individual palette for every
                  loyalty tier. Customers receive the palette for their tier
                  after the next app refresh or sign-in.
                </p>
                <p className="mt-4 text-sm font-bold text-gray-800">
                  Fallback palette
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {appearanceFields.map(([key, label]) => (
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
                <div className="mt-7 border-t border-gray-200 pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Tier palettes
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Choose a tier to edit the colours its members see.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#EDF6F3] px-3 py-1 text-xs font-bold text-[#2E5E58]">
                      {tierAppearancesAvailable === false
                        ? "API update required"
                        : `${tierAppearances.length} active tiers`}
                    </span>
                  </div>
                  {tierAppearances.length > 0 ? (
                    <>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {tierAppearances.map((tier) => (
                          <button
                            key={tier.tier_id}
                            type="button"
                            onClick={() => setPreviewTierId(tier.tier_id)}
                            className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                              tier.tier_id === previewTierId
                                ? "border-[#1F3A34] bg-[#1F3A34] text-white"
                                : "border-gray-300 bg-white text-gray-700 hover:border-[#6F9F96]"
                            }`}
                          >
                            {tier.name}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {appearanceFields.map(([key, label]) => (
                          <label
                            key={`tier-${key}`}
                            className="block text-sm font-bold text-gray-700"
                          >
                            {label}
                            <span className="mt-2 flex items-center gap-2 rounded-lg border border-gray-300 p-1.5">
                              <input
                                type="color"
                                value={selectedTierAppearance?.[key] || appearance[key]}
                                onChange={(event) => updateTierAppearance(key, event.target.value)}
                                className="h-9 w-11 cursor-pointer rounded border-0 bg-transparent p-0"
                              />
                              <input
                                value={selectedTierAppearance?.[key] || appearance[key]}
                                maxLength={7}
                                onChange={(event) => updateTierAppearance(key, event.target.value)}
                                className="min-w-0 flex-1 border-0 px-2 py-1 text-sm uppercase outline-none"
                                aria-label={`${previewTierName} ${label} hex value`}
                              />
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : tierAppearancesAvailable === false ? (
                    <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      The connected API has not been updated for tier palettes yet. Deploy the latest API and run its database migrations, then refresh this page.
                    </p>
                  ) : (
                    <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      No active tiers are available to configure yet.
                    </p>
                  )}
                </div>
                <div className="mt-6 grid gap-5 rounded-2xl border border-[#D7E4E0] bg-[#F8FBFA] p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-[#1F3A34]">
                      <Smartphone size={20} />
                      <h3 className="text-lg font-bold">Customer app preview</h3>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      This is the mobile layout for the selected {previewTierName} tier, including the header, membership card, action button, and navigation.
                    </p>
                    <p className={hasAccessibleText ? "mt-3 text-sm font-semibold text-emerald-700" : "mt-3 text-sm font-semibold text-red-700"}>
                      Text {previewContrast.text.toFixed(1)}:1 · Muted {previewContrast.muted.toFixed(1)}:1
                    </p>
                    {!hasAccessibleText && (
                      <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
                        Text and muted text must each have at least 4.5:1 contrast against the background for every tier.
                      </p>
                    )}
                  </div>
                  <div className="mx-auto w-full max-w-[300px] rounded-[2.5rem] border-[7px] border-[#17211E] bg-[#17211E] p-1.5 shadow-xl">
                    <div className="overflow-hidden rounded-[2rem]" style={{ backgroundColor: previewAppearance.background_color }}>
                      <div className="flex h-8 items-center justify-between px-5 text-[9px] font-bold" style={{ color: previewAppearance.text_color }}>
                        <span>9:41</span><span>● ● ●  Wi-Fi</span>
                      </div>
                      <div className="px-5 pb-5 pt-3" style={{ backgroundColor: previewAppearance.primary_color }}>
                        <p className="font-serif text-xl font-black tracking-wide text-white">C2 COFFEE</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-white/80">C2 Coffee Broga</p>
                      </div>
                      <div className="px-4 py-4">
                        <p className="text-[11px] font-semibold" style={{ color: previewAppearance.muted_text_color }}>GOOD MORNING</p>
                        <div className="mt-2 rounded-2xl p-3" style={{ backgroundColor: previewAppearance.secondary_color }}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-bold" style={{ color: previewAppearance.text_color }}>YOUR TIER</p>
                              <p className="mt-1 text-lg font-black" style={{ color: previewAppearance.text_color }}>{previewTierName}</p>
                            </div>
                            <span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-bold" style={{ color: previewAppearance.text_color }}>120 tokens</span>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70"><div className="h-full w-3/5 rounded-full" style={{ backgroundColor: previewAppearance.primary_color }} /></div>
                        </div>
                        <p className="mt-4 text-sm font-black" style={{ color: previewAppearance.text_color }}>Today&apos;s favourites</p>
                        <div className="mt-2 flex gap-2"><div className="h-16 flex-1 rounded-xl" style={{ backgroundColor: previewAppearance.primary_color, opacity: 0.15 }} /><div className="h-16 flex-1 rounded-xl" style={{ backgroundColor: previewAppearance.secondary_color }} /></div>
                        <button type="button" className="mt-4 w-full rounded-xl py-2.5 text-xs font-black text-white" style={{ backgroundColor: previewAppearance.primary_color }}>ORDER NOW</button>
                      </div>
                      <div className="flex justify-around border-t px-3 py-2 text-[9px] font-bold" style={{ borderColor: `${previewAppearance.muted_text_color}33`, color: previewAppearance.muted_text_color }}>
                        <span>HOME</span><span>MENU</span><span>ORDERS</span><span>PROFILE</span>
                      </div>
                    </div>
                  </div>
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
