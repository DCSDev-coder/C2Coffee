import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Boxes, CalendarClock, CheckCircle2, ChevronDown, Gift, Pencil,
  Plus, RefreshCw, Search, Shuffle, Sparkles, Store, Trash2, X,
} from 'lucide-react';
import {
  createAdminPromotionalAddon,
  deleteAdminPromotionalAddon,
  loadAdminPromotionalAddonCatalogue,
  loadAdminPromotionalAddonReadiness,
  loadAdminPromotionalAddons,
  updateAdminPromotionalAddon,
} from '../lib/adminApi';
import { requestAdminConfirm } from '../lib/adminDialog';
import {
  buildPromotionalAddonPayload,
  emptyPromotionalAddonCampaign,
  normalizePromotionalAddonCampaign,
  unwrapPromotionalAddonCollection,
  validatePromotionalAddonCampaign,
} from '../lib/promotionalAddonsForm';
import { useUnsavedChanges } from '../utils/UnsavedChangesContext';
import InfoTooltip from './InfoTooltip';

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-2xs outline-none focus:border-[#2E5E58] focus:ring-2 focus:ring-[#2E5E58]/10 disabled:bg-gray-100 disabled:text-gray-500';
const labelClass = 'mb-1.5 block text-xs font-bold text-gray-700';

function optionId(option) {
  return Number(option?.id ?? option?.menu_item_id ?? option?.category_id ?? option?.store_id);
}

function optionCode(option) {
  return String(option?.code ?? option?.product_kind_code ?? option?.id ?? '');
}

function optionName(option) {
  return option?.name ?? option?.display_name ?? option?.item_name ?? option?.category_name ?? option?.store_name ?? option?.label ?? optionCode(option);
}

function getCatalogueList(catalogue, ...keys) {
  for (const key of keys) {
    const value = catalogue?.[key] ?? catalogue?.data?.[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function readinessRows(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.campaigns)) return response.campaigns;
  if (Array.isArray(response?.readiness)) return response.readiness;
  if (Array.isArray(response?.data?.campaigns)) return response.data.campaigns;
  return [];
}

function FieldError({ children }) {
  return children ? <p className="mt-1 text-[11px] font-semibold text-red-600" role="alert">{children}</p> : null;
}

function FormSection({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2E5E58]/10 text-[#2E5E58]"><Icon size={18} /></div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ChoiceCards({ value, onChange, options }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl border p-3 text-left transition-colors ${selected ? 'border-[#2E5E58] bg-[#F1F8F6] ring-1 ring-[#2E5E58]/20' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
          >
            <span className="block text-xs font-bold text-gray-900">{option.label}</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-gray-500">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function MultiChecklist({ options, selected, onChange, getValue = optionId, emptyText = 'No options available.', columns = 2 }) {
  const selectedSet = new Set(selected.map(String));
  if (!options.length) return <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">{emptyText}</p>;
  return (
    <div className={`grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/60 p-2 ${columns === 1 ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
      {options.map((option) => {
        const rawValue = getValue(option);
        const checked = selectedSet.has(String(rawValue));
        const unavailable = option.available === false || option.is_available === false;
        return (
          <label key={String(rawValue)} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 ${checked ? 'border-[#2E5E58]/40 bg-white' : 'border-transparent hover:bg-white'} ${unavailable ? 'opacity-65' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? selected.filter((item) => String(item) !== String(rawValue)) : [...selected, rawValue])}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#2E5E58]"
            />
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold text-gray-800">{optionName(option)}</span>
              {(option.category_name || option.product_kind_name || option.stock_status || option.available_quantity != null) && (
                <span className="mt-0.5 block truncate text-[10px] text-gray-500">
                  {[option.category_name, option.product_kind_name, option.stock_status, option.available_quantity != null ? `${option.available_quantity} available` : ''].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function statusStyle(status) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'paused') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'archived') return 'border-gray-200 bg-gray-100 text-gray-600';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function formatWindow(campaign) {
  const starts = campaign.starts_at ?? campaign.start_at;
  const ends = campaign.ends_at ?? campaign.end_at;
  const fmt = (value) => value ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not set';
  return `${fmt(starts)} – ${fmt(ends)}`;
}

function campaignReadiness(campaign, readiness) {
  const id = Number(campaign.id ?? campaign.campaign_id);
  return readiness.find((row) => Number(row.campaign_id ?? row.id) === id) ?? campaign.readiness ?? null;
}

function CampaignForm({ initial, catalogue, readiness, onClose, onSaved }) {
  const [form, setForm] = useState(() => normalizePromotionalAddonCampaign(initial));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const { registerUnsavedHandler, clearUnsavedHandler } = useUnsavedChanges();
  const original = useMemo(() => JSON.stringify(normalizePromotionalAddonCampaign(initial)), [initial]);
  const dirty = JSON.stringify(form) !== original;

  const stores = getCatalogueList(catalogue, 'stores', 'outlets');
  const productKinds = getCatalogueList(catalogue, 'product_kinds', 'productKinds');
  const categories = getCatalogueList(catalogue, 'categories');
  const menuItems = getCatalogueList(catalogue, 'menu_items', 'menuItems');
  const explicitRewards = getCatalogueList(catalogue, 'reward_items', 'rewardItems');
  const rewardItems = explicitRewards.length ? explicitRewards : menuItems.filter((item) => ['promotion_only', 'hidden'].includes(item.sale_visibility) || item.can_be_promotional_reward);
  const query = itemSearch.trim().toLowerCase();
  const filteredMenuItems = query ? menuItems.filter((item) => `${optionName(item)} ${item.category_name || ''}`.toLowerCase().includes(query)) : menuItems;
  const selectedReadiness = readiness.find((row) => Number(row.campaign_id ?? row.id) === Number(form.id));
  const readinessIssues = selectedReadiness?.issues ?? selectedReadiness?.blockers ?? [];

  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: '', qualification: key.startsWith('qualifying') ? '' : previous.qualification }));
  };

  const save = async () => {
    const nextErrors = validatePromotionalAddonCampaign(form);
    if (form.status === 'active' && readinessIssues.length) nextErrors.status = 'Resolve the readiness blockers before activating this campaign.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return false;
    setSaving(true);
    setSubmitError('');
    try {
      const payload = buildPromotionalAddonPayload(form);
      if (form.id) await updateAdminPromotionalAddon(form.id, payload);
      else await createAdminPromotionalAddon(payload);
      clearUnsavedHandler();
      await onSaved();
      return true;
    } catch (error) {
      setSubmitError(error.message || 'Unable to save this promotional add-on campaign.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => registerUnsavedHandler({ hasUnsavedChanges: () => dirty, onSave: save, onDiscard: onClose }), [dirty, form]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearUnsavedHandler(), [clearUnsavedHandler]);

  const close = async () => {
    if (dirty && !(await requestAdminConfirm({ title: 'Discard campaign changes?', message: 'Your unsaved promotional add-on settings will be lost.', confirmLabel: 'Discard', tone: 'danger' }))) return;
    clearUnsavedHandler();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-xs sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="promotional-addon-form-title">
      <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-[#F7F8F7] shadow-2xl sm:rounded-3xl">
        <header className="flex items-start justify-between border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2E5E58]">Promotional Add-ons</p>
            <h2 id="promotional-addon-form-title" className="mt-1 text-lg font-bold text-gray-900">{form.id ? 'Edit campaign' : 'New campaign'}</h2>
            <p className="mt-0.5 text-xs text-gray-500">Configure qualification, assignment, pricing, and the eligible gift collection.</p>
          </div>
          <button type="button" onClick={() => void close()} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100" aria-label="Close campaign editor"><X size={19} /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {submitError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700" role="alert">{submitError}</div>}
          {readinessIssues.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <p className="font-bold">Activation readiness needs attention</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">{readinessIssues.map((issue, index) => <li key={`${issue.code || issue}-${index}`}>{issue.message || issue.label || String(issue)}</li>)}</ul>
            </div>
          )}

          <FormSection title="Campaign details" description="Give staff a clear internal name and define when the offer can run." icon={CalendarClock}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2"><label className={labelClass}>Campaign name</label><input value={form.name} onChange={(e) => update('name', e.target.value)} className={inputClass} placeholder="e.g. C2 Bear Collection" /><FieldError>{errors.name}</FieldError></div>
              <div><label className={labelClass}>Campaign code</label><input value={form.code} onChange={(e) => update('code', e.target.value.toUpperCase().replace(/\s+/g, '_'))} className={inputClass} placeholder="C2_BEAR_2026" disabled={Boolean(form.id)} /><FieldError>{errors.code}</FieldError></div>
              <div><label className={labelClass}>Status</label><select value={form.status} onChange={(e) => update('status', e.target.value)} className={inputClass}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></select><FieldError>{errors.status}</FieldError></div>
              <div><label className={labelClass}>Starts</label><input type="datetime-local" value={form.startsAt} onChange={(e) => update('startsAt', e.target.value)} className={inputClass} /><FieldError>{errors.startsAt}</FieldError></div>
              <div><label className={labelClass}>Ends</label><input type="datetime-local" value={form.endsAt} onChange={(e) => update('endsAt', e.target.value)} className={inputClass} /><FieldError>{errors.endsAt}</FieldError></div>
              <div><label className={labelClass}>Priority</label><input type="number" min="0" step="1" value={form.priority} onChange={(e) => update('priority', e.target.value)} className={inputClass} /><FieldError>{errors.priority}</FieldError></div>
            </div>
          </FormSection>

          <FormSection title="Outlet scope" description="Run everywhere or restrict this campaign to selected outlets." icon={Store}>
            <ChoiceCards value={form.outletScope} onChange={(value) => update('outletScope', value)} options={[
              { value: 'all', label: 'All outlets', description: 'Customers can claim at every active outlet.' },
              { value: 'selected', label: 'Selected outlets', description: 'Only the outlets selected below participate.' },
            ]} />
            {form.outletScope === 'selected' && <div className="mt-3"><MultiChecklist options={stores} selected={form.storeIds} onChange={(value) => update('storeIds', value)} emptyText="No outlets were returned by the catalogue endpoint." /><FieldError>{errors.storeIds}</FieldError></div>}
          </FormSection>

          <FormSection title="Purchase qualification" description="A sale item matches when it belongs to any selected kind, category, or item. Promotional reward lines never qualify." icon={Boxes}>
            <div className="grid gap-5 lg:grid-cols-3">
              <div><label className={labelClass}>Product kinds</label><MultiChecklist options={productKinds} selected={form.qualifyingProductKindCodes} onChange={(value) => update('qualifyingProductKindCodes', value)} getValue={optionCode} columns={1} /></div>
              <div><label className={labelClass}>Categories</label><MultiChecklist options={categories} selected={form.qualifyingCategoryIds} onChange={(value) => update('qualifyingCategoryIds', value)} columns={1} /></div>
              <div><label className={labelClass}>Minimum matching quantity</label><input type="number" min="1" step="1" value={form.minimumQuantity} onChange={(e) => update('minimumQuantity', e.target.value)} className={inputClass} /><FieldError>{errors.minimumQuantity}</FieldError><p className="mt-2 text-[11px] leading-relaxed text-gray-500">Example: 2 means the cart must contain at least two matching sale units.</p></div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><label className="text-xs font-bold text-gray-700">Specific qualifying menu items</label><div className="relative sm:w-72"><Search className="absolute left-3 top-2.5 text-gray-400" size={14} /><input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className={`${inputClass} py-2 pl-9 text-xs`} placeholder="Search menu items" /></div></div>
              <MultiChecklist options={filteredMenuItems} selected={form.qualifyingMenuItemIds} onChange={(value) => update('qualifyingMenuItemIds', value)} emptyText="No menu items match this search." />
              <FieldError>{errors.qualification}</FieldError>
            </div>
          </FormSection>

          <FormSection title="Gift assignment" description="Let customers choose from the collection, or have the server assign one securely at checkout." icon={Shuffle}>
            <ChoiceCards value={form.assignmentMode} onChange={(value) => update('assignmentMode', value)} options={[
              { value: 'customer_choice', label: 'Customer chooses', description: 'The app requires an available gift selection before checkout.' },
              { value: 'server_random', label: 'Random gift', description: 'The server selects an in-stock gift and reveals it after checkout.' },
            ]} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Older app fallback</label><select value={form.priceMode === 'free' ? form.legacyFallback : 'no_reward'} onChange={(e) => update('legacyFallback', e.target.value)} disabled={form.priceMode !== 'free'} className={inputClass}><option value="no_reward">Do not assign a reward</option><option value="random">Assign an available gift randomly</option></select><p className="mt-1 text-[11px] text-gray-500">{form.priceMode === 'free' ? 'Used only when an older app cannot display the gift flow.' : 'Paid add-ons require the updated app, so older versions receive no reward.'}</p></div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3.5"><input type="checkbox" checked={form.allowDecline} onChange={(e) => update('allowDecline', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#2E5E58]" /><span><span className="block text-xs font-bold text-gray-800">Allow customer to decline</span><span className="mt-1 block text-[11px] leading-relaxed text-gray-500">The customer may continue without receiving a promotional add-on.</span></span></label>
            </div>
          </FormSection>

          <FormSection title="Promotional price" description="Set the gift to free, or charge a fixed amount in RM or C2 Credit tokens." icon={Gift}>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <ChoiceCards value={form.priceMode} onChange={(value) => update('priceMode', value)} options={[
                { value: 'free', label: 'Free', description: 'No charge is added to the order.' },
                { value: 'fixed_rm', label: 'Fixed RM', description: 'Charge one fixed direct-payment amount.' },
                { value: 'fixed_token', label: 'Fixed tokens', description: 'Charge one fixed C2 Credit amount.' },
              ]} />
              {form.priceMode !== 'free' && <div><label className={labelClass}>{form.priceMode === 'fixed_rm' ? 'Price (RM)' : 'Price (tokens)'}</label><input type="number" min="0" step={form.priceMode === 'fixed_rm' ? '0.01' : '1'} value={form.priceAmount} onChange={(e) => update('priceAmount', e.target.value)} className={inputClass} /><FieldError>{errors.priceAmount}</FieldError></div>}
            </div>
          </FormSection>

          <FormSection title="Reward collection" description="Choose the promotion-only catalogue items that customers can browse or receive randomly." icon={Sparkles}>
            <MultiChecklist options={rewardItems} selected={form.rewardMenuItemIds} onChange={(value) => update('rewardMenuItemIds', value)} emptyText="No reward-ready items are available. Create promotion-only menu items with inventory recipes first." />
            <FieldError>{errors.rewardMenuItemIds}</FieldError>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">Only reward-ready products should appear here. Stock and recipe blockers are checked again by the API before activation.</p>
          </FormSection>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={() => void close()} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F3A34] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:opacity-60">{saving && <RefreshCw className="animate-spin" size={15} />}{saving ? 'Saving…' : form.id ? 'Save campaign' : 'Create campaign'}</button>
        </footer>
      </div>
    </div>
  );
}

export default function PromotionalAddons() {
  const [campaigns, setCampaigns] = useState([]);
  const [catalogue, setCatalogue] = useState({});
  const [readiness, setReadiness] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [campaignResponse, catalogueResponse, readinessResponse] = await Promise.all([
        loadAdminPromotionalAddons(),
        loadAdminPromotionalAddonCatalogue(),
        loadAdminPromotionalAddonReadiness(),
      ]);
      setCampaigns(unwrapPromotionalAddonCollection(campaignResponse, 'campaigns'));
      setCatalogue(catalogueResponse?.catalogue ?? catalogueResponse?.data ?? catalogueResponse ?? {});
      setReadiness(readinessRows(readinessResponse));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load promotional add-on campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return campaigns
      .filter((campaign) => status === 'all' || campaign.status === status)
      .filter((campaign) => !query || `${campaign.name || ''} ${campaign.code || campaign.campaign_code || ''}`.toLowerCase().includes(query))
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(a.name || '').localeCompare(String(b.name || '')));
  }, [campaigns, search, status]);

  const remove = async (campaign) => {
    const confirmed = await requestAdminConfirm({ title: 'Delete promotional add-on?', message: `Delete “${campaign.name}”? Campaigns already attached to orders remain in the audit history.`, confirmLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;
    setError('');
    try {
      await deleteAdminPromotionalAddon(campaign.id ?? campaign.campaign_id);
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete this campaign.');
    }
  };

  const activeCount = campaigns.filter((campaign) => campaign.status === 'active').length;
  const randomCount = campaigns.filter((campaign) => campaign.assignment_mode === 'server_random').length;
  const blockedCount = readiness.filter((row) => row.ready === false || (row.issues ?? row.blockers ?? []).length > 0).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-8 pt-2 sm:px-6 md:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#2E5E58]"><Sparkles size={18} /><span className="text-xs font-bold uppercase tracking-[0.14em]">Marketing & Loyalty</span><InfoTooltip title="Promotional Add-ons" content="Reward qualifying purchases with a free or fixed-price item. Campaigns can offer customer choice or secure server-side random assignment." /></div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">Promotional Add-ons</h1>
          <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-gray-600 sm:text-sm">Build collectible, gift, food, or merchandise offers without exposing reward-only products in the normal menu.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void refresh()} className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-700 shadow-2xs hover:bg-gray-50" aria-label="Refresh promotional add-ons"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
          <button type="button" onClick={() => setEditing(emptyPromotionalAddonCampaign())} className="inline-flex items-center gap-2 rounded-xl bg-[#1F3A34] px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58]"><Plus size={16} />New campaign</button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700" role="alert">{error}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Campaigns', campaigns.length, 'Configured offers', Sparkles, 'bg-[#2E5E58]/10 text-[#2E5E58]'],
          ['Active now', activeCount, 'Currently available', CheckCircle2, 'bg-emerald-50 text-emerald-700'],
          ['Random assignment', randomCount, 'Server-selected gift', Shuffle, 'bg-violet-50 text-violet-700'],
          ['Needs attention', blockedCount, 'Readiness blockers', AlertTriangle, blockedCount ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'],
        ].map(([title, value, hint, Icon, colour]) => <div key={title} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{title}</p><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${colour}`}><Icon size={16} /></span></div><p className="mt-3 text-2xl font-extrabold text-gray-900">{value}</p><p className="mt-1 text-[11px] text-gray-500">{hint}</p></div>)}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><h2 className="text-base font-bold text-gray-900">Campaigns</h2><p className="mt-0.5 text-xs text-gray-500">Higher priority campaigns are evaluated first.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} py-2 pl-9 text-xs sm:w-64`} placeholder="Search name or code" /></div>
            <div className="relative"><select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} appearance-none py-2 pr-9 text-xs`}><option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option><option value="archived">Archived</option></select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 text-gray-400" size={14} /></div>
          </div>
        </div>

        {loading ? <div className="flex min-h-52 items-center justify-center gap-2 text-sm font-semibold text-[#2E5E58]"><RefreshCw className="animate-spin" size={17} />Loading campaigns…</div> : filtered.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center"><Gift className="text-gray-300" size={34} /><h3 className="mt-3 text-sm font-bold text-gray-800">No promotional add-ons found</h3><p className="mt-1 max-w-md text-xs text-gray-500">Create a campaign to connect qualifying purchases with collectible gifts or other promotional products.</p></div>
        ) : (
          <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500"><tr><th className="px-5 py-3">Campaign</th><th className="px-5 py-3">Window & outlets</th><th className="px-5 py-3">Assignment</th><th className="px-5 py-3">Rewards</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">
            {filtered.map((campaign) => {
              const ready = campaignReadiness(campaign, readiness);
              const rewards = campaign.reward_items ?? campaign.rewards ?? campaign.reward_menu_item_ids ?? [];
              const stores = campaign.stores ?? campaign.store_ids ?? [];
              return <tr key={campaign.id ?? campaign.campaign_id} className="align-top hover:bg-gray-50/70"><td className="px-5 py-4"><p className="font-bold text-gray-900">{campaign.name}</p><p className="mt-1 font-mono text-[10px] text-gray-500">{campaign.code ?? campaign.campaign_code}</p><p className="mt-1 text-[10px] text-gray-500">Priority {campaign.priority ?? 0} · Minimum {campaign.minimum_quantity ?? 1} item(s)</p></td><td className="px-5 py-4"><p className="whitespace-nowrap text-gray-700">{formatWindow(campaign)}</p><p className="mt-1 text-[10px] text-gray-500">{campaign.outlet_scope === 'selected' || stores.length ? `${stores.length || campaign.store_count || 0} selected outlet(s)` : 'All outlets'}</p></td><td className="px-5 py-4"><p className="font-semibold text-gray-800">{campaign.assignment_mode === 'server_random' ? 'Random gift' : 'Customer chooses'}</p><p className="mt-1 text-[10px] text-gray-500">Legacy: {campaign.legacy_fallback === 'random' ? 'random gift' : 'no reward'} · {campaign.allow_decline ? 'may decline' : 'required'}</p></td><td className="px-5 py-4"><p className="font-semibold text-gray-800">{rewards.length || campaign.reward_count || 0} item(s)</p><p className="mt-1 text-[10px] text-gray-500">{campaign.price_mode === 'fixed_rm' ? `RM ${Number(campaign.price_amount || 0).toFixed(2)}` : campaign.price_mode === 'fixed_token' ? `${campaign.price_amount || 0} tokens` : 'Free'}</p></td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold capitalize ${statusStyle(campaign.status)}`}>{campaign.status || 'draft'}</span>{ready && <p className={`mt-1.5 text-[10px] font-semibold ${ready.ready === false || (ready.issues ?? ready.blockers ?? []).length ? 'text-amber-700' : 'text-emerald-700'}`}>{ready.ready === false || (ready.issues ?? ready.blockers ?? []).length ? 'Needs readiness review' : 'Ready'}</p>}</td><td className="px-5 py-4"><div className="flex justify-end gap-1.5"><button type="button" onClick={() => setEditing(campaign)} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100" aria-label={`Edit ${campaign.name}`}><Pencil size={14} /></button><button type="button" onClick={() => void remove(campaign)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" aria-label={`Delete ${campaign.name}`}><Trash2 size={14} /></button></div></td></tr>;
            })}
          </tbody></table></div>
        )}
      </section>

      {editing && <CampaignForm initial={editing} catalogue={catalogue} readiness={readiness} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); }} />}
    </div>
  );
}
