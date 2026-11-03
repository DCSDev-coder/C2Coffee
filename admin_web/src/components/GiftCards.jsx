import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, RefreshCw, Search, ShieldAlert, Gift, Coins,
  CircleDollarSign, CheckCircle2, Clock, Ban,
  Copy, Check, Download, AlertCircle, X, Sparkles
} from 'lucide-react';
import { issueAdminGiftCard, loadAdminGiftCards, updateAdminGiftCardStatus } from '../lib/adminApi';
import { requestAdminConfirm, requestAdminPrompt } from '../lib/adminDialog';
import { showAdminError, showAdminSuccess } from '../lib/adminToast';
import Pagination from './Pagination';
import InfoTooltip from './InfoTooltip';
import { exportToCSV } from '../utils/exportToCSV';

const emptyForm = {
  currency: 'token',
  amount: '',
  recipient_phone: '',
  recipient_message: '',
  reason: ''
};

const ITEMS_PER_PAGE = 10;
const STATUS_TABS = ['All', 'Active', 'Pending Payment', 'Suspended', 'Cancelled'];

const money = (value, currency) =>
  currency === 'rm'
    ? `RM ${Number(value || 0).toFixed(2)}`
    : `${Number(value || 0).toLocaleString()} Tokens`;

function reportGiftCardError(operation, error) {
  console.error(`[GiftCards] ${operation}`, {
    code: error?.code || 'unexpected_error',
    status: error?.status || 0,
    error
  });
}

