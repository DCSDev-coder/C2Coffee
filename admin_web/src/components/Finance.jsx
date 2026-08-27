import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Download,
  Layers3,
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
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { exportToCSV } from '../utils/exportToCSV';
import { loadAdminFinanceOverview } from '../lib/adminApi';
import { formatReportMoney, formatReportTokens } from '../utils/reporting';

const REFRESH_INTERVAL_MS = 60_000;

const COLORS = ['#1F3A34', '#2E5E58', '#6F9F96', '#8AACA5', '#E07A5F', '#D4AF7A'];

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

function FinanceActionButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm text-left"
    >
      <span className="flex items-center gap-2 font-semibold text-gray-800">
        <Icon size={16} className="text-[#1F3A34]" />
        {label}
      </span>
      <ArrowRight size={16} className="text-gray-400" />
    </button>
  );
}

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
  const statusBreakdown = Array.isArray(overview.statusBreakdown) ? overview.statusBreakdown : [];
  const recentTransactions = Array.isArray(overview.recentTransactions) ? overview.recentTransactions : [];

  const financeActions = useMemo(() => ([
    { label: 'Revenue Report', page: 'RevenueReport', icon: BarChart3 },
    { label: 'All Transactions', page: 'AllTransactions', icon: ReceiptText },
    { label: 'Expense Breakdown', page: 'ExpenseBreakdownFull', icon: Layers3 },
    { label: 'Product Report', page: 'Product Report', icon: ShoppingCart },
    { label: 'Generate Invoice', page: 'GenerateInvoice', icon: Wallet }
  ]), []);

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
    grossRevenueRm: entry.revenueRm,
    refundsRm: entry.refundRm,
    netRevenueRm: entry.netRm,
    orders: entry.orders
  }));

  const topStatusShare = statusBreakdown.reduce((acc, entry) => acc + Number(entry.value || 0), 0);
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
              Live finance overview sourced from orders and refunds.
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

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 shrink-0">
          <StatCard
            title="Gross Revenue"
            value={formatReportMoney(summary.totalRevenueRm)}
            subtitle={`${formatReportTokens(summary.totalTokensCharged)} charged`}
            icon={TrendingUp}
            iconBg="bg-[#1F3A34]"
          />
          <StatCard
            title="Net Revenue"
            value={formatReportMoney(summary.netRevenueRm)}
            subtitle="After completed refunds"
            icon={BarChart3}
            iconBg="bg-[#2E5E58]"
          />
          <StatCard
            title="Tokens Charged"
            value={formatReportTokens(summary.totalTokensCharged)}
            subtitle={`${summary.totalOrders.toLocaleString('en-US')} orders`}
            icon={Wallet}
            iconBg="bg-[#6F9F96]"
          />
          <StatCard
            title="Refunds"
            value={formatReportMoney(summary.totalRefundAmountRm)}
            subtitle={`${summary.refundedOrders.toLocaleString('en-US')} refund${summary.refundedOrders === 1 ? '' : 's'}`}
            icon={ReceiptText}
            iconBg="bg-[#E07A5F]"
          />
          <StatCard
            title="Average Order"
            value={formatReportMoney(summary.averageOrderValueRm)}
            subtitle={`${summary.completedOrders.toLocaleString('en-US')} completed orders`}
            icon={ShoppingCart}
            iconBg="bg-[#D4AF7A]"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[380px]">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Revenue by Month</h3>
                <p className="text-sm text-gray-500">Gross revenue, refunds, and net revenue.</p>
              </div>
            </div>
            <div className="flex-1 min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="month" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} tickFormatter={(val) => `RM ${(val / 1000).toFixed(0)}K`} />
                  <Tooltip
                    cursor={{ fill: '#F3F4F6' }}
                    contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value, name) => [`RM ${Number(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name]}
                  />
                  <Bar dataKey="grossRevenueRm" name="Gross revenue" fill="#1F3A34" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="refundsRm" name="Refunds" fill="#E07A5F" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="netRevenueRm" name="Net revenue" fill="#6F9F96" radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[380px]">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Order Mix</h3>
                <p className="text-sm text-gray-500">Status distribution of live orders.</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-4">
              <div className="w-full lg:w-52 h-52 mx-auto lg:mx-0 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={60} outerRadius={84} paddingAngle={2} stroke="none">
                      {statusBreakdown.map((entry, index) => (
                        <Cell key={`status-${entry.name}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${Number(value).toLocaleString('en-US')} orders`, name]}
                      contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto">
                {statusBreakdown.length > 0 ? statusBreakdown.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }} />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{entry.name}</p>
                        <p className="text-xs text-gray-500">{Number(entry.value || 0).toLocaleString('en-US')} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatReportMoney(entry.amountRm)}</p>
                      <p className="text-xs text-gray-500">
                        {topStatusShare > 0 ? `${((Number(entry.value || 0) / topStatusShare) * 100).toFixed(1)}%` : '0%'}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl">
                    No status data available yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-[420px]">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
              <p className="text-sm text-gray-500">Latest orders and refunds from the live backend.</p>
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
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-right">Amount</th>
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
                    <td className={`px-6 py-4 text-right font-bold ${Number(transaction.amountRm || 0) < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                      <div>{formatReportMoney(transaction.amountRm)}</div>
                      <div className="text-xs font-semibold text-gray-500">{formatReportTokens(transaction.amountTokens)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        Number(transaction.amountRm || 0) < 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{transaction.paymentMode || 'C2 Tokens'}</td>
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
