import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Search, RefreshCw } from 'lucide-react';
import { exportToCSV } from '../utils/exportToCSV';
import { loadAdminFinanceOverview } from '../lib/adminApi';
import { formatReportMoney, formatReportTokens } from '../utils/reporting';

const REFRESH_INTERVAL_MS = 60_000;

const AllTransactions = ({ onBack }) => {
  const [overview, setOverview] = useState({ recentTransactions: [] });
  const [searchTerm, setSearchTerm] = useState('');
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
        setOverview(nextOverview || { recentTransactions: [] });
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load transactions.');
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

  const transactions = Array.isArray(overview.recentTransactions) ? overview.recentTransactions : [];

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return transactions;

    return transactions.filter((transaction) => (
      String(transaction.date || '').toLowerCase().includes(query)
      || String(transaction.time || '').toLowerCase().includes(query)
      || String(transaction.type || '').toLowerCase().includes(query)
      || String(transaction.description || '').toLowerCase().includes(query)
      || String(transaction.status || '').toLowerCase().includes(query)
      || String(transaction.paymentMode || '').toLowerCase().includes(query)
      || String(transaction.reference || '').toLowerCase().includes(query)
    ));
  }, [searchTerm, transactions]);

  const refreshOverview = async () => {
    try {
      const nextOverview = await loadAdminFinanceOverview();
      setOverview(nextOverview || { recentTransactions: [] });
      setLastUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load transactions.');
    }
  };

  const exportRows = useMemo(() => [
    ['Date', 'Time', 'Type', 'Description', 'RM Amount', 'Token Amount', 'Status', 'Payment'],
    ...filtered.map((transaction) => [
      `"${transaction.date}"`,
      `"${transaction.time}"`,
      `"${transaction.type}"`,
      `"${transaction.description}"`,
      Number(transaction.amountRm || 0).toFixed(2),
      Number(transaction.amountTokens || 0).toFixed(0),
      `"${transaction.status}"`,
      `"${transaction.paymentMode || ''}"`
    ])
  ], [filtered]);

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6 overflow-y-auto bg-gray-50/30">
      <div className="shrink-0 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            title="Back to Finance"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Transactions</h1>
            <p className="text-sm text-gray-500 mt-1">
              Live order and refund transactions pulled from the backend.
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
            onClick={() => exportToCSV(exportRows, 'all_transactions.csv')}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col flex-1 min-h-[500px]">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3A34] focus:border-[#1F3A34]"
            />
          </div>
          <p className="text-sm font-medium text-gray-500">
            Showing {filtered.length.toLocaleString('en-US')} transaction{filtered.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="overflow-auto flex-1">
          <table className="min-w-full text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-sm shadow-sm z-10">
              <tr className="border-b border-gray-200 text-left">
                <th className="px-5 py-4 font-bold text-gray-900 w-44">Date & Time</th>
                <th className="px-5 py-4 font-bold text-gray-900 w-24">Type</th>
                <th className="px-5 py-4 font-bold text-gray-900">Description</th>
                <th className="px-5 py-4 font-bold text-gray-900 w-44 text-right">Amount</th>
                <th className="px-5 py-4 font-bold text-gray-900 w-28">Status</th>
                <th className="px-5 py-4 font-bold text-gray-900 w-40">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-gray-900">{transaction.date}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{transaction.time}</p>
                  </td>
                  <td className="px-5 py-4 font-bold text-gray-900">{transaction.type}</td>
                  <td className="px-5 py-4 font-medium text-gray-700 max-w-[360px] truncate">{transaction.description}</td>
                  <td className={`px-5 py-4 text-right font-bold ${Number(transaction.amountRm || 0) < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                    <div>{formatReportMoney(transaction.amountRm)}</div>
                    <div className="text-xs font-semibold text-gray-500">{formatReportTokens(transaction.amountTokens)}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                      Number(transaction.amountRm || 0) < 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-600 font-medium">{transaction.paymentMode || 'C2 Tokens'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center text-gray-500 font-medium">
                    No transactions found matching your search.
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

export default AllTransactions;
