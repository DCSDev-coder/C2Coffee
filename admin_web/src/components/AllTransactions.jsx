import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Search, RefreshCw } from 'lucide-react';
import { exportToCSV } from '../utils/exportToCSV';
import { loadAdminFinanceOverview } from '../lib/adminApi';
import { formatPaymentLabel, formatReportMoney, formatReportTokens } from '../utils/reporting';

const REFRESH_INTERVAL_MS = 60_000;

const AllTransactions = ({ onBack }) => {
  const [overview, setOverview] = useState({ recentTransactions: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
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

  const visibleTransactions = useMemo(
    () => filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [currentPage, filtered, rowsPerPage]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const pageEnd = Math.min(filtered.length, currentPage * rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, rowsPerPage]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

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

  const paginationWindow = useMemo(() => {
    const windowSize = 2;
    const start = Math.max(1, currentPage - windowSize);
    const end = Math.min(pageCount, currentPage + windowSize);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPage, pageCount]);

  const goToPage = (nextPage) => {
    const clamped = Math.max(1, Math.min(pageCount, nextPage));
    setCurrentPage(clamped);
  };

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
        <div className="p-5 border-b border-gray-100 flex flex-col gap-4 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3A34] focus:border-[#1F3A34]"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <span>Show</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1F3A34] focus:border-[#1F3A34]"
                >
                  {[50, 100, 150, 200].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm font-medium text-gray-500">
                Showing {pageStart.toLocaleString('en-US')} to {pageEnd.toLocaleString('en-US')} of {filtered.length.toLocaleString('en-US')} transaction{filtered.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
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
              {visibleTransactions.map((transaction) => (
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
                  <td className="px-5 py-4 text-gray-600 font-medium">{formatPaymentLabel(transaction.paymentMode)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center text-gray-500 font-medium">
                    No transactions found matching your search.
                  </td>
                </tr>
              )}
              {filtered.length > 0 && visibleTransactions.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center text-gray-500 font-medium">
                    No transactions available for the selected display count.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-100 bg-white px-5 py-4 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-sm text-gray-500">
              Page {currentPage.toLocaleString('en-US')} of {pageCount.toLocaleString('en-US')}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {paginationWindow[0] > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => goToPage(1)}
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    1
                  </button>
                  {paginationWindow[0] > 2 && <span className="px-1 text-gray-400">…</span>}
                </>
              )}

              {paginationWindow.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => goToPage(page)}
                  className={`px-3 py-2 rounded-lg border text-sm font-semibold shadow-sm transition-colors ${
                    page === currentPage
                      ? 'border-[#1F3A34] bg-[#1F3A34] text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              {paginationWindow[paginationWindow.length - 1] < pageCount && (
                <>
                  {paginationWindow[paginationWindow.length - 1] < pageCount - 1 && (
                    <span className="px-1 text-gray-400">…</span>
                  )}
                  <button
                    type="button"
                    onClick={() => goToPage(pageCount)}
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    {pageCount}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === pageCount}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllTransactions;