// Modern KPI Stat Card matching Admin Dashboard standard
const StatCard = ({ title, value, info, icon: Icon, iconBg = 'bg-[#1E433A]', iconColor = 'text-white', badge }) => (
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
    {badge && (
      <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold bg-[#E8F3F0] text-[#1E433A]">
        {badge}
      </span>
    )}
  </div>
);

export default function GiftCards({ currentUser }) {
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [showIssue, setShowIssue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const issueButtonRef = useRef(null);
  const issueDialogRef = useRef(null);
  const submittingRef = useRef(false);
  submittingRef.current = submitting;

  const canControl = Array.isArray(currentUser?.roles) && currentUser.roles.includes('super_admin');

  const loadCards = useCallback(async (searchValue = '') => {
    setLoading(true);
    try {
      const data = await loadAdminGiftCards({ search: searchValue });
      setCards(data.gift_cards || []);
    } catch (error) {
      reportGiftCardError('Unable to load cards', error);
      showAdminError('Unable to load gift cards. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => loadCards(search), [loadCards, search]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  useEffect(() => {
    if (!showIssue) return undefined;

    const previouslyFocused = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault();
        setShowIssue(false);
        return;
      }
      if (event.key !== 'Tab' || !issueDialogRef.current) return;

      const focusable = [...issueDialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const focusFrame = window.requestAnimationFrame(() => {
      issueDialogRef.current?.querySelector('select, input, textarea, button')?.focus();
    });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [showIssue]);

  const copyToClipboard = async (code) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showAdminSuccess(`Copied gift card code ${code}`);
      setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000);
    } catch (error) {
      reportGiftCardError('Unable to copy card code', error);
      showAdminError('Unable to copy the gift card code. Please copy it manually.');
    }
  };

  const outstanding = useMemo(() => ({
    rm: cards
      .filter((card) => card.status === 'active' && card.currency === 'rm')
      .reduce((sum, card) => sum + Number(card.remaining_amount || 0), 0),
    token: cards
      .filter((card) => card.status === 'active' && card.currency === 'token')
      .reduce((sum, card) => sum + Number(card.remaining_amount || 0), 0),
    activeCount: cards.filter((card) => card.status === 'active').length,
    claimedCount: cards.filter((card) => Boolean(card.recipient_phone)).length,
  }), [cards]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // Status filter
      if (statusFilter !== 'All') {
        const normalizedCardStatus = card.status.toLowerCase().replaceAll('_', ' ');
        const normalizedFilter = statusFilter.toLowerCase();
        if (normalizedCardStatus !== normalizedFilter) return false;
      }
      // Currency filter
      if (currencyFilter !== 'all' && card.currency !== currencyFilter) {
        return false;
      }
      // Search filter (client-side refinement)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const codeMatch = card.code?.toLowerCase().includes(q);
        const phoneMatch = card.recipient_phone?.toLowerCase().includes(q);
        const nameMatch = card.recipient_name?.toLowerCase().includes(q);
        const refMatch = card.purchase_ref?.toLowerCase().includes(q);
        if (!codeMatch && !phoneMatch && !nameMatch && !refMatch) return false;
      }
      return true;
    });
  }, [cards, statusFilter, currencyFilter, search]);

  const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE) || 1;
  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCards.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCards, currentPage]);

  const handleExportCSV = () => {
    if (cards.length === 0) {
      showAdminError('No gift cards to export.');
      return;
    }
    const headers = [
      'Code',
      'Currency',
      'Original Amount',
      'Remaining Amount',
      'Status',
      'Recipient Phone',
      'Recipient Name',
      'Purchase Reference',
      'Created At'
    ];
    const rows = [
      headers,
      ...filteredCards.map((c) => [
        `"${c.code || ''}"`,
        `"${c.currency || ''}"`,
        c.original_amount || 0,
        c.remaining_amount || 0,
        `"${c.status || ''}"`,
        `"${c.recipient_phone || ''}"`,
        `"${(c.recipient_name || '').replace(/"/g, '""')}"`,
        `"${c.purchase_ref || ''}"`,
        `"${c.created_at || ''}"`
      ])
    ];
    exportToCSV(rows, `gift-cards-${new Date().toISOString().slice(0, 10)}.csv`);
    showAdminSuccess(`Exported ${filteredCards.length} gift cards to CSV.`);
  };

  const issue = async (event) => {
    event.preventDefault();
    const confirmationPassword = await requestAdminPrompt({
      title: 'Confirm gift-card issue',
              message: 'Enter your admin password to issue C2 Credit directly to the customer.',
      inputLabel: 'Admin password',
      inputType: 'password',
      confirmLabel: 'Issue gift card'
    });
    if (!confirmationPassword) return;

    setSubmitting(true);
    try {
      const result = await issueAdminGiftCard({
        ...form,
        amount: Number(form.amount),
        confirmation_password: confirmationPassword
      });
      setShowIssue(false);
      setForm(emptyForm);
      await refresh();
      showAdminSuccess(`Gift card issued successfully. Code: ${result.code}`);
    } catch (error) {
      reportGiftCardError('Unable to issue card', error);
      showAdminError('Unable to issue the gift card. Please review the details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (card, status) => {
    const actionLabel =
      status === 'active' ? 'Reactivate' : status === 'suspended' ? 'Suspend' : 'Cancel';
    const confirmed = await requestAdminConfirm({
      title: `${actionLabel} gift card`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} gift card ${card.code}? This modifies its ability to spend remaining balance.`,
      confirmLabel: actionLabel,
      tone: status === 'cancelled' ? 'danger' : 'warning'
    });
    if (!confirmed) return;

    const reason = await requestAdminPrompt({
      title: 'Reason required',
      message: 'Record why this stored-value card is being changed for audit purposes.',
      inputLabel: 'Reason',
      confirmLabel: 'Continue'
    });
    if (!reason) return;

    const confirmationPassword = await requestAdminPrompt({
      title: 'Confirm sensitive action',
      message: 'Enter your admin password to apply this change.',
      inputLabel: 'Admin password',
      inputType: 'password',
      confirmLabel: 'Save'
    });
    if (!confirmationPassword) return;

    try {
      await updateAdminGiftCardStatus(card.id, {
        status,
        reason,
        confirmation_password: confirmationPassword
      });
      await refresh();
      showAdminSuccess(`Gift card ${card.code} status updated to ${status}.`);
    } catch (error) {
      reportGiftCardError('Unable to update card status', error);
      showAdminError('Unable to update the gift card. Please try again.');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Gift className="text-[#1E433A]" size={26} />
            Gift Cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Issue, audit, and track customer gift cards with real-time balance reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200/90 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Download size={16} />
            Export CSV
          </button>
          {canControl && (
            <button
              ref={issueButtonRef}
              onClick={() => setShowIssue(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#16332c] transition-colors"
            >
              <Plus size={17} strokeWidth={2.5} />
              Issue gift card
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Cards"
          value={cards.length}
          icon={Gift}
          iconBg="bg-slate-800"
          info="Total gift cards created in the system, including app purchases and admin issues."
        />
        <StatCard
          title="Active Cards"
          value={outstanding.activeCount}
          icon={CheckCircle2}
          iconBg="bg-[#1E433A]"
          badge={`${cards.length ? Math.round((outstanding.activeCount / cards.length) * 100) : 0}% active`}
          info="Cards that are currently active and ready to be redeemed at checkout."
        />
        <StatCard
          title="Active RM Value"
          value={`RM ${outstanding.rm.toFixed(2)}`}
          icon={CircleDollarSign}
          iconBg="bg-teal-700"
          info="Total unredeemed RM stored-value liability across active gift cards."
        />
        <StatCard
          title="Active Token Value"
          value={outstanding.token.toLocaleString()}
          icon={Coins}
          iconBg="bg-amber-600"
          info="Total unredeemed C2 Tokens stored across active gift cards."
        />
      </div>

      {/* Controls: Search, Tabs & Currency Filters */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && refresh()}
              placeholder="Search by code (e.g. C2G-...), recipient phone, name, or purchase ref..."
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-[#1E433A] focus:ring-1 focus:ring-[#1E433A] outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={currencyFilter}
              onChange={(e) => {
                setCurrencyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:border-[#1E433A] outline-none"
            >
              <option value="all">All Currencies</option>
              <option value="token">C2 Tokens</option>
              <option value="rm">RM Credit</option>
            </select>

            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              title="Refresh list"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {STATUS_TABS.map((tab) => {
            const isSelected = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setStatusFilter(tab);
                  setCurrentPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  isSelected
                    ? 'bg-[#1E433A] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gift Cards Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50/80 text-xs font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-3.5">Gift Card</th>
                <th className="px-5 py-3.5">Recipient & Message</th>
                <th className="px-5 py-3.5">Balance</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="animate-spin text-[#1E433A]" size={24} />
                      <p className="text-sm font-medium">Loading gift cards...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCards.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Gift className="text-gray-300" size={36} />
                      <p className="text-base font-bold text-gray-700">No gift cards found</p>
                      <p className="text-xs text-gray-400">
                        {search || statusFilter !== 'All' || currencyFilter !== 'all'
                          ? 'Try adjusting your search query or filters.'
                          : 'No gift cards have been created yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCards.map((card) => {
                  const rem = Number(card.remaining_amount || 0);
                  const orig = Number(card.original_amount || rem);
                  const progress = orig > 0 ? Math.min(100, Math.max(0, (rem / orig) * 100)) : 0;
                  const isToken = card.currency === 'token';

                  return (
                    <tr key={card.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Code & Origin */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900 tracking-wide text-sm">
                            {card.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(card.code)}
                            className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-md hover:bg-gray-100"
                            title="Copy gift card code"
                          >
                            {copiedCode === card.code ? (
                              <Check size={14} className="text-emerald-600" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold uppercase text-[10px] ${
                              isToken ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'
                            }`}
                          >
                            {isToken ? 'C2 Tokens' : 'RM Credit'}
                          </span>
                          <span>•</span>
                          <span>{card.purchase_ref || 'Manual Issue'}</span>
                        </div>
                      </td>

                      {/* Recipient info & Message */}
                      <td className="px-5 py-4 max-w-xs">
                        <p className="font-semibold text-gray-900 text-sm">
                          {card.recipient_name || card.recipient_phone || 'Unclaimed'}
                        </p>
                        {card.recipient_phone && (
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{card.recipient_phone}</p>
                        )}
                        {card.recipient_message && (
                          <p className="text-xs italic text-gray-600 mt-1 line-clamp-1 bg-gray-50 rounded px-2 py-0.5 border border-gray-100">
                            “{card.recipient_message}”
                          </p>
                        )}
                      </td>

                      {/* Balance & Progress */}
                      <td className="px-5 py-4 min-w-[160px]">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-bold text-gray-900 text-sm">
                            {money(card.remaining_amount, card.currency)}
                          </span>
                          <span className="text-xs text-gray-400">
                            of {money(card.original_amount, card.currency)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isToken ? 'bg-amber-500' : 'bg-[#1E433A]'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge status={card.status} remaining={rem} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {canControl ? (
                          <div className="flex items-center justify-end gap-2">
                            {card.status === 'active' && (
                              <button
                                onClick={() => changeStatus(card, 'suspended')}
                                className="rounded-lg px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-50 transition-colors"
                              >
                                Suspend
                              </button>
                            )}
                            {card.status === 'suspended' && (
                              <button
                                onClick={() => changeStatus(card, 'active')}
                                className="rounded-lg px-2.5 py-1 text-xs font-bold text-[#1E433A] hover:bg-teal-50 transition-colors"
                              >
                                Reactivate
                              </button>
                            )}
                            {['active', 'suspended'].includes(card.status) && (
                              <button
                                onClick={() => changeStatus(card, 'cancelled')}
                                className="rounded-lg px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredCards.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredCards.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </div>
        )}
      </div>

      {/* Financial Security Guardrail */}
      <div className="flex gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs text-amber-900 shadow-2xs">
        <ShieldAlert size={19} className="shrink-0 text-amber-700 mt-0.5" />
        <div>
          <span className="font-bold">Important Audit Guardrail:</span> Never alter a card’s remaining balance manually from this page. Suspend or cancel cards here; value corrections require a separately approved financial adjustment ledger with full password verification and audit history.
        </div>
      </div>

      {/* Issue Gift Card Modal */}
      {canControl && showIssue && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <form
            ref={issueDialogRef}
            onSubmit={issue}
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-gift-card-title"
            className="w-full max-w-lg rounded-2xl border border-white/80 bg-white p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="issue-gift-card-title" className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                  <Sparkles className="text-[#1E433A]" size={20} />
                  Issue Stored-Value Gift Card
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  For approved goodwill, VIP rewards, or offline sales. Normal customer orders happen in the mobile app.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIssue(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                aria-label="Close issue gift card dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Currency Selector Pill */}
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Currency</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, currency: 'token' })}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-bold transition-all ${
                    form.currency === 'token'
                      ? 'border-[#1E433A] bg-[#1E433A]/5 text-[#1E433A]'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Coins size={16} />
                  C2 Tokens
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, currency: 'rm' })}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-bold transition-all ${
                    form.currency === 'rm'
                      ? 'border-[#1E433A] bg-[#1E433A]/5 text-[#1E433A]'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <CircleDollarSign size={16} />
                  RM Credit
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Amount ({form.currency === 'rm' ? 'RM' : 'Tokens'})
              </label>
              <input
                autoFocus
                type="number"
                required
                min="1"
                max="5000"
                step="1"
                placeholder={form.currency === 'rm' ? '25.00' : '50'}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:border-[#1E433A] focus:ring-1 focus:ring-[#1E433A] outline-none"
              />
            </div>

            {/* Recipient Phone */}
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Recipient Phone
              </label>
              <input
                placeholder="+60123456789 or 0123456789"
                value={form.recipient_phone}
                onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:border-[#1E433A] focus:ring-1 focus:ring-[#1E433A] outline-none"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                          Optional. A registered phone delivers the C2 Credit directly to that customer; leave blank to create a shareable code.
              </p>
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Message (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Personal note for the recipient..."
                value={form.recipient_message}
                onChange={(e) => setForm({ ...form, recipient_message: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm text-gray-900 focus:border-[#1E433A] focus:ring-1 focus:ring-[#1E433A] outline-none resize-none"
              />
            </div>

            {/* Issue Reason */}
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Audit Reason <span className="text-red-500">*</span>
              </label>
              <input
                required
                minLength={3}
                placeholder="e.g. VIP Customer Apology / Influencer Partnership"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:border-[#1E433A] focus:ring-1 focus:ring-[#1E433A] outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowIssue(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                className="rounded-xl bg-[#1E433A] px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#16332c] disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Issuing...' : 'Issue Gift Card'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}

function StatusBadge({ status, remaining }) {
  if (status === 'active' && remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
        <CheckCircle2 size={12} />
        Fully Used
      </span>
    );
  }
  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
          <CheckCircle2 size={12} />
          Active
        </span>
      );
    case 'pending_payment':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
          <Clock size={12} />
          Pending Payment
        </span>
      );
    case 'suspended':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">
          <AlertCircle size={12} />
          Suspended
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
          <Ban size={12} />
          Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">
          {status.replaceAll('_', ' ')}
        </span>
      );
  }
}
