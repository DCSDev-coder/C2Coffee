import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Award, BarChart3, Edit3, Gift, MoreVertical, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Pagination from './Pagination';
import { adminRequest, createAdminTier, deleteAdminTier, getAdminApiBaseUrl, loadAdminLoyaltyOverview, loadAdminMenu, loadAdminVouchers, updateAdminTier, uploadAdminTierImage } from '../lib/adminApi';

const DEFAULT_COLORS = ['#1F3A34', '#2E5E58', '#6F9F96', '#E07A5F', '#D4AF7A', '#9333EA'];

const statCardClass =
  'bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0';

const StatCard = ({ title, value, change, icon: Icon, iconBg, iconColor = 'text-white' }) => (
  <div className={statCardClass}>
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-sm`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight mt-0.5 whitespace-normal">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
      {change && (
        <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal mt-1">
          {change}
        </p>
      )}
    </div>
  </div>
);

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function formatCupsLabel(minCups) {
  const cups = parseNumber(minCups);
  return `${cups.toLocaleString('en-US')} cups+`;
}

function formatTierStatus(value) {
  return value ? 'Active' : 'Inactive';
}

function tierRewardIds(tier) {
  const configuredVoucherIds = tier?.rewardConfig?.voucherTemplateIds
    ?? (tier?.rewardConfig?.voucherTemplateId ? [tier.rewardConfig.voucherTemplateId] : []);
  return [...new Set(configuredVoucherIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function tierBirthdayRewardIds(tier) {
  const configuredVoucherIds = tier?.rewardConfig?.birthdayVoucherTemplateIds
    ?? (tier?.rewardConfig?.birthdayVoucherTemplateId ? [tier.rewardConfig.birthdayVoucherTemplateId] : []);
  return [...new Set(configuredVoucherIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function getStatusClass(isActive) {
  return isActive
    ? 'bg-green-100 text-green-700'
    : 'bg-gray-100 text-gray-600';
}

function getTierBadgeStyle(color) {
  const safeColor = color || '#1F3A34';
  return {
    backgroundColor: `${safeColor}14`,
    color: safeColor,
    borderColor: `${safeColor}33`
  };
}

function resolveTierArtworkUrl(imageUrl) {
  const value = String(imageUrl ?? '').trim();
  if (!value || /^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  return `${getAdminApiBaseUrl()}${value.startsWith('/') ? value : `/${value}`}`;
}

function emptyForm() {
  return {
    id: null,
    code: '',
    name: '',
    minCups: 0,
    imageUrl: null,
    sortOrder: 0,
    isActive: true
  };
}

function emptyTierRewardForm(tiers = []) {
  const firstEligibleTier = tiers.find((tier) => tier.isActive);
  return {
    tierId: firstEligibleTier ? String(firstEligibleTier.id) : '',
    rewardTiming: 'achievement',
    name: '',
    benefitType: 'Free Drink',
    discountValue: '',
    productKinds: ['drink', 'food', 'merchandise', 'candle'],
    subcategoryCodes: [],
    eligibleItems: [],
    rewardQuantity: 1,
    limitPerUser: 1,
    description: ''
  };
}

function deriveTierRewardMenuItems(response) {
  return (response?.categories || []).flatMap((category) => (category.items || []).map((item) => ({
    id: item.id,
    name: item.name,
    productKindCode: item.product_kind_code || category.product_kind_code || 'other',
    subcategoryCode: item.subcategory_code || '',
    subcategoryName: item.subcategory_name || category.name || 'Other'
  })));
}

const TierArtworkField = ({ imageUrl, onChange }) => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadArtwork = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await uploadAdminTierImage(file);
      onChange(response.image_url || null);
    } catch (error) {
      alert(`Unable to upload tier artwork: ${error.message}`);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-[#BFD3CE] bg-[#F8FBFA] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="block font-bold text-gray-900">Tier artwork</label>
          <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">Optional. Members see this card when they are in this tier.</p>
        </div>
        {imageUrl && (
          <button type="button" onClick={() => onChange(null)} className="shrink-0 text-[11px] font-bold text-red-600 hover:text-red-700">
            Remove
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[135px_minmax(0,1fr)] sm:items-center">
        <div className="aspect-[3/4] overflow-hidden rounded-xl border border-[#D7E4E0] bg-white shadow-sm">
          {imageUrl ? (
            <img src={resolveTierArtworkUrl(imageUrl)} alt="Tier artwork preview" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center text-[11px] text-gray-400">
              <span className="font-bold text-[#5C7770]">3:4 preview</span>
              <span>Tier artwork</span>
            </div>
          )}
        </div>
        <div>
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-[#1E433A] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#16342D] disabled:cursor-not-allowed disabled:opacity-60">
            {isUploading ? 'Uploading...' : imageUrl ? 'Replace image' : 'Choose image'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadArtwork} disabled={isUploading} className="sr-only" />
          </label>
          <p className="mt-2 text-[11px] font-medium text-gray-700">Recommended: 1086 × 1448 px (3:4 portrait)</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">PNG, JPEG, or WebP, up to 8 MB. The upload is cropped to 3:4 and optimised for the mobile rewards card.</p>
        </div>
      </div>
    </div>
  );
};

const TierModal = ({ open, title, form, onChange, onClose, onSave, saving }) => {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4.5 border-b border-gray-100 bg-white/80 backdrop-blur-xs flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Live tier settings used by customer progress, menu pricing, and tier state.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSave} className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tier Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => onChange({ name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                required
              />
            </div>
            <div>
              <p className="rounded-lg border border-[#D7E4E0] bg-[#F8FBFA] px-3 py-2 text-[11px] leading-relaxed text-[#5C7770]">
                The system keeps the tier identifier in the background. Renaming this label does not change existing member records.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cups Needed</label>
              <input
                type="number"
                min={0}
                value={form.minCups}
                onChange={(e) => onChange({ minCups: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                required
              />
            </div>
            <div>
              <p className="rounded-lg border border-[#D7E4E0] bg-[#F8FBFA] px-3 py-2 text-[11px] leading-relaxed text-[#5C7770]">
                Tier rewards are managed separately below. This keeps tier progress settings independent from reward setup.
              </p>
            </div>
            <div className="flex items-end">
              <p className="text-[11px] text-gray-400 leading-snug">
                Tiers are sorted automatically by cups needed, then saved in the backend for deterministic fallback.
              </p>
            </div>
          </div>

          <TierArtworkField imageUrl={form.imageUrl} onChange={(imageUrl) => onChange({ imageUrl })} />

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(form.isActive)}
                onChange={(e) => onChange({ isActive: e.target.checked })}
                className="rounded border-gray-300 text-[#1F3A34] focus:ring-[#1F3A34]"
              />
              Active
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] rounded-lg cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Tier'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const TierRewardModal = ({ open, form, tiers, menuItems, onChange, onClose, onSave, saving, isEditing = false }) => {
  if (!open || typeof document === 'undefined') return null;

  const eligibleTiers = tiers.filter((tier) => tier.isActive);
  const allProductKinds = ['drink', 'food', 'merchandise', 'candle'];
  const isDiscount = form.benefitType === 'Discount';
  const scopedItems = menuItems.filter((item) =>
    form.productKinds.includes(item.productKindCode)
    && (form.subcategoryCodes.length === 0 || form.subcategoryCodes.includes(item.subcategoryCode))
  );
  const scopedSubcategories = [...new Map(menuItems
    .filter((item) => form.productKinds.includes(item.productKindCode) && item.subcategoryCode)
    .map((item) => [item.subcategoryCode, item.subcategoryName]))
    .entries()];
  const allScopedItemsSelected = scopedItems.length > 0 && scopedItems.every((item) => form.eligibleItems.includes(item.name));

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-xs px-6 py-4.5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEditing ? 'Edit Tier Reward' : 'New Tier Reward'}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{isEditing ? 'Update this tier voucher without changing which tier it belongs to.' : 'Create an achievement reward or a birthday-month reward for one tier.'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer" aria-label="Close tier reward form">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-5 overflow-y-auto p-6">
          <section className="rounded-xl border border-[#D7E4E0] bg-[#F8FBFA] p-4">
            <h3 className="font-bold text-gray-900">1. Reward timing</h3>
            <p className="mt-0.5 text-xs text-gray-500">Achievement rewards are issued once. Birthday rewards appear only during the member's birthday month and only for their current tier.</p>
            <label className="mt-3 block text-xs font-medium text-gray-500">When should members receive it?</label>
            <select disabled={isEditing} value={form.rewardTiming} onChange={(event) => onChange({ rewardTiming: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F3A34] disabled:cursor-not-allowed disabled:bg-gray-100">
              <option value="achievement">When this tier is achieved</option>
              <option value="birthday_month">During the member's birthday month</option>
            </select>
            <label className="mt-3 block text-xs font-medium text-gray-500">Unlock tier</label>
            <select
              required
              disabled={isEditing}
              value={form.tierId}
              onChange={(event) => onChange({ tierId: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F3A34] disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">Choose a tier</option>
              {eligibleTiers.map((tier) => <option key={tier.id} value={tier.id}>{form.rewardTiming === 'birthday_month' ? tier.name : Number(tier.minCups) === 0 ? `${tier.name} (after first completed drink)` : `${tier.name} (${formatCupsLabel(tier.minCups)})`}</option>)}
            </select>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="font-bold text-gray-900">2. Reward</h3>
              <p className="mt-0.5 text-xs text-gray-500">This is managed in Tier Management and does not appear in the normal Vouchers list.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500">Reward name</label>
                <input required value={form.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="e.g. Brewer welcome drink" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Benefit</label>
                <select value={form.benefitType} onChange={(event) => onChange({ benefitType: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F3A34]">
                  <option value="Free Drink">Free Drink</option>
                  <option value="Free Food">Free Food</option>
                  <option value="Discount">Discount</option>
                </select>
              </div>
              {isDiscount && (
                <div>
                  <label className="block text-xs font-medium text-gray-500">Discount percent</label>
                  <input required type="number" min="1" max="100" value={form.discountValue} onChange={(event) => onChange({ discountValue: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500">Items per redemption</label>
                <input required type="number" min="1" max="20" value={form.rewardQuantity} onChange={(event) => onChange({ rewardQuantity: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Eligible menu items</p>
              <div className="mt-1 grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-4">
                {allProductKinds.map((kind) => (
                  <label key={kind} className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.productKinds.includes(kind)}
                      onChange={() => onChange({
                        productKinds: form.productKinds.includes(kind)
                          ? form.productKinds.filter((value) => value !== kind)
                          : [...form.productKinds, kind],
                        subcategoryCodes: [],
                        eligibleItems: []
                      })}
                      className="rounded text-[#1F3A34] focus:ring-[#1F3A34]"
                    />
                    {kind === 'drink' ? 'Drinks' : kind === 'food' ? 'Food' : kind === 'merchandise' ? 'Merchandise' : 'Candles'}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Leave all selected to apply this reward to all menu items.</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Choose menu types</p>
              {scopedSubcategories.length > 0 ? (
                <div className="mt-1 grid max-h-28 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-3">
                  {scopedSubcategories.map(([code, name]) => (
                    <label key={code} className="flex items-center gap-2 text-xs text-gray-700">
                      <input type="checkbox" checked={form.subcategoryCodes.includes(code)} onChange={() => onChange({ subcategoryCodes: form.subcategoryCodes.includes(code) ? form.subcategoryCodes.filter((value) => value !== code) : [...form.subcategoryCodes, code], eligibleItems: [] })} className="rounded text-[#1F3A34] focus:ring-[#1F3A34]" />
                      {name}
                    </label>
                  ))}
                </div>
              ) : <p className="mt-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">Choose an eligible menu item type first.</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Choose specific items</p>
              {scopedItems.length > 0 ? (
                <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-gray-200 p-3">
                  <label className="mb-2 flex items-center gap-2 border-b border-gray-100 pb-2 text-xs font-bold text-gray-700">
                    <input type="checkbox" checked={allScopedItemsSelected} onChange={() => onChange({ eligibleItems: allScopedItemsSelected ? [] : scopedItems.map((item) => item.name) })} className="rounded text-[#1F3A34] focus:ring-[#1F3A34]" />
                    All matching items
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {scopedItems.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-xs text-gray-700">
                        <input type="checkbox" checked={form.eligibleItems.includes(item.name)} onChange={() => onChange({ eligibleItems: form.eligibleItems.includes(item.name) ? form.eligibleItems.filter((value) => value !== item.name) : [...form.eligibleItems, item.name] })} className="rounded text-[#1F3A34] focus:ring-[#1F3A34]" />
                        <span className="min-w-0 truncate">{item.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : <p className="mt-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">No active menu items match this selection.</p>}
              <p className="mt-1 text-[11px] text-gray-400">Leave this list unticked to apply the reward to every item in the selected scope.</p>
            </div>
          </section>

          <section className="space-y-3 border-t border-[#DDE9E5] pt-4">
            <div>
              <h3 className="font-bold text-gray-900">3. Limits</h3>
              <p className="mt-0.5 text-xs text-gray-500">{form.rewardTiming === 'birthday_month' ? 'Birthday rewards expire at the end of the member\'s birthday month.' : 'Achievement rewards are issued once per tier.'}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500">Uses per customer</label>
                <input required type="number" min="1" max="20" value={form.limitPerUser} onChange={(event) => onChange({ limitPerUser: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Description</label>
                <input value={form.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Optional redemption instructions" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" />
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || eligibleTiers.length === 0} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#2E5E58] disabled:cursor-not-allowed disabled:opacity-60"><Gift size={16} />{saving ? 'Saving...' : isEditing ? 'Save changes' : 'Create Tier Reward'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const TierManagement = () => {
  const [overview, setOverview] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [voucherOptions, setVoucherOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [tierRewardModalOpen, setTierRewardModalOpen] = useState(false);
  const [tierRewardSaving, setTierRewardSaving] = useState(false);
  const [tierRewardForm, setTierRewardForm] = useState(emptyTierRewardForm());
  const [editingTierReward, setEditingTierReward] = useState(null);
  const [tierRewardMenuItems, setTierRewardMenuItems] = useState([]);
  const [codeAutoGenerated, setCodeAutoGenerated] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        setLoadError('');
        const [response, voucherResponse, menuResponse] = await Promise.all([
          loadAdminLoyaltyOverview(100),
          loadAdminVouchers({ includeTierRewards: true }),
          loadAdminMenu()
        ]);
        if (!isMounted) return;

        setOverview(response ?? null);
        setTiers(Array.isArray(response?.tiers) ? response.tiers : []);
        setVoucherOptions(Array.isArray(voucherResponse?.vouchers) ? voucherResponse.vouchers : []);
        setTierRewardMenuItems(deriveTierRewardMenuItems(menuResponse));
      } catch (error) {
        console.error('Failed to load loyalty tiers', error);
        if (isMounted) {
          setLoadError(error?.message || 'Failed to load loyalty tiers.');
          setOverview(null);
          setTiers([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    const refresh = () => fetchData({ silent: true });
    const intervalId = window.setInterval(refresh, 30000);
    const handleFocus = () => refresh();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const sortedTiers = useMemo(() => {
    return [...tiers].sort((a, b) => parseNumber(a.minCups) - parseNumber(b.minCups) || parseNumber(a.id) - parseNumber(b.id));
  }, [tiers]);

  const activeTiers = useMemo(() => sortedTiers.filter((tier) => tier.isActive), [sortedTiers]);
  const totalMembers = parseNumber(overview?.summary?.totalMembers);
  const activeTierCount = activeTiers.length;
  const topTier = activeTiers[activeTiers.length - 1] ?? null;
  const baseTier = activeTiers[0] ?? null;
  const topTierBreakdown = Array.isArray(overview?.tierBreakdown) && overview.tierBreakdown.length > 0
    ? [...overview.tierBreakdown].sort((a, b) => parseNumber(a.minCups) - parseNumber(b.minCups))
    : [];

  const chartData = topTierBreakdown.length > 0
    ? topTierBreakdown.map((tier, index) => ({
        name: tier.tierName || tier.name || `Tier ${index + 1}`,
        members: parseNumber(tier.members ?? tier.count ?? tier.member_count),
        color: DEFAULT_COLORS[index % DEFAULT_COLORS.length]
      }))
    : activeTiers.map((tier, index) => ({
        name: tier.name,
        members: 0,
        color: DEFAULT_COLORS[index % DEFAULT_COLORS.length]
      }));

  const openAddModal = () => {
    const nextCode = slugify(`tier_${activeTiers.length + 1}`);
    setForm({
      ...emptyForm(),
      code: nextCode
    });
    setCodeAutoGenerated(true);
    setModalOpen(true);
  };

  const openEditModal = (tier) => {
    setForm({
      id: tier.id,
      code: tier.code || '',
      name: tier.name || '',
      minCups: parseNumber(tier.minCups),
      imageUrl: tier.imageUrl || null,
      sortOrder: parseNumber(tier.sortOrder || tier.minCups),
      isActive: Boolean(tier.isActive)
    });
    setCodeAutoGenerated(false);
    setModalOpen(true);
  };

  const updateForm = (patch) => {
    setForm((current) => {
      const next = { ...current, ...patch };

      if (codeAutoGenerated && Object.prototype.hasOwnProperty.call(patch, 'name')) {
        next.code = slugify(patch.name || '');
      }

      return next;
    });

    if (Object.prototype.hasOwnProperty.call(patch, 'code')) {
      setCodeAutoGenerated(false);
    }
  };

  const refreshTiers = async () => {
    const [response, voucherResponse, menuResponse] = await Promise.all([
      loadAdminLoyaltyOverview(100),
      loadAdminVouchers({ includeTierRewards: true }),
      loadAdminMenu()
    ]);
    setOverview(response ?? null);
    setTiers(Array.isArray(response?.tiers) ? response.tiers : []);
    setVoucherOptions(Array.isArray(voucherResponse?.vouchers) ? voucherResponse.vouchers : []);
    setTierRewardMenuItems(deriveTierRewardMenuItems(menuResponse));
    setCurrentPage(1);
  };

  const openTierRewardModal = (tierId = '', reward = null) => {
    const timing = reward?.timing || 'achievement';
    const voucher = reward?.voucher;

    setEditingTierReward(voucher ? {
      tierId: Number(tierId),
      voucherTemplateId: Number(reward.voucherTemplateId),
      voucherCode: voucher.id,
      timing
    } : null);
    setTierRewardForm(voucher ? {
      ...emptyTierRewardForm(sortedTiers),
      tierId: String(tierId),
      rewardTiming: timing,
      name: voucher.name || '',
      benefitType: voucher.benefitType || 'Free Drink',
      discountValue: voucher.discountValue ?? '',
      productKinds: voucher.productKinds?.length ? voucher.productKinds : ['drink', 'food', 'merchandise', 'candle'],
      subcategoryCodes: voucher.subcategoryCodes || [],
      eligibleItems: (voucher.eligibleItems || []).filter((item) => item !== 'All Items'),
      rewardQuantity: voucher.rewardQuantity || 1,
      limitPerUser: voucher.limitPerUser || 1,
      description: voucher.description || ''
    } : {
      ...emptyTierRewardForm(sortedTiers),
      ...(tierId ? { tierId: String(tierId) } : {})
    });
    setTierRewardModalOpen(true);
  };

  const updateTierRewardForm = (patch) => {
    setTierRewardForm((current) => ({ ...current, ...patch }));
  };

  const buildTierRewardPayload = () => ({
    code: editingTierReward?.voucherCode || `TIER_${tierRewardForm.rewardTiming === 'birthday_month' ? 'BIRTHDAY_' : ''}${slugify(tierRewardForm.name) || 'REWARD'}`,
    name: String(tierRewardForm.name || '').trim(),
    type: 'Tier Reward',
    benefitType: tierRewardForm.benefitType,
    promotionKind: 'standard',
    status: 'Active',
    tier: 'All Tiers',
    discountValue: Number(tierRewardForm.discountValue) || 0,
    productKinds: tierRewardForm.productKinds,
    subcategoryCodes: tierRewardForm.subcategoryCodes,
    eligibleItems: tierRewardForm.eligibleItems.length > 0 ? tierRewardForm.eligibleItems : ['All Items'],
    rewardProductKinds: tierRewardForm.productKinds,
    rewardSubcategoryCodes: tierRewardForm.subcategoryCodes,
    rewardItems: tierRewardForm.eligibleItems,
    qualifyingQuantity: 1,
    rewardQuantity: Number(tierRewardForm.rewardQuantity) || 1,
    expiry: null,
    totalQty: null,
    limitPerUser: Number(tierRewardForm.limitPerUser) || 1,
    description: tierRewardForm.description || (tierRewardForm.rewardTiming === 'birthday_month' ? `Birthday-month tier reward: ${tierRewardForm.name}` : `Tier achievement reward: ${tierRewardForm.name}`),
    imageUrl: null,
    audience: 'all_customers',
    availabilityMode: 'always',
    activeDays: [],
    startTime: null,
    endTime: null,
    annualDate: null,
    monthlyDay: null
  });

  const handleSaveTierReward = async (event) => {
    event.preventDefault();
    const tier = sortedTiers.find((entry) => Number(entry.id) === Number(tierRewardForm.tierId));
    if (!tier || !tier.isActive) {
      alert('Choose an active tier for this reward.');
      return;
    }
    if (tierRewardForm.productKinds.length === 0) {
      alert('Choose at least one eligible menu item type.');
      return;
    }

    setTierRewardSaving(true);
    let createdVoucher = null;
    try {
      if (editingTierReward) {
        await adminRequest(`/v1/admin/vouchers/${encodeURIComponent(editingTierReward.voucherCode)}`, {
          method: 'PUT',
          body: JSON.stringify(buildTierRewardPayload())
        });
      } else {
        createdVoucher = await adminRequest('/v1/admin/vouchers', {
          method: 'POST',
          body: JSON.stringify(buildTierRewardPayload())
        });
        await updateAdminTier(tier.id, {
          rewardConfig: {
            voucherTemplateIds: tierRewardForm.rewardTiming === 'birthday_month' ? tierRewardIds(tier) : [...tierRewardIds(tier), Number(createdVoucher.db_id)],
            birthdayVoucherTemplateIds: tierRewardForm.rewardTiming === 'birthday_month' ? [...tierBirthdayRewardIds(tier), Number(createdVoucher.db_id)] : tierBirthdayRewardIds(tier)
          }
        });
      }
      await refreshTiers();
      setTierRewardModalOpen(false);
      setTierRewardForm(emptyTierRewardForm(sortedTiers));
      setEditingTierReward(null);
    } catch (error) {
      // Do not leave an unlinked template behind if the tier link could not be saved.
      if (createdVoucher?.id) {
        await adminRequest(`/v1/admin/vouchers/${encodeURIComponent(createdVoucher.id)}`, { method: 'DELETE' }).catch(() => undefined);
      }
      alert(`Unable to create tier reward: ${error.message}`);
    } finally {
      setTierRewardSaving(false);
    }
  };

  const handleUnlinkTierReward = async (tier, voucherTemplateId, timing) => {
    const voucher = voucherOptions.find((entry) => Number(entry.db_id) === Number(voucherTemplateId));
    if (!window.confirm(`Remove ${voucher?.name || 'this reward'} from ${tier.name}? The voucher itself remains available in Vouchers.`)) return;

    try {
      const remainingAchievementIds = tierRewardIds(tier).filter((id) => id !== Number(voucherTemplateId));
      const remainingBirthdayIds = tierBirthdayRewardIds(tier).filter((id) => id !== Number(voucherTemplateId));
      await updateAdminTier(tier.id, {
        rewardConfig: remainingAchievementIds.length > 0 || remainingBirthdayIds.length > 0
          ? {
              voucherTemplateIds: timing === 'achievement' ? remainingAchievementIds : tierRewardIds(tier),
              birthdayVoucherTemplateIds: timing === 'birthday_month' ? remainingBirthdayIds : tierBirthdayRewardIds(tier)
            }
          : null
      });
      await refreshTiers();
    } catch (error) {
      alert(`Unable to remove tier reward: ${error.message}`);
    }
  };

  const handleSaveTier = async (event) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      code: slugify(form.code || form.name),
      name: String(form.name || '').trim(),
      minCups: Number(form.minCups || 0),
      imageUrl: form.imageUrl || null,
      sortOrder: Number(form.sortOrder || form.minCups || 0),
      isActive: Boolean(form.isActive)
    };

    try {
      if (form.id) {
        await updateAdminTier(form.id, payload);
      } else {
        await createAdminTier(payload);
      }
      await refreshTiers();
      setModalOpen(false);
      setForm(emptyForm());
    } catch (error) {
      alert(`Unable to save tier: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveTier = async (tier) => {
    const confirmed = window.confirm(`Archive ${tier.name}? This will hide it from active progress calculations until reactivated.`);
    if (!confirmed) {
      setOpenDropdownId(null);
      return;
    }

    try {
      await deleteAdminTier(tier.id);
      await refreshTiers();
    } catch (error) {
      alert(`Unable to archive tier: ${error.message}`);
    } finally {
      setOpenDropdownId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(sortedTiers.length / itemsPerPage));
  const paginatedTiers = sortedTiers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6 overflow-y-auto bg-gray-50/30">
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tier Management</h1>
            <p className="text-sm text-gray-500 mt-1">Configure loyalty tiers and cup requirements from the live database.</p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F3A34] text-white text-sm font-bold rounded-lg border-transparent hover:bg-[#2E5E58] transition-colors shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Plus size={16} /> New Tier
        </button>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="rounded-2xl border border-[#D7E4E0] bg-[#F4F8F7] px-4 py-3 text-xs text-gray-700">
        <span className="font-bold text-[#1F3A34]">How rewards work: </span>
        Achievement rewards issue once when a member reaches a tier. Birthday-month rewards are available only during that member&apos;s birthday month.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 shrink-0">
        <StatCard
          title="Total Members"
          value={isLoading ? '—' : totalMembers.toLocaleString('en-US')}
          change="Live loyalty data"
          icon={Users}
          iconBg="bg-[#1F3A34]"
        />
        <StatCard
          title="Base Tier"
          value={baseTier?.name || 'None'}
          change={baseTier ? `Starts at ${formatCupsLabel(baseTier.minCups)}` : 'No active tiers'}
          icon={BarChart3}
          iconBg="bg-[#6F9F96]"
        />
        <StatCard
          title="Top Tier"
          value={topTier?.name || 'None'}
          change={topTier ? `Starts at ${formatCupsLabel(topTier.minCups)}` : 'No active tiers'}
          icon={Award}
          iconBg="bg-[#D4AF7A]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Members by Tier</h2>
              <p className="text-xs text-gray-500 mt-0.5">Live from the current tier configuration and customer snapshots.</p>
            </div>
          </div>

          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }} />
                <Tooltip
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value) => [value, 'Members']}
                />
                <Bar dataKey="members" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {chartData.map((entry, index) => (
                    <Cell key={`tier-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-[#1F3A34]/10 text-[#1F3A34] rounded-full flex items-center justify-center mb-4">
            <Users size={32} />
          </div>
          <h3 className="text-4xl font-bold text-gray-900">{activeTierCount}</h3>
          <p className="text-sm font-medium text-gray-500 mt-1">Active tiers in use</p>
          <div className="mt-8 w-full pt-6 border-t border-gray-100 flex justify-between items-center px-4">
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{totalMembers.toLocaleString('en-US')}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Members</p>
            </div>
            <div className="w-px h-10 bg-gray-200"></div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#1F3A34]">{topTier?.name || 'None'}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Top Tier</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col flex-1 min-h-[420px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Tier Name</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Cups Needed</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Tier Rewards</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && paginatedTiers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                    Loading tiers...
                  </td>
                </tr>
              ) : paginatedTiers.length > 0 ? (
                paginatedTiers.map((tier, index) => {
                  const badgeStyle = getTierBadgeStyle(DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
                  const linkedRewards = [
                    ...tierRewardIds(tier).map((voucherTemplateId) => ({
                      voucherTemplateId,
                      timing: 'achievement',
                      voucher: voucherOptions.find((voucher) => Number(voucher.db_id) === voucherTemplateId) || null
                    })),
                    ...tierBirthdayRewardIds(tier).map((voucherTemplateId) => ({
                      voucherTemplateId,
                      timing: 'birthday_month',
                      voucher: voucherOptions.find((voucher) => Number(voucher.db_id) === voucherTemplateId) || null
                    }))
                  ];

                  return (
                    <tr key={tier.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border"
                            style={badgeStyle}
                          >
                            <Award size={16} />
                          </div>
                        <div>
                          <span className="font-semibold text-gray-900">{tier.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{formatCupsLabel(tier.minCups)}</td>
                      <td className="px-6 py-4 align-top whitespace-normal">
                        <div className="min-w-[280px] space-y-2">
                          {linkedRewards.map((reward) => (
                            <div key={`${tier.id}-${reward.timing}-${reward.voucherTemplateId}`} className="rounded-lg border border-[#DDE9E5] bg-[#F8FBFA] p-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${reward.timing === 'birthday_month' ? 'bg-[#FFF4DD] text-[#996514]' : 'bg-[#EEF3FF] text-[#32549A]'}`}>{reward.timing === 'birthday_month' ? 'Birthday month' : 'Achievement'}</span>
                                    <span className="truncate text-xs font-bold text-gray-900">{reward.voucher?.name || `Reward #${reward.voucherTemplateId}`}</span>
                                  </div>
                                  <p className="mt-1 text-[11px] text-gray-500">{reward.voucher?.benefitType || 'Voucher'}{reward.voucher?.status ? ` · ${reward.voucher.status}` : ''}</p>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                  <button type="button" onClick={() => openTierRewardModal(tier.id, reward)} className="rounded-md border border-[#BFD3CE] p-1.5 text-[#1F3A34] hover:bg-white" aria-label={`Edit ${reward.voucher?.name || 'tier reward'}`} title="Edit reward"><Edit3 size={13} /></button>
                                  <button type="button" onClick={() => handleUnlinkTierReward(tier, reward.voucherTemplateId, reward.timing)} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50" aria-label={`Unlink ${reward.voucher?.name || 'tier reward'}`} title="Unlink reward"><X size={13} /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {linkedRewards.length === 0 && <p className="text-xs text-gray-400">No rewards configured.</p>}
                          <button type="button" onClick={() => openTierRewardModal(tier.id)} disabled={!tier.isActive} className="inline-flex items-center gap-1 text-xs font-bold text-[#1F3A34] hover:text-[#2E5E58] disabled:cursor-not-allowed disabled:text-gray-400"><Plus size={13} /> Add reward</button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md font-bold text-xs ${getStatusClass(Boolean(tier.isActive))}`}>
                          {formatTierStatus(Boolean(tier.isActive))}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center relative">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenDropdownId(openDropdownId === tier.id ? null : tier.id);
                          }}
                          className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {openDropdownId === tier.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 flex flex-col overflow-hidden">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditModal(tier);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors border-b border-gray-50"
                              >
                                <Edit3 size={14} className="text-gray-400" /> Edit
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleArchiveTier(tier);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
                              >
                                <Trash2 size={14} className="text-red-400" /> Archive
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                    No tiers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-auto px-6 py-4 border-t border-gray-100 flex shrink-0 bg-white">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={sortedTiers.length}
            itemName="tiers"
          />
        </div>
      </div>

      <TierModal
        open={modalOpen}
        title={form.id ? 'Edit Tier' : 'New Tier'}
        form={form}
        onChange={updateForm}
        onClose={() => {
          setModalOpen(false);
          setForm(emptyForm());
        }}
        onSave={handleSaveTier}
        saving={saving}
      />
      <TierRewardModal
        open={tierRewardModalOpen}
        form={tierRewardForm}
        tiers={sortedTiers}
        menuItems={tierRewardMenuItems}
        onChange={updateTierRewardForm}
        onClose={() => {
          setTierRewardModalOpen(false);
          setTierRewardForm(emptyTierRewardForm(sortedTiers));
          setEditingTierReward(null);
        }}
        onSave={handleSaveTierReward}
        saving={tierRewardSaving}
        isEditing={Boolean(editingTierReward)}
      />
    </div>
  );
};

export default TierManagement;
