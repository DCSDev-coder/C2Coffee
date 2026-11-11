import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Download,
  RefreshCw,
  ReceiptText,
  ShoppingCart,
  Wallet
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { exportToCSV } from '../utils/exportToCSV';
import { loadAdminFinanceAuditLedger, loadAdminFinanceOverview } from '../lib/adminApi';
import { formatPaymentLabel, formatReportMoney, formatReportTokens } from '../utils/reporting';
import OutletFilter from './OutletFilter';
import InfoTooltip from './InfoTooltip';

const REFRESH_INTERVAL_MS = 60_000;

const EMPTY_OVERVIEW = {
  summary: {
    totalRevenueRm: 0,
    totalTokensCharged: 0,
    totalRefundAmountRm: 0,
    totalRefundTokens: 0,
    netRevenueRm: 0,
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    refundedOrders: 0,
    averageOrderValueRm: 0
  },
  monthlyRevenue: [],
  statusBreakdown: [],
  topUpMethodBreakdown: [],
  paymentMethodBreakdown: [],
  tokenMovementBreakdown: [],
  subsidySummary: { issuedTokens: 0, consumedTokens: 0, remainingIssuedTokens: 0, movementCount: 0 },
  recentTransactions: []
};

const topUpMethodLabel = (method) => {
  switch (method) {
    case 'fpx':
      return 'FPX Online Banking';
    case 'duitnow_qr':
      return 'DuitNow QR';
    case 'ewallet':
      return 'Online Payment';
    case 'touch_n_go':
      return 'Touch n Go online payment (legacy)';
    case 'card':
      return 'Credit or debit card';
    case 'bank_transfer':
      return 'Online banking (legacy)';
    case 'not_recorded':
      return 'Not recorded';
    default:
      return formatPaymentLabel(method);
  }
};

