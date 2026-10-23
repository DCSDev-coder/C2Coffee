import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Clock3,
  Database,
  FileCheck2,
  HardDrive,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

import { adminRequest } from '../lib/adminApi';
import { showAdminToast } from '../lib/adminToast';

const cleanupLabels = {
  temporary_records: 'expired temporary records',
  old_notifications: 'notifications older than 24 months',
  orphan_media: 'media that completed its 30-day quarantine',
};

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && amount >= 1024; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${unit}`;
}

function MetricCard({ icon: Icon, label, value, helper, tone = 'green' }) {
  const tones = {
    green: 'bg-[#173F37] text-white',
    mint: 'bg-[#DDEEEA] text-[#173F37]',
    gold: 'bg-[#F5E7C8] text-[#704F13]',
    coral: 'bg-[#FCE4DD] text-[#9B3A25]',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function CleanupRow({ title, description, count, disabled, onPreview }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{count}</span>
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled || count === 0}
        onClick={onPreview}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#2E5E58] px-4 py-2.5 text-sm font-bold text-[#1F4B43] transition hover:bg-[#EDF6F3] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
      >
        <FileCheck2 className="h-4 w-4" />
        Preview cleanup
      </button>
    </div>
  );
}

export default function DataRetention() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [password, setPassword] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await adminRequest('/v1/admin/data-retention/summary'));
    } catch (error) {
      showAdminToast(error.message || 'The retention summary could not be loaded.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const protectedTotal = useMemo(
    () => Object.values(summary?.protected_records || {}).reduce((total, value) => total + Number(value || 0), 0),
    [summary],
  );

  const startMediaReview = async () => {
    setWorking(true);
    try {
      await adminRequest('/v1/admin/data-retention/media-review', {
        method: 'POST',
        body: JSON.stringify({}),
        successMessage: 'Unreferenced media entered a 30-day safety review.',
      });
      await loadSummary();
    } catch (error) {
      showAdminToast(error.message || 'The media review could not be started.', 'error');
    } finally {
      setWorking(false);
    }
  };

  const previewCleanup = async (action) => {
    setWorking(true);
    try {
      const result = await adminRequest('/v1/admin/data-retention/cleanup', {
        method: 'POST',
        body: JSON.stringify({ action, dry_run: true }),
        suppressSuccessToast: true,
      });
      setPassword('');
      setDialog({ action, candidates: Number(result.candidates || 0) });
    } catch (error) {
      showAdminToast(error.message || 'The cleanup preview could not be prepared.', 'error');
    } finally {
      setWorking(false);
    }
  };

  const executeCleanup = async () => {
    if (!dialog || password.length < 8) return;
    setWorking(true);
    try {
      await adminRequest('/v1/admin/data-retention/cleanup', {
        method: 'POST',
        body: JSON.stringify({ action: dialog.action, dry_run: false, confirmation_password: password }),
        successMessage: 'Eligible records were cleaned and the action was added to Audit Logs.',
      });
      setDialog(null);
      setPassword('');
      await loadSummary();
    } catch (error) {
      showAdminToast(error.message || 'The cleanup could not be completed.', 'error');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6 px-8 pb-12 pt-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5D877F]">System maintenance</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Data Retention Centre</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Review archived records, monitor database storage, and safely clean temporary data. Financial, loyalty, voucher usage, referral, and audit history stays protected.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSummary()}
          disabled={loading || working}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh review
        </button>
      </div>

      {loading && !summary ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#2E5E58]" />
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Database} label="Database size" value={formatBytes(summary.storage.database_bytes)} helper="Tables and indexes currently stored." />
            <MetricCard icon={HardDrive} label="Media storage" value={formatBytes(summary.storage.media_bytes)} helper={`${summary.storage.media_assets} media assets in the database.`} tone="mint" />
            <MetricCard icon={Clock3} label="Five-year reviews due" value={summary.archive_review.due_now} helper="A reminder to review; never an automatic deletion." tone="gold" />
            <MetricCard icon={ShieldCheck} label="Protected records" value={protectedTotal.toLocaleString()} helper="Operational and financial history excluded from cleanup." tone="coral" />
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[#E4F1EE] p-3 text-[#1F4B43]"><Archive className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Archive review reminders</h2>
                <p className="mt-1 text-sm text-slate-500">Archived setup records are retained for history. Records older than five years are flagged for a human review.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {summary.archive_review.groups.map((group) => (
                <div key={group.key} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-800">{group.label}</p>
                  <p className="mt-2 text-2xl font-bold text-[#1F4B43]">{group.archived_count}</p>
                  <p className="text-xs text-slate-500">{group.due_count} due for review</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start gap-3">
              <div className="rounded-xl bg-[#F5E7C8] p-3 text-[#704F13]"><Trash2 className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Safe cleanup</h2>
                <p className="mt-1 text-sm text-slate-500">Every cleanup starts with a dry run. Execution requires the current administrator password and creates an audit entry.</p>
              </div>
            </div>
            <div className="space-y-3">
              <CleanupRow
                title="Temporary security records"
                count={summary.cleanup_candidates.temporary.eligible_now}
                disabled={working}
                description={`${summary.cleanup_candidates.temporary.expired_now} records are expired. Only records beyond the 90-day safety window are eligible.`}
                onPreview={() => void previewCleanup('temporary_records')}
              />
              <CleanupRow
                title="Old customer notifications"
                count={summary.cleanup_candidates.old_notifications}
                disabled={working}
                description="Only notification copies older than 24 months are eligible. Customer orders and loyalty history are untouched."
                onPreview={() => void previewCleanup('old_notifications')}
              />
              <CleanupRow
                title="Unreferenced media"
                count={summary.orphan_media.eligible_count}
                disabled={working}
                description={`${summary.orphan_media.count} possible orphan assets (${formatBytes(summary.orphan_media.bytes)}). ${summary.orphan_media.quarantined_count} are in review; only unchanged assets past 30 days can be removed.`}
                onPreview={() => void previewCleanup('orphan_media')}
              />
            </div>
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-dashed border-[#8AB3AA] bg-[#F1F8F6] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-[#173F37]">Media safety review</p>
                <p className="mt-1 text-sm text-[#52736C]">Register current orphan candidates and begin their 30-day quarantine. Re-running this does not reset the original review date.</p>
              </div>
              <button type="button" disabled={working || summary.orphan_media.count === 0} onClick={() => void startMediaReview()} className="rounded-xl bg-[#173F37] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#24594F] disabled:opacity-50">
                Start media review
              </button>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><LockKeyhole className="h-5 w-5 text-[#2E5E58]" /> Protected history</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {Object.entries(summary.protected_records).map(([key, value]) => (
                  <div key={key} className="rounded-xl bg-slate-50 p-3">
                    <p className="font-semibold capitalize text-slate-600">{key.replaceAll('_', ' ')}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{Number(value).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Customer retention dates</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Closed customer accounts follow the configured {summary.policy.account_retention_years}-year retention period. They are shown for review and are not automatically erased by this page.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#FFF5F2] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#A94C36]">Due now</p><p className="mt-2 text-3xl font-bold text-slate-900">{summary.customer_retention.due_now}</p></div>
                <div className="rounded-2xl bg-[#FFF9EA] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#87631C]">Next 90 days</p><p className="mt-2 text-3xl font-bold text-slate-900">{summary.customer_retention.due_within_90_days}</p></div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {dialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0EC] text-[#B8422A]"><Trash2 className="h-5 w-5" /></div>
              <button type="button" onClick={() => setDialog(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <h2 className="mt-5 text-2xl font-bold text-slate-950">Confirm safe cleanup</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The dry run found <strong>{dialog.candidates}</strong> eligible {cleanupLabels[dialog.action]}. The API checks eligibility again before deletion and records the result in Audit Logs.
            </p>
            <label className="mt-5 block text-sm font-bold text-slate-800" htmlFor="retention-password">Current administrator password</label>
            <input id="retention-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#2E5E58] focus:ring-2 focus:ring-[#2E5E58]/15" placeholder="Enter password to confirm" />
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setDialog(null)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={working || password.length < 8 || dialog.candidates === 0} onClick={() => void executeCleanup()} className="flex-1 rounded-xl bg-[#B8422A] px-4 py-3 font-bold text-white hover:bg-[#96351F] disabled:cursor-not-allowed disabled:opacity-45">
                {working ? 'Cleaning…' : 'Clean eligible records'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
