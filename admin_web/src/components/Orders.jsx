import React, { useState, forwardRef, useEffect, useMemo } from "react";
import {
  Search, ChevronDown, Download, Clock, Printer,
  X, ShoppingBag, Ban, RotateCcw, Coins,
  ArrowUp, ArrowDown, ArrowUpDown
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Pagination from './Pagination';
import InfoTooltip from './InfoTooltip';
import { exportToCSV } from '../utils/exportToCSV';
import RefundDetails from "./RefundDetails";
import ViewProfile from "./ViewProfile";
import { adminRequest } from '../lib/adminApi';
import { formatPaymentLabel } from '../utils/reporting';
import OutletFilter from './OutletFilter';

//Custom Icons for Timeline 

const ReceiptDocIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M8 7h8" />
    <path d="M8 11h8" />
    <path d="M8 15h5" />
    <circle cx="6.5" cy="7" r="0.5" fill="currentColor" />
    <circle cx="6.5" cy="11" r="0.5" fill="currentColor" />
    <circle cx="6.5" cy="15" r="0.5" fill="currentColor" />
  </svg>
);

const MokaPotIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    {/* Lid Knob */}
    <circle cx="12" cy="2.5" r="1.5" />
    {/* Lid */}
    <path d="M8 4.5h8l-1 2H9l-1-2z" />
    {/* Upper Chamber */}
    <path d="M6.5 6.5h11l-2 6.5h-7l-2-6.5z" />
    {/* Waist band */}
    <rect x="8" y="13" width="8" height="1.5" rx="0.5" />
    {/* Lower Boiler */}
    <path d="M7.5 14.5h9l1.5 6.5h-12l1.5-6.5z" />
    {/* Handle */}
    <path d="M17.5 8c2 0 3 1.5 3 3.5s-1 3.5-3 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Spout */}
    <path d="M6.5 8.5L3.5 7v2.5L6.5 11" />
  </svg>
);

const SolidBagIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zm-9-1a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z" />
  </svg>
);

const SolidCheckSquareIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" />
    <path d="m7 12 3.5 3.5 7-7" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const itemCustomizationRows = (item) => {
  if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
    return item.modifiers
      .map((modifier) => ({
        label: String(modifier.group || '').trim(),
        value: String(modifier.option || '').trim(),
      }))
      .filter(({ label, value }) => (
        value
        && label.toLowerCase() !== 'remarks'
        && label.toLowerCase() !== 'order type'
      ));
  }

  return [
    ['Bean', item.bean],
    ['Shot(s)', item.espressoShot],
    ['Temp', item.temperature],
    ['Sparkling', item.sparkling],
    ['Milk', item.milk],
    ['Sweetness', item.sweetness],
    ['Ice Level', item.iceLevel],
  ].filter(([, value]) => value).map(([label, value]) => ({ label, value }));
};

// Helpers matching Customers Page

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

const normalizeOrderStatus = (rawStatus) => {
  const s = String(rawStatus || '').trim().toLowerCase().replace(/_/g, ' ');
  if (s === 'paid' || s === 'accepted' || s === 'new' || s === 'order received') {
    return 'Order Received';
  }
  if (s === 'preparing') {
    return 'Preparing';
  }
  if (s.includes('ready')) {
    return 'Ready for Pickup';
  }
  if (s === 'collected' || s === 'completed') {
    return 'Collected';
  }
  if (s === 'cancelled' || s === 'voided') {
    return 'Cancelled';
  }
  if (s === 'refund requested' || s === 'refund reviewing') {
    return 'Refund Requested';
  }
  if (s === 'refunded' || s === 'refund') {
    return 'Refunded';
  }
  return rawStatus || 'Unknown';
};