const StatCard = ({ title, value, subtitle, icon: Icon, iconBg, iconColor = 'text-white', info }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-xs transition-shadow flex items-center space-x-4 min-w-0">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-sm`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <h3 className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight whitespace-normal">
          {title}
        </h3>
        {info && <InfoTooltip content={info} title={title} />}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
      {subtitle && (
        <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal mt-1">
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

function SortableHeader({ label, columnKey, currentKey, direction, onSort, info, className = "" }) {
  const isSorted = currentKey === columnKey;
  return (
    <th className={`px-6 py-4 font-bold text-[11px] text-gray-500 uppercase tracking-wider whitespace-nowrap ${className}`}>
      <div className={`flex items-center gap-1.5 ${className.includes('text-right') ? 'justify-end' : className.includes('text-center') ? 'justify-center' : ''}`}>
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

const Finance = ({ setCurrentPage }) => {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [transactionSortKey, setTransactionSortKey] = useState('dateTime');
  const [transactionSortDirection, setTransactionSortDirection] = useState('desc');
  const [auditEntries, setAuditEntries] = useState([]);

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        setError('');
        const nextOverview = await loadAdminFinanceOverview({ storeId: selectedStoreId });
        if (!active) return;
        setOverview(nextOverview || EMPTY_OVERVIEW);
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load finance data.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadOverview();
    const timer = window.setInterval(() => {
      void loadOverview();
    }, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedStoreId]);

  useEffect(() => {
    let active = true;
    void loadAdminFinanceAuditLedger({ storeId: selectedStoreId, limit: 100 })
      .then((response) => {
        if (active) setAuditEntries(Array.isArray(response?.entries) ? response.entries : []);
      })
      .catch(() => {
        if (active) setAuditEntries([]);
      });
    return () => { active = false; };
  }, [selectedStoreId]);

  const summary = overview.summary || EMPTY_OVERVIEW.summary;
  const monthlyRevenue = Array.isArray(overview.monthlyRevenue) ? overview.monthlyRevenue : [];
  const topUpMethodBreakdown = Array.isArray(overview.topUpMethodBreakdown) ? overview.topUpMethodBreakdown : [];
  const paymentMethodBreakdown = Array.isArray(overview.paymentMethodBreakdown) ? overview.paymentMethodBreakdown : [];
  const tokenMovementBreakdown = Array.isArray(overview.tokenMovementBreakdown) ? overview.tokenMovementBreakdown : [];
  const subsidySummary = overview.subsidySummary || EMPTY_OVERVIEW.subsidySummary;
  const recentTransactions = useMemo(
    () => (Array.isArray(overview.recentTransactions) ? overview.recentTransactions : []),
    [overview.recentTransactions]
  );
  const peakTokenMonth = monthlyRevenue.reduce((best, entry) => {
    if (!best) return entry;
    return Number(entry.tokensCharged || 0) > Number(best.tokensCharged || 0) ? entry : best;
  }, null);
  const totalPaidTopUps = topUpMethodBreakdown.reduce((total, entry) => total + Number(entry.count || 0), 0);
  const mostUsedTopUpMethod = topUpMethodBreakdown.find((entry) => entry.method !== 'not_recorded') || null;

  const exportRows = [
      ['Date', 'Time', 'Type', 'Description', 'Outlet', 'RM Amount', 'Token Amount', 'Status', 'Payment'],
      ...recentTransactions.map((transaction) => [
        `"${transaction.date}"`,
        `"${transaction.time}"`,
        `"${transaction.type}"`,
        `"${transaction.description}"`,
        `"${transaction.storeName || ''}"`,
        Number(transaction.amountRm || 0).toFixed(2),
        Number(transaction.amountTokens || 0).toFixed(0),
        `"${transaction.status}"`,
        `"${transaction.paymentMode || ''}"`
      ])
    ];

  const handleExport = () => {
    exportToCSV(exportRows, 'finance_overview.csv');
  };

  const revenueChartData = monthlyRevenue.map((entry) => ({
    month: entry.month,
    tokensCharged: Number(entry.tokensCharged || 0),
    refundTokens: Number(entry.refundTokens || 0),
    netTokens: Number(entry.netTokens || 0),
    grossRevenueRm: Number(entry.revenueRm || 0),
    netRevenueRm: Number(entry.netRm || 0)
  }));
  const maxTokenValue = revenueChartData.reduce((max, entry) => Math.max(
    max,
    Number(entry.tokensCharged || 0),
    Number(entry.refundTokens || 0),
    Number(entry.netTokens || 0)
  ), 0);
  const tokenTickStep = Math.max(250, Math.ceil(Math.max(maxTokenValue, 1) / 4 / 250) * 250);
  const tokenAxisMax = Math.max(tokenTickStep, Math.ceil(maxTokenValue / tokenTickStep) * tokenTickStep);
  const tokenAxisTicks = Array.from(
    { length: Math.floor(tokenAxisMax / tokenTickStep) + 1 },
    (_, index) => index * tokenTickStep
  );

  const handleTransactionSort = (key) => {
    if (transactionSortKey === key) {
      setTransactionSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTransactionSortKey(key);
      setTransactionSortDirection('asc');
    }
  };

  const sortedTransactions = useMemo(() => {
    return [...recentTransactions].sort((a, b) => {
      let aVal, bVal;
      if (transactionSortKey === 'dateTime') {
        aVal = `${a.date || ''} ${a.time || ''}`;
        bVal = `${b.date || ''} ${b.time || ''}`;
      } else if (transactionSortKey === 'type') {
        aVal = (a.type || '').toLowerCase();
        bVal = (b.type || '').toLowerCase();
      } else if (transactionSortKey === 'description') {
        aVal = (a.description || '').toLowerCase();
        bVal = (b.description || '').toLowerCase();
      } else if (transactionSortKey === 'outlet') {
        aVal = (a.storeName || '').toLowerCase();
        bVal = (b.storeName || '').toLowerCase();
      } else if (transactionSortKey === 'tokens') {
        aVal = Number(a.amountTokens || 0);
        bVal = Number(b.amountTokens || 0);
      } else if (transactionSortKey === 'status') {
        aVal = (a.status || '').toLowerCase();
        bVal = (b.status || '').toLowerCase();
      } else if (transactionSortKey === 'payment') {
        aVal = (a.paymentMode || '').toLowerCase();
        bVal = (b.paymentMode || '').toLowerCase();
      }

      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null || aVal === '') return 1;
      if (bVal === undefined || bVal === null || bVal === '') return -1;
      const res = aVal > bVal ? 1 : -1;
      return transactionSortDirection === 'asc' ? res : -res;
    });
  }, [recentTransactions, transactionSortKey, transactionSortDirection]);

  const topTransactions = sortedTransactions.slice(0, 10);
  const refreshOverview = async () => {
    try {
      const nextOverview = await loadAdminFinanceOverview({ storeId: selectedStoreId });
      setOverview(nextOverview || EMPTY_OVERVIEW);
      setLastUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load finance data.');
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="p-6 lg:p-8 w-full h-full flex flex-col space-y-6">
        <div className="shrink-0 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
            <p className="text-sm text-gray-500 mt-1">
              Token-first finance view for daily operations and RM reconciliation.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {loading ? 'Refreshing live data...' : error ? `Showing last successful data. ${error}` : `Last updated ${lastUpdatedAt?.toLocaleString('en-MY') || 'just now'}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <OutletFilter value={selectedStoreId} onChange={setSelectedStoreId} />
            <button
              type="button"
              onClick={() => void refreshOverview()}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="min-w-[1180px]">
            <div className="grid grid-cols-4 gap-4 shrink-0">
              <StatCard
                title="Token orders"
                value={formatReportTokens(summary.totalTokensCharged)}
                subtitle={`${formatReportMoney(summary.tokenOrderValueRm)} RM equivalent`}
                icon={Wallet}
                iconBg="bg-[#1F3A34]"
                info="Tokens spent on completed orders. The RM figure is an equivalent order value, not a card or bank settlement."
              />
              <StatCard
                title="Direct order value"
                value={formatReportMoney(summary.directPaymentOrderValueRm)}
                subtitle={`${summary.totalOrders.toLocaleString('en-US')} orders in scope`}
                icon={BarChart3}
                iconBg="bg-[#2E5E58]"
                info="Order value for direct-payment orders only. Actual gateway settlement is shown below from paid payment records."
              />
              <StatCard
                title="Refunds"
                value={formatReportMoney(summary.totalRefundAmountRm)}
                subtitle={`${formatReportTokens(summary.totalRefundTokens)} returned`}
                icon={ReceiptText}
                iconBg="bg-[#E07A5F]"
                info="Completed refunds only. Token returns and RM refunds are shown separately from sales."
              />
              <StatCard
                title="Orders in scope"
                value={summary.totalOrders.toLocaleString('en-US')}
                subtitle={`${summary.activeOrders.toLocaleString('en-US')} active · ${summary.completedOrders.toLocaleString('en-US')} completed`}
                icon={ShoppingCart}
                iconBg="bg-[#6F9F96]"
                info="Total order count handled by the counter and app fulfillment system."
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Payment reconciliation</h3>
                <p className="mt-1 text-sm text-gray-500">Paid order settlements by channel. This is the cash/payment view.</p>
              </div>
              <InfoTooltip content="Only paid payment records are included. Token-funded orders are not counted as direct cash settlement." title="Payment reconciliation" />
            </div>
            {paymentMethodBreakdown.length > 0 ? (
              <div className="mt-5 space-y-3">
                {paymentMethodBreakdown.map((entry) => (
                  <div key={`${entry.paymentMode}-${entry.method}`} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{topUpMethodLabel(entry.method)}</p>
                      <p className="text-xs text-gray-500">{formatPaymentLabel(entry.paymentMode)} · {Number(entry.count || 0).toLocaleString('en-US')} paid</p>
                    </div>
                    <p className="font-bold text-gray-900">{formatReportMoney(entry.amountRm)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="mt-5 rounded-xl bg-gray-50 px-4 py-5 text-sm text-gray-500">No paid order settlements recorded yet.</p>}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Company subsidy</h3>
                <p className="mt-1 text-sm text-gray-500">Employee and intern allowance movements from the immutable token ledger.</p>
              </div>
              <InfoTooltip content="Issuance, expiry, role changes, spending, and refund returns remain ledger movements and are not treated as customer payments." title="Company subsidy" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-emerald-50 px-3 py-3"><p className="text-[11px] uppercase tracking-wide text-emerald-700">Issued</p><p className="mt-1 font-bold text-gray-900">{formatReportTokens(subsidySummary.issuedTokens)}</p></div>
              <div className="rounded-xl bg-amber-50 px-3 py-3"><p className="text-[11px] uppercase tracking-wide text-amber-700">Consumed</p><p className="mt-1 font-bold text-gray-900">{formatReportTokens(subsidySummary.consumedTokens)}</p></div>
              <div className="rounded-xl bg-gray-50 px-3 py-3"><p className="text-[11px] uppercase tracking-wide text-gray-600">Remaining</p><p className="mt-1 font-bold text-gray-900">{formatReportTokens(subsidySummary.remainingIssuedTokens)}</p></div>
            </div>
            <div className="mt-5 space-y-2">
              {tokenMovementBreakdown.filter((entry) => String(entry.sourceType || '').startsWith('employee_allowance')).map((entry) => (
                <div key={`${entry.sourceType}-${entry.direction}`} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{formatPaymentLabel(entry.sourceType)} · {entry.direction}</span>
                  <span className="font-semibold text-gray-900">{formatReportTokens(entry.tokenAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Audit ledger</h3>
                <InfoTooltip content="Append-only operational evidence across token movements, payments, and refunds." title="Audit ledger" />
              </div>
              <p className="mt-1 text-sm text-gray-500">Latest movements with customer, source, reference, outlet, payment channel, and status.</p>
            </div>
            <button type="button" onClick={() => exportToCSV(auditEntries.map((entry) => ({
              dateTime: entry.createdAt,
              type: entry.type,
              source: entry.source,
              description: entry.description,
              customer: entry.customer,
              reference: entry.reference,
              outlet: entry.storeName,
              paymentMethod: entry.paymentMethod,
              paymentMode: entry.paymentMode,
              amountRm: entry.amountRm,
              amountTokens: entry.amountTokens,
              status: entry.status
            })), 'finance_audit_ledger.csv')} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <Download size={14} /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200"><tr>
                {['Date & time', 'Type / source', 'Customer', 'Reference', 'Outlet', 'RM', 'Tokens', 'Status'].map((label) => <th key={label} className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {auditEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-600">{new Date(entry.createdAt).toLocaleString('en-MY')}</td>
                    <td className="px-5 py-3"><p className="font-semibold text-gray-900">{entry.type}</p><p className="text-xs text-gray-500">{formatPaymentLabel(entry.source)}</p></td>
                    <td className="px-5 py-3 text-gray-700">{entry.customer}</td>
                    <td className="px-5 py-3 text-gray-600">{entry.reference || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{entry.storeName || 'Tenant-wide'}</td>
                    <td className={`px-5 py-3 font-semibold ${Number(entry.amountRm) < 0 ? 'text-red-700' : 'text-gray-900'}`}>{Number(entry.amountRm) ? formatReportMoney(entry.amountRm) : '—'}</td>
                    <td className={`px-5 py-3 font-semibold ${Number(entry.amountTokens) < 0 ? 'text-red-700' : 'text-gray-900'}`}>{Number(entry.amountTokens) ? formatReportTokens(entry.amountTokens) : '—'}</td>
                    <td className="px-5 py-3 text-gray-600 capitalize">{String(entry.status || '').replaceAll('_', ' ')}</td>
                  </tr>
                ))}
                {!auditEntries.length && <tr><td colSpan="8" className="px-5 py-10 text-center text-gray-500">No audit movements available.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Top-up Payment Methods</h3>
                <InfoTooltip content="Distribution of customer C2 Credit token reloads by payment gateway method." title="Top-up Methods" />
              </div>
              <p className="mt-1 text-sm text-gray-500">Paid token top-ups by the method selected at checkout.</p>
              {selectedStoreId && <p className="mt-1 text-xs font-medium text-amber-700">Top-ups are tenant-wide C2 Credit transactions. The outlet filter applies to orders and refunds, not this section.</p>}
            </div>
            <div className="rounded-full bg-[#EEF6F3] px-3 py-1 text-xs font-semibold text-[#1F5A4D]">
              {mostUsedTopUpMethod ? `Most used: ${topUpMethodLabel(mostUsedTopUpMethod.method)}` : 'No paid top-ups yet'}
            </div>
          </div>

          {topUpMethodBreakdown.length > 0 ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {topUpMethodBreakdown.map((entry) => {
                const count = Number(entry.count || 0);
                const share = totalPaidTopUps > 0 ? Math.round((count / totalPaidTopUps) * 100) : 0;
                const historical = entry.method === 'not_recorded';
                return (
                  <div key={entry.method} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-gray-900">{topUpMethodLabel(entry.method)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${historical ? 'bg-gray-100 text-gray-600' : 'bg-[#E5F2ED] text-[#1F5A4D]'}`}>{share}%</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-gray-900">{count.toLocaleString('en-US')}</p>
                    <p className="text-xs text-gray-500">paid top-ups</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-[#2E5E58]" style={{ width: `${share}%` }} />
                    </div>
                    <div className="mt-3 flex justify-between gap-3 text-xs text-gray-600">
                      <span>{formatReportMoney(entry.amountRm)}</span>
                      <span>{formatReportTokens(entry.tokenAmount)}</span>
                    </div>
                    {historical && <p className="mt-3 text-[11px] leading-relaxed text-gray-500">Older paid top-ups before method tracking.</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-gray-50 px-4 py-5 text-sm text-gray-500">No paid online token top-ups are available for this tenant yet.</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[440px]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Token Flow by Month</h3>
                <InfoTooltip content="Monthly breakdown comparing tokens charged, refunded, and retained net balance." title="Token Flow" />
              </div>
              <p className="text-sm text-gray-500">Token volume is shown separately from direct-payment settlement. RM values here are order-value equivalents.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Token first
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="h-[360px]" style={{ minWidth: `${Math.max(960, revenueChartData.length * 180)}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} margin={{ top: 20, right: 28, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="month" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} dy={10} />
                  <YAxis
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }}
                    tickFormatter={(val) => Number(val).toLocaleString('en-US')}
                    tickCount={tokenAxisTicks.length}
                    ticks={tokenAxisTicks}
                    domain={[0, tokenAxisMax]}
                    allowDecimals={false}
                    width={68}
                  />
                  <Tooltip
                    cursor={{ fill: '#F3F4F6' }}
                    contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value, name) => [`${Number(value).toLocaleString('en-US')} tokens`, name]}
                  />
                  <Bar dataKey="tokensCharged" name="Tokens charged" fill="#1F3A34" radius={[4, 4, 0, 0]} barSize={22} />
                  <Bar dataKey="refundTokens" name="Refund tokens" fill="#E07A5F" radius={[4, 4, 0, 0]} barSize={22} />
                  <Bar dataKey="netTokens" name="Net tokens" fill="#6F9F96" radius={[4, 4, 0, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Order value (RM eq.)</p>
              <p className="mt-1 font-semibold text-gray-900">{formatReportMoney(summary.totalRevenueRm)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-gray-500">After refunds (RM eq.)</p>
              <p className="mt-1 font-semibold text-gray-900">{formatReportMoney(summary.netRevenueRm)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Peak month</p>
              <p className="mt-1 font-semibold text-gray-900">
                {peakTokenMonth ? `${peakTokenMonth.month} · ${formatReportTokens(peakTokenMonth.tokensCharged)}` : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-[420px]">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
                <InfoTooltip content="Latest live transaction ledger across all payment channels and outlets." title="Recent Transactions" />
              </div>
              <p className="text-sm text-gray-500">Token-first transaction feed, with RM shown for reference.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage?.('AllTransactions')}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
              >
                View All
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage?.('RevenueReport')}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1F3A34] text-white text-sm font-bold rounded-lg hover:bg-[#2E5E58] transition-colors cursor-pointer shadow-sm"
              >
                Revenue Report
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 backdrop-blur-xs border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <SortableHeader label="Date & Time" columnKey="dateTime" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Date and timestamp of transaction." />
                  <SortableHeader label="Type" columnKey="type" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Transaction category e.g. order payment or refund." />
                  <SortableHeader label="Description" columnKey="description" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Item breakdown or reason details." />
                  <SortableHeader label="Outlet" columnKey="outlet" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Store location where the transaction occurred." />
                  <SortableHeader label="Tokens" columnKey="tokens" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Token amount charged or refunded." className="text-right" />
                  <SortableHeader label="Status" columnKey="status" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Financial settlement status." />
                  <SortableHeader label="Payment" columnKey="payment" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Channel or gateway used for settlement." />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topTransactions.length > 0 ? topTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{transaction.date}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{transaction.time}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{transaction.type}</td>
                    <td className="px-6 py-4 text-gray-700 font-medium max-w-[360px] truncate">{transaction.description}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{transaction.storeName || '-'}</td>
                    <td className={`px-6 py-4 text-right font-bold ${Number(transaction.amountTokens || 0) < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                      <div>{formatReportTokens(transaction.amountTokens)}</div>
                      <div className="text-xs font-semibold text-gray-500">{formatReportMoney(transaction.amountRm)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        Number(transaction.amountTokens || 0) < 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{formatPaymentLabel(transaction.paymentMode)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-500">
                      No finance transactions available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-6 py-4 flex justify-end shrink-0 bg-white">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Finance;
