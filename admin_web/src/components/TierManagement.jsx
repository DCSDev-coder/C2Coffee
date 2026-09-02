import React, { useEffect, useMemo, useState } from 'react';
import { Award, BarChart3, Edit3, MoreVertical, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Pagination from './Pagination';
import { createAdminTier, deleteAdminTier, loadAdminLoyaltyOverview, loadAdminVouchers, updateAdminTier } from '../lib/adminApi';

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

function formatTierRewards(tier, voucherOptions) {
  const tierCode = String(tier?.code || '').trim().toLowerCase();
  const targetedVouchers = voucherOptions.filter((voucher) =>
    voucher.status === 'Active'
      && String(voucher.tier || '').trim().toLowerCase() === tierCode
  );
  const configuredVoucherId = Number(tier?.rewardConfig?.voucherTemplateId || 0);
  const configuredVoucher = configuredVoucherId
    ? voucherOptions.find((voucher) => Number(voucher.db_id) === configuredVoucherId)
    : null;
  const vouchers = configuredVoucher && !targetedVouchers.some((voucher) => Number(voucher.db_id) === configuredVoucherId)
    ? [configuredVoucher, ...targetedVouchers]
    : targetedVouchers;

  if (vouchers.length === 0) return 'No tier vouchers';
  return vouchers.map((voucher) => voucher.name).join(', ');
}

function getStatusClass(isActive) {
  return isActive
    ? 'bg-green-100 text-green-700'
    : 'bg-gray-100 text-gray-600';
}

function getTierBadgeStyle(color) {
  const safeColor = typeof color === 'string' && color.trim() ? color.trim() : '#1F3A34';
  return {
    backgroundColor: `${safeColor}14`,
    color: safeColor,
    borderColor: `${safeColor}33`
  };
}

function emptyForm() {
  return {
    id: null,
    code: '',
    name: '',
    minCups: 0,
    badgeColor: '#1F3A34',
    sortOrder: 0,
    isActive: true,
    rewardVoucherId: ''
  };
}

const TierModal = ({ open, title, form, voucherOptions, onChange, onClose, onSave, saving }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Live tier settings used by customer progress, menu pricing, and tier state.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Tier Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => onChange({ code: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                required
              />
              <p className="text-[11px] text-gray-400 mt-1">Used by menu pricing, voucher rules, and member snapshots.</p>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Tier Unlock Voucher</label>
              <select
                value={form.rewardVoucherId}
                onChange={(e) => onChange({ rewardVoucherId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] bg-white"
              >
                <option value="">No automatic voucher</option>
                {voucherOptions.map((voucher) => (
                  <option key={voucher.db_id} value={voucher.db_id} disabled={voucher.status !== 'Active'}>
                    {voucher.name} ({voucher.id}){voucher.status !== 'Active' ? ' - inactive' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Issued once when a member first reaches this tier. The base tier at 0 cups does not unlock a voucher.</p>
            </div>
            <div className="flex items-end">
              <p className="text-[11px] text-gray-400 leading-snug">
                Tiers are sorted automatically by cups needed, then saved in the backend for deterministic fallback.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Badge Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.badgeColor || '#1F3A34'}
                  onChange={(e) => onChange({ badgeColor: e.target.value })}
                  className="h-11 w-16 border border-gray-200 rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={form.badgeColor || ''}
                  onChange={(e) => onChange({ badgeColor: e.target.value })}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                  placeholder="#1F3A34"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-6">
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
    </div>
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
        const [response, voucherResponse] = await Promise.all([
          loadAdminLoyaltyOverview(100),
          loadAdminVouchers()
        ]);
        if (!isMounted) return;

        setOverview(response ?? null);
        setTiers(Array.isArray(response?.tiers) ? response.tiers : []);
        setVoucherOptions(Array.isArray(voucherResponse?.vouchers) ? voucherResponse.vouchers : []);
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
        color: tier.badgeColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
      }))
    : activeTiers.map((tier, index) => ({
        name: tier.name,
        members: 0,
        color: tier.badgeColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
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
      badgeColor: tier.badgeColor || '#1F3A34',
      sortOrder: parseNumber(tier.sortOrder || tier.minCups),
      isActive: Boolean(tier.isActive),
      rewardVoucherId: tier.rewardConfig?.voucherTemplateId ? String(tier.rewardConfig.voucherTemplateId) : ''
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
    const [response, voucherResponse] = await Promise.all([
      loadAdminLoyaltyOverview(100),
      loadAdminVouchers()
    ]);
    setOverview(response ?? null);
    setTiers(Array.isArray(response?.tiers) ? response.tiers : []);
    setVoucherOptions(Array.isArray(voucherResponse?.vouchers) ? voucherResponse.vouchers : []);
    setCurrentPage(1);
  };

  const handleSaveTier = async (event) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      code: slugify(form.code || form.name),
      name: String(form.name || '').trim(),
      minCups: Number(form.minCups || 0),
      badgeColor: String(form.badgeColor || '').trim() || null,
      sortOrder: Number(form.sortOrder || form.minCups || 0),
      isActive: Boolean(form.isActive),
      rewardConfig: form.rewardVoucherId
        ? { voucherTemplateId: Number(form.rewardVoucherId) }
        : null
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
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Code</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Cups Needed</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Tier Vouchers</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && paginatedTiers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 text-sm">
                    Loading tiers...
                  </td>
                </tr>
              ) : paginatedTiers.length > 0 ? (
                paginatedTiers.map((tier, index) => {
                  const badgeStyle = getTierBadgeStyle(tier.badgeColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);

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
                      <td className="px-6 py-4 text-gray-600 font-medium">{tier.code}</td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{formatCupsLabel(tier.minCups)}</td>
                      <td className="px-6 py-4 text-gray-600 font-medium whitespace-normal min-w-52">{formatTierRewards(tier, voucherOptions)}</td>
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
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 text-sm">
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
        voucherOptions={voucherOptions}
        onChange={updateForm}
        onClose={() => {
          setModalOpen(false);
          setForm(emptyForm());
        }}
        onSave={handleSaveTier}
        saving={saving}
      />
    </div>
  );
};

export default TierManagement;
