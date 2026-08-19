import React, { useState, useEffect, forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Search, ChevronDown, Download, Users, Coins, ArrowUp,
  CreditCard, ShoppingBag, MoreVertical, X, Eye,
  Crown, Edit3, BarChart3, ChevronRight, CheckCircle2, Ticket, Percent, ArrowRight
} from "lucide-react";
import Pagination from './Pagination';
import TokenTransaction from './TokenTransaction';
import LoyaltyAnalytics from './LoyaltyAnalytics';
import LoyaltyProgramSummary from './LoyaltyProgramSummary';
import { exportToCSV } from '../utils/exportToCSV';

const CustomDateInput = forwardRef(({ value, onClick, onClear }, ref) => (
  <div className="relative">
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick(e);
      }}
      ref={ref}
      className="peer flex items-center pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
    >
      {value || 'Select Date'}
    </button>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
      {value ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
          className="text-gray-400 hover:text-gray-600 rounded-full bg-gray-100 p-0.5 cursor-pointer"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      ) : (
        <ChevronDown size={16} className="text-gray-500 pointer-events-none transition-transform duration-200 peer-focus:-rotate-180" />
      )}
    </div>
  </div>
));


const initialTransactions = [
  {
    id: "tx-1",
    date: "Aug 19, 2026",
    time: "10:15 AM",
    member: {
      name: "miraelys",
      email: "mira@gmail.com",
      phone: "+60 11-63793812",
      memberId: "C2-001",
      tier: "Legend",
      tokensBalance: "1,560",
      lifetimeEarned: "12,480",
      lifetimeRedeemed: "10,920",
      tierProgress: { current: 25, target: 30, expiry: "31 Jan 2027" }
    },
    description: "Purchase Order ORD-0510-001",
    type: "Earned",
    tokens: "+10",
    balance: "1,560"
  },
  {
    id: "tx-2",
    date: "Aug 19, 2026",
    time: "02:30 PM",
    member: {
      name: "alex_chong",
      email: "alex.c@yahoo.com",
      phone: "+60 12-3456789",
      memberId: "C2-002",
      tier: "Legend",
      tokensBalance: "2,100",
      lifetimeEarned: "15,200",
      lifetimeRedeemed: "13,100",
      tierProgress: { current: 30, target: 30, expiry: "31 Jan 2027" }
    },
    description: "Redeem Free Latte Voucher VCH-1001",
    type: "Redeemed",
    tokens: "-250",
    balance: "2,100"
  },
  {
    id: "tx-3",
    date: "Aug 19, 2026",
    time: "11:45 AM",
    member: {
      name: "sarah_lee",
      email: "sarah.lee88@gmail.com",
      phone: "+60 17-9876543",
      memberId: "C2-003",
      tier: "Dilamun",
      tokensBalance: "450",
      lifetimeEarned: "1,200",
      lifetimeRedeemed: "750",
      tierProgress: { current: 15, target: 20, expiry: "31 Jan 2027" }
    },
    description: "Purchase Order ORD-0503-042",
    type: "Earned",
    tokens: "+45",
    balance: "450"
  },
  {
    id: "tx-4",
    date: "Aug 19, 2026",
    time: "09:15 AM",
    member: {
      name: "khai_rul",
      email: "khairul.dev@gmail.com",
      phone: "+60 19-1122334",
      memberId: "C2-004",
      tier: "Ketagih",
      tokensBalance: "3,200",
      lifetimeEarned: "8,500",
      lifetimeRedeemed: "5,300",
      tierProgress: { current: 28, target: 30, expiry: "31 Jan 2027" }
    },
    description: "Purchase Order ORD-0502-011",
    type: "Earned",
    tokens: "+120",
    balance: "3,200"
  },
  {
    id: "tx-5",
    date: "Aug 19, 2026",
    time: "04:20 PM",
    member: {
      name: "jane_doe",
      email: "janedoe99@outlook.com",
      phone: "+60 13-5557777",
      memberId: "C2-005",
      tier: "Kawan",
      tokensBalance: "120",
      lifetimeEarned: "120",
      lifetimeRedeemed: "0",
      tierProgress: { current: 3, target: 10, expiry: "31 Jan 2027" }
    },
    description: "Purchase Order ORD-0501-088",
    type: "Earned",
    tokens: "+15",
    balance: "120"
  },
  {
    id: "tx-6",
    date: "Aug 19, 2026",
    time: "01:10 PM",
    member: {
      name: "ahmad_z",
      email: "ahmad.z@gmail.com",
      phone: "+60 14-2223333",
      memberId: "C2-006",
      tier: "Dilamun",
      tokensBalance: "1,890",
      lifetimeEarned: "4,500",
      lifetimeRedeemed: "2,610",
      tierProgress: { current: 18, target: 20, expiry: "31 Jan 2027" }
    },
    description: "Purchase Order ORD-0430-055",
    type: "Earned",
    tokens: "+80",
    balance: "1,890"
  },
  {
    id: "tx-7",
    date: "Aug 19, 2026",
    time: "10:05 AM",
    member: {
      name: "lily_tan",
      email: "lily.tan@company.com",
      phone: "+60 16-8889999",
      memberId: "C2-007",
      tier: "Ketagih",
      tokensBalance: "4,500",
      lifetimeEarned: "12,000",
      lifetimeRedeemed: "7,500",
      tierProgress: { current: 22, target: 30, expiry: "31 Jan 2027" }
    },
    description: "Redeem Free Cake Voucher VCH-1002",
    type: "Redeemed",
    tokens: "-500",
    balance: "4,500"
  },
  {
    id: "tx-8",
    date: "Aug 19, 2026",
    time: "08:30 AM",
    member: {
      name: "ravi_s",
      email: "ravi.shankar@gmail.com",
      phone: "+60 11-1234123",
      memberId: "C2-008",
      tier: "Dilamun",
      tokensBalance: "670",
      lifetimeEarned: "1,500",
      lifetimeRedeemed: "830",
      tierProgress: { current: 15, target: 20, expiry: "31 Jan 2027" }
    },
    description: "Purchase Order ORD-0428-002",
    type: "Earned",
    tokens: "+25",
    balance: "670"
  },
];

