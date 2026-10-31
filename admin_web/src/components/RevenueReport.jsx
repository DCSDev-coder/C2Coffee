import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, BarChart3, Download, ReceiptText, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
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
import InfoTooltip from './InfoTooltip';

const REFRESH_INTERVAL_MS = 60_000;

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

const RevenueReport = ({ onBack }) => {
  const [overview, setOverview] = useState({ monthlyRevenue: [], summary: { totalRevenueRm: 0, netRevenueRm: 0, totalRefundAmountRm: 0, totalTokensCharged: 0, totalOrders: 0 } });
  const [revenueSortKey, setRevenueSortKey] = useState('month');
  const [revenueSortDirection, setRevenueSortDirection] = useState('desc');
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

  const monthlyRevenue = useMemo(
    () => (Array.isArray(overview.monthlyRevenue) ? overview.monthlyRevenue : []),
    [overview.monthlyRevenue]
  );

  const handleRevenueSort = (key) => {
    if (revenueSortKey === key) {
      setRevenueSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setRevenueSortKey(key);
      setRevenueSortDirection('asc');
    }
  };

  const sortedMonthlyRevenue = useMemo(() => {
    return [...monthlyRevenue].sort((a, b) => {
      let aVal, bVal;
      if (revenueSortKey === 'month') {
        aVal = a.month || '';
        bVal = b.month || '';
      } else if (revenueSortKey === 'gross') {
        aVal = Number(a.revenueRm || 0);
        bVal = Number(b.revenueRm || 0);
      } else if (revenueSortKey === 'refund') {
        aVal = Number(a.refundRm || 0);
        bVal = Number(b.refundRm || 0);
      } else if (revenueSortKey === 'net') {
        aVal = Number(a.netRm || 0);
        bVal = Number(b.netRm || 0);
      } else if (revenueSortKey === 'orders') {
        aVal = Number(a.orders || 0);
        bVal = Number(b.orders || 0);
      } else if (revenueSortKey === 'tokens') {
        aVal = Number(a.tokensCharged || 0);
        bVal = Number(b.tokensCharged || 0);
      }

      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null || aVal === '') return 1;
      if (bVal === undefined || bVal === null || bVal === '') return -1;
      const res = aVal > bVal ? 1 : -1;
      return revenueSortDirection === 'asc' ? res : -res;
    });
  }, [monthlyRevenue, revenueSortKey, revenueSortDirection]);
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Revenue Report</h1>
              <InfoTooltip content="Monthly financial performance summarizing gross sales, refunds, net profit, and token volume." title="Revenue Report" />
            </div>
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
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-xs transition-shadow flex items-center space-x-4 min-w-0">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-[#1F3A34] text-white shadow-sm">
            <TrendingUp size={26} strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight whitespace-normal">Gross Revenue</p>
              <InfoTooltip content="Total gross income before subtracting refunds and cancellations." title="Gross Revenue" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{formatReportMoney(summary.totalRevenueRm)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-xs transition-shadow flex items-center space-x-4 min-w-0">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-[#2E5E58] text-white shadow-sm">
            <BarChart3 size={26} strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight whitespace-normal">Net Revenue</p>
              <InfoTooltip content="Realized revenue retained after full and partial customer refunds." title="Net Revenue" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{formatReportMoney(summary.netRevenueRm)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-xs transition-shadow flex items-center space-x-4 min-w-0">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-[#E07A5F] text-white shadow-sm">
            <ReceiptText size={26} strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight whitespace-normal">Refunds</p>
              <InfoTooltip content="Total monetary value of refunded orders across all channels." title="Refunds" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{formatReportMoney(summary.totalRefundAmountRm)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-xs transition-shadow flex items-center space-x-4 min-w-0">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-[#6F9F96] text-white shadow-sm">
            <Wallet size={26} strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight whitespace-normal">Tokens Charged</p>
              <InfoTooltip content="Total loyalty token points charged for orders in this period." title="Tokens Charged" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{formatReportTokens(summary.totalTokensCharged)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[420px]">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">Revenue by Month</h3>
              <InfoTooltip content="Monthly trajectory comparison of gross sales, refunds, and final net earnings." title="Revenue by Month" />
            </div>
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
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">Monthly Breakdown</h3>
              <InfoTooltip content="Tabular audit ledger of monthly financial metrics." title="Monthly Ledger" />
            </div>
            <p className="text-sm text-gray-500">Monthly totals backing the live chart.</p>
          </div>
          <p className="text-sm text-gray-500">{monthlyRevenue.length.toLocaleString('en-US')} months</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/80 backdrop-blur-xs border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <SortableHeader label="Month" columnKey="month" currentKey={revenueSortKey} direction={revenueSortDirection} onSort={handleRevenueSort} info="Calendar month identifier." />
                <SortableHeader label="Gross Revenue" columnKey="gross" currentKey={revenueSortKey} direction={revenueSortDirection} onSort={handleRevenueSort} info="Gross sales revenue collected." className="text-right" />
                <SortableHeader label="Refunds" columnKey="refund" currentKey={revenueSortKey} direction={revenueSortDirection} onSort={handleRevenueSort} info="Total refunded value." className="text-right" />
                <SortableHeader label="Net Revenue" columnKey="net" currentKey={revenueSortKey} direction={revenueSortDirection} onSort={handleRevenueSort} info="Net retained sales revenue." className="text-right" />
                <SortableHeader label="Orders" columnKey="orders" currentKey={revenueSortKey} direction={revenueSortDirection} onSort={handleRevenueSort} info="Total order tickets processed." className="text-right" />
                <SortableHeader label="Tokens Charged" columnKey="tokens" currentKey={revenueSortKey} direction={revenueSortDirection} onSort={handleRevenueSort} info="Tokens charged in order fulfillment." className="text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedMonthlyRevenue.length > 0 ? sortedMonthlyRevenue.map((entry) => (
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
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={() => exportToCSV(exportRows, 'revenue_report.csv')}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default RevenueReport;
