import React, { useState, forwardRef, useEffect } from "react";
import {
  Search, ChevronDown, X, Clock, ClipboardList,
  ShieldCheck, FileX, Receipt, Eye, MoreVertical,
  ArrowLeft, CheckCircle2, RotateCcw, MessageSquare, AlertCircle
} from "lucide-react";
import Pagination from './Pagination';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Custom Icons for Timeline 

const ClockTimelineIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const DocTimelineIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const CheckTimelineIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m8 12 2.5 2.5 5.5-5.5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// Mock Refund Data 

const initialRefundsData = [
  {
    id: "REF-0510-001",
    orderId: "ORD-0510-001",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Wrong Item",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Approved",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "I received Flat White instead of Latte",
    attachment: "/FLAT WHITE.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  },
  {
    id: "REF-0510-002",
    orderId: "ORD-0510-002",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Quality Issued",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Pending",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Drink spilled upon delivery and was cold",
    attachment: "/BOIJITO.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: false },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: false }
    ]
  },
  {
    id: "REF-0510-003",
    orderId: "ORD-0510-003",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Delayed Order",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Under Review",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Took over 45 minutes to prepare and was late",
    attachment: "/LATTE.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: false }
    ]
  },
  {
    id: "REF-0510-004",
    orderId: "ORD-0510-004",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Wrong Item",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Rejected",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Items matched customized selection",
    attachment: "/BOIJITO.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Rejected", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  },
  {
    id: "REF-0510-005",
    orderId: "ORD-0510-005",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Other",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Approved",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Duplicate order placed accidentally",
    attachment: "/FLAT WHITE.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  },
  {
    id: "REF-0510-006",
    orderId: "ORD-0510-006",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Missing Item",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Approved",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Missing 1 pastry item",
    attachment: "/BOIJITO.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  },
  {
    id: "REF-0510-007",
    orderId: "ORD-0510-007",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Missing Item",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Approved",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Received wrong size cup",
    attachment: "/FLAT WHITE.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  },
  {
    id: "REF-0510-008",
    orderId: "ORD-0510-008",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Missing Item",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Approved",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Order cancelled by store",
    attachment: "/BOIJITO.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  },
  {
    id: "REF-0510-009",
    orderId: "ORD-0510-009",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Missing Item",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Approved",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Missing extra shot addition",
    attachment: "/FLAT WHITE.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  },
  {
    id: "REF-0510-010",
    orderId: "ORD-0510-010",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Missing Item",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Approved",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Payment charged twice",
    attachment: "/BOIJITO.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  },
  {
    id: "REF-0510-011",
    orderId: "ORD-0510-011",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Missing Item",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Approved",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Wrong milk type used",
    attachment: "/FLAT WHITE.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  },
  {
    id: "REF-0510-012",
    orderId: "ORD-0510-012",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Missing Item",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Approved",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Order not fulfilled by outlet",
    attachment: "/BOIJITO.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  },
  {
    id: "REF-0510-013",
    orderId: "ORD-0510-013",
    customer: "miraelys",
    email: "mira@gmail.com",
    phone: "+60 11-63793812",
    tier: "Legend",
    memberId: "C2-001",
    amount: 15.90,
    reason: "Missing Item",
    paymentMethod: "Touch 'n Go eWallet",
    status: "Approved",
    requestedAt: "Aug 19, 2026 10:15 AM",
    orderDate: "Aug 19, 2026 – 10:18 AM",
    customerNotes: "Refund requested per store manager approval",
    attachment: "/FLAT WHITE.png",
    timeline: [
      { label: "Refund Requested", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Under Review", date: "Aug 19, 2026 10:21 AM", done: true },
      { label: "Refund Completed", date: "Aug 19, 2026 10:21 AM", done: true }
    ]
  }
];

// Status Badge Helper 

const getRefundStatusBadge = (status) => {
  switch (status) {
    case "Approved":
      return (
        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-green-100 text-green-600">
          Approved
        </span>
      );
    case "Pending":
      return (
        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-[#FFEADB] text-[#F37021]">
          Pending
        </span>
      );
    case "Under Review":
      return (
        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-[#E4F2FF] text-[#2995F7]">
          Under Review
        </span>
      );
    case "Rejected":
      return (
        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-red-100 text-red-600">
          Rejected
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-gray-100 text-gray-600">
          {status}
        </span>
      );
  }
};

const fmtPrice = (n) => `RM ${n.toFixed(2)}`;
const ITEMS_PER_PAGE = 10;
const STATUSES = ["All Status", "Pending", "Under Review", "Approved", "Rejected"];

// KPI Card Component

const KPICard = ({ title, value, change, icon: Icon, iconBg, iconColor = "text-white" }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-sm`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight mt-0.5 whitespace-normal">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
      {change && (
        <div className="flex items-center gap-1 mt-1">
          <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal">
            {change.includes('%') && !change.includes('of total') && !change.includes('↑') && !change.includes('↓') && change.includes('vs') ? `↑ ${change}` : change}
          </p>
        </div>
      )}
    </div>
  </div>
);

// Date Picker Input 

const CustomDateInput = forwardRef(({ value, onClick, onClear }, ref) => (
  <div className="relative">
    <button
      ref={ref}
      onClick={(e) => { e.preventDefault(); onClick(e); }}
      className="peer flex items-center pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer"
    >
      {value || 'Select Date'}
    </button>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      <ChevronDown size={16} className="text-gray-500 transition-transform duration-200 peer-focus:-rotate-180" />
    </div>
    {value && (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
        className="absolute right-7 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 rounded-full bg-gray-100 p-0.5 cursor-pointer"
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    )}
  </div>
));

// Refund Detail Panel Component

const RefundDetailPanel = ({ refund, onClose, onUpdateStatus, onPreviewAttachment }) => {
  return (
    <div className="w-[360px] lg:w-[380px] bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col shrink-0 overflow-y-auto p-5 space-y-4">
      {/* Header */}
      <div className="border-b border-gray-100 pb-3">
        <div className="flex justify-between items-start">
          <h2 className="text-base font-bold text-gray-900">Refund Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 cursor-pointer">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-bold text-gray-900">{refund.id}</p>
          {getRefundStatusBadge(refund.status)}
        </div>
        <p className="text-xs text-gray-500 mt-1">Requested on {refund.requestedAt}</p>
      </div>

      {/* Order Information Section */}
      <div>
        <h3 className="text-xs font-bold text-gray-900 mb-2">Order Information</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-gray-500 text-[11px]">Order ID</p>
            <p className="font-bold text-gray-900 mt-0.5">{refund.orderId}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[11px]">Payment Method</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-5 h-5 rounded-md bg-[#0055A5] flex flex-col items-center justify-center text-white shrink-0 p-0.5 shadow-2xs">
                <span className="text-[5px] font-extrabold leading-none tracking-tighter">Touch</span>
                <span className="text-[4px] font-bold leading-none text-yellow-300">'n Go</span>
              </div>
              <span className="font-bold text-gray-900 text-xs">{refund.paymentMethod}</span>
            </div>
          </div>
          <div className="col-span-2 mt-1">
            <p className="text-gray-500 text-[11px]">Order Date</p>
            <p className="font-bold text-gray-900 mt-0.5">{refund.orderDate}</p>
          </div>
        </div>
      </div>

      {/* Customer Section */}
      <div className="pt-1 border-t border-gray-100">
        <h3 className="text-xs font-bold text-gray-900 mb-2">Customer</h3>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-[#2E5E58] shrink-0 shadow-sm"></div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{refund.customer}</p>
              <p className="text-xs text-gray-500 truncate">{refund.email}</p>
              <p className="text-xs text-gray-500">{refund.phone}</p>
              <p className="text-xs text-gray-700 font-medium mt-0.5">Member ID : {refund.memberId}</p>
            </div>
          </div>
          <button
            onClick={() => alert(`Viewing profile for ${refund.customer}`)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            View Profile
          </button>
        </div>
      </div>

      {/* Refund Information Section */}
      <div className="pt-1 border-t border-gray-100">
        <h3 className="text-xs font-bold text-gray-900 mb-2">Refund Information</h3>
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div>
            <p className="text-gray-500 text-[11px]">Refund Amount</p>
            <p className="font-bold text-gray-900 mt-0.5">{fmtPrice(refund.amount)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[11px]">Refund Reason</p>
            <p className="font-bold text-gray-900 mt-0.5">{refund.reason}</p>
          </div>
        </div>

        <div className="mb-3">
          <p className="text-gray-500 text-[11px]">Customer Notes</p>
          <p className="text-xs font-bold text-gray-900 mt-0.5 leading-snug">{refund.customerNotes}</p>
        </div>

        <div>
          <p className="text-gray-500 text-[11px] mb-1.5 flex items-center justify-between">
            <span>Attachments</span>
            <span className="text-[10px] text-[#2E5E58] font-medium">Click to zoom</span>
          </p>
          <button
            type="button"
            onClick={() => onPreviewAttachment && onPreviewAttachment(refund.attachment, {
              title: "Refund Attachment Preview",
              subtitle: `${refund.reason} • ${refund.id}`,
              notes: refund.customerNotes
            })}
            className="w-14 h-14 rounded-lg border border-gray-200 p-1 flex items-center justify-center bg-gray-50 overflow-hidden shadow-xs hover:border-[#2E5E58] hover:shadow-md transition-all cursor-pointer group relative text-left"
            title="Click to get a closer look"
          >
            <img
              src={refund.attachment}
              alt="Attachment"
              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
              <Eye size={15} className="text-white drop-shadow-md" />
            </div>
          </button>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="pt-1 border-t border-gray-100">
        <h3 className="text-xs font-bold text-gray-900 mb-2.5">Timeline</h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ClockTimelineIcon size={14} className="text-gray-700" />
              <span className="font-medium text-gray-800">Refund Requested</span>
            </div>
            <span className="text-gray-500 text-[11px]">Aug 19, 2026 10:21 AM</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <DocTimelineIcon size={14} className="text-gray-700" />
              <span className="font-medium text-gray-800">Under Review</span>
            </div>
            <span className="text-gray-500 text-[11px]">Aug 19, 2026 10:21 AM</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CheckTimelineIcon size={14} className="text-black" />
              <span className="font-bold text-gray-900">Refund Completed</span>
            </div>
            <span className="text-gray-500 text-[11px]">Aug 19, 2026 10:21 AM</span>
          </div>
        </div>
      </div>

      {/* Footer Action Buttons (Reject, Request More Info, Approve Refund) */}
      <div className="pt-3 border-t border-gray-100 mt-auto grid grid-cols-3 gap-2">
        <button
          onClick={() => onUpdateStatus(refund.id, "Rejected")}
          className="py-2 px-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors text-center cursor-pointer"
        >
          Reject
        </button>
        <button
          onClick={() => alert(`Requested more information for ${refund.id}`)}
          className="py-2 px-1 border border-gray-300 rounded-lg text-[11px] font-bold text-gray-700 hover:bg-gray-50 transition-colors text-center cursor-pointer leading-tight"
        >
          Request More Info
        </button>
        <button
          onClick={() => onUpdateStatus(refund.id, "Approved")}
          className="py-2 px-1 border border-gray-400 rounded-lg text-[11px] font-bold text-gray-900 hover:bg-green-50 hover:text-green-700 hover:border-green-400 transition-colors text-center cursor-pointer leading-tight"
        >
          Approve Refund
        </button>
      </div>
    </div>
  );
};

// Main RefundDetails Component 

const RefundDetails = ({ onBack }) => {
  const [refunds, setRefunds] = useState(initialRefundsData);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusOpen, setStatusOpen] = useState(false);

  const resetPage = () => setCurrentPage(1);

  const handleUpdateStatus = (refundId, newStatus) => {
    setRefunds((prev) =>
      prev.map((r) => (r.id === refundId ? { ...r, status: newStatus } : r))
    );
    if (selectedRefund && selectedRefund.id === refundId) {
      setSelectedRefund((prev) => ({ ...prev, status: newStatus }));
    }
  };

  const filtered = refunds.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      r.id.toLowerCase().includes(q) ||
      r.orderId.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All Status" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // KPI Calculations
  const pendingCount = refunds.filter((r) => r.status === "Pending").length || 10;
  const underReviewCount = refunds.filter((r) => r.status === "Under Review").length || 4;
  const approvedCount = refunds.filter((r) => r.status === "Approved").length || 6;
  const rejectedCount = refunds.filter((r) => r.status === "Rejected").length || 3;
  const totalRefundedAmount = 74.50;

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
      {/* Header with Back Arrow and Title */}
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              title="Back to Orders"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Refund Details</h1>
          </div>
          <p className="text-gray-500 text-sm mt-0.5 ml-8">Review and manage customer refund requests.</p>
        </div>
      </div>

      {/* Top 5 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5 mb-6 shrink-0">
        <KPICard
          title="Pending"
          value={pendingCount}
          change="12.6% vs yesterday"
          icon={Clock}
          iconBg="bg-[#1F3A34]"
          iconColor="text-white"
        />
        <KPICard
          title="Under Review"
          value={underReviewCount}
          change="8.2% vs yesterday"
          icon={ClipboardList}
          iconBg="bg-[#2E5E58]"
          iconColor="text-white"
        />
        <KPICard
          title="Approved"
          value={approvedCount}
          change="17.1% vs yesterday"
          icon={ShieldCheck}
          iconBg="bg-[#6F9F96]"
          iconColor="text-white"
        />
        <KPICard
          title="Rejected"
          value={rejectedCount}
          change="8.7% vs yesterday"
          icon={FileX}
          iconBg="bg-[#E07A5F]"
          iconColor="text-white"
        />
        <KPICard
          title="Total Refunded"
          value={fmtPrice(totalRefundedAmount)}
          change="9.3% vs yesterday"
          icon={Receipt}
          iconBg="bg-[#D9C4A9]"
          iconColor="text-white"
        />
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 shrink-0">
        {/* Search */}
        <div className="relative w-full max-w-[440px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search Refund ID, Order ID, customer..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-[#2E5E58] focus:border-[#2E5E58] text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}
              onFocus={() => setStatusOpen(true)}
              onBlur={() => setStatusOpen(false)}
              className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Date Picker */}
          <div className="relative transition-transform duration-200 peer-focus:-rotate-180">
            <DatePicker portalId="root-portal" popperPlacement="bottom-end"
              selected={selectedDate}
              onChange={(d) => { setSelectedDate(d); resetPage(); }}
              customInput={<CustomDateInput onClear={() => { setSelectedDate(null); resetPage(); }} />}
              dateFormat="MMM d, yyyy"
            />
          </div>
        </div>
      </div>

      {/* Main Content: Table + Detail Panel */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        {/* Refunds Table */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0">
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  {["Refund ID", "Order ID", "Customer", "Amount", "Reason", "Payment Method", "Status", "Requested At", "Action"].map((h) => (
                    <th key={h} className="px-5 py-4 text-left text-xs font-bold text-gray-900 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginated.length > 0 ? (
                  paginated.map((refund) => {
                    const isSelected = selectedRefund?.id === refund.id;
                    return (
                      <tr
                        key={refund.id}
                        className={`hover:bg-gray-50 transition-colors ${isSelected ? "bg-gray-50" : ""
                          }`}
                      >
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {refund.id}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {refund.orderId}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-9 w-9 rounded-full bg-[#2E5E58] shrink-0 shadow-sm"></div>
                            <div className="ml-3">
                              <div className="text-sm font-bold text-gray-900">{refund.customer}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                          {fmtPrice(refund.amount)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">
                          {refund.reason}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-md bg-[#0055A5] flex flex-col items-center justify-center text-white shrink-0 p-0.5 shadow-2xs">
                              <span className="text-[5px] font-extrabold leading-none tracking-tighter">Touch</span>
                              <span className="text-[4px] font-bold leading-none text-yellow-300">'n Go</span>
                            </div>
                            <span>{refund.paymentMethod}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {getRefundStatusBadge(refund.status)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600 font-medium">
                          {refund.requestedAt}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setSelectedRefund(isSelected ? null : refund)}
                            className="bg-[#1E293B] hover:bg-[#0F172A] text-white px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                            title="View Refund Details"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500 text-sm">
                      No refund requests found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex shrink-0 bg-white">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filtered.length}
              itemName="refund requests"
            />
          </div>
        </div>

        {/* Right Side: Refund Detail Panel */}
        {selectedRefund && (
          <RefundDetailPanel
            refund={selectedRefund}
            onClose={() => setSelectedRefund(null)}
            onUpdateStatus={handleUpdateStatus}
            onPreviewAttachment={(img, info) => setPreviewImage({ img, ...info })}
          />
        )}
      </div>

      {/* Attachment Image Lightbox Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">{previewImage.title || "Attachment Preview"}</h3>
                {previewImage.subtitle && (
                  <p className="text-xs text-gray-500 mt-0.5">{previewImage.subtitle}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Close Preview"
              >
                <X size={20} />
              </button>
            </div>

            <div className="w-full h-80 sm:h-96 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center p-4 overflow-hidden mb-4 shadow-inner">
              <img
                src={previewImage.img}
                alt="Attachment Preview"
                className="max-h-full max-w-full object-contain transition-transform duration-200 hover:scale-105"
              />
            </div>

            {previewImage.notes && (
              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Customer Note</p>
                <p className="text-xs font-semibold text-gray-800 italic">"{previewImage.notes}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RefundDetails;
