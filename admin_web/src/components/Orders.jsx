import React, { useState, forwardRef, useEffect } from "react";
import {
  Search, Filter, ChevronDown, Download, CheckCircle, Clock, CheckCircle2,
  MapPin, Phone, MessageSquare, Printer, Receipt, Eye, Share2, CornerUpLeft, MessageCircle,
  X, ShoppingBag, Ban, RotateCcw, XCircle,
  Coins, Wallet, Users, Package, Square,
  FileText, CheckSquare, ArrowUp, Edit3, Navigation, Plus
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Pagination from './Pagination';
import { exportToCSV } from '../utils/exportToCSV';
import RefundDetails from "./RefundDetails";
import ViewProfile from "./ViewProfile";
import { adminRequest } from '../lib/adminApi';
import { formatPaymentLabel } from '../utils/reporting';

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

// Helpers matching Customers Page

const getTierColor = (tier) => {
  switch (tier) {
    case "Kawan": return "bg-blue-100 text-blue-600";
    case "Dilamun": return "bg-[#E07A5F]/15 text-[#E07A5F]";
    case "Ketagih": return "bg-purple-100 text-purple-600";
    case "Legend": return "bg-[#D4AF7A]/20 text-[#A8824A]";
    default: return "bg-gray-100 text-gray-600";
  }
};

const getStatusBadge = (s) => {
  switch (s) {
    case "Completed":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-green-100 text-green-600">Completed</span>;
    case "Preparing":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-[#E07A5F]/15 text-[#E07A5F]">Preparing</span>;
    case "Ready for Pickup":
    case "Ready":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-blue-100 text-blue-600">Ready</span>;
    case "Cancelled":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-red-100 text-red-600">Cancelled</span>;
    case "Refund Requested":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-purple-100 text-purple-600">Refund Requested</span>;
    case "Refunded":
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-amber-100 text-amber-700">Refunded</span>;
    default:
      return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-gray-100 text-gray-600">{s}</span>;
  }
};

const getPaymentBadge = (p) => {
  const normalized = String(p || '').trim().toLowerCase();

  if (!normalized) {
    return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-gray-100 text-gray-600">-</span>;
  }

  if (normalized === "refunded" || normalized === "refund") {
    return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-red-100 text-red-600">Refunded</span>;
  }
  return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-green-100 text-green-600">{formatPaymentLabel(p) || 'Paid'}</span>;
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

const STATUSES = ["All Status", "Completed", "Preparing", "Ready for Pickup", "Cancelled", "Refund Requested", "Refunded"];
const PAYMENTS = ["All Payment Status", "Paid", "Refunded"];

// KPI Card matching Customers Page Structure

const KPICard = ({ title, value, change, icon: Icon, iconBg, iconColor = "text-white", className = "" }) => (
  <div className={`bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0 ${className}`}>
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

// Order Detail Panel with Animated Timelie

const OrderDetailPanel = ({ order, onClose, onViewProfile }) => {
  const subtotal = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const total = Number(order.total ?? (subtotal - Number(order.discount || 0)));
  const tokenTotal = order.tokenAmountCharged ?? total;

  // Status mapping for the 4-step timeline flow
  const getStepProgress = (status) => {
    switch (status) {
      case "Completed":
        return 4;
      case "Ready for Pickup":
      case "Ready":
        return 3;
      case "Preparing":
        return 2;
      case "Order Received":
      case "Refund Requested":
      case "Refunded":
      case "Cancelled":
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
      label: "Completed",
      date: `${order.date} ${order.time}`,
      icon: SolidCheckSquareIcon,
      isDone: currentProgress >= 4,
      isActive: currentProgress === 4,
    },
  ];

  return (
    <div className="print-section w-[360px] lg:w-[380px] bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col shrink-0 overflow-y-auto p-5 space-y-4 print:overflow-visible print:w-full">
      {/* Header */}
      <div className="border-b border-gray-100 pb-3">
        <div className="flex justify-between items-start">
          <h2 className="text-base font-bold text-gray-900">Order Details</h2>
          <button onClick={onClose} className="no-print text-gray-400 hover:text-gray-900 cursor-pointer">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-bold text-gray-900">{order.id.replace("ORD-", "ORD -")}</p>
          {getStatusBadge(order.status)}
        </div>
        <p className="text-xs text-gray-500 mt-1">{order.date} – {order.time}</p>
      </div>

      {/* Customer Section with Plain Green Circle matching Customers Page */}
      <div>
        <p className="text-xs font-bold text-gray-900 mb-2.5">Username</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-full bg-[#2E5E58] shrink-0 shadow-sm"></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900 truncate">{order.customer}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getTierColor(order.tier)}`}>
                  {order.tier}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{order.email}</p>
              <p className="text-xs text-gray-500">{order.phone}</p>
              <p className="text-xs text-gray-700 font-medium mt-0.5">Member ID : {order.memberId}</p>
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
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            View Profile
          </button>
        </div>
      </div>

      {/* Order Items Section */}
      <div>
        <p className="text-xs font-bold text-gray-900 mb-1">Prepared By</p>
        <p className="text-sm font-semibold text-[#1F3A34]">
          {order.baristaName || 'Not assigned yet'}
        </p>
        {order.baristaUsername && (
          <p className="text-xs text-gray-500 mt-0.5">@{order.baristaUsername}</p>
        )}
      </div>

      {/* Order Items Section */}
      <div>
        <p className="text-xs font-bold text-gray-900 mb-2.5">Order Items</p>
        <div className="space-y-4">
          {order.items.map((item, i) => (
            <div key={i} className="flex flex-col pb-4 border-b border-gray-50 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-gray-50 rounded-lg p-1 border border-gray-100">
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
                    <p className="text-sm font-bold text-gray-900">{item.name}</p>
                    {item.orderType && (
                      <span className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 w-fit">
                        {item.orderType}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-sm font-bold text-gray-900">{formatRm(item.unitPrice * item.qty)}</p>
                  <p className="text-xs text-gray-500 font-medium">Qty: {item.qty}</p>
                </div>
              </div>

              {/* Customizations Grid */}
              {(item.bean || item.espressoShot || item.temperature || item.sparkling || item.milk || item.sweetness || item.iceLevel) && (
                <div className="mt-3 ml-13 pl-3 border-l-2 border-gray-100">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {item.bean && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Bean</span>
                        <span className="text-xs font-semibold text-gray-800">{item.bean}</span>
                      </div>
                    )}
                    {item.espressoShot && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Shot(s)</span>
                        <span className="text-xs font-semibold text-gray-800">{item.espressoShot}</span>
                      </div>
                    )}
                    {item.temperature && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Temp</span>
                        <span className="text-xs font-semibold text-gray-800">{item.temperature}</span>
                      </div>
                    )}
                    {item.sparkling && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Sparkling</span>
                        <span className="text-xs font-semibold text-gray-800">{item.sparkling}</span>
                      </div>
                    )}
                    {item.milk && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Milk</span>
                        <span className="text-xs font-semibold text-gray-800">{item.milk}</span>
                      </div>
                    )}
                    {item.sweetness && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Sweetness</span>
                        <span className="text-xs font-semibold text-gray-800">{item.sweetness}</span>
                      </div>
                    )}
                    {item.iceLevel && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Ice Level</span>
                        <span className="text-xs font-semibold text-gray-800">{item.iceLevel}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {item.remarks && (
                <div className="mt-2 ml-13 pl-3 border-l-2 border-amber-200">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Remarks</span>
                  <p className="text-xs font-medium text-gray-800 mt-0.5">{item.remarks}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Subtotal</span>
            <span>{formatRm(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Discount</span>
            <span>{formatRm(order.discount)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1">
            <span>Total</span>
            <OrderValueStack tokenValue={tokenTotal} rmValue={total} align="items-end" />
          </div>
        </div>
      </div>

      {/* Payment Section */}
      <div>
      <p className="text-xs font-bold text-gray-900 mb-2.5">Checkout</p>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2E5E58] flex items-center justify-center text-white shrink-0 shadow-sm">
              <Coins size={15} strokeWidth={2.3} />
            </div>
            <span className="text-xs font-semibold text-gray-900">
              {formatPaymentLabel(order.paymentMode)}
            </span>
          </div>
          {getPaymentBadge(order.paymentStatus)}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Transaction Reference &nbsp;<span className="text-gray-700 font-medium">{order.txnId}</span>
        </p>
      </div>

      {/* Order Status Timeline matching Image 2 with Flow Animation */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Order Status Timeline</h3>

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

          <div className="space-y-4">
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
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-all duration-300 ${step.isDone
                        ? "text-black scale-100"
                        : "text-gray-300"
                        } ${step.isActive ? "animate-pulse ring-2 ring-[#2E5E58]/20 rounded-md" : ""}`}
                    >
                      <StepIcon size={18} />
                    </div>
                    <span className={`text-xs font-semibold ${step.isDone ? "text-black font-bold" : "text-gray-400"}`}>
                      {step.label}
                    </span>
                  </div>
                  <span className={`text-[11px] font-medium ${step.isDone ? "text-gray-900" : "text-gray-400"}`}>
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
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <Printer size={15} /> Print Receipt
        </button>
      </div>
    </div>
  );
};

// Main Component 

const Orders = ({ initialShowRefunds = false, onBackToOrders }) => {
  const [ordersList, setOrdersList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [paymentFilter, setPaymentFilter] = useState("All Payment Status");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showRefundsView, setShowRefundsView] = useState(initialShowRefunds);
  const [viewingProfileFor, setViewingProfileFor] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusOpen, setStatusOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    setShowRefundsView(initialShowRefunds);
  }, [initialShowRefunds]);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async ({ keepSelection = false, silent = false } = {}) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        const response = await adminRequest('/v1/admin/orders');
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
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  if (showRefundsView) {
    return (
      <RefundDetails
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

  const resetPage = () => setCurrentPage(1);

  const filtered = ordersList.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch =
      o.id.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All Status" || o.status === statusFilter;
    const matchPayment =
      paymentFilter === "All Payment Status" ||
      o.paymentStatus === paymentFilter ||
      (paymentFilter === "Refunded" && (o.paymentStatus === "Refunded" || o.paymentStatus === "Refund"));
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // KPI counts based on active list
  const totalCount = ordersList.length;
  const completed = ordersList.filter(o => o.status === "Completed").length;
  const cancelled = ordersList.filter(o => o.status === "Cancelled").length;
  const refunds = ordersList.filter(o => o.status === "Refund Requested" || o.status === "Refunded").length;

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
      {/* Page Title & Subtitle */}
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500">Manage customer orders and track their status.</p>
      </div>

      {/* Operational totals only. Workflow stages remain available in the status filter. */}
      <div className="grid grid-cols-1 gap-3.5 mb-6 shrink-0 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Total Orders"
          value={totalCount}
          icon={ShoppingBag}
          iconBg="bg-[#1F3A34]"
          iconColor="text-white"
          className="min-w-0"
        />
        <KPICard
          title="Completed"
          value={completed}
          icon={Clock}
          iconBg="bg-[#2E5E58]"
          iconColor="text-white"
          className="min-w-0"
        />
        <KPICard
          title="Cancelled"
          value={cancelled}
          icon={Ban}
          iconBg="bg-[#E07A5F]"
          iconColor="text-white"
          className="min-w-0"
        />
        <KPICard
          title="Refunds"
          value={refunds}
          icon={RotateCcw}
          iconBg="bg-[#D9C4A9]"
          iconColor="text-white"
          className="min-w-0"
        />
      </div>

      {/* Filters and Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 shrink-0">
        {/* Search */}
        <div className="relative w-full max-w-[400px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search order ID, username or email..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-[#2E5E58] focus:border-[#2E5E58] text-sm"
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

          {/* Payment Dropdown */}
          <div className="relative transition-transform duration-200 peer-focus:-rotate-180">
            <select
              value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value); resetPage(); }}
              onFocus={() => setPaymentOpen(true)}
              onBlur={() => setPaymentOpen(false)}
              className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
            >
              {PAYMENTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${paymentOpen ? 'rotate-180' : ''}`} />
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

          {/* Export & Action Buttons */}
          <button
            onClick={() => {
              const rows = [
                ["Order ID", "Username", "Email", "Barista", "Status", "Payment Status", "Date", "Time", "Total (Tokens)", "Total (RM)"],
                ...filtered.map(o => {
                  const subtotal = o.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
                  const rmTotal = Number(o.total ?? (subtotal - Number(o.discount || 0)));
                  const tokenTotal = o.tokenAmountCharged ?? rmTotal;
                  return [
                    `"${o.id}"`,
                    `"${o.customer}"`,
                    `"${o.email}"`,
                    `"${o.baristaName || ''}"`,
                    `"${o.status}"`,
                    `"${o.paymentStatus}"`,
                    `"${o.date}"`,
                    `"${o.time}"`,
                    `"${formatTokens(tokenTotal)}"`,
                    `"${formatRm(rmTotal)}"`
                  ];
                })
              ];
              exportToCSV(rows, "orders.csv");
            }}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer lg:ml-2"
          >
            <Download size={16} className="mr-2" /> Export
          </button>
          <button
            onClick={() => setShowRefundsView(true)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
          >
            View Refunds
          </button>
        </div>
      </div>

      {/* Main Content Area: Table + Side Details Panel */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        {/* Orders Table Container */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0">
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  {["Order ID", "Username", "Items", "Total", "Barista", "Status", "Payment", "Time", "Actions"].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-gray-900">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginated.length > 0 ? (
                  paginated.map((order, idx) => {
                    const isSelected = selectedOrder?.id === order.id;
                    const itemsLabel = order.items.map((i) => `${i.qty}x ${i.name}`).join(", ");
                    const rowSubtotal = order.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
                    const rowTotal = Number(order.total ?? (rowSubtotal - Number(order.discount || 0)));
                    const rowTokenTotal = order.tokenAmountCharged ?? rowTotal;

                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? "bg-gray-50" : ""}`}
                        onClick={() => setSelectedOrder(isSelected ? null : order)}
                      >
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {order.id}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-[#2E5E58] shrink-0 shadow-sm"></div>
                            <div className="ml-4">
                              <div className="text-sm font-bold text-gray-900">{order.customer}</div>
                              <div className="text-xs text-gray-500">{order.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {itemsLabel}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                          <OrderValueStack tokenValue={rowTokenTotal} rmValue={rowTotal} />
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">
                          {order.baristaName || 'Unassigned'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          {getPaymentBadge(order.paymentStatus)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 font-medium">
                          {order.time}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(isSelected ? null : order);
                            }}
                            className="bg-[#1E293B] hover:bg-[#0F172A] text-white px-2.5 py-1.5 rounded-lg inline-flex items-center shadow-sm transition-colors cursor-pointer"
                            title="View order details"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500 text-sm">
                      No orders found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Bottom: Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex shrink-0 bg-white">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filtered.length}
              itemName="orders"
            />
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