const getStatusBadge = (s) => {
  const normalized = normalizeOrderStatus(s);
  switch (normalized) {
    case "Collected":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-emerald-100 text-emerald-800">Collected</span>;
    case "Preparing":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-orange-100 text-orange-800">Preparing</span>;
    case "Ready for Pickup":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-blue-100 text-blue-800">Ready for Pickup</span>;
    case "Order Received":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-amber-100 text-amber-800">Order Received</span>;
    case "Cancelled":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-red-100 text-red-700">Cancelled</span>;
    case "Refund Requested":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-purple-100 text-purple-700">Refund Requested</span>;
    case "Refunded":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-rose-100 text-rose-700">Refunded</span>;
    default:
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-gray-100 text-gray-700">{s}</span>;
  }
};

const getPaymentTypeBadge = (order) => {
  const mode = String(order?.paymentMode || order?.payment || '').toLowerCase();
  const isRefunded = String(order?.status || '').toLowerCase() === 'refunded' ||
                     String(order?.paymentStatus || '').toLowerCase() === 'refunded';

  if (mode === 'token' || mode === 'tokens') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#E8F3F0] text-[#1E433A] border border-[#2E5E58]/20">
        <Coins size={12} className="text-[#2E5E58]" strokeWidth={2.3} />
        <span>Tokens</span>
        {isRefunded && <span className="text-[10px] text-rose-600 font-semibold">(Refunded)</span>}
      </span>
    );
  }

  const provider = order?.paymentProvider ? formatPaymentLabel(order.paymentProvider) : null;
  const label = provider && provider !== '-' ? `Direct (${provider})` : 'Direct (RM)';

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
      <span>{label}</span>
      {isRefunded && <span className="text-[10px] text-rose-600 font-semibold">(Refunded)</span>}
    </span>
  );
};

const formatRm = (value) => {
  const amount = Number(value || 0);
  return `RM ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatTokens = (value) => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('en-US')} tokens`;
};

const OrderValueStack = ({ tokenValue, rmValue, align = 'items-start' }) => (
  <div className={`flex flex-col leading-tight ${align}`}>
    <span className="font-bold text-gray-900">{formatTokens(tokenValue)}</span>
    <span className="text-[11px] text-gray-500">{formatRm(rmValue)}</span>
  </div>
);
const ITEMS_PER_PAGE = 10;

const STATUSES = ["All Status", "Order Received", "Preparing", "Ready for Pickup", "Collected", "Cancelled", "Refunded"];
const PAYMENT_TYPES = ["All Payment Types", "Tokens", "Direct (RM)", "Refunded"];

