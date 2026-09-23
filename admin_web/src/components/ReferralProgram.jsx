import React, { useEffect, useState } from 'react';
import { Gift, Pencil, Plus, RefreshCw, Share2, Trash2, Users, X } from 'lucide-react';
import { adminRequest, loadAdminVouchers } from '../lib/adminApi';

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
  if (status === 'active') return 'bg-emerald-100 text-emerald-700';
  if (status === 'paused') return 'bg-amber-100 text-amber-800';
  if (status === 'archived') return 'bg-gray-100 text-gray-600';
  return 'bg-slate-100 text-slate-600';
}

function RewardField({ title, value, vouchers, onChange }) {
  const update = (patch) => onChange({ ...value, ...patch });
  const activeVouchers = vouchers.filter((voucher) => voucher.status === 'Active');
  return (
    <section className="rounded-xl border border-[#D7E4E0] bg-[#F8FBFA] p-4">
      <h3 className="font-bold text-[#1F3A34]">{title}</h3>
      <p className="mt-1 text-xs text-gray-500">This is issued once after the referral reaches its qualifying event.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-gray-700">Reward type
          <select value={value.type} onChange={(event) => update({ type: event.target.value, voucherTemplateId: '', tokenAmount: '' })} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="voucher">Voucher</option>
            <option value="token">Free tokens</option>
          </select>
        </label>
        {value.type === 'voucher' ? (
          <label className="text-xs font-semibold text-gray-700">Active voucher
            <select value={value.voucherTemplateId} onChange={(event) => update({ voucherTemplateId: event.target.value })} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="">Select an active voucher</option>
              {activeVouchers.map((voucher) => <option key={voucher.db_id} value={voucher.db_id}>{voucher.name} ({voucher.id})</option>)}
            </select>
          </label>
        ) : (
          <label className="text-xs font-semibold text-gray-700">Tokens to add
            <input type="number" min="1" max="1000" value={value.tokenAmount} onChange={(event) => update({ tokenAmount: event.target.value })} placeholder="e.g. 10" className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
          </label>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between border-b border-gray-100 bg-white px-6 py-5">
          <div><h2 className="text-xl font-bold text-[#1F3A34]">{form.id ? 'Edit Referral Program' : 'New Referral Program'}</h2><p className="mt-1 text-sm text-gray-500">Set what both people receive when a referral completes.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="space-y-5 p-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <label className="text-xs font-semibold text-gray-700">Program name
              <input required value={form.name} onChange={(event) => update({ name: event.target.value })} placeholder="e.g. Bring a friend" className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-gray-700">Status
              <select value={form.status} onChange={(event) => update({ status: event.target.value })} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                <option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <RewardField title="Friend reward" value={form.friendReward} vouchers={vouchers} onChange={(friendReward) => update({ friendReward })} />
            <RewardField title="Referrer reward" value={form.referrerReward} vouchers={vouchers} onChange={(referrerReward) => update({ referrerReward })} />
          </div>
          <section className="rounded-xl border border-gray-200 p-4">
            <h3 className="font-bold text-[#1F3A34]">Qualification controls</h3>
            <p className="mt-1 text-xs text-gray-500">A referral completes only when the friend collects their first order within this window.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-gray-700">Days to complete
                <input required type="number" min="1" max="90" value={form.qualificationDays} onChange={(event) => update({ qualificationDays: event.target.value })} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-semibold text-gray-700">Referrer rewards per month
                <input required type="number" min="1" max="100" value={form.monthlyReferrerLimit} onChange={(event) => update({ monthlyReferrerLimit: event.target.value })} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </label>
            </div>
          </section>
          <p className="text-xs leading-relaxed text-gray-500">Only one program can be active at a time. Activating this program pauses any other active referral program.</p>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-100 bg-white px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button><button disabled={saving} className="rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save referral program'}</button></div>
      </form>
    </div>
  );
}

export default function ReferralProgram() {
  const [programs, setPrograms] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [programResponse, voucherResponse] = await Promise.all([
        referralRequest('/v1/admin/referral-programs'),
        loadAdminVouchers()
      ]);
      setPrograms(programResponse.programs || []);
      setVouchers(voucherResponse.vouchers || []);
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
    if (!window.confirm(`Delete "${program.name}"? Programs that have already been used cannot be deleted.`)) return;
    try { await referralRequest(`/v1/admin/referral-programs/${program.id}`, { method: 'DELETE' }); await refresh(); } catch (requestError) { setError(requestError.message || 'Unable to delete this referral program.'); }
  };
  const saveComplete = async () => { setEditing(null); await refresh(); };

  return <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2 text-[#2E5E58]"><Share2 size={21} /><span className="text-xs font-bold uppercase tracking-[0.14em]">Marketing & loyalty</span></div><h1 className="mt-2 text-3xl font-bold text-[#1F3A34]">Referral Program</h1><p className="mt-2 max-w-2xl text-sm text-gray-600">Create one controlled referral campaign. The friend qualifies after their first collected order; each person can receive either a voucher or free tokens.</p></div><div className="flex gap-2"><button onClick={() => void refresh()} className="rounded-lg border border-gray-200 bg-white p-2.5 text-[#2E5E58] hover:bg-[#F3F8F6]" title="Refresh"><RefreshCw size={18} /></button><button onClick={() => setEditing(emptyProgram())} className="inline-flex items-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2E5E58]"><Plus size={18} />New referral program</button></div></div>
    {error && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><Users className="text-[#2E5E58]" size={23} /><p className="mt-3 text-2xl font-bold text-gray-900">{programs.length}</p><p className="text-sm text-gray-500">Referral programs</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><Gift className="text-[#D08B32]" size={23} /><p className="mt-3 text-2xl font-bold text-gray-900">{programs.filter((program) => program.status === 'active').length}</p><p className="text-sm text-gray-500">Active program</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><Share2 className="text-[#6F9F96]" size={23} /><p className="mt-3 text-sm font-bold text-gray-900">Friend's first collected order</p><p className="mt-1 text-sm text-gray-500">Qualification event</p></div></div>
    <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-[#1F3A34]">Campaigns</h2><p className="mt-1 text-xs text-gray-500">Keep a single active program so customers receive predictable rewards.</p></div>{loading ? <div className="p-8 text-sm text-gray-500">Loading referral programs...</div> : programs.length === 0 ? <div className="p-10 text-center"><Share2 className="mx-auto text-[#6F9F96]" size={30} /><h3 className="mt-3 font-bold text-[#1F3A34]">No referral program yet</h3><p className="mt-1 text-sm text-gray-500">Create the first campaign to define friend and referrer rewards.</p></div> : <div className="divide-y divide-gray-100">{programs.map((program) => <div key={program.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#1F3A34]">{program.name}</h3><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${statusStyle(program.status)}`}>{program.status}</span></div><p className="mt-1 text-xs text-gray-500">{program.qualification_days} days to complete · {program.monthly_referrer_limit} referrer rewards/month</p></div><div className="rounded-lg bg-[#F8FBFA] px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Friend receives</p><p className="mt-1 text-sm font-semibold text-gray-800">{rewardLabel(program, 'friend', vouchers)}</p></div><div className="rounded-lg bg-[#F8FBFA] px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Referrer receives</p><p className="mt-1 text-sm font-semibold text-gray-800">{rewardLabel(program, 'referrer', vouchers)}</p></div><div className="flex gap-2"><button onClick={() => setEditing(fromProgram(program))} className="rounded-lg border border-gray-200 p-2 text-[#2E5E58] hover:bg-[#F3F8F6]" title="Edit"><Pencil size={16} /></button><button onClick={() => void remove(program)} className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-[#F3F8F6]" title="Delete"><Trash2 size={16} /></button></div></div>)}</div>}</div>
    {editing && <ProgramForm initial={editing} vouchers={vouchers} onClose={() => setEditing(null)} onSaved={saveComplete} />}
  </div>;
}
