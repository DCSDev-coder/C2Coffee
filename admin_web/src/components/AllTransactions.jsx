import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Download, Search, RefreshCw } from 'lucide-react';
import { exportToCSV } from '../utils/exportToCSV';
import { loadAdminFinanceOverview } from '../lib/adminApi';
import { formatPaymentLabel, formatReportMoney, formatReportTokens } from '../utils/reporting';
import InfoTooltip from './InfoTooltip';
import Pagination from './Pagination';
import { useResponsivePageSize } from '../utils/useResponsivePageSize';

const REFRESH_INTERVAL_MS = 60_000;

function SortableHeader({ label, columnKey, currentKey, direction, onSort, info, className = "" }) {
  const isSorted = currentKey === columnKey;
  return (
    <th className={`px-5 py-4 font-bold text-[11px] text-gray-500 uppercase tracking-wider whitespace-nowrap ${className}`}>
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

const AllTransactions = ({ onBack }) => {
  const [overview, setOverview] = useState({ recentTransactions: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [showAll, setShowAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionSortKey, setTransactionSortKey] = useState('dateTime');
  const [transactionSortDirection, setTransactionSortDirection] = useState('desc');
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

  const transactions = useMemo(
    () => Array.isArray(overview.recentTransactions) ? overview.recentTransactions : [],
    [overview.recentTransactions]
  );

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

  const handleTransactionSort = (key) => {
    if (transactionSortKey === key) {
      setTransactionSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTransactionSortKey(key);
      setTransactionSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortedTransactions = useMemo(() => {
    return [...filtered].sort((a, b) => {
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
      } else if (transactionSortKey === 'amount') {
        aVal = Number(a.amountRm || 0);
        bVal = Number(b.amountRm || 0);
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
  }, [filtered, transactionSortKey, transactionSortDirection]);

  const responsiveItemsPerPage = useResponsivePageSize(5, rowsPerPage);
  const itemsPerPage = showAll ? filtered.length : responsiveItemsPerPage;
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  const visibleTransactions = useMemo(
    () => sortedTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [currentPage, sortedTransactions, itemsPerPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, rowsPerPage]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

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
    <div className="px-4 sm:px-6 md:px-8 pb-8 pt-2 h-full flex flex-col space-y-6 overflow-y-auto bg-gray-50/30">
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">All Transactions</h1>
              <InfoTooltip content="Comprehensive historical log of order charges, C2 Credit debits, and customer refunds." title="Transaction Ledger" />
            </div>
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

            <div className="hidden sm:flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 whitespace-nowrap">
                <span>Rows</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#1F3A34] focus:border-[#1F3A34]"
                >
                  {[50, 100, 150, 200].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="min-w-full text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-sm shadow-sm z-10">
              <tr className="border-b border-gray-200 text-left">
                <SortableHeader label="Date & Time" columnKey="dateTime" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Date and timestamp of transaction record." className="w-44" />
                <SortableHeader label="Type" columnKey="type" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Transaction action type." className="w-28" />
                <SortableHeader label="Description" columnKey="description" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Transaction summary description." />
                <SortableHeader label="Amount" columnKey="amount" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Gross transaction monetary value in RM and tokens." className="w-44 text-right" />
                <SortableHeader label="Status" columnKey="status" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Fulfillment and settlement outcome." className="w-28" />
                <SortableHeader label="Payment" columnKey="payment" currentKey={transactionSortKey} direction={transactionSortDirection} onSort={handleTransactionSort} info="Payment channel applied." className="w-40" />
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

        <div className="border-t border-gray-100 bg-white px-4 sm:px-6 py-3.5 shrink-0">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            itemName="transactions"
            showAll={showAll}
            onToggleShowAll={() => setShowAll(!showAll)}
            action={
              <button
                type="button"
                onClick={() => exportToCSV(exportRows, 'all_transactions.csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
              >
                <Download size={13} /> Export
              </button>
            }
          />
        </div>
      </div>
    </div>
  );
};

export default AllTransactions;
