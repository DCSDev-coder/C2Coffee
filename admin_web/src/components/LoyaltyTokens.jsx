import React, { useState, useEffect, forwardRef } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Search, ChevronDown, Download, Users, Coins, ShoppingBag, X, Eye,
  Edit3, CheckCircle2, Ticket, Percent, ArrowRight,
  ArrowUp, ArrowDown, ArrowUpDown
} from "lucide-react";
import Pagination from './Pagination';
import InfoTooltip from './InfoTooltip';
import TokenTransaction from './TokenTransaction';
import LoyaltyAnalytics from './LoyaltyAnalytics';
import LoyaltyProgramSummary from './LoyaltyProgramSummary';
import { exportToCSV } from '../utils/exportToCSV';
import { adjustAdminCustomerTokens, loadAdminLoyaltyOverview, loadEmployeeAllowanceReport, loadSubsidyPolicies, saveSubsidyPolicies } from '../lib/adminApi';

const CustomDateInput = forwardRef(({ value, onClick, onClear }, ref) => (
  <div className="relative">
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick(e);
      }}
      ref={ref}
      className="peer flex items-center pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs whitespace-nowrap cursor-pointer transition-colors"
    >
      {value || 'Select Date'}
    </button>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      {value ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
          className="text-gray-400 hover:text-gray-600 rounded-full bg-gray-100 p-0.5 pointer-events-auto cursor-pointer"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      ) : (
        <ChevronDown size={14} className="text-gray-500 transition-transform duration-200 peer-focus:-rotate-180" />
      )}
    </div>
  </div>
));

//Helpers
const getTierColor = (tier, tierCode) => {
  const normalized = String(tierCode || tier || '').trim().toLowerCase();
  switch (normalized) {
    case 'sipper':
    case 'kawan':
      return 'bg-blue-100 text-blue-600';
    case 'brewer':
    case 'dilamun':
      return 'bg-[#E07A5F]/15 text-[#E07A5F]';
    case 'roaster':
    case 'ketagih':
      return 'bg-purple-100 text-purple-600';
    case 'legendary':
    case 'legend':
      return 'bg-[#D4AF7A]/20 text-[#A8824A]';
    default:
      return 'bg-emerald-100 text-emerald-700';
  }
};