// Sleek KPI Card matching DashboardHome & Menu standard
const KPICard = ({ title, value, badge, info, icon: Icon, iconBg, iconColor = "text-white" }) => (
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

// Date Picker Input 
const CustomDateInput = forwardRef(({ value, onClick, onClear }, ref) => (
  <div className="relative">
    <button
      ref={ref}
      onClick={(e) => { e.preventDefault(); onClick(e); }}
      className="peer flex items-center pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs whitespace-nowrap cursor-pointer transition-colors"
    >
      {value || 'Select Date'}
    </button>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      <ChevronDown size={14} className="text-gray-500 transition-transform duration-200 peer-focus:-rotate-180" />
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

// Order Detail Panel with Animated Timeline
const OrderDetailPanel = ({ order, onClose, onViewProfile }) => {
  const subtotal = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const total = Number(order.total ?? (subtotal - Number(order.discount || 0)));
  const tokenTotal = order.tokenAmountCharged ?? total;

  // Status mapping for the 4-step timeline flow
  const getStepProgress = (status) => {
    const norm = normalizeOrderStatus(status);
    switch (norm) {
      case "Collected":
        return 4;
      case "Ready for Pickup":
        return 3;
      case "Preparing":
        return 2;
      case "Order Received":
      default:
        return 1;
    }
  };

  const currentProgress = getStepProgress(order.status);

  const timelineSteps = [
    {
      step: 1,
      label: "Order Received",
      date: `${order.date} ${order.time}`,
      icon: ReceiptDocIcon,
      isDone: currentProgress >= 1,
      isActive: currentProgress === 1,
    },
    {
      step: 2,
      label: "Preparing",
      date: `${order.date} ${order.time}`,
      icon: MokaPotIcon,
      isDone: currentProgress >= 2,
      isActive: currentProgress === 2,
    },
    {
      step: 3,
      label: "Ready for Pickup",
      date: `${order.date} ${order.time}`,
      icon: SolidBagIcon,
      isDone: currentProgress >= 3,
      isActive: currentProgress === 3,
    },
    {
      step: 4,
      label: "Collected",
      date: `${order.date} ${order.time}`,
      icon: SolidCheckSquareIcon,
      isDone: currentProgress >= 4,
      isActive: currentProgress === 4,
    },
  ];

  return (
    <div className="print-section w-[360px] lg:w-[380px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col shrink-0 overflow-y-auto p-5 space-y-4 print:overflow-visible print:w-full">
      {/* Header */}
      <div className="border-b border-gray-100 pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-gray-900">Order Details</h2>
            <InfoTooltip content="Complete order summary, fulfillment lifecycle, and customer profile details." title="Order Details" />
          </div>
          <button onClick={onClose} className="no-print p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-bold text-gray-900">{order.id.replace("ORD-", "ORD -")}</p>
          {getStatusBadge(order.status)}
        </div>
        <p className="text-xs text-gray-400 mt-1">{order.date} · {order.time}</p>
      </div>

      {/* Customer Section */}
      <div>
        <span className="text-xs font-bold text-gray-900 uppercase tracking-wider block mb-2.5">Customer</span>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#2E5E58] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
              {order.customer ? order.customer.charAt(0).toUpperCase() : 'C'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900 truncate">{order.customer}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getTierColor(order.tier)}`}>
                  {order.tier}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{order.email}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Member ID: {order.memberId}</p>
            </div>
          </div>
          <button
            onClick={() => {
              const cups = order.tier === 'Legend' ? '35' : order.tier === 'Ketagih' ? '25' : order.tier === 'Dilamun' ? '15' : '5';
              onViewProfile({
                username: order.customer,
                email: order.email,
                phone: order.phone,
                orders: cups,
              });
            }}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs transition-all whitespace-nowrap cursor-pointer"
          >
            View Profile
          </button>
        </div>
      </div>

      {/* Outlet */}
      <div className="flex items-center justify-between py-2 border-y border-gray-50">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Outlet</span>
        <span className="text-xs font-bold text-[#1E433A] bg-[#E8F3F0] px-2.5 py-0.5 rounded-full">{order.storeName || 'Not recorded'}</span>
      </div>

      {/* Order Items Section */}
      <div>
        <span className="text-xs font-bold text-gray-900 uppercase tracking-wider block mb-2.5">Order Items</span>
        <div className="space-y-3">
          {order.items.map((item, i) => {
            const customizations = itemCustomizationRows(item);
            return (
              <div key={i} className="flex flex-col pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center bg-gray-50 rounded-xl p-1 border border-gray-100">
                      <img
                        src={item.img}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-xs font-bold text-gray-900">{item.name}</p>
                      {item.orderType && (
                        <span className="inline-flex items-center mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-gray-100 text-gray-600 w-fit">
                          {item.orderType}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <p className="text-xs font-bold text-gray-900">{formatRm(item.unitPrice * item.qty)}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Qty: {item.qty}</p>
                  </div>
                </div>

                {/* Customizations */}
                {customizations.length > 0 && (
                  <div className="mt-2 ml-11 pl-2.5 border-l-2 border-gray-100">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {customizations.map((customization, customizationIndex) => (
                        <div key={`${customization.label}-${customization.value}-${customizationIndex}`} className="flex flex-col">
                          <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">{customization.label || 'Option'}</span>
                          <span className="text-[11px] font-semibold text-gray-800">{customization.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remarks */}
                {item.remarks && (
                  <div className="mt-2 ml-11 pl-2.5 border-l-2 border-amber-300">
                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">Remarks</span>
                    <p className="text-[11px] font-medium text-gray-800 mt-0.5">{item.remarks}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Subtotal</span>
            <span>{formatRm(subtotal)}</span>
          </div>
          {Number(order.discount || 0) > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 font-medium">
              <span>Discount</span>
              <span>-{formatRm(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-gray-900 pt-1">
            <span>Total</span>
            <OrderValueStack tokenValue={tokenTotal} rmValue={total} align="items-end" />
          </div>
        </div>
      </div>

      {/* Payment Section */}
      <div className="border-t border-gray-50 pt-3">
        <span className="text-xs font-bold text-gray-900 uppercase tracking-wider block mb-2">Payment Type</span>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#2E5E58] flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Coins size={14} strokeWidth={2.3} />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-900 block">
                {(order.paymentMode || '').toLowerCase() === 'token' ? 'Loyalty Tokens' : 'Direct Payment (RM)'}
              </span>
              {order.paymentProvider && formatPaymentLabel(order.paymentProvider) !== '-' && (
                <span className="text-[10px] text-gray-400 block">{formatPaymentLabel(order.paymentProvider)}</span>
              )}
            </div>
          </div>
          {getPaymentTypeBadge(order)}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          Reference: <span className="text-gray-700 font-medium">{order.txnId}</span>
        </p>
      </div>

      {/* Order Status Timeline */}
      <div className="border-t border-gray-50 pt-3">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Order Status Timeline</h3>

        <div className="relative pl-1">
          {/* Animated Connecting Flow Line */}
          <div className="absolute left-[13px] top-3 bottom-4 w-0.5 bg-gray-200 overflow-hidden">
            <div
              className="w-full bg-[#2E5E58] transition-all duration-700 ease-out"
              style={{ height: `${Math.min(100, (currentProgress / 4) * 100)}%` }}
            />
            {/* Top-to-bottom pulse flow animation */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#2E5E58]/80 to-transparent w-full h-1/2 animate-[pulseFlow_2s_ease-in-out_infinite]" />
          </div>

          <div className="space-y-3.5">
            {timelineSteps.map((step) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={step.step}
                  className={`flex items-center justify-between transition-all duration-300 relative ${step.isDone ? "text-gray-900" : "text-gray-400"
                    }`}
                >
                  <div className="flex items-center gap-3 relative z-10 bg-white pr-2">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 ${step.isDone
                        ? "text-black scale-100"
                        : "text-gray-300"
                        } ${step.isActive ? "animate-pulse ring-2 ring-[#2E5E58]/20" : ""}`}
                    >
                      <StepIcon size={16} />
                    </div>
                    <span className={`text-xs ${step.isDone ? "text-gray-900 font-bold" : "text-gray-400"}`}>
                      {step.label}
                    </span>
                  </div>
                  <span className={`text-[10px] font-medium ${step.isDone ? "text-gray-700" : "text-gray-300"}`}>
                    {step.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Print Receipt Button */}
      <div className="no-print pt-2 mt-auto">
        <button
          onClick={() => window.print()}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs transition-all cursor-pointer"
        >
          <Printer size={14} /> Print Receipt
        </button>
      </div>
    </div>
  );
};

// Main Component 

const Orders = ({ initialShowRefunds = false, onBackToOrders, currentUser }) => {
  const [ordersList, setOrdersList] = useState([]);
  const [, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [paymentFilter, setPaymentFilter] = useState("All Payment Types");
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showRefundsView, setShowRefundsView] = useState(initialShowRefunds);
  const [viewingProfileFor, setViewingProfileFor] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusOpen, setStatusOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [sortKey, setSortKey] = useState("time");
  const [sortDirection, setSortDirection] = useState("desc");

  useEffect(() => {
    setShowRefundsView(initialShowRefunds);
  }, [initialShowRefunds]);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async ({ keepSelection = false, silent = false } = {}) => {
      try {
        setLoadError('');
        if (!silent) {
          setIsLoading(true);
        }
        const response = await adminRequest(`/v1/admin/orders${selectedStoreId ? `?store_id=${encodeURIComponent(selectedStoreId)}` : ''}`);
        if (!isMounted) return;

        const nextOrders = Array.isArray(response?.orders) ? response.orders : [];
        setOrdersList(nextOrders);

        if (keepSelection) {
          setSelectedOrder((prev) => {
            if (!prev) return null;
            return nextOrders.find((order) => order.id === prev.id) || null;
          });
        }
      } catch (err) {
        console.error('Failed to fetch orders', err);
        if (isMounted) {
          setLoadError(err?.message || 'Unable to load orders. Check the connection and try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchOrders();

    const refreshOrders = () => {
      fetchOrders({ keepSelection: true, silent: true });
    };

    const intervalId = window.setInterval(refreshOrders, 30000);
    const handleFocus = () => refreshOrders();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshOrders();
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
  }, [selectedStoreId]);

  const resetPage = () => setCurrentPage(1);

  const filtered = useMemo(() => {
    return ordersList.filter((o) => {
      const q = search.toLowerCase();
      const matchSearch =
        o.id.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q);

      const normStatus = normalizeOrderStatus(o.status);
      const matchStatus = statusFilter === "All Status" || normStatus === statusFilter;

      const isToken = (o.paymentMode || o.payment || '').toLowerCase() === 'token';
      const isDirect = (o.paymentMode || o.payment || '').toLowerCase() === 'direct';
      const isRefund = o.paymentStatus === 'Refunded' || o.paymentStatus === 'Refund' || normStatus === 'Refunded';

      const matchPayment = (() => {
        if (paymentFilter === "All Payment Types" || paymentFilter === "All Payment Status") return true;
        if (paymentFilter === "Tokens") return isToken;
        if (paymentFilter === "Direct (RM)") return isDirect;
        if (paymentFilter === "Refunded") return isRefund;
        return true;
      })();

      let matchDate = true;
      if (selectedDate) {
        const fmt = selectedDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        matchDate =
          o.date === fmt ||
          o.date.includes(
            selectedDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          );
      }
      return matchSearch && matchStatus && matchPayment && matchDate;
    });
  }, [ordersList, search, statusFilter, paymentFilter, selectedDate]);

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const sortedOrders = useMemo(() => {
    if (!sortKey || !sortDirection) return filtered;

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "id") {
        comparison = (a.id || "").localeCompare(b.id || "", undefined, { numeric: true, sensitivity: "base" });
      } else if (sortKey === "customer") {
        comparison = (a.customer || "").localeCompare(b.customer || "", undefined, { sensitivity: "base" });
      } else if (sortKey === "store") {
        comparison = (a.storeName || "").localeCompare(b.storeName || "", undefined, { sensitivity: "base" });
      } else if (sortKey === "items") {
        const countA = (a.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
        const countB = (b.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
        comparison = countA - countB;
      } else if (sortKey === "total") {
        const totalA = Number(a.total || 0);
        const totalB = Number(b.total || 0);
        comparison = totalA - totalB;
      } else if (sortKey === "status") {
        const statusA = normalizeOrderStatus(a.status);
        const statusB = normalizeOrderStatus(b.status);
        comparison = statusA.localeCompare(statusB, undefined, { sensitivity: "base" });
      } else if (sortKey === "payment" || sortKey === "paymentType") {
        const modeA = (a.paymentMode || a.payment || "").toLowerCase();
        const modeB = (b.paymentMode || b.payment || "").toLowerCase();
        comparison = modeA.localeCompare(modeB, undefined, { sensitivity: "base" });
      } else if (sortKey === "time") {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = timeA - timeB;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filtered, sortKey, sortDirection]);

  if (showRefundsView) {
    return (
      <RefundDetails
        currentUser={currentUser}
        selectedStoreId={selectedStoreId}
        onStoreChange={setSelectedStoreId}
        onBack={() => {
          if (onBackToOrders) {
            onBackToOrders();
          }
          setShowRefundsView(false);
        }}
      />
    );
  }

  if (viewingProfileFor) {
    return (
      <ViewProfile 
        customer={viewingProfileFor} 
        onBack={() => setViewingProfileFor(null)} 
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / ITEMS_PER_PAGE));
  const paginated = sortedOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // KPI counts based on active list
  const totalCount = ordersList.length;
  const collected = ordersList.filter(o => normalizeOrderStatus(o.status) === "Collected").length;
  const cancelled = ordersList.filter(o => normalizeOrderStatus(o.status) === "Cancelled").length;
  const refunds = ordersList.filter(o => {
    const s = normalizeOrderStatus(o.status);
    return s === "Refund Requested" || s === "Refunded";
  }).length;

  const SortableHeader = ({ label, columnKey, info, className = "" }) => {
    const isSorted = sortKey === columnKey;
    return (
      <th className={`px-6 py-3.5 font-bold text-[11px] text-gray-500 uppercase tracking-wider whitespace-nowrap ${className}`}>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSort(columnKey)}
            className={`group inline-flex items-center gap-1.5 hover:text-[#2E5E58] cursor-pointer focus:outline-none transition-colors select-none ${
              isSorted ? "text-[#2E5E58] font-bold" : ""
            }`}
            title={`Sort by ${label} ${isSorted && sortDirection === "asc" ? "(Descending)" : "(Ascending)"}`}
          >
            <span>{label}</span>
            <span className="inline-flex items-center">
              {isSorted ? (
                sortDirection === "asc" ? (
                  <ArrowUp size={13} className="text-[#2E5E58]" strokeWidth={2.5} />
                ) : (
                  <ArrowDown size={13} className="text-[#2E5E58]" strokeWidth={2.5} />
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
  };

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
      {/* Page Title & Subtitle */}
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <InfoTooltip
              content="Real-time order feed across all cafe outlets. Track preparation, payment settlement, customer details, and print receipts."
              title="Orders Management"
            />
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            Live order fulfillment, ticket progress, and transaction history.
          </p>
        </div>
      </div>
      {loadError && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 shadow-2xs">{loadError}</div>}

      {/* Operational KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 mb-6 shrink-0 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Total Orders"
          value={totalCount}
          badge="Live Feed"
          info="Total orders recorded across all outlets."
          icon={ShoppingBag}
          iconBg="bg-[#1F3A34]"
          iconColor="text-white"
        />
        <KPICard
          title="Collected"
          value={collected}
          badge={`${totalCount > 0 ? ((collected / totalCount) * 100).toFixed(0) : 0}% Done`}
          info="Orders successfully prepared and collected by customers."
          icon={Clock}
          iconBg="bg-[#2E5E58]"
          iconColor="text-white"
        />
        <KPICard
          title="Cancelled"
          value={cancelled}
          badge={cancelled > 0 ? `${cancelled} voided` : 'Zero'}
          info="Orders cancelled by the customer or counter before preparation."
          icon={Ban}
          iconBg="bg-[#E07A5F]"
          iconColor="text-white"
        />
        <KPICard
          title="Refunds"
          value={refunds}
          badge={refunds > 0 ? `${refunds} requests` : 'None'}
          info="Orders currently under refund request or already refunded."
          icon={RotateCcw}
          iconBg="bg-[#8C6D53]"
          iconColor="text-white"
        />
      </div>

      {/* Filters and Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 shrink-0">
        <OutletFilter value={selectedStoreId} onChange={(value) => { setSelectedStoreId(value); resetPage(); }} />
        {/* Search */}
        <div className="relative w-full max-w-[380px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search order ID, username or email..."
            className="block w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-xl focus:border-[#2E5E58] outline-none text-xs bg-white shadow-2xs"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}
              onFocus={() => setStatusOpen(true)}
              onBlur={() => setStatusOpen(false)}
              className="pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer shadow-2xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Payment Dropdown */}
          <div className="relative">
            <select
              value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value); resetPage(); }}
              onFocus={() => setPaymentOpen(true)}
              onBlur={() => setPaymentOpen(false)}
              className="pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer shadow-2xs"
            >
              {PAYMENT_TYPES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${paymentOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Date Picker */}
          <div className="relative">
            <DatePicker portalId="root-portal" popperPlacement="bottom-end"
              selected={selectedDate}
              onChange={(d) => { setSelectedDate(d); resetPage(); }}
              customInput={<CustomDateInput onClear={() => { setSelectedDate(null); resetPage(); }} />}
              dateFormat="MMM d, yyyy"
            />
          </div>

          <button
            onClick={() => setShowRefundsView(true)}
            className="flex items-center px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs transition-all whitespace-nowrap cursor-pointer"
          >
            View Refunds
          </button>
        </div>
      </div>

      {/* Main Content Area: Table + Side Details Panel */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        {/* Orders Table Container */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0">
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
              <thead className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <SortableHeader label="Order ID" columnKey="id" />
                  <SortableHeader label="Username" columnKey="customer" />
                  <SortableHeader label="Outlet" columnKey="store" />
                  <SortableHeader label="Items" columnKey="items" />
                  <SortableHeader label="Total" columnKey="total" info="Order amount charged in Loyalty Tokens and MYR." />
                  <SortableHeader label="Status" columnKey="status" info="Live order fulfillment stage." />
                  <SortableHeader label="Payment Type" columnKey="paymentType" info="Payment method used: Loyalty Tokens or Direct RM." />
                  <SortableHeader label="Time" columnKey="time" info="Order timestamp (latest first by default)." />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginated.length > 0 ? (
                  paginated.map((order) => {
                    const isSelected = selectedOrder?.id === order.id;
                    const itemsLabel = order.items.map((i) => `${i.qty}x ${i.name}`).join(", ");
                    const rowSubtotal = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
                    const rowTotal = Number(order.total ?? (rowSubtotal - Number(order.discount || 0)));
                    const rowTokenTotal = order.tokenAmountCharged ?? rowTotal;

                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? "bg-gray-50" : ""}`}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <td className="px-6 py-3.5 whitespace-nowrap text-xs font-bold text-gray-900">
                          {order.id}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-[#2E5E58] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs">
                              {order.customer ? order.customer.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div className="ml-3">
                              <div className="text-xs font-bold text-gray-900">{order.customer}</div>
                              <div className="text-[10px] text-gray-400">{order.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-xs text-gray-700 font-medium">{order.storeName || '-'}</td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-xs text-gray-800 font-medium max-w-[220px] truncate" title={itemsLabel}>
                          {itemsLabel}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-xs font-bold text-gray-900">
                          <OrderValueStack tokenValue={rowTokenTotal} rmValue={rowTotal} />
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          {getPaymentTypeBadge(order)}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-xs text-gray-500 font-medium">
                          {order.time}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-10 text-center text-gray-500 text-xs">
                      No orders found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Bottom: Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4 shrink-0 bg-white">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={sortedOrders.length}
              itemName="orders"
            />
            <button
              onClick={() => {
                const rows = [
                  ["Order ID", "Username", "Email", "Outlet", "Status", "Payment Type", "Date", "Time", "Total (Tokens)", "Total (RM)"],
                  ...sortedOrders.map(o => {
                    const subtotal = o.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
                    const rmTotal = Number(o.total ?? (subtotal - Number(o.discount || 0)));
                    const tokenTotal = o.tokenAmountCharged ?? rmTotal;
                    const paymentLabel = (o.paymentMode || '').toLowerCase() === 'token' ? 'Tokens' : 'Direct (RM)';
                    return [`"${o.id}"`, `"${o.customer}"`, `"${o.email}"`, `"${o.storeName || ''}"`, `"${normalizeOrderStatus(o.status)}"`, `"${paymentLabel}"`, `"${o.date}"`, `"${o.time}"`, `"${formatTokens(tokenTotal)}"`, `"${formatRm(rmTotal)}"`];
                  })
                ];
                exportToCSV(rows, "orders.csv");
              }}
              className="flex items-center px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs whitespace-nowrap cursor-pointer transition-all"
            >
              <Download size={14} className="mr-1.5" /> Export
            </button>
          </div>
        </div>

        {/* Right Side: Order Detail Panel */}
        {selectedOrder && (
          <OrderDetailPanel
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onViewProfile={setViewingProfileFor}
          />
        )}
      </div>

    </div>
  );
};

export default Orders;
