import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, RefreshCw, TrendingUp } from 'lucide-react';
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
import { formatReportMoney, formatReportTokens } from '../utils/reporting';

const REFRESH_INTERVAL_MS = 60_000;

const RevenueReport = ({ onBack }) => {
  const [overview, setOverview] = useState({ monthlyRevenue: [], summary: { totalRevenueRm: 0, netRevenueRm: 0, totalRefundAmountRm: 0, totalTokensCharged: 0, totalOrders: 0 } });
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
        setOverview(nextOverview || overview);
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load revenue data.');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthlyRevenue = Array.isArray(overview.monthlyRevenue) ? overview.monthlyRevenue : [];
  const summary = overview.summary || {};

  const chartData = useMemo(() => monthlyRevenue.map((entry) => ({
    month: entry.month,
    revenueRm: entry.revenueRm,
    refundRm: entry.refundRm,
    netRm: entry.netRm,
    orders: entry.orders
  })), [monthlyRevenue]);

  const refreshOverview = async () => {
    try {
      const nextOverview = await loadAdminFinanceOverview();
      setOverview(nextOverview || { monthlyRevenue: [], summary: { totalRevenueRm: 0, netRevenueRm: 0, totalRefundAmountRm: 0, totalTokensCharged: 0, totalOrders: 0 } });
      setLastUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load revenue data.');
    }
  };

  const exportRows = useMemo(() => [
    ['Month', 'Gross Revenue (RM)', 'Refunds (RM)', 'Net Revenue (RM)', 'Orders', 'Tokens Charged'],
    ...monthlyRevenue.map((entry) => [
      `"${entry.month}"`,
      Number(entry.revenueRm || 0).toFixed(2),
      Number(entry.refundRm || 0).toFixed(2),
      Number(entry.netRm || 0).toFixed(2),
      Number(entry.orders || 0).toFixed(0),
      Number(entry.tokensCharged || 0).toFixed(0)
    ])
  ], [monthlyRevenue]);

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6 overflow-y-auto bg-gray-50/30">
      <div className="shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            title="Back to Finance"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revenue Report</h1>
            <p className="text-sm text-gray-500 mt-1">
              Live monthly revenue from completed orders and refunds.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {loading ? 'Refreshing live data...' : error ? `Showing last successful data. ${error}` : `Last updated ${lastUpdatedAt?.toLocaleString('en-MY') || 'just now'}`}
            </p>
          </div>
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
            onClick={() => exportToCSV(exportRows, 'revenue_report.csv')}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#1F3A34] text-white">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Gross Revenue</p>
              <p className="text-xl font-bold text-gray-900">{formatReportMoney(summary.totalRevenueRm)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Net Revenue</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatReportMoney(summary.netRevenueRm)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Refunds</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatReportMoney(summary.totalRefundAmountRm)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Tokens Charged</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatReportTokens(summary.totalTokensCharged)}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[420px]">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Revenue by Month</h3>
            <p className="text-sm text-gray-500">Gross revenue, refunds, and net revenue.</p>
          </div>
        </div>
        <div className="flex-1 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="month" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} dy={10} />
              <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} tickFormatter={(val) => `RM ${(val / 1000).toFixed(0)}K`} />
              <Tooltip
                cursor={{ fill: '#F3F4F6' }}
                contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value, name) => [`RM ${Number(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name]}
              />
              <Bar dataKey="revenueRm" name="Gross revenue" fill="#1F3A34" radius={[4, 4, 0, 0]} barSize={36} />
              <Bar dataKey="refundRm" name="Refunds" fill="#E07A5F" radius={[4, 4, 0, 0]} barSize={36} />
              <Bar dataKey="netRm" name="Net revenue" fill="#6F9F96" radius={[4, 4, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Monthly Breakdown</h3>
            <p className="text-sm text-gray-500">Monthly totals backing the live chart.</p>
          </div>
          <p className="text-sm text-gray-500">{monthlyRevenue.length.toLocaleString('en-US')} months</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-900">Month</th>
                <th className="px-6 py-4 font-semibold text-gray-900 text-right">Gross Revenue</th>
                <th className="px-6 py-4 font-semibold text-gray-900 text-right">Refunds</th>
                <th className="px-6 py-4 font-semibold text-gray-900 text-right">Net Revenue</th>
                <th className="px-6 py-4 font-semibold text-gray-900 text-right">Orders</th>
                <th className="px-6 py-4 font-semibold text-gray-900 text-right">Tokens Charged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {monthlyRevenue.length > 0 ? monthlyRevenue.map((entry) => (
                <tr key={entry.month} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-900">{entry.month}</td>
                  <td className="px-6 py-4 text-right text-gray-700 font-medium">{formatReportMoney(entry.revenueRm)}</td>
                  <td className="px-6 py-4 text-right text-gray-700 font-medium">{formatReportMoney(entry.refundRm)}</td>
                  <td className="px-6 py-4 text-right text-gray-900 font-bold">{formatReportMoney(entry.netRm)}</td>
                  <td className="px-6 py-4 text-right text-gray-700 font-medium">{Number(entry.orders || 0).toLocaleString('en-US')}</td>
                  <td className="px-6 py-4 text-right text-gray-700 font-medium">{formatReportTokens(entry.tokensCharged)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-500">
                    No revenue data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RevenueReport;
