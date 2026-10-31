import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Gift, Pencil, Plus, RefreshCw, Share2, Trash2, Users, X,
  Search, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown, Save
} from 'lucide-react';
import { adminRequest, loadAdminVouchers } from '../lib/adminApi';
import { requestAdminConfirm, requestAdminPrompt } from '../lib/adminDialog';
import InfoTooltip from './InfoTooltip';

const emptyProgram = () => ({
  id: null,
  name: '',
  status: 'draft',
  friendReward: { type: 'voucher', voucherTemplateId: '', tokenAmount: '' },
  referrerReward: { type: 'voucher', voucherTemplateId: '', tokenAmount: '' },
  qualificationDays: 14,
  monthlyReferrerLimit: 10
});

function fromProgram(program) {
  return {
    id: program.id,
    name: program.name || '',
    status: program.status || 'draft',
    friendReward: {
      type: program.friend_reward_type || 'voucher',
      voucherTemplateId: program.friend_voucher_template_id ? String(program.friend_voucher_template_id) : '',
      tokenAmount: program.friend_token_amount ?? ''
    },
    referrerReward: {
      type: program.referrer_reward_type || 'voucher',
      voucherTemplateId: program.referrer_voucher_template_id ? String(program.referrer_voucher_template_id) : '',
      tokenAmount: program.referrer_token_amount ?? ''
    },
    qualificationDays: program.qualification_days ?? 14,
    monthlyReferrerLimit: program.monthly_referrer_limit ?? 10
  };
}

function rewardLabel(program, side, vouchers) {
  const type = program[`${side}_reward_type`];
  if (type === 'token') return `${program[`${side}_token_amount`]} free tokens`;
  const voucherId = Number(program[`${side}_voucher_template_id`]);
  return vouchers.find((voucher) => Number(voucher.db_id) === voucherId)?.name || 'Voucher not available';
}

