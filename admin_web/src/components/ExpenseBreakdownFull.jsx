import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Layers3, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { exportToCSV } from '../utils/exportToCSV';
import { loadAdminFinanceOverview } from '../lib/adminApi';
import { formatReportMoney } from '../utils/reporting';

const REFRESH_INTERVAL_MS = 60_000;
const COLORS = ['#1F3A34', '#2E5E58', '#6F9F96', '#8AACA5', '#E07A5F', '#D4AF7A'];

const ExpenseBreakdownFull = ({ onBack }) => {
  const [overview, setOverview] = useState({
    statusBreakdown: [],
    summary: { totalOrders: 0, refundedOrders: 0, totalRefundAmountRm: 0 }
  });
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
        setError(err instanceof Error ? err.message : 'Unable to load breakdown data.');
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

  const statusBreakdown = Array.isArray(overview.statusBreakdown) ? overview.statusBreakdown : [];
  const summary = overview.summary || {};
  const totalStatuses = statusBreakdown.reduce((acc, item) => acc + Number(item.value || 0), 0);

  const refreshOverview = async () => {
    try {
      const nextOverview = await loadAdminFinanceOverview();
      setOverview(nextOverview || { statusBreakdown: [], summary: { totalOrders: 0, refundedOrders: 0, totalRefundAmountRm: 0 } });
      setLastUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load breakdown data.');
    }
  };

  const exportRows = useMemo(() => [
    ['Status', 'Count', 'Amount (RM)', 'Share'],
    ...statusBreakdown.map((entry) => [
      `"${entry.name}"`,
      Number(entry.value || 0).toFixed(0),
      Number(entry.amountRm || 0).toFixed(2),
      `${totalStatuses > 0 ? ((Number(entry.value || 0) / totalStatuses) * 100).toFixed(1) : '0.0'}%`
    ])
  ], [statusBreakdown, totalStatuses]);

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
            <h1 className="text-2xl font-bold text-gray-900">Transaction Breakdown</h1>
            <p className="text-sm text-gray-500 mt-1">Live mix of order and refund statuses.</p>
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
            onClick={() => exportToCSV(exportRows, 'transaction_breakdown.csv')}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
          >
            <Download size={16} /> Export Data
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-10">
        <div className="flex-1 max-w-md mx-auto relative flex items-center justify-center">
          <div className="w-full aspect-square relative shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusBreakdown} innerRadius="65%" outerRadius="90%" paddingAngle={2} dataKey="value" nameKey="name" stroke="none">
                  {statusBreakdown.map((entry, index) => <Cell key={`cell-${entry.name}`} fill={entry.color || COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${Number(value).toLocaleString('en-US')} orders`, name]}
                  contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-900">
                {Number(totalStatuses || 0).toLocaleString('en-US')}
              </span>
              <span className="text-xs text-gray-500 font-medium mt-1">Transactions</span>
              <span className="text-[11px] text-gray-400 mt-1">RM {Number(summary.totalRevenueRm || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gross</span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Status Details</h3>
              <p className="text-sm text-gray-500">Counts and RM amounts by live transaction status.</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#1F3A34] text-white flex items-center justify-center">
              <Layers3 size={20} />
            </div>
          </div>
          <div className="space-y-4 overflow-y-auto pr-2 max-h-[500px]">
            {statusBreakdown.length > 0 ? statusBreakdown.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${(item.color || COLORS[index % COLORS.length])}20` }}>
                     <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}></div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{item.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {Number(item.value || 0).toLocaleString('en-US')} order{Number(item.value || 0) === 1 ? '' : 's'} · {totalStatuses > 0 ? `${((Number(item.value || 0) / totalStatuses) * 100).toFixed(1)}% of total` : '0% of total'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-gray-900 text-sm">{Number(item.value || 0).toLocaleString('en-US')}</span>
                  <p className="text-xs text-gray-500">{formatReportMoney(item.amountRm)}</p>
                </div>
              </div>
            )) : (
              <div className="flex items-center justify-center min-h-[240px] text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl">
                No transaction breakdown data available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseBreakdownFull;
