import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Eye, Mail, Search, X } from 'lucide-react';
import Pagination from './Pagination';
import { createAdminRefund, loadAdminRefunds, reviewAdminRefund } from '../lib/adminApi';
import ViewProfile from './ViewProfile';

const ITEMS_PER_PAGE = 10;
const STATUSES = ['All Status', 'Pending', 'Approved', 'Rejected'];

const statusClass = {
  Pending: 'bg-amber-50 text-amber-700',
  Approved: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-red-50 text-red-700'
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${statusClass[status] || 'bg-slate-100 text-slate-700'}`}>
    {status}
  </span>
);

const formatAmount = (refund) => {
  const isTokenRefund = String(refund.paymentMethod || '').toLowerCase() === 'token';
  if (isTokenRefund) {
    return `${Number(refund.tokenAmount || 0)} tokens`;
  }
  return `RM ${Number(refund.amountRm || 0).toFixed(2)}`;
};

const RefundDetails = ({ onBack }) => {
  const [refunds, setRefunds] = useState([]);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [viewingProfileFor, setViewingProfileFor] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [orderReference, setOrderReference] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadRefunds = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await loadAdminRefunds();
      setRefunds(Array.isArray(response?.refunds) ? response.refunds : []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load refund requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRefunds();
  }, []);

  const reviewRefund = async (refund, decision) => {
    if (refund.status !== 'Pending') return;
    setActionId(refund.id);
    setError('');
    try {
      await reviewAdminRefund(refund.id, decision);
      await loadRefunds();
      setSelectedRefund(null);
    } catch (requestError) {
      setError(requestError.message || 'Unable to record this refund decision.');
    } finally {
      setActionId('');
    }
  };

  const createRefund = async (event) => {
    event.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    setError('');
    try {
      await createAdminRefund(orderReference.trim(), refundReason.trim());
      setOrderReference('');
      setRefundReason('');
      setIsCreateOpen(false);
      await loadRefunds();
    } catch (requestError) {
      setError(requestError.message || 'Unable to create this refund request.');
    } finally {
      setIsCreating(false);
    }
  };

  const filtered = refunds.filter((refund) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [refund.id, refund.orderId, refund.customer, refund.reason]
      .some((value) => String(value || '').toLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'All Status' || refund.status === statusFilter);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const counts = Object.fromEntries(STATUSES.slice(1).map((status) => [status, refunds.filter((refund) => refund.status === status).length]));

  if (viewingProfileFor) return <ViewProfile customer={viewingProfileFor} onBack={() => setViewingProfileFor(null)} />;

  return (
    <div className="flex h-full flex-col px-8 pb-8 pt-2">
      <div className="mb-6 flex items-start justify-between gap-4"><div><div className="flex items-center gap-2.5"><button onClick={onBack} className="rounded-lg p-1 text-gray-700 hover:bg-gray-100" title="Back to Orders"><ArrowLeft size={22} /></button><h1 className="text-2xl font-bold text-gray-900">Refund Reviews</h1></div><p className="ml-8 mt-0.5 text-sm text-gray-500">Approve a request to return its tokens to the customer's wallet.</p></div><button onClick={() => setIsCreateOpen(true)} className="rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white hover:bg-[#2E5E58]">Create refund request</button></div>
      {error && <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => void loadRefunds()} className="font-bold underline">Retry</button></div>}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">{STATUSES.slice(1).map((status) => <div key={status} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-gray-500">{status}</p><p className="mt-1 text-2xl font-bold text-gray-900">{counts[status]}</p></div>)}</div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-md"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Search refund, order, customer or reason" className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm" /></div><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead><tr className="text-left text-xs font-bold text-gray-900">{['Refund ID', 'Order ID', 'Customer', 'Amount', 'Reason', 'Status', 'Requested', ''].map((heading) => <th key={heading} className="px-5 py-4 whitespace-nowrap">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{loading ? <tr><td colSpan="8" className="px-6 py-10 text-center text-sm text-gray-500">Loading refund requests...</td></tr> : pageItems.length ? pageItems.map((refund) => <tr key={refund.id} className={selectedRefund?.id === refund.id ? 'bg-[#F3F7F5]' : 'hover:bg-gray-50'}><td className="px-5 py-3 text-sm font-semibold text-gray-900">{refund.id}</td><td className="px-5 py-3 text-sm text-gray-700">{refund.orderId}</td><td className="px-5 py-3 text-sm font-medium text-gray-900">{refund.customer}</td><td className="px-5 py-3 text-sm font-semibold text-gray-900">{formatAmount(refund)}</td><td className="px-5 py-3 text-sm text-gray-700">{refund.reason}</td><td className="px-5 py-3"><StatusBadge status={refund.status} /></td><td className="px-5 py-3 text-sm text-gray-600">{refund.requestedAt}</td><td className="px-5 py-3"><button onClick={() => setSelectedRefund(selectedRefund?.id === refund.id ? null : refund)} className="rounded-lg bg-[#1F3A34] p-2 text-white hover:bg-[#2E5E58]" title="View refund"><Eye size={15} /></button></td></tr>) : <tr><td colSpan="8" className="px-6 py-10 text-center text-sm text-gray-500">No refund requests match these filters.</td></tr>}</tbody></table></div><div className="border-t border-gray-200 px-6 py-4"><Pagination currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} itemsPerPage={ITEMS_PER_PAGE} totalItems={filtered.length} itemName="refund requests" /></div></div>
        {selectedRefund && <aside className="w-full shrink-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:w-[360px]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-bold text-gray-900">Refund Details</h2><p className="mt-1 text-sm text-gray-500">{selectedRefund.id}</p></div><button onClick={() => setSelectedRefund(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button></div><div className="mt-5 space-y-4 border-y border-gray-100 py-4 text-sm"><div><p className="text-xs text-gray-500">Customer</p><p className="font-bold text-gray-900">{selectedRefund.customer}</p><p className="text-gray-600">{selectedRefund.email}</p></div><div><p className="text-xs text-gray-500">Order and amount</p><p className="font-semibold text-gray-900">{selectedRefund.orderId} · {formatAmount(selectedRefund)}</p></div><div><p className="text-xs text-gray-500">Customer reason</p><p className="font-semibold text-gray-900">{selectedRefund.customerNotes || selectedRefund.reason}</p></div><div><p className="text-xs text-gray-500">Decision status</p><div className="mt-1"><StatusBadge status={selectedRefund.status} /></div></div></div><button onClick={() => setViewingProfileFor({ username: selectedRefund.customer, email: selectedRefund.email, phone: selectedRefund.phone })} className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">View Customer</button>{selectedRefund.email && <a href={`mailto:${selectedRefund.email}?subject=${encodeURIComponent(`Refund request ${selectedRefund.id}`)}`} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"><Mail size={15} /> Email Customer</a>}{selectedRefund.status === 'Pending' && <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={actionId === selectedRefund.id} onClick={() => void reviewRefund(selectedRefund, 'rejected')} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button><button disabled={actionId === selectedRefund.id} onClick={() => void reviewRefund(selectedRefund, 'approved')} className="flex items-center justify-center gap-2 rounded-lg bg-[#1F3A34] px-3 py-2 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:opacity-50"><Check size={16} />{actionId === selectedRefund.id ? 'Saving...' : 'Approve'}</button></div>}</aside>}
      </div>
      {isCreateOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={createRefund} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-gray-900">Create refund request</h2><p className="mt-1 text-sm text-gray-500">Use this when support receives a request outside the app.</p></div><button type="button" onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button></div><label className="mt-5 block text-sm font-bold text-gray-700">Order reference<input required value={orderReference} onChange={(event) => setOrderReference(event.target.value)} placeholder="C2-260904-JUQTQL" className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label><label className="mt-4 block text-sm font-bold text-gray-700">Reason<textarea required minLength="10" maxLength="500" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="Reason provided by the customer" className="mt-1.5 min-h-28 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">Cancel</button><button disabled={isCreating} type="submit" className="rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isCreating ? 'Creating...' : 'Create request'}</button></div></form></div>}
    </div>
  );
};

export default RefundDetails;
