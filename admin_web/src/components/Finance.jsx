import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  RefreshCw,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
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
import { loadAdminFinanceOverview } from '../lib/adminApi';
import { formatPaymentLabel, formatReportMoney, formatReportTokens } from '../utils/reporting';

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
  recentTransactions: []
};

const StatCard = ({ title, value, subtitle, icon: Icon, iconBg, iconColor = 'text-white' }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-sm`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight mt-0.5 whitespace-normal">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
      {subtitle && (
        <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal mt-1">
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

const Finance = ({ setCurrentPage }) => {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        setError('');
        const nextOverview = await loadAdminFinanceOverview();
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
  }, []);

  const summary = overview.summary || EMPTY_OVERVIEW.summary;
  const monthlyRevenue = Array.isArray(overview.monthlyRevenue) ? overview.monthlyRevenue : [];
  const recentTransactions = Array.isArray(overview.recentTransactions) ? overview.recentTransactions : [];
  const netTokens = Number(summary.netTokens ?? Math.max(0, Number(summary.totalTokensCharged || 0) - Number(summary.totalRefundTokens || 0)));
  const tokenRefundRate = Number(summary.totalTokensCharged || 0) > 0
    ? (Number(summary.totalRefundTokens || 0) / Number(summary.totalTokensCharged || 0)) * 100
    : 0;
  const peakTokenMonth = monthlyRevenue.reduce((best, entry) => {
    if (!best) return entry;
    return Number(entry.tokensCharged || 0) > Number(best.tokensCharged || 0) ? entry : best;
  }, null);

  const exportRows = useMemo(() => {
    return [
      ['Date', 'Time', 'Type', 'Description', 'RM Amount', 'Token Amount', 'Status', 'Payment'],
      ...recentTransactions.map((transaction) => [
        `"${transaction.date}"`,
        `"${transaction.time}"`,
        `"${transaction.type}"`,
        `"${transaction.description}"`,
        Number(transaction.amountRm || 0).toFixed(2),
        Number(transaction.amountTokens || 0).toFixed(0),
        `"${transaction.status}"`,
        `"${transaction.paymentMode || ''}"`
      ])
    ];
  }, [recentTransactions]);

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

  const topTransactions = recentTransactions.slice(0, 8);
  const refreshOverview = async () => {
    try {
      const nextOverview = await loadAdminFinanceOverview();
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
            <button
              type="button"
              onClick={() => void refreshOverview()}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="min-w-[1180px]">
            <div className="grid grid-cols-4 gap-4 shrink-0">
              <StatCard
                title="Tokens Charged"
                value={formatReportTokens(summary.totalTokensCharged)}
                subtitle={`${formatReportMoney(summary.totalRevenueRm)} gross RM`}
                icon={Wallet}
                iconBg="bg-[#1F3A34]"
              />
              <StatCard
                title="Net Tokens Kept"
                value={formatReportTokens(netTokens)}
                subtitle={`${formatReportTokens(summary.totalRefundTokens)} refunded`}
                icon={BarChart3}
                iconBg="bg-[#2E5E58]"
              />
              <StatCard
                title="Refund Tokens"
                value={formatReportTokens(summary.totalRefundTokens)}
                subtitle={`${tokenRefundRate.toFixed(1)}% of token volume`}
                icon={ReceiptText}
                iconBg="bg-[#E07A5F]"
              />
              <StatCard
                title="Orders Processed"
                value={summary.totalOrders.toLocaleString('en-US')}
                subtitle={`${summary.activeOrders.toLocaleString('en-US')} active · ${summary.completedOrders.toLocaleString('en-US')} completed`}
                icon={ShoppingCart}
                iconBg="bg-[#6F9F96]"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[440px]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Token Flow by Month</h3>
              <p className="text-sm text-gray-500">Token volume is the primary operating signal. RM stays visible only for reconciliation.</p>
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
              <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Gross RM</p>
              <p className="mt-1 font-semibold text-gray-900">{formatReportMoney(summary.totalRevenueRm)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Net RM</p>
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
              <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
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
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Date & Time</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Type</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Description</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-right">Tokens</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Status</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Payment</th>
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
                    <td colSpan="6" className="py-12 text-center text-gray-500">
                      No finance transactions available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Finance;
