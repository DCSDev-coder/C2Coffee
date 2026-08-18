import React, { useState, useEffect, forwardRef } from "react";
import {
  Search, ChevronDown, Download, Plus,
  Eye, Edit3, MoreVertical, X, Copy,
  Trash2, ArrowLeft, Percent, Gift,
  CreditCard, Tag, Users, Check, Clock, ArrowUp
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Pagination from './Pagination';
import VouchersAnalytics from "./VouchersAnalytics";

const CustomDateInput = forwardRef(({ value, onClick, onClear }, ref) => (
  <div className="relative">
    <button
      ref={ref}
      onClick={(e) => { e.preventDefault(); onClick(e); }}
      className="flex items-center pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer"
    >
      {value || "Select Date"}
    </button>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      <ChevronDown size={16} className="text-gray-500" />
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

// ─── Stat Card Component (Matched to Customers & Orders KPICard) ─────────────
const StatCard = ({ title, value, change, icon: Icon, iconBg, iconColor = "text-white" }) => (
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

// ─── Dummy Data for Vouchers ───────────────────────────────────────────────────
const initialVouchersList = [
  {
    id: "VCH-1001",
    name: "Free Latte",
    type: "Free Drink",
    tier: "All Tiers",
    reward: "Free Latte",
    expiry: "31 December 2026",
    expiryFull: "31 December 2026, 11:59 PM",
    status: "Active",
    issued: 1230,
    redeemed: 1180,
    totalQty: 2000,
    rate: "61.5%",
    limitPerUser: 1,
    description: "Redeem a free Latte (Hot/Cold) at any time",
    created: "15 Jan 2026"
  },
  {
    id: "VCH-1002",
    name: "15% Off Total Bill",
    type: "Percentage Off",
    tier: "All Tiers",
    reward: "15% Discount",
    expiry: "31 December 2026",
    expiryFull: "31 December 2026, 11:59 PM",
    status: "Expired",
    issued: 2000,
    redeemed: 2000,
    totalQty: 2000,
    rate: "100%",
    limitPerUser: 1,
    description: "Enjoy 15% discount on all drinks and food items.",
    created: "10 Jan 2026"
  },
  {
    id: "VCH-1003",
    name: "RM 5 Instant Discount",
    type: "Token Discount",
    tier: "All Tiers",
    reward: "RM 5 Off",
    expiry: "31 December 2026",
    expiryFull: "31 December 2026, 11:59 PM",
    status: "Active",
    issued: 1230,
    redeemed: 980,
    totalQty: 2000,
    rate: "61.5%",
    limitPerUser: 2,
    description: "Instant RM 5 discount on orders above RM 25.",
    created: "18 Jan 2026"
  },
  {
    id: "VCH-1004",
    name: "Buy 1 Free 1 Shakerato",
    type: "Free Drink",
    tier: "All Tiers",
    reward: "Buy 1 Free 1",
    expiry: "31 December 2026",
    expiryFull: "31 December 2026, 11:59 PM",
    status: "Active",
    issued: 1230,
    redeemed: 890,
    totalQty: 2000,
    rate: "61.5%",
    limitPerUser: 1,
    description: "Buy 1 Shakerato Bianco and get 1 free.",
    created: "20 Jan 2026"
  },
  {
    id: "VCH-1005",
    name: "Welcome 10% OFF",
    type: "Percentage Off",
    tier: "All Tiers",
    reward: "10% Discount",
    expiry: "31 December 2026",
    expiryFull: "31 December 2026, 11:59 PM",
    status: "Active",
    issued: 1230,
    redeemed: 1040,
    totalQty: 2000,
    rate: "61.5%",
    limitPerUser: 1,
    description: "Welcome voucher for newly registered app users.",
    created: "22 Jan 2026"
  },
  {
    id: "VCH-1006",
    name: "Free Cinnamon Roll",
    type: "Free Food",
    tier: "All Tiers",
    reward: "Free Pastry",
    expiry: "31 December 2026",
    expiryFull: "31 December 2026, 11:59 PM",
    status: "Active",
    issued: 1230,
    redeemed: 760,
    totalQty: 2000,
    rate: "61.5%",
    limitPerUser: 1,
    description: "Complimentary warm cinnamon roll with any beverage.",
    created: "25 Jan 2026"
  },
  {
    id: "VCH-1007",
    name: "Legend Tier Exclusive Drink",
    type: "Free Drink",
    tier: "Legend",
    reward: "Free Specialty Drink",
    expiry: "31 December 2026",
    expiryFull: "31 December 2026, 11:59 PM",
    status: "Active",
    issued: 1230,
    redeemed: 1120,
    totalQty: 2000,
    rate: "61.5%",
    limitPerUser: 2,
    description: "Exclusive reward for Legend Tier members.",
    created: "28 Jan 2026"
  },
  {
    id: "VCH-1008",
    name: "Morning Boost 20% OFF",
    type: "Percentage Off",
    tier: "All Tiers",
    reward: "20% Discount",
    expiry: "31 December 2026",
    expiryFull: "31 December 2026, 11:59 PM",
    status: "Active",
    issued: 1230,
    redeemed: 990,
    totalQty: 2000,
    rate: "61.5%",
    limitPerUser: 1,
    description: "20% discount on coffee orders before 10:30 AM.",
    created: "30 Jan 2026"
  }
];

const VOUCHER_TYPES = ["All Type", "Free Drink", "Percentage Off", "Token Discount", "Free Food", "Cash Voucher"];
const STATUS_TYPES = ["All Status", "Active", "Expired", "Draft"];
const ITEMS_PER_PAGE = 10;

const Vouchers = ({ onBack }) => {
  const [vouchers, setVouchers] = useState(initialVouchersList);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Type");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selectedDate, setSelectedDate] = useState(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("Details");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);

  // New Voucher Form State
  const [newVoucher, setNewVoucher] = useState({
    name: "",
    type: "Free Drink",
    tier: "All Tiers",
    reward: "",
    expiry: "31 December 2026",
    totalQty: 1000,
    limitPerUser: 1,
    description: ""
  });

  useEffect(() => {
    const handleClickOutside = () => setActionMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  if (showAnalytics) {
    return <VouchersAnalytics onBack={() => setShowAnalytics(false)} />;
  }

  const resetPage = () => setCurrentPage(1);

  const filtered = vouchers.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch =
      v.name.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      v.reward.toLowerCase().includes(q) ||
      v.type.toLowerCase().includes(q);
    const matchType = typeFilter === "All Type" || v.type === typeFilter;
    const matchStatus = statusFilter === "All Status" || v.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleCreateVoucher = (e) => {
    e.preventDefault();
    const createdVoucher = {
      id: `VCH-${1000 + vouchers.length + 1}`,
      name: newVoucher.name,
      type: newVoucher.type,
      tier: newVoucher.tier,
      reward: newVoucher.reward || newVoucher.name,
      expiry: newVoucher.expiry,
      expiryFull: `${newVoucher.expiry}, 11:59 PM`,
      status: "Active",
      issued: 0,
      redeemed: 0,
      totalQty: Number(newVoucher.totalQty) || 1000,
      rate: "0%",
      limitPerUser: Number(newVoucher.limitPerUser) || 1,
      description: newVoucher.description || `Redeem ${newVoucher.name}`,
      created: "Today"
    };

    setVouchers([createdVoucher, ...vouchers]);
    setShowCreateModal(false);
    setNewVoucher({
      name: "",
      type: "Free Drink",
      tier: "All Tiers",
      reward: "",
      expiry: "31 December 2026",
      totalQty: 1000,
      limitPerUser: 1,
      description: ""
    });
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setVouchers((prev) =>
      prev.map((v) => (v.id === editingVoucher.id ? { ...v, ...editingVoucher } : v))
    );
    if (selectedVoucher?.id === editingVoucher.id) {
      setSelectedVoucher({ ...selectedVoucher, ...editingVoucher });
    }
    setEditingVoucher(null);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this voucher?")) {
      setVouchers((prev) => prev.filter((v) => v.id !== id));
      if (selectedVoucher?.id === id) setSelectedVoucher(null);
    }
  };

  const handleDuplicate = (voucher) => {
    const duplicated = {
      ...voucher,
      id: `VCH-${1000 + vouchers.length + 1}`,
      name: `${voucher.name} (Copy)`,
      issued: 0,
      redeemed: 0,
      created: "Today"
    };
    setVouchers([duplicated, ...vouchers]);
    setSelectedVoucher(duplicated);
  };

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6">
      {/* 1. Header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Vouchers</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Create, manage, and track voucher campaigns and redemption.
        </p>
      </div>

      {/* 2. Stat Cards Row (5 Cards matching mockup) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Voucher"
          value="24"
          change="12.6% vs last month"
          icon={Percent}
          iconBg="bg-[#1F3A34]"
        />
        <StatCard
          title="Active Vouchers"
          value="19"
          change="8.2% vs last month"
          icon={Gift}
          iconBg="bg-[#2E5E58]"
        />
        <StatCard
          title="Vouchers Issued"
          value="12,560"
          change="17.1% vs last month"
          icon={CreditCard}
          iconBg="bg-[#6F9F96]"
        />
        <StatCard
          title="Vouchers Redeemed"
          value="8,320"
          change="8.7% vs last month"
          icon={Tag}
          iconBg="bg-[#E07A5F]"
        />
        <StatCard
          title="Redemption Rate"
          value="66.2%"
          change="9.3% vs last month"
          icon={Users}
          iconBg="bg-[#D4AF7A]"
        />
      </div>

      {/* 3. Filter and Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        {/* Search */}
        <div className="relative w-full max-w-[400px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search vouchers by name, code or reward..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-[#2E5E58] focus:border-[#2E5E58] text-sm"
          />
        </div>

        {/* Filters and Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); resetPage(); }}
              onFocus={() => setTypeOpen(true)}
              onBlur={() => setTypeOpen(false)}
              className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
            >
              {VOUCHER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${typeOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}
              onFocus={() => setStatusOpen(true)}
              onBlur={() => setStatusOpen(false)}
              className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
            >
              {STATUS_TYPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Date Picker */}
          <div className="relative">
            <DatePicker
              selected={selectedDate}
              onChange={(d) => { setSelectedDate(d); resetPage(); }}
              customInput={<CustomDateInput onClear={() => { setSelectedDate(null); resetPage(); }} />}
              dateFormat="MMM d, yyyy"
            />
          </div>

          {/* View Analytics Button */}
          <button
            onClick={() => setShowAnalytics(true)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
          >
            View Analytics
          </button>

          {/* Export Button */}
          <button
            onClick={() => alert("Exporting vouchers CSV...")}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <Download size={16} className="mr-2" /> Export
          </button>

          {/* + New Voucher Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <Plus size={16} className="mr-2" /> New Voucher
          </button>
        </div>
      </div>

      {/* 4. Main Content: Vouchers Table + Right Side Details Panel */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        {/* Table Card */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0">
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead>
                <tr className="bg-white text-gray-900 font-bold border-b border-gray-100">
                  <th className="px-6 py-4 text-left">Voucher Name</th>
                  <th className="px-6 py-4 text-left">Type</th>
                  <th className="px-6 py-4 text-left">Eligible Tier</th>
                  <th className="px-6 py-4 text-left">Reward</th>
                  <th className="px-6 py-4 text-left">Expiry</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-left">Usage</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {paginated.length > 0 ? (
                  paginated.map((v) => {
                    const isSelected = selectedVoucher?.id === v.id;
                    const usagePercent = Math.min(100, Math.round((v.issued / v.totalQty) * 100));

                    return (
                      <tr
                        key={v.id}
                        className={`hover:bg-gray-50/70 transition-colors ${
                          isSelected ? "bg-gray-50" : ""
                        }`}
                      >
                        {/* Voucher Name */}
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-[#1F3A34] text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                              {v.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{v.name}</p>
                              <p className="text-[10px] text-gray-400">{v.id}</p>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-6 py-3.5 whitespace-nowrap font-medium text-gray-700">
                          {v.type}
                        </td>

                        {/* Eligible Tier */}
                        <td className="px-6 py-3.5 whitespace-nowrap font-medium text-gray-700">
                          {v.tier}
                        </td>

                        {/* Reward */}
                        <td className="px-6 py-3.5 whitespace-nowrap font-semibold text-gray-800">
                          {v.reward}
                        </td>

                        {/* Expiry */}
                        <td className="px-6 py-3.5 whitespace-nowrap text-gray-600 font-medium">
                          {v.expiry}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-md text-[10px] font-bold ${
                              v.status === "Active"
                                ? "bg-green-100 text-green-800"
                                : v.status === "Expired"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>

                        {/* Usage Progress Bar */}
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <div className="w-28">
                            <p className="text-[11px] font-bold text-gray-800 mb-1">
                              {v.issued.toLocaleString()}/{v.totalQty.toLocaleString()}
                            </p>
                            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-[#1F3A34] h-full rounded-full transition-all duration-300"
                                style={{ width: `${usagePercent}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        {/* Action Buttons: Eye, Edit, More */}
                        <td className="px-6 py-3.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center space-x-1.5 relative">
                            {/* Eye / View Details Button */}
                            <button
                              onClick={() => setSelectedVoucher(isSelected ? null : v)}
                              className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye size={14} />
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => setEditingVoucher(v)}
                              className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                              title="Edit Voucher"
                            >
                              <Edit3 size={14} />
                            </button>

                            {/* More Actions Menu Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuId(actionMenuId === v.id ? null : v.id);
                              }}
                              className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                              title="More Options"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {/* Dropdown Menu */}
                            {actionMenuId === v.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-left"
                              >
                                <button
                                  onClick={() => {
                                    handleDuplicate(v);
                                    setActionMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Copy size={13} /> Duplicate
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingVoucher(v);
                                    setActionMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Edit3 size={13} /> Edit
                                </button>
                                <button
                                  onClick={() => {
                                    handleDelete(v.id);
                                    setActionMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                      No vouchers found matching your filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 flex shrink-0 bg-white">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filtered.length}
              itemName="vouchers"
            />
          </div>
        </div>

        {/* Right-Side Voucher Detail Drawer (Matching Mockup exactly) */}
        {selectedVoucher && (
          <div className="w-[360px] lg:w-[380px] bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col shrink-0 overflow-y-auto space-y-5 animate-in fade-in duration-200">
            {/* Top Close Icon and Avatar */}
            <div className="relative">
              <button
                onClick={() => setSelectedVoucher(null)}
                className="absolute top-0 right-0 text-gray-500 hover:text-black cursor-pointer"
                title="Close"
              >
                <X size={20} strokeWidth={2.5} />
              </button>

              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-[#1F3A34] text-white flex items-center justify-center font-bold text-2xl shrink-0 shadow-sm">
                  {selectedVoucher.name.charAt(0)}
                </div>
                <div className="min-w-0 pr-6">
                  <h3 className="text-base font-bold text-gray-900 leading-tight">
                    {selectedVoucher.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedVoucher.id} - Created on {selectedVoucher.created}
                  </p>
                </div>
              </div>
            </div>

            {/* Detail Tabs */}
            <div className="flex border-b border-gray-200 text-xs font-bold text-gray-500">
              {["Details", "Usage", "History"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 pb-2 text-center transition-colors cursor-pointer ${
                    activeTab === tab
                      ? "text-gray-900 border-b-2 border-[#1F3A34]"
                      : "hover:text-gray-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab 1: Details Fields */}
            {activeTab === "Details" && (
              <div className="space-y-3.5 text-xs">
                <div>
                  <p className="text-gray-500 text-[11px] font-semibold mb-0.5">Description</p>
                  <p className="font-semibold text-gray-900 leading-snug">
                    {selectedVoucher.description}
                  </p>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Type</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.type}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Eligible Tier</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.tier}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Reward</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.reward}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Expiry Date</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.expiryFull}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Total Quantity</span>
                  <span className="font-bold text-gray-900">
                    {selectedVoucher.totalQty.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Issued</span>
                  <span className="font-bold text-gray-900">
                    {selectedVoucher.issued.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Redeemed</span>
                  <span className="font-bold text-gray-900">
                    {selectedVoucher.redeemed.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Redemption Rate</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{selectedVoucher.rate}</span>
                    <div className="w-14 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#1F3A34] h-full rounded-full w-3/5"></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Limit Per User</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.limitPerUser}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Status</span>
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-800">
                    {selectedVoucher.status}
                  </span>
                </div>
              </div>
            )}

            {/* Tab 2: Usage */}
            {activeTab === "Usage" && (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-gray-500 text-[11px]">Remaining Allocation</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {(selectedVoucher.totalQty - selectedVoucher.issued).toLocaleString()} units
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-gray-500 text-[11px]">Redemption Success Rate</p>
                  <p className="text-lg font-bold text-green-700 mt-1">
                    {selectedVoucher.rate}
                  </p>
                </div>
              </div>
            )}

            {/* Tab 3: History */}
            {activeTab === "History" && (
              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="font-bold text-gray-900">Voucher Created</p>
                  <p className="text-gray-500 text-[10px]">15 Jan 2026 by miraelys</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="font-bold text-gray-900">Allocation Increased (+500)</p>
                  <p className="text-gray-500 text-[10px]">20 Feb 2026 by admin_alex</p>
                </div>
              </div>
            )}

            {/* Bottom 3 Action Buttons */}
            <div className="pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 mt-auto">
              <button
                onClick={() => handleDuplicate(selectedVoucher)}
                className="py-2 px-2 border border-gray-800 rounded-lg text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Copy size={12} /> Duplicate
              </button>

              <button
                onClick={() => setEditingVoucher(selectedVoucher)}
                className="py-2 px-2 border border-gray-800 rounded-lg text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Edit3 size={12} /> Edit
              </button>

              <button
                onClick={() => handleDelete(selectedVoucher.id)}
                className="py-2 px-2 border border-gray-800 rounded-lg text-xs font-bold text-gray-900 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Create New Voucher Modal ─────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900">Create New Voucher</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-900 mb-1">Voucher Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Free Latte, 20% Weekend Promo"
                  value={newVoucher.name}
                  onChange={(e) => setNewVoucher({ ...newVoucher, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-900 mb-1">Type</label>
                  <select
                    value={newVoucher.type}
                    onChange={(e) => setNewVoucher({ ...newVoucher, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  >
                    <option value="Free Drink">Free Drink</option>
                    <option value="Percentage Off">Percentage Off</option>
                    <option value="Token Discount">Token Discount</option>
                    <option value="Free Food">Free Food</option>
                    <option value="Cash Voucher">Cash Voucher</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-900 mb-1">Eligible Tier</label>
                  <select
                    value={newVoucher.tier}
                    onChange={(e) => setNewVoucher({ ...newVoucher, tier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  >
                    <option value="All Tiers">All Tiers</option>
                    <option value="Legend">Legend</option>
                    <option value="Kawan">Kawan</option>
                    <option value="Dilamun">Dilamun</option>
                    <option value="Ketagih">Ketagih</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-900 mb-1">Reward</label>
                  <input
                    type="text"
                    placeholder="e.g. Free Latte, RM 5 Off"
                    value={newVoucher.reward}
                    onChange={(e) => setNewVoucher({ ...newVoucher, reward: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-900 mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={newVoucher.expiry}
                    onChange={(e) => setNewVoucher({ ...newVoucher, expiry: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-900 mb-1">Total Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={newVoucher.totalQty}
                    onChange={(e) => setNewVoucher({ ...newVoucher, totalQty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-900 mb-1">Limit Per User</label>
                  <input
                    type="number"
                    min="1"
                    value={newVoucher.limitPerUser}
                    onChange={(e) => setNewVoucher({ ...newVoucher, limitPerUser: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-900 mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Terms and redemption instructions..."
                  value={newVoucher.description}
                  onChange={(e) => setNewVoucher({ ...newVoucher, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                ></textarea>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#2E5E58] text-white rounded-lg font-bold hover:bg-[#1F3A34] transition-colors cursor-pointer"
                >
                  Create Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Voucher Modal ───────────────────────────────────────── */}
      {editingVoucher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900">Edit Voucher ({editingVoucher.id})</h3>
              <button
                onClick={() => setEditingVoucher(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-900 mb-1">Voucher Name</label>
                <input
                  type="text"
                  required
                  value={editingVoucher.name}
                  onChange={(e) => setEditingVoucher({ ...editingVoucher, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-900 mb-1">Type</label>
                  <select
                    value={editingVoucher.type}
                    onChange={(e) => setEditingVoucher({ ...editingVoucher, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  >
                    <option value="Free Drink">Free Drink</option>
                    <option value="Percentage Off">Percentage Off</option>
                    <option value="Token Discount">Token Discount</option>
                    <option value="Free Food">Free Food</option>
                    <option value="Cash Voucher">Cash Voucher</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-900 mb-1">Status</label>
                  <select
                    value={editingVoucher.status}
                    onChange={(e) => setEditingVoucher({ ...editingVoucher, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  >
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-900 mb-1">Reward</label>
                  <input
                    type="text"
                    value={editingVoucher.reward}
                    onChange={(e) => setEditingVoucher({ ...editingVoucher, reward: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-900 mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={editingVoucher.expiry}
                    onChange={(e) => setEditingVoucher({ ...editingVoucher, expiry: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-900 mb-1">Description</label>
                <textarea
                  rows="2"
                  value={editingVoucher.description}
                  onChange={(e) => setEditingVoucher({ ...editingVoucher, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                ></textarea>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingVoucher(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#2E5E58] text-white rounded-lg font-bold hover:bg-[#1F3A34] transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vouchers;