const getTypeColor = (type) => {
  switch (type) {
    case 'Earned': return 'bg-green-100 text-green-700';
    case 'Redeemed': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

// Sleek KPI Card matching standard
const KPICard = ({ title, value, change, info, icon: Icon, iconBg = "bg-[#1E433A]", iconColor = "text-white" }) => (
  <div className="flex items-center justify-between rounded-2xl border border-gray-200/80 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
    <div className="flex items-center gap-3.5 min-w-0">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-xs`}>
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
          {info && <InfoTooltip content={info} title={title} />}
        </div>
        <p className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight mt-0.5">{value}</p>
      </div>
    </div>
    {change && (
      <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold bg-[#E8F3F0] text-[#1E433A]">
        {change}
      </span>
    )}
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

//Main Component
const LoyaltyTokens = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All Transaction Types");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [overview, setOverview] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tokenSortKey, setTokenSortKey] = useState("time");
  const [tokenSortDirection, setTokenSortDirection] = useState("desc");

  const [typeOpen, setTypeOpen] = useState(false);

  const [isEditTokensOpen, setIsEditTokensOpen] = useState(false);
  const [editTokenAmount, setEditTokenAmount] = useState("");
  const [editTokenAction, setEditTokenAction] = useState("Add");
  const [editTokenReason, setEditTokenReason] = useState("");
  const [editTokenPassword, setEditTokenPassword] = useState("");
  const [editTokenError, setEditTokenError] = useState("");
  const [isSavingTokenAdjustment, setIsSavingTokenAdjustment] = useState(false);
  const [, setMenuOpenId] = useState(null);
  const [activeView, setActiveView] = useState("list");
  const [selectedDate, setSelectedDate] = useState(null);
  const [employeeReportMonth, setEmployeeReportMonth] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit' }));
  const [employeeReport, setEmployeeReport] = useState(null);
  const [employeeReportLoading, setEmployeeReportLoading] = useState(false);
  const [employeeReportError, setEmployeeReportError] = useState('');
  const [subsidyPolicies, setSubsidyPolicies] = useState(null);
  const [subsidyPolicyForm, setSubsidyPolicyForm] = useState({ employee_amount: '', intern_amount: '', confirmation_password: '' });
  const [subsidyPolicyError, setSubsidyPolicyError] = useState('');
  const [subsidyPolicySaved, setSubsidyPolicySaved] = useState('');
  const [subsidyPolicySaving, setSubsidyPolicySaving] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeView !== 'employee_allowances') return undefined;
    let active = true;
    setEmployeeReportLoading(true);
    setEmployeeReportError('');
    loadEmployeeAllowanceReport(employeeReportMonth)
      .then((response) => { if (active) setEmployeeReport(response); })
      .catch((error) => { if (active) setEmployeeReportError(error?.message || 'Unable to load the employee token report.'); })
      .finally(() => { if (active) setEmployeeReportLoading(false); });
    return () => { active = false; };
  }, [activeView, employeeReportMonth]);

  useEffect(() => {
    if (activeView !== 'employee_allowances') return undefined;
    let active = true;
    loadSubsidyPolicies()
      .then((response) => {
        if (!active) return;
        setSubsidyPolicies(response);
        setSubsidyPolicyForm((previous) => ({
          ...previous,
          employee_amount: String(response?.pending?.employee_amount ?? response?.current?.employee_amount ?? ''),
          intern_amount: String(response?.pending?.intern_amount ?? response?.current?.intern_amount ?? '')
        }));
      })
      .catch((error) => { if (active) setSubsidyPolicyError(error?.message || 'Unable to load subsidy settings.'); });
    return () => { active = false; };
  }, [activeView]);

  const submitSubsidyPolicy = async (event) => {
    event.preventDefault();
    setSubsidyPolicyError('');
    setSubsidyPolicySaved('');
    setSubsidyPolicySaving(true);
    try {
      const response = await saveSubsidyPolicies({
        employee_amount: Number(subsidyPolicyForm.employee_amount),
        intern_amount: Number(subsidyPolicyForm.intern_amount),
        confirmation_password: subsidyPolicyForm.confirmation_password
      });
      setSubsidyPolicySaved(`Saved. These values take effect on ${response.effective_period_start}.`);
      setSubsidyPolicyForm((previous) => ({ ...previous, confirmation_password: '' }));
      const refreshed = await loadSubsidyPolicies();
      setSubsidyPolicies(refreshed);
    } catch (error) {
      setSubsidyPolicyError(error?.message || 'Unable to save subsidy settings.');
    } finally {
      setSubsidyPolicySaving(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchOverview = async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        setLoadError("");
        const response = await loadAdminLoyaltyOverview(100);
        if (!isMounted) return;

        setOverview(response ?? null);
        setTransactions(Array.isArray(response?.transactions) ? response.transactions : []);
      } catch (error) {
        console.error('Failed to load loyalty overview', error);
        if (isMounted) {
          setLoadError(error?.message || 'Failed to load loyalty data.');
          setOverview(null);
          setTransactions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchOverview();

    const refreshOverview = () => fetchOverview({ silent: true });
    const intervalId = window.setInterval(refreshOverview, 30000);
    const handleFocus = () => refreshOverview();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshOverview();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const itemsPerPage = 10;

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = tx.member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.member.memberId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "All Transaction Types" || tx.type === selectedType;
    let matchesDate = true;
    if (selectedDate) {
      const formattedDate = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      matchesDate = tx.date === formattedDate || tx.date.includes(formattedDate);
    }
    return matchesSearch && matchesType && matchesDate;
  });

  const walletMembers = Array.isArray(overview?.members) ? overview.members : [];
  const groupedMembers = walletMembers
    .filter((member) => {
      const needle = searchQuery.trim().toLowerCase();
      if (!needle) return true;
      return [member.name, member.email, member.phone, member.memberId]
        .some((value) => String(value || '').toLowerCase().includes(needle));
    })
    .map((member) => {
      const memberTransactions = filteredTransactions.filter((tx) => tx.member.memberId === member.memberId);
      return {
        member: {
          ...member,
          tokenHistory: memberTransactions.slice(0, 5).map((item) => ({
            id: item.id,
            type: item.type,
            amount: item.tokens,
            source: item.description,
            desc: item.description,
            date: `${item.date} ${item.time}`,
            balance: item.balance
          })),
          lastActivity: memberTransactions[0] || null
        },
        transactions: memberTransactions
      };
    })
    .filter((group) => {
      const isActivityFilterActive = selectedType !== 'All Transaction Types' || selectedDate !== null;
      return !isActivityFilterActive || group.transactions.length > 0;
    });

  const handleTokenSort = (key) => {
    if (tokenSortKey === key) {
      setTokenSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTokenSortKey(key);
      setTokenSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortedMembers = [...groupedMembers].sort((a, b) => {
    let aVal, bVal;
    if (tokenSortKey === 'time') {
      const aTx = a.transactions[0];
      const bTx = b.transactions[0];
      aVal = aTx ? `${aTx.date} ${aTx.time}` : '';
      bVal = bTx ? `${bTx.date} ${bTx.time}` : '';
    } else if (tokenSortKey === 'customer') {
      aVal = (a.member.name || '').toLowerCase();
      bVal = (b.member.name || '').toLowerCase();
    } else if (tokenSortKey === 'tier') {
      aVal = (a.member.tier || '').toLowerCase();
      bVal = (b.member.tier || '').toLowerCase();
    } else if (tokenSortKey === 'activity') {
      const aTx = a.transactions[0];
      const bTx = b.transactions[0];
      aVal = (aTx?.type || '').toLowerCase();
      bVal = (bTx?.type || '').toLowerCase();
    } else if (tokenSortKey === 'tokens') {
      const aTx = a.transactions[0];
      const bTx = b.transactions[0];
      aVal = Number(aTx?.tokens || 0);
      bVal = Number(bTx?.tokens || 0);
    } else if (tokenSortKey === 'balance') {
      aVal = Number(a.member.balance ?? a.member.tokens ?? 0);
      bVal = Number(b.member.balance ?? b.member.tokens ?? 0);
    }

    if (aVal === bVal) return 0;
    if (aVal === undefined || aVal === null || aVal === '') return 1;
    if (bVal === undefined || bVal === null || bVal === '') return -1;
    const res = aVal > bVal ? 1 : -1;
    return tokenSortDirection === 'asc' ? res : -res;
  });

  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / itemsPerPage));
  const paginatedMembers = sortedMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (activeView === 'analytics') {
    return <LoyaltyAnalytics overview={overview} onBack={() => setActiveView('list')} onViewSummary={() => setActiveView('program_summary')} />;
  }

  if (activeView === 'program_summary') {
    return <LoyaltyProgramSummary overview={overview} onBack={() => setActiveView('analytics')} />;
  }

  if (activeView === 'tokens' && selectedCustomer) {
    return <TokenTransaction customer={{ ...selectedCustomer, username: selectedCustomer.name, transactions: selectedCustomer.tokenHistory || [] }} onBack={() => setActiveView('list')} />;
  }

  if (activeView === 'employee_allowances') {
    const allowances = Array.isArray(employeeReport?.allowances) ? employeeReport.allowances : [];
    const purchases = Array.isArray(employeeReport?.purchases) ? employeeReport.purchases : [];
    const summary = employeeReport?.summary || {};
    const exportEmployeeReport = () => exportToCSV([
      ['Month','Order','Employee','Outlet','Items','Company used','Company refunded','Personal used','Status'],
      ...purchases.map((row) => [employeeReportMonth, row.orderRef, `"${row.employee}"`, `"${row.outlet}"`, `"${String(row.items).replaceAll('"','""')}"`, row.allowanceTokens, row.refundedAllowanceTokens, row.personalTokens, row.status])
    ], `employee-token-audit-${employeeReportMonth}.csv`);
    return (
      <div className="h-full overflow-y-auto px-8 pb-8 pt-2 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Token Audit</h1>
            <p className="text-sm text-gray-500 mt-1">Monthly company-funded C2 Credit and employee purchase audit.</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" value={employeeReportMonth} onChange={(event) => setEmployeeReportMonth(event.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold" />
            <button onClick={exportEmployeeReport} disabled={!purchases.length} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"><Download size={15} className="inline mr-1" />Export</button>
            <button onClick={() => setActiveView('list')} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold hover:bg-gray-50">Back to Token Ledger</button>
          </div>
        </div>
        <form onSubmit={submitSubsidyPolicy} className="rounded-xl border border-[#B7CFCA] bg-[#F3F7F6] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Company subsidy settings</h2>
              <p className="mt-1 text-sm text-gray-600">
                Changes are scheduled for {subsidyPolicies?.next_period?.start || 'the next month'} and never change an issued allowance.
              </p>
              {subsidyPolicies?.pending?.employee_amount !== null && subsidyPolicies?.pending?.employee_amount !== undefined && (
                <p className="mt-1 text-xs font-semibold text-[#1F3A34]">Pending values are already scheduled for the next period.</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold text-gray-600">Employee / month
                <input type="number" min="0" max="100000" required value={subsidyPolicyForm.employee_amount} onChange={(event) => setSubsidyPolicyForm((previous) => ({ ...previous, employee_amount: event.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-bold text-gray-600">Intern / month
                <input type="number" min="0" max="100000" required value={subsidyPolicyForm.intern_amount} onChange={(event) => setSubsidyPolicyForm((previous) => ({ ...previous, intern_amount: event.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-bold text-gray-600">Admin password
                <input type="password" minLength="8" required value={subsidyPolicyForm.confirmation_password} onChange={(event) => setSubsidyPolicyForm((previous) => ({ ...previous, confirmation_password: event.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
              </label>
            </div>
            <button type="submit" disabled={subsidyPolicySaving} className="rounded-lg bg-[#2E5E58] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1F3A34] disabled:opacity-50">
              {subsidyPolicySaving ? 'Scheduling...' : 'Schedule changes'}
            </button>
          </div>
          {subsidyPolicyError && <p className="mt-3 text-sm font-semibold text-red-700">{subsidyPolicyError}</p>}
          {subsidyPolicySaved && <p className="mt-3 text-sm font-semibold text-[#1F3A34]">{subsidyPolicySaved}</p>}
        </form>
        {employeeReportError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{employeeReportError}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard title="Issued / eligible" value={employeeReportLoading ? '—' : `${Number(summary.employeesIssued || 0).toLocaleString('en-US')} / ${Number(summary.employeesEligible || 0).toLocaleString('en-US')}`} icon={Users} />
          <KPICard title="Carried" value={Number(summary.carriedForward || 0).toLocaleString('en-US')} icon={Coins} iconBg="bg-[#6F9F96]" />
          <KPICard title="Top-up" value={Number(summary.companyTopUp || 0).toLocaleString('en-US')} icon={Coins} iconBg="bg-[#6F9F96]" />
          <KPICard title="Used" value={Number(summary.grossUsed || 0).toLocaleString('en-US')} icon={ShoppingBag} iconBg="bg-[#D4AF7A]" />
          <KPICard title="Refunded" value={Number(summary.refunded || 0).toLocaleString('en-US')} icon={ArrowDown} iconBg="bg-[#8B6F47]" />
          <KPICard title="Ending" value={Number(summary.endingBalance || 0).toLocaleString('en-US')} icon={Coins} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">Monthly allowance records</h2></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50"><tr>{['Employee','Period','Carried','Top-up','Refunded','Remaining','Status'].map((label) => <th key={label} className="px-5 py-3 text-left text-xs font-bold uppercase text-gray-500">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">
            {allowances.map((row) => <tr key={`${row.userId}-${row.periodStart}`}><td className="px-5 py-3"><p className="font-semibold">{row.employee}</p><p className="text-xs text-gray-500">{row.email || row.phone}</p><p className="text-[11px] font-bold uppercase text-[#1F3A34]">{row.role || 'employee'}</p></td><td className="px-5 py-3">{row.role === 'boss' ? 'Unlimited' : row.issued ? `${String(row.periodStart).slice(0,10)} – ${String(row.periodEnd).slice(0,10)}` : 'Not issued this month'}</td><td className="px-5 py-3">{row.role === 'boss' ? '—' : row.carriedForward}</td><td className="px-5 py-3 font-semibold">{row.role === 'boss' ? '∞' : row.granted}</td><td className="px-5 py-3">{row.role === 'boss' ? '—' : row.refunded}</td><td className="px-5 py-3 font-semibold">{row.role === 'boss' ? '∞' : row.remaining}</td><td className="px-5 py-3 capitalize">{String(row.status).replaceAll('_',' ')}</td></tr>)}
            {!allowances.length && <tr><td colSpan="7" className="px-5 py-8 text-center text-gray-500">No employee allowance records for this month.</td></tr>}
          </tbody></table></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">Employee purchase history</h2></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50"><tr>{['Order','Employee','Outlet & items','Company','Refunded','Personal','Status','Tier cup'].map((label) => <th key={label} className="px-5 py-3 text-left text-xs font-bold uppercase text-gray-500">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">
            {purchases.map((row) => <tr key={row.id}><td className="px-5 py-3"><p className="font-semibold">{row.orderRef}</p><p className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleString('en-MY')}</p></td><td className="px-5 py-3">{row.employee}</td><td className="px-5 py-3"><p className="font-medium">{row.outlet}</p><p className="text-xs text-gray-500 max-w-md">{row.items}</p></td><td className="px-5 py-3 font-semibold">{row.allowanceTokens}</td><td className="px-5 py-3">{row.refundedAllowanceTokens}</td><td className="px-5 py-3">{row.personalTokens}</td><td className="px-5 py-3 capitalize">{String(row.status).replaceAll('_',' ')}</td><td className="px-5 py-3 font-semibold text-gray-600">No</td></tr>)}
            {!purchases.length && <tr><td colSpan="8" className="px-5 py-8 text-center text-gray-500">No allowance-funded employee purchases for this month.</td></tr>}
          </tbody></table></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col px-8 pb-8 pt-2 space-y-6 overflow-hidden">
      <div className="shrink-0 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Token Ledger</h1>
          <p className="text-gray-500 text-sm mt-0.5">Review C2 Credit balances, token movements, and approved corrections. Customer profiles and order activity stay on Customers.</p>
        </div>

        {loadError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KPICard
            title="C2 Credit Members"
            value={isLoading ? '—' : (overview?.summary?.totalMembers ?? 0).toLocaleString('en-US')}
            change="Customer C2 Credit"
            icon={Users}
            iconBg="bg-[#1F3A34]"
          />
          <KPICard
            title="Tokens Held"
            value={isLoading ? '—' : (overview?.summary?.tokensInCirculation ?? 0).toLocaleString('en-US')}
            change="C2 Credit balance"
            icon={Coins}
            iconBg="bg-[#6F9F96]"
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-30">
          <div className="relative w-full lg:max-w-[400px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search C2 Credit by name, phone, or member ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1F3A34] focus:border-[#1F3A34]"
            />
          </div>

          <div className="text-xs text-gray-500 lg:ml-2">
            Showing {groupedMembers.length.toLocaleString('en-US')} C2 Credit members and {filteredTransactions.length.toLocaleString('en-US')} token events
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <DatePicker portalId="root-portal" popperPlacement="bottom-end"
                selected={selectedDate}
                onChange={(date) => { setSelectedDate(date); setCurrentPage(1); }}
                customInput={<CustomDateInput onClear={() => { setSelectedDate(null); setCurrentPage(1); }} />}
                dateFormat="MMM d, yyyy"
              />
            </div>
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
                onFocus={() => setTypeOpen(true)}
                onBlur={() => setTypeOpen(false)}
                className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer w-full"
              >
                <option value="All Transaction Types">All Transaction Types</option>
                <option value="Earned">Earned</option>
                <option value="Redeemed">Redeemed</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${typeOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <button
              onClick={() => setActiveView('analytics')}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer shadow-sm whitespace-nowrap transition-transform duration-200 peer-focus:-rotate-180"
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveView('employee_allowances')}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer shadow-sm whitespace-nowrap"
            >
              Employee Token Audit
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 space-x-6 min-h-0 relative">
        {/* Table Container */}
        <div className={`flex flex-col transition-all duration-300 ease-in-out ${selectedCustomer ? 'w-[65%]' : 'w-full'}`}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="overflow-x-auto flex-1">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                  <tr className="text-left text-xs font-bold text-gray-900">
                    <SortableHeader label="Date & Time" columnKey="time" currentKey={tokenSortKey} direction={tokenSortDirection} onSort={handleTokenSort} info="Date and time of the latest token activity." />
                    <SortableHeader label="C2 Credit Owner" columnKey="customer" currentKey={tokenSortKey} direction={tokenSortDirection} onSort={handleTokenSort} info="Customer name, contact details, and member ID." />
                    <SortableHeader label="Member Tier" columnKey="tier" currentKey={tokenSortKey} direction={tokenSortDirection} onSort={handleTokenSort} info="Current tier status and benefits band." />
                    <SortableHeader label="Latest Activity" columnKey="activity" currentKey={tokenSortKey} direction={tokenSortDirection} onSort={handleTokenSort} info="Most recent token earning or redemption transaction." />
                    <SortableHeader label="Tokens" columnKey="tokens" currentKey={tokenSortKey} direction={tokenSortDirection} onSort={handleTokenSort} info="Token delta on the most recent event." className="text-right" />
                    <SortableHeader label="Balance" columnKey="balance" currentKey={tokenSortKey} direction={tokenSortDirection} onSort={handleTokenSort} info="Current total token balance remaining in this customer's C2 Credit." className="text-right" />
                    <th className="px-6 py-4 font-bold text-[11px] text-gray-500 uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedMembers.map((group) => {
                    const tx = group.transactions[0];
                    const transactionCount = group.transactions.length;
                    const latestWords = tx?.description?.split(' ').slice(0, 6) || [];

                    return (
                    <tr
                      key={group.member.memberId}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedCustomer && selectedCustomer.memberId === group.member.memberId ? 'bg-gray-50' : ''}`}
                      onClick={() => setSelectedCustomer(group.member)}
                    >
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <p className="font-semibold text-gray-900 text-xs">{tx?.date || 'No activity'}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{tx?.time || '—'}</p>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#2E5E58] shrink-0 shadow-sm"></div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{group.member.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{group.member.email || group.member.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${getTierColor(group.member.tier, group.member.tierCode)}`}>
                          {group.member.tier}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {tx ? (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${getTypeColor(tx.type)}`}>
                              {tx.type}
                            </span>
                            <div className="text-xs">
                              {latestWords.map((word, i) => (
                                <span key={i} className={i === 0 ? "font-semibold text-gray-900 mr-1" : "text-gray-500 mr-1"}>
                                  {word}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">No token activity yet</span>
                        )}
                        {transactionCount > 1 && (
                          <p className="mt-1 text-[10px] text-gray-400">
                            {transactionCount} token events for this member
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right whitespace-nowrap text-xs font-bold text-gray-900">
                        {tx?.tokens || '—'}
                      </td>
                      <td className="px-6 py-3 text-right whitespace-nowrap text-xs font-bold text-gray-900">
                        {group.member.tokensBalance}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-center">
                        <button
                          className="p-1.5 bg-[#1E293B] hover:bg-[#0F172A] text-white rounded shadow-sm transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(selectedCustomer?.memberId === group.member.memberId ? null : group.member);
                          }}
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-auto px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4 shrink-0 bg-white">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={groupedMembers.length}
                itemName="members"
              />
              <button
                onClick={() => {
                  const rows = [
                    ["Transaction ID", "Member Name", "Tokens", "Balance", "Type", "Source", "Date"],
                    ...filteredTransactions.map((transaction) => [
                      `"${transaction.id}"`,
                      `"${transaction.member.name}"`,
                      `"${transaction.tokens}"`,
                      `"${transaction.balance}"`,
                      `"${transaction.type}"`,
                      `"${transaction.description}"`,
                      `"${transaction.date} ${transaction.time}"`
                    ])
                  ];
                  exportToCSV(rows, "loyalty_tokens.csv");
                }}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer shadow-sm whitespace-nowrap"
              >
                <Download size={16} className="mr-1.5" /> Export
              </button>
            </div>
          </div>
        </div>

        {/* Right side: C2 Credit details panel */}
        {selectedCustomer && (
          <div className="w-[35%] bg-white rounded-2xl border border-gray-200 shadow-lg flex flex-col h-full animate-in slide-in-from-right-8 duration-300 shrink-0">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-2xl shrink-0">
              <h2 className="text-xl font-bold text-gray-900">C2 Credit Details</h2>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Profile Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#2E5E58] shrink-0 shadow-sm"></div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{selectedCustomer.name}</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">{selectedCustomer.email}</p>
                      <p className="text-[11px] text-gray-400">{selectedCustomer.phone}</p>
                      <p className="text-[11px] font-bold text-gray-700 mt-1">Member ID : {selectedCustomer.memberId}</p>
                    </div>
                  </div>
                  <div className="self-start">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${getTierColor(selectedCustomer.tier, selectedCustomer.tierCode)}`}>
                      {selectedCustomer.tier}
                    </span>
                  </div>
                </div>
                <p className="-mt-3 text-xs text-gray-500">Account details and order activity are available on Customers.</p>

                {/* Stats Row */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 font-semibold mb-1">Tokens Balance</p>
                    <p className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1">
                      <Ticket size={12} className="text-gray-400" /> {selectedCustomer.tokensBalance}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-gray-100"></div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 font-semibold mb-1">Lifetime Earned</p>
                    <p className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1">
                      <CheckCircle2 size={12} className="text-gray-400" /> {selectedCustomer.lifetimeEarned}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-gray-100"></div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 font-semibold mb-1">Lifetime Redeemed</p>
                    <p className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1">
                      <ShoppingBag size={12} className="text-gray-400" /> {selectedCustomer.lifetimeRedeemed}
                    </p>
                  </div>
                </div>

                {/* Token History */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-900 text-sm">Recent C2 Credit Activity</h3>
                    <button
                      onClick={() => setActiveView('tokens')}
                      className="text-xs font-bold text-gray-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      View All <ArrowRight size={14} className="ml-0.5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(selectedCustomer.tokenHistory || []).length > 0 ? (
                      (selectedCustomer.tokenHistory || []).map((history) => (
                        <div key={history.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm ${history.type === 'Earned' ? 'bg-gray-900' : 'bg-gray-900'}`}>
                              {history.type === 'Earned' ? (
                                <CheckCircle2 size={16} strokeWidth={2.5} />
                              ) : (
                                <Percent size={16} strokeWidth={2.5} />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{history.type}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{history.desc}</p>
                              <p className="text-[9px] text-gray-400">{history.date}</p>
                            </div>
                          </div>
                          <div className={`font-bold text-xs ${history.type === 'Earned' ? 'text-gray-900' : 'text-gray-900'}`}>
                            {history.amount}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">No recent token history available.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl shrink-0">
              <button
                onClick={() => {
                  setEditTokenError("");
                  setEditTokenReason("");
                  setEditTokenPassword("");
                  setIsEditTokensOpen(true);
                }}
                className="w-full py-2.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Edit3 size={16} /> Adjust C2 Credit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* C2 Credit adjustment modal */}
      {isEditTokensOpen && selectedCustomer && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-[440px] shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
            <div className="flex justify-between items-center px-6 py-4.5 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">Adjust C2 Credit Tokens</h2>
                <InfoTooltip content="Add or deduct tokens from customer C2 Credit with mandatory audit reason and confirmation." title="Adjust C2 Credit" />
              </div>
              <button onClick={() => { setEditTokenPassword(""); setIsEditTokensOpen(false); }} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="h-10 w-10 rounded-full bg-[#2E5E58] shrink-0 shadow-sm"></div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{selectedCustomer.name}</p>
                  <p className="text-xs text-gray-500">{selectedCustomer.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Action</label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button
                    className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${editTokenAction === 'Add' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setEditTokenAction('Add')}
                  >
                    Add
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${editTokenAction === 'Deduct' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setEditTokenAction('Deduct')}
                  >
                    Deduct
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Amount</label>
                <input
                  type="number"
                  value={editTokenAmount}
                  onChange={(e) => setEditTokenAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#1F3A34] focus:border-[#1F3A34] sm:text-sm outline-none"
                  placeholder="e.g. 100"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Adjustment reason <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editTokenReason}
                  onChange={(e) => setEditTokenReason(e.target.value)}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#1F3A34] focus:border-[#1F3A34] sm:text-sm outline-none"
                  placeholder="e.g. Correct a duplicate top-up"
                />
                <p className="mt-1.5 text-xs text-gray-500">This is recorded in the token ledger and audit log.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Current password <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  value={editTokenPassword}
                  onChange={(e) => setEditTokenPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#1F3A34] focus:border-[#1F3A34] sm:text-sm outline-none"
                  placeholder="Confirm this financial adjustment"
                />
                <p className="mt-1.5 text-xs text-gray-500">Required every time tokens are manually added or deducted.</p>
              </div>

              {editTokenError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {editTokenError}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50/50">
              <button
                onClick={() => {
                  setIsEditTokensOpen(false);
                  setEditTokenError("");
                  setEditTokenPassword("");
                }}
                disabled={isSavingTokenAdjustment}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const amount = Number(editTokenAmount);
                  if (!Number.isInteger(amount) || amount < 1) {
                    setEditTokenError('Enter a whole token amount of at least 1.');
                    return;
                  }

                  if (editTokenReason.trim().length < 3) {
                    setEditTokenError('Enter a short reason for this adjustment.');
                    return;
                  }

                  if (editTokenPassword.length < 8) {
                    setEditTokenError('Enter your current password to confirm this adjustment.');
                    return;
                  }

                  setIsSavingTokenAdjustment(true);
                  setEditTokenError("");
                  try {
                    await adjustAdminCustomerTokens(selectedCustomer.id, {
                      action: editTokenAction === 'Add' ? 'credit' : 'debit',
                      amount,
                      reason: editTokenReason.trim(),
                      confirmation_password: editTokenPassword
                    });
                    const response = await loadAdminLoyaltyOverview(100);
                    setOverview(response ?? null);
                    setTransactions(Array.isArray(response?.transactions) ? response.transactions : []);
                    setSelectedCustomer(null);
                    setIsEditTokensOpen(false);
                    setEditTokenAmount("");
                    setEditTokenPassword("");
                  } catch (error) {
                    setEditTokenError(error?.message || 'We could not update this C2 Credit balance.');
                  } finally {
                    setIsSavingTokenAdjustment(false);
                  }
                }}
                disabled={isSavingTokenAdjustment}
                className="px-4 py-2 bg-[#2E5E58] text-white rounded-lg text-sm font-bold hover:bg-[#1F3A34] disabled:cursor-not-allowed disabled:opacity-60 transition-colors shadow-sm cursor-pointer"
              >
                {isSavingTokenAdjustment ? 'Updating...' : 'Record Adjustment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LoyaltyTokens;
