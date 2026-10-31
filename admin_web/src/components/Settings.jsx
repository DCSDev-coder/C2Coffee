import React, { useEffect, useState } from "react";
import { FileText, KeyRound, Palette, ShieldCheck, Smartphone, Store, Wrench } from "lucide-react";
import {
  loadAdminAppearance,
  loadAdminStore,
  updateAdminAppearance,
  updateAdminStoreName,
  loadAdminMaintenance,
  updateAdminMaintenance,
} from "../lib/adminApi";
import InfoTooltip from "./InfoTooltip";

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
  const [maintenance, setMaintenance] = useState({ enabled: false, title: "C2 Coffee is under maintenance", message: "We are making improvements. Please check back soon.", expected_end_at: null });
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);

  useEffect(() => {
    let active = true;
    loadAdminStore()
      .then((data) => {
        if (!active) return;
        setStoreName(data?.store?.name || "");
      })
      .catch(() => {});
    loadAdminAppearance()
      .then((data) => {
        if (!active) return;
        const baseAppearance = {
          ...defaultAppearance,
          ...Object.fromEntries(
            Object.entries(data?.appearance || {}).filter(([, color]) =>
              Boolean(color),
            ),
          ),
        };
        setAppearance(baseAppearance);
        setTierAppearances(
          normalizeTierAppearances(data?.tier_appearances, baseAppearance),
        );
        setTierAppearancesAvailable(Array.isArray(data?.tier_appearances));
        setPreviewTierId(data?.tier_appearances?.[0]?.tier_id || null);
      })
      .catch(() => {
        if (!active) return;
        setTierAppearancesAvailable(false);
      });
    loadAdminMaintenance()
      .then((data) => {
        if (!active) return;
        setMaintenance((current) => ({ ...current, ...data?.maintenance }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const saveStoreName = async () => {
    setIsSavingStore(true);
    setStoreMessage("");
    try {
      const { store } = await updateAdminStoreName(storeName);
      setStoreName(store.name);
      setStoreMessage("Store name updated.");
    } catch {
      setStoreMessage("Store name could not be saved.");
    } finally {
      setIsSavingStore(false);
    }
  };

  const saveMaintenance = async () => {
    setIsSavingMaintenance(true);
    setMaintenanceMessage("");
    try {
      const payload = { ...maintenance, expected_end_at: maintenance.expected_end_at || null };
      const { maintenance: saved } = await updateAdminMaintenance(payload);
      setMaintenance((current) => ({ ...current, ...saved }));
      setMaintenanceMessage(maintenance.enabled ? "Maintenance mode is active. Employees can continue testing." : "Maintenance mode is off. Customers can order again and will be notified.");
    } catch {
      setMaintenanceMessage("Maintenance settings could not be saved. Check the message and expected end time.");
    } finally {
      setIsSavingMaintenance(false);
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
      <div className="max-w-3xl space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Settings</h1>
            <InfoTooltip
              title="System Configuration"
              content="Configure global store identity, customer mobile app branding and palettes, maintenance broadcast mode, and account security."
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Account security and system records.
          </p>
        </div>

        {/* Account Security */}
        <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xs transition-shadow hover:shadow-xs">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1F3A34] text-white shadow-2xs">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  Account Security
                </h2>
                <InfoTooltip
                  title="Admin Credentials"
                  content="Update administrative login credentials protected by multi-factor email verification codes."
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Change your password with an email verification code.
              </p>
              <button
                onClick={() => setCurrentPage?.("Profile")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
              >
                <KeyRound size={16} /> Open Account Security
              </button>
            </div>
          </div>
        </section>

        {canManageStore && (
          <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xs transition-shadow hover:shadow-xs">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1F3A34] text-white shadow-2xs">
                <Store size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">
                    Customer Outlet
                  </h2>
                  <InfoTooltip
                    title="Public Brand Name"
                    content="The public establishment name displayed in customer mobile applications and digital invoices."
                  />
                </div>
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
                    className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-hidden focus:border-[#1F3A34] focus:ring-2 focus:ring-[#1F3A34]/15"
                  />
                  <button
                    type="button"
                    disabled={isSavingStore}
                    onClick={saveStoreName}
                    className="rounded-xl bg-[#1F3A34] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:cursor-not-allowed disabled:opacity-60 transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
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

        {canManageStore && (
          <section className="rounded-2xl border border-amber-200/90 bg-white p-6 shadow-2xs transition-shadow hover:shadow-xs">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-2xs">
                <Wrench size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">Customer app maintenance</h2>
                  <InfoTooltip
                    title="Maintenance Lockout"
                    content="Temporarily suspends mobile customer ordering. Baristas and staff with employee bypass remain able to access internal tools."
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">When enabled, customers see only the maintenance screen. Approved employee accounts can continue for internal testing.</p>
                <label className="mt-4 flex items-center gap-3 text-sm font-bold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenance.enabled}
                    onChange={(event) => setMaintenance((current) => ({ ...current, enabled: event.target.checked }))}
                    className="h-4 w-4 rounded-sm border-gray-300 text-[#1F3A34] focus:ring-[#1F3A34] cursor-pointer"
                  />
                  <span>Enable maintenance mode</span>
                </label>
                <p className="mt-1.5 text-xs text-gray-500">Employee bypass is always enabled and is controlled by the employee flag on the customer membership.</p>
                
                <label className="mt-4 block text-sm font-bold text-gray-700">
                  Screen title
                  <input
                    value={maintenance.title}
                    maxLength={160}
                    onChange={(event) => setMaintenance((current) => ({ ...current, title: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-normal outline-hidden focus:border-[#1F3A34] focus:ring-2 focus:ring-[#1F3A34]/15"
                  />
                </label>
                
                <label className="mt-4 block text-sm font-bold text-gray-700">
                  Customer message
                  <textarea
                    value={maintenance.message}
                    maxLength={600}
                    onChange={(event) => setMaintenance((current) => ({ ...current, message: event.target.value }))}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-normal outline-hidden focus:border-[#1F3A34] focus:ring-2 focus:ring-[#1F3A34]/15"
                  />
                </label>
                
                <label className="mt-4 block text-sm font-bold text-gray-700">
                  Expected end time (optional)
                  <input
                    type="datetime-local"
                    value={maintenance.expected_end_at ? new Date(maintenance.expected_end_at).toISOString().slice(0, 16) : ""}
                    onChange={(event) => setMaintenance((current) => ({ ...current, expected_end_at: event.target.value ? new Date(event.target.value).toISOString() : null }))}
                    className="mt-2 block rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-normal outline-hidden focus:border-[#1F3A34] focus:ring-2 focus:ring-[#1F3A34]/15"
                  />
                </label>
                
                <button
                  type="button"
                  disabled={isSavingMaintenance}
                  onClick={saveMaintenance}
                  className="mt-5 rounded-xl bg-[#1F3A34] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:cursor-not-allowed disabled:opacity-60 transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
                >
                  {isSavingMaintenance ? "Saving..." : "Save maintenance settings"}
                </button>
                {maintenanceMessage && <p className="mt-2 text-sm text-gray-600" role="status">{maintenanceMessage}</p>}
              </div>
            </div>
          </section>
        )}

        {canViewAuditLogs && (
          <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xs transition-shadow hover:shadow-xs">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1F3A34] text-white shadow-2xs">
                <Palette size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">
                    App Appearance
                  </h2>
                  <InfoTooltip
                    title="Mobile App Theme"
                    content="Branding palettes for mobile customer apps. Each loyalty tier can inherit from default or define its own premium custom palette."
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Set a fallback palette and an individual palette for every
                  loyalty tier. Customers receive the palette for their tier
                  after the next app refresh or sign-in.
                </p>
                <p className="mt-5 text-sm font-bold text-gray-800">
                  Fallback palette
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {appearanceFields.map(([key, label]) => (
                    <label
                      key={key}
                      className="block text-sm font-bold text-gray-700"
                    >
                      {label}
                      <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-gray-300 p-1.5 bg-white">
                        <input
                          type="color"
                          value={appearance[key]}
                          onChange={(event) =>
                            setAppearance((current) => ({
                              ...current,
                              [key]: event.target.value.toUpperCase(),
                            }))
                          }
                          className="h-9 w-11 cursor-pointer rounded-lg border-0 bg-transparent p-0"
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
                          className="min-w-0 flex-1 border-0 px-2 py-1 text-sm uppercase outline-hidden font-mono text-gray-800"
                          aria-label={`${label} hex value`}
                        />
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-7 border-t border-gray-100 pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Tier palettes
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Choose a tier to edit the colours its members see.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#1F3A34]/10 px-3 py-1 text-xs font-bold text-[#1F3A34]">
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
                            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer ${
                              tier.tier_id === previewTierId
                                ? "border-[#1F3A34] bg-[#1F3A34] text-white"
                                : "border-gray-200 bg-white text-gray-700 hover:border-[#2E5E58]"
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
                            <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-gray-300 p-1.5 bg-white">
                              <input
                                type="color"
                                value={selectedTierAppearance?.[key] || appearance[key]}
                                onChange={(event) => updateTierAppearance(key, event.target.value)}
                                className="h-9 w-11 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                              />
                              <input
                                value={selectedTierAppearance?.[key] || appearance[key]}
                                maxLength={7}
                                onChange={(event) => updateTierAppearance(key, event.target.value)}
                                className="min-w-0 flex-1 border-0 px-2 py-1 text-sm uppercase outline-hidden font-mono text-gray-800"
                                aria-label={`${previewTierName} ${label} hex value`}
                              />
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : tierAppearancesAvailable === false ? (
                    <p className="mt-4 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800 border border-amber-200">
                      The connected API has not been updated for tier palettes yet. Deploy the latest API and run its database migrations, then refresh this page.
                    </p>
                  ) : (
                    <p className="mt-4 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800 border border-amber-200">
                      No active tiers are available to configure yet.
                    </p>
                  )}
                </div>

                <div className="mt-6 grid gap-5 rounded-2xl border border-gray-200/80 bg-gray-50/50 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2 text-[#1F3A34]">
                      <Smartphone size={20} />
                      <h3 className="text-base font-bold text-gray-900">Customer app preview</h3>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      This is the mobile layout for the selected {previewTierName} tier, including the header, membership card, action button, and navigation.
                    </p>
                    <p className={hasAccessibleText ? "mt-3 text-sm font-semibold text-emerald-700" : "mt-3 text-sm font-semibold text-rose-700"}>
                      Text {previewContrast.text.toFixed(1)}:1 · Muted {previewContrast.muted.toFixed(1)}:1
                    </p>
                    {!hasAccessibleText && (
                      <p className="mt-2 text-sm font-semibold text-rose-700" role="alert">
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
                        <button type="button" className="mt-4 w-full rounded-xl py-2.5 text-xs font-black text-white cursor-pointer" style={{ backgroundColor: previewAppearance.primary_color }}>ORDER NOW</button>
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
                  className="mt-5 rounded-xl bg-[#1F3A34] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:cursor-not-allowed disabled:opacity-60 transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
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
          <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xs transition-shadow hover:shadow-xs">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1F3A34] text-white shadow-2xs">
                <FileText size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">Audit Logs</h2>
                  <InfoTooltip
                    title="System Activity"
                    content="Full immutable chronological record of all administrative activities and operations."
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Review recorded administrative activity, including password
                  changes.
                </p>
                <button
                  onClick={() => setCurrentPage?.("Audit Logs")}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#1F3A34] px-4 py-2 text-sm font-bold text-[#1F3A34] hover:bg-[#1F3A34]/5 transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
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