async function referralRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    return await adminRequest(path, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('The referral service did not respond within 12 seconds. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function statusStyle(status) {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
  if (status === 'paused') return 'bg-amber-50 text-amber-800 border border-amber-200/60';
  if (status === 'archived') return 'bg-gray-100 text-gray-600 border border-gray-200/60';
  return 'bg-slate-100 text-slate-600 border border-slate-200/60';
}

function KPICard({ title, value, badge, info, icon: Icon, iconBg = "bg-[#1E433A]", iconColor = "text-white" }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-200/80 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-xs`}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
            {info && <InfoTooltip content={info} title={title} />}
          </div>
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight mt-0.5">{value}</p>
        </div>
      </div>
      {badge && (
        <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold bg-[#E8F3F0] text-[#1E433A]">
          {badge}
        </span>
      )}
    </div>
  );
}

function SortableHeader({ label, columnKey, currentKey, direction, onSort, info, className = "" }) {
  const isSorted = currentKey === columnKey;
  return (
    <th className={`px-6 py-4 font-bold text-[11px] text-gray-500 uppercase tracking-wider whitespace-nowrap ${className}`}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSort(columnKey)}
          className={`group inline-flex items-center gap-1.5 hover:text-[#1E433A] cursor-pointer focus:outline-none transition-colors select-none ${
            isSorted ? "text-[#1E433A] font-bold" : ""
          }`}
          title={`Sort by ${label} ${isSorted && direction === "asc" ? "(Descending)" : "(Ascending)"}`}
        >
          <span>{label}</span>
          <span className="inline-flex items-center">
            {isSorted ? (
              direction === "asc" ? (
                <ArrowUp size={13} className="text-[#1E433A]" strokeWidth={2.5} />
              ) : (
                <ArrowDown size={13} className="text-[#1E433A]" strokeWidth={2.5} />
              )
            ) : (
              <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            )}
          </span>
        </button>
        {info && <InfoTooltip content={info} title={label} />}
      </div>
    </th>
  );
}

function RewardField({ title, value, vouchers, onChange, timing }) {
  const update = (patch) => onChange({ ...value, ...patch });
  const activeVouchers = vouchers.filter((voucher) => voucher.status === 'Active');
  return (
    <section className="rounded-2xl border border-gray-200/80 bg-[#FAFBFB] p-4.5 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-xs uppercase tracking-wider text-gray-900">{title}</h3>
        <InfoTooltip content={timing} title={title} />
      </div>
      <p className="text-xs text-gray-500">{timing}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Reward type</label>
          <select
            value={value.type}
            onChange={(event) => update({ type: event.target.value, voucherTemplateId: '', tokenAmount: '' })}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
          >
            <option value="voucher">Voucher</option>
            <option value="token">Free tokens</option>
          </select>
        </div>
        {value.type === 'voucher' ? (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Active voucher</label>
            <select
              value={value.voucherTemplateId}
              onChange={(event) => update({ voucherTemplateId: event.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
            >
              <option value="">Select an active voucher</option>
              {activeVouchers.map((voucher) => (
                <option key={voucher.db_id} value={voucher.db_id}>
                  {voucher.name} ({voucher.id})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Tokens to add</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={value.tokenAmount}
              onChange={(event) => update({ tokenAmount: event.target.value })}
              placeholder="e.g. 10"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function ProgramForm({ initial, vouchers, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  const save = async (event) => {
    event.preventDefault();
    setError('');
    const payload = {
      ...form,
      friendReward: {
        type: form.friendReward.type,
        voucherTemplateId: form.friendReward.type === 'voucher' ? Number(form.friendReward.voucherTemplateId) || null : null,
        tokenAmount: form.friendReward.type === 'token' ? Number(form.friendReward.tokenAmount) || null : null
      },
      referrerReward: {
        type: form.referrerReward.type,
        voucherTemplateId: form.referrerReward.type === 'voucher' ? Number(form.referrerReward.voucherTemplateId) || null : null,
        tokenAmount: form.referrerReward.type === 'token' ? Number(form.referrerReward.tokenAmount) || null : null
      },
      qualificationDays: Number(form.qualificationDays),
      monthlyReferrerLimit: Number(form.monthlyReferrerLimit)
    };
    setSaving(true);
    try {
      await referralRequest(form.id ? `/v1/admin/referral-programs/${form.id}` : '/v1/admin/referral-programs', {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      await onSaved();
    } catch (requestError) {
      setError(requestError.message || 'Unable to save the referral program.');
    } finally {
      setSaving(false);
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <form onSubmit={save} className="mx-auto my-auto w-full max-w-3xl max-h-[calc(100vh-2rem)] flex flex-col rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-4 sm:p-5 bg-white/80 backdrop-blur-xs">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">
                {form.id ? 'Edit Referral Program' : 'New Referral Program'}
              </h2>
              <InfoTooltip
                title="Referral Program"
                content="Define rewards for both the new invitee and the referring customer. When a new customer enters a referral code, rewards trigger based on qualification criteria."
              />
            </div>
            <p className="mt-0.5 text-xs text-gray-400">Set what both customers receive when an invitation completes.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-6">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Program name *</label>
              <input
                required
                value={form.name}
                onChange={(event) => update({ name: event.target.value })}
                placeholder="e.g. Bring a Friend Campaign"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(event) => update({ status: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A] cursor-pointer"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <RewardField
              title="Friend reward"
              timing="Issued immediately when an eligible new customer claims the referral code."
              value={form.friendReward}
              vouchers={vouchers}
              onChange={(friendReward) => update({ friendReward })}
            />
            <RewardField
              title="Referrer reward"
              timing="Issued after the friend collects their first qualifying order."
              value={form.referrerReward}
              vouchers={vouchers}
              onChange={(referrerReward) => update({ referrerReward })}
            />
          </div>

          <section className="rounded-2xl border border-gray-200/80 bg-[#FAFBFB] p-4.5 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-900">Qualification controls</h3>
              <InfoTooltip
                title="Completion Window"
                content="A referral completes only when the invited friend places and collects their first order within this day window."
              />
            </div>
            <p className="text-xs text-gray-500">
              A referral completes only when the friend collects their first order within this window.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Days to complete</label>
                <input
                  required
                  type="number"
                  min="1"
                  max="90"
                  value={form.qualificationDays}
                  onChange={(event) => update({ qualificationDays: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Referrer rewards per month</label>
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  value={form.monthlyReferrerLimit}
                  onChange={(event) => update({ monthlyReferrerLimit: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
            </div>
          </section>

          <p className="text-[11px] text-gray-400">
            Note: Only one program can be active at a time. Activating this program pauses any other active referral program.
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 p-4 sm:p-5 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors disabled:opacity-60 cursor-pointer"
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save Referral Program'}</span>
          </button>
        </div>
      </form>
    </div>,
    document.body
  ) : null;
}

export default function ReferralProgram() {
  const [programs, setPrograms] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [rewardJobs, setRewardJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [programResponse, voucherResponse, rewardJobResponse] = await Promise.all([
        referralRequest('/v1/admin/referral-programs'),
        loadAdminVouchers(),
        referralRequest('/v1/admin/referral-reward-jobs')
      ]);
      setPrograms(programResponse.programs || []);
      setVouchers(voucherResponse.vouchers || []);
      setRewardJobs(rewardJobResponse.jobs || []);
    } catch (requestError) {
      if (requestError?.name !== 'AbortError') {
        setError(requestError.message || 'Unable to load referral programs.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const remove = async (program) => {
    if (
      !(await requestAdminConfirm({
        title: 'Delete referral program?',
        message: `Delete “${program.name}”? Programs already used by customers remain protected.`,
        confirmLabel: 'Delete',
        tone: 'danger'
      }))
    )
      return;
    try {
      await referralRequest(`/v1/admin/referral-programs/${program.id}`, { method: 'DELETE' });
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete this referral program.');
    }
  };

  const saveComplete = async () => {
    setEditing(null);
    await refresh();
  };

  const retryReward = async (job) => {
    setError('');
    try {
      const result = await referralRequest(`/v1/admin/referral-reward-jobs/${job.id}/retry`, { method: 'POST' });
      if (!result.completed) setError('The reward is still blocked. Review the reason below or resolve it after correcting the customer account or voucher.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Unable to retry this reward.');
    }
  };

  const waiveReward = async (job) => {
    const note = await requestAdminPrompt({
      title: 'Waive referral reward',
      message: 'Explain why this reward will not be issued. This explanation is saved in the audit record.',
      inputLabel: 'Reason',
      multiline: true,
      confirmLabel: 'Continue'
    });
    if (!note) return;
    const password = await requestAdminPrompt({
      title: 'Confirm protected action',
      message: 'Enter your current Super Admin password to waive this reward.',
      inputLabel: 'Password',
      inputType: 'password',
      confirmLabel: 'Confirm',
      tone: 'secure'
    });
    if (!password) return;
    try {
      await referralRequest(`/v1/admin/referral-reward-jobs/${job.id}/waive`, {
        method: 'POST',
        body: JSON.stringify({ note, confirmation_password: password })
      });
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Unable to resolve this reward.');
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredPrograms = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = programs.filter((p) => {
      const matchesSearch = !q || (p.name || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'days':
          comparison = (a.qualification_days || 0) - (b.qualification_days || 0);
          break;
        case 'limit':
          comparison = (a.monthly_referrer_limit || 0) - (b.monthly_referrer_limit || 0);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [programs, search, statusFilter, sortKey, sortDirection]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-[#2E5E58]">
            <Share2 size={18} />
            <span className="text-xs font-bold uppercase tracking-[0.14em]">Marketing & Loyalty</span>
            <InfoTooltip
              title="Referral Strategy"
              content="Encourage word-of-mouth growth. When existing customers invite friends, both parties earn configured rewards upon first order fulfillment."
            />
          </div>
          <h1 className="mt-1 text-3xl font-extrabold text-gray-900 tracking-tight">Referral Program</h1>
          <p className="mt-1.5 max-w-2xl text-xs text-gray-500">
            The friend receives their reward when claiming an eligible code. The referrer receives theirs after the friend's first collected order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#1E433A]' : ''} />
          </button>
          <button
            onClick={() => setEditing(emptyProgram())}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>New Referral Program</span>
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 shadow-2xs">{error}</div>}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Referral Programs"
          value={programs.length}
          badge="Campaigns"
          info="Total number of referral rule templates created."
          icon={Users}
          iconBg="bg-[#1E433A]"
        />
        <KPICard
          title="Active Program"
          value={programs.filter((program) => program.status === 'active').length}
          badge={programs.some((program) => program.status === 'active') ? 'Live' : 'Inactive'}
          info="Currently running program. Only one referral program can be active at any time."
          icon={Gift}
          iconBg="bg-[#2E5E58]"
        />
        <KPICard
          title="Qualification Event"
          value="1st Order"
          badge="Collected"
          info="Referrer reward is issued only after the friend completes and collects their first order."
          icon={Share2}
          iconBg="bg-[#8C6D53]"
        />
      </div>

      {/* Unresolved Rewards Alert */}
      {rewardJobs.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70 shadow-2xs">
          <div className="flex items-start gap-3 border-b border-amber-200/80 px-5 py-4">
            <AlertTriangle className="mt-0.5 text-amber-700" size={18} />
            <div>
              <h2 className="text-sm font-bold text-amber-950">Unresolved Referral Rewards ({rewardJobs.length})</h2>
              <p className="mt-0.5 text-xs text-amber-800">
                Pending rewards blocked by wallet cap, account issues, or voucher availability. Retry after resolving issues or waive with authorization.
              </p>
            </div>
          </div>
          <div className="divide-y divide-amber-200/60 bg-white">
            {rewardJobs.map((job) => (
              <div key={job.id} className="grid gap-3 px-5 py-3.5 lg:grid-cols-[1fr_1fr_auto] lg:items-center text-xs">
                <div>
                  <p className="font-bold text-gray-900">
                    {job.reward_side === 'friend' ? job.friend_name || 'Friend' : job.referrer_name || 'Referrer'} · {job.reward_side} reward
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {job.program_name || 'Historical referral'} · Referral #{job.referral_id} · Attempt {job.attempt_count}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-red-700">{job.last_failure_reason || 'Reward requires review'}</p>
                  <p className="text-[11px] text-gray-500">{job.last_error_message || 'Retry or waive to clear queue.'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void retryReward(job)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-[#1E433A] shadow-2xs hover:bg-gray-50 cursor-pointer"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => void waiveReward(job)}
                    className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 shadow-2xs hover:bg-red-50 cursor-pointer"
                  >
                    Waive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Campaigns Table & Filter Bar */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
        <div className="border-b border-gray-100 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Campaigns</h2>
                <InfoTooltip
                  title="Single Active Rule"
                  content="Keep a single active program so customers have predictable rules. Any existing pending referrals honor the settings at the time of code entry."
                />
              </div>
              <p className="mt-0.5 text-xs text-gray-500">Configure and monitor your active and draft referral campaigns.</p>
            </div>

            {/* Search and Status Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:max-w-xs">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search size={14} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search campaigns..."
                  className="block w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-800 placeholder-gray-400 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3.5 pr-8 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-none cursor-pointer"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                  <ChevronDown size={13} className="text-gray-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-semibold text-gray-500">Loading referral programs...</div>
        ) : filteredPrograms.length === 0 ? (
          <div className="p-12 text-center">
            <Share2 className="mx-auto text-[#6F9F96]" size={32} />
            <h3 className="mt-3 text-sm font-bold text-gray-900">No referral programs found</h3>
            <p className="mt-1 text-xs text-gray-500">Create a new referral campaign to define friend and referrer rewards.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs divide-y divide-gray-100">
              <thead className="bg-[#FAFBFB] text-gray-500 uppercase tracking-wider">
                <tr>
                  <SortableHeader label="Campaign" columnKey="name" currentKey={sortKey} direction={sortDirection} onSort={handleSort} />
                  <th className="px-6 py-4 font-bold text-[11px]">Friend receives</th>
                  <th className="px-6 py-4 font-bold text-[11px]">Referrer receives</th>
                  <SortableHeader label="Days" columnKey="days" currentKey={sortKey} direction={sortDirection} onSort={handleSort} info="Qualification window in days." />
                  <SortableHeader label="Status" columnKey="status" currentKey={sortKey} direction={sortDirection} onSort={handleSort} />
                  <th className="px-6 py-4 text-right font-bold text-[11px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredPrograms.map((program) => (
                  <tr key={program.id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">
                      <div>
                        <p className="text-xs">{program.name}</p>
                        <p className="text-[11px] font-normal text-gray-500 mt-0.5">
                          Limit: {program.monthly_referrer_limit} rewards/mo
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-800">
                      <span className="inline-block rounded-xl bg-gray-50 border border-gray-100 px-3 py-1.5 font-semibold text-gray-900 text-xs shadow-2xs">
                        {rewardLabel(program, 'friend', vouchers)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-800">
                      <span className="inline-block rounded-xl bg-gray-50 border border-gray-100 px-3 py-1.5 font-semibold text-gray-900 text-xs shadow-2xs">
                        {rewardLabel(program, 'referrer', vouchers)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-600">
                      {program.qualification_days} days
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${statusStyle(program.status)}`}>
                        {program.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(fromProgram(program))}
                          className="rounded-xl border border-gray-200 bg-white p-2 text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(program)}
                          className="rounded-xl border border-red-200 bg-white p-2 text-red-600 shadow-2xs hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <ProgramForm initial={editing} vouchers={vouchers} onClose={() => setEditing(null)} onSaved={saveComplete} />}
    </div>
  );
}