const mockTokenHistory = [
  { id: 'TXN-001', type: 'Earned', amount: '+145', desc: 'Order ORD-2026-001', date: 'Aug 19, 2026' },
  { id: 'TXN-002', type: 'Redeemed', amount: '-500', desc: 'Voucher Redemption', date: 'Aug 19, 2026' },
  { id: 'TXN-003', type: 'Earned', amount: '+25', desc: 'Order ORD-2026-002', date: 'Aug 19, 2026' },
];

//Helpers
const getTierColor = (tier) => {
  switch (tier) {
    case 'Kawan': return 'bg-blue-100 text-blue-600';
    case 'Dilamun': return 'bg-[#E07A5F]/15 text-[#E07A5F]';
    case 'Ketagih': return 'bg-purple-100 text-purple-600';
    case 'Legend': return 'bg-[#D4AF7A]/20 text-[#A8824A]';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getTypeColor = (type) => {
  switch (type) {
    case 'Earned': return 'bg-green-100 text-green-700';
    case 'Redeemed': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

//KPI Card Component
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

//Main Component
const LoyaltyTokens = ({ onBack, onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All Transaction Types");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [typeOpen, setTypeOpen] = useState(false);

  const [isEditTokensOpen, setIsEditTokensOpen] = useState(false);
  const [editTokenAmount, setEditTokenAmount] = useState("");
  const [editTokenAction, setEditTokenAction] = useState("Add");
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [activeView, setActiveView] = useState("list");
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const itemsPerPage = 10;

  const filteredTransactions = initialTransactions.filter((tx) => {
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

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (activeView === 'analytics') {
    return <LoyaltyAnalytics onBack={() => setActiveView('list')} onViewSummary={() => setActiveView('program_summary')} />;
  }

  if (activeView === 'program_summary') {
    return <LoyaltyProgramSummary onBack={() => setActiveView('analytics')} />;
  }

  if (activeView === 'tokens' && selectedCustomer) {
    return <TokenTransaction customer={{ ...selectedCustomer, username: selectedCustomer.name }} onBack={() => setActiveView('list')} />;
  }

  return (
    <div className="h-full flex flex-col px-8 pb-8 pt-2 space-y-6 overflow-hidden">
      <div className="shrink-0 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loyalty & Tokens</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage customer loyalty tiers, points and token transactions.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Members"
            value="2,138"
            change="12.6% vs last month"
            icon={Users}
            iconBg="bg-[#1F3A34]"
          />
          <KPICard
            title="Tokens Held"
            value="128,560"
            change="8.2% vs last month"
            icon={Coins}
            iconBg="bg-[#6F9F96]"
          />
          <KPICard
            title="Token Issued"
            value="15,230"
            change="17.1% vs last month"
            icon={CreditCard}
            iconBg="bg-[#E07A5F]"
          />
          <KPICard
            title="Tokens Redeemed"
            value="8,450"
            change="8.7% vs last month"
            icon={ShoppingBag}
            iconBg="bg-[#D4AF7A]"
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
              placeholder="Search members by name, phone or member ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1F3A34] focus:border-[#1F3A34]"
            />
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
              View Analytics
            </button>
            <button
              onClick={() => {
                const rows = [
                  ["Transaction ID", "Member Name", "Tokens", "Balance", "Type", "Source", "Date"],
                  ...filteredItems.map(t => [
                    `"${t.id}"`,
                    `"${t.member.name}"`,
                    `"${t.tokens}"`,
                    `"${t.balance}"`,
                    `"${t.type}"`,
                    `"${t.description}"`,
                    `"${t.date} ${t.time}"`
                  ])
                ];
                exportToCSV(rows, "loyalty_tokens.csv");
              }}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer shadow-sm whitespace-nowrap"
            >
              <Download size={16} className="mr-1.5" />
              Export
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
                    <th className="px-6 py-4 font-extrabold">Date & Time</th>
                    <th className="px-6 py-4 font-extrabold">Username</th>
                    <th className="px-6 py-4 font-extrabold">Member Tier</th>
                    <th className="px-6 py-4 font-extrabold">Description</th>
                    <th className="px-6 py-4 font-extrabold text-right">Tokens</th>
                    <th className="px-6 py-4 font-extrabold text-right">Balance</th>
                    <th className="px-6 py-4 font-extrabold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedCustomer && selectedCustomer.memberId === tx.member.memberId ? 'bg-gray-50' : ''}`}
                      onClick={() => setSelectedCustomer(tx.member)}
                    >
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <p className="font-semibold text-gray-900 text-xs">{tx.date}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{tx.time}</p>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#2E5E58] shrink-0 shadow-sm"></div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{tx.member.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{tx.member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${getTierColor(tx.member.tier)}`}>
                          {tx.member.tier}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${getTypeColor(tx.type)}`}>
                            {tx.type}
                          </span>
                          <div className="text-xs">
                            {tx.description.split(' ').map((word, i) => (
                              <span key={i} className={i === 0 ? "font-semibold text-gray-900 mr-1" : "text-gray-500 mr-1"}>
                                {word}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className={`px-6 py-3 text-right whitespace-nowrap text-xs font-bold ${tx.tokens.startsWith('+') ? 'text-gray-900' : 'text-gray-900'}`}>
                        {tx.tokens}
                      </td>
                      <td className="px-6 py-3 text-right whitespace-nowrap text-xs font-bold text-gray-900">
                        {tx.balance}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-center">
                        <button
                          className="p-1.5 bg-[#1E293B] hover:bg-[#0F172A] text-white rounded shadow-sm transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(selectedCustomer?.memberId === tx.member.memberId ? null : tx.member);
                          }}
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-auto px-6 py-4 border-t border-gray-100 flex shrink-0 bg-white">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={filteredTransactions.length}
                itemName="transactions"
              />
            </div>
          </div>
        </div>

        {/* Right side: Customer Overview Panel */}
        {selectedCustomer && (
          <div className="w-[35%] bg-white rounded-2xl border border-gray-200 shadow-lg flex flex-col h-full animate-in slide-in-from-right-8 duration-300 shrink-0">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-2xl shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Customer Overview</h2>
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
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${getTierColor(selectedCustomer.tier)}`}>
                      {selectedCustomer.tier}
                    </span>
                  </div>
                </div>

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

                {/* Tier Progress Card */}
                <div className="bg-[#1a1a1a] rounded-xl p-4 text-white relative overflow-hidden">
                  {/* Background decorative elements */}
                  <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl translate-x-1/3 -translate-y-1/3"></div>

                  <div className="flex justify-between items-end mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                        <Crown size={20} className="text-yellow-500" fill="currentColor" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{selectedCustomer.tier}</h4>
                        <p className="text-[10px] text-gray-400">Until {selectedCustomer.tierProgress.expiry}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Next tier:</p>
                      <p className="font-bold text-xs">{selectedCustomer.tierProgress.current}/{selectedCustomer.tierProgress.target} cups</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-white/20 rounded-full h-1.5 relative z-10">
                    <div
                      className="bg-white h-1.5 rounded-full"
                      style={{ width: `${(selectedCustomer.tierProgress.current / selectedCustomer.tierProgress.target) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Token History */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-900 text-sm">Token History</h3>
                    <button
                      onClick={() => setActiveView('tokens')}
                      className="text-xs font-bold text-gray-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      View All <ArrowRight size={14} className="ml-0.5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {mockTokenHistory.map((history) => (
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
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl shrink-0">
              <button
                onClick={() => setIsEditTokensOpen(true)}
                className="w-full py-2.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Edit3 size={16} /> Edit Tokens
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Tokens Modal */}
      {isEditTokensOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-[400px] shadow-xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Edit Tokens</h2>
              <button onClick={() => setIsEditTokensOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors">
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
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50">
              <button
                onClick={() => setIsEditTokensOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert(`Successfully ${editTokenAction.toLowerCase()}ed ${editTokenAmount || 0} tokens for ${selectedCustomer.name}.`);
                  setIsEditTokensOpen(false);
                  setEditTokenAmount("");
                }}
                className="px-4 py-2 bg-[#2E5E58] text-white rounded-lg text-sm font-bold hover:bg-[#1F3A34] transition-colors shadow-sm cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoyaltyTokens;
