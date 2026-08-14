import React, { useState, forwardRef, useEffect } from 'react';
import {
  Wallet, ShoppingBag, Users, Megaphone, Search, ChevronDown, Download, Plus,
  Eye, MoreVertical, X, Crown, ChevronRight, User, ClipboardList, Coins, Ticket, BarChart3, Calendar, Trash2, Pencil
} from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ViewProfile from './ViewProfile';
import OrderHistory from './OrderHistory';
import TokenTransaction from './TokenTransaction';
import VoucherHistory from './VoucherHistory';
import TiersHistory from './TiersHistory';

export const calculateTierProgress = (cupsStr) => {
  const cups = parseInt(cupsStr.toString().replace(/,/g, ''), 10) || 0;
  if (cups < 10) return { tier: 'Kawan', nextTier: 'Dilamun', target: 10, current: cups, percentage: (cups / 10) * 100, remaining: 10 - cups };
  if (cups < 20) return { tier: 'Dilamun', nextTier: 'Ketagih', target: 20, current: cups, percentage: (cups / 20) * 100, remaining: 20 - cups };
  if (cups < 30) return { tier: 'Ketagih', nextTier: 'Legend', target: 30, current: cups, percentage: (cups / 30) * 100, remaining: 30 - cups };
  return { tier: 'Legend', nextTier: 'Max Tier', target: cups, current: cups, percentage: 100, remaining: 0 };
};

const KPICard = ({ title, value, change, icon: Icon, iconBg, iconColor }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
      <Icon size={28} strokeWidth={2} />
    </div>
    <div>
      <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {change && (
        <p className="text-xs text-green-500 font-medium mt-0.5">^ {change}</p>
      )}
    </div>
  </div>
);

const initialCustomerData = [
  { id: 'cust-0', username: 'miraelys', email: 'mira@gmail.com', tier: 'Legend', tokens: '1,560', orders: '48', spent: 'RM 2,600.50', lastOrder: 'May 5, 2026', status: 'Paid', phone: '+60 11-63793812', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-1', username: 'alex_chong', email: 'alex.c@yahoo.com', tier: 'Legend', tokens: '2,100', orders: '102', spent: 'RM 5,230.00', lastOrder: 'Aug 2, 2026', status: 'Paid', phone: '+60 12-3456789', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-2', username: 'sarah_lee', email: 'sarah.lee88@gmail.com', tier: 'Dilamun', tokens: '450', orders: '12', spent: 'RM 450.25', lastOrder: 'Aug 10, 2026', status: 'Refund', phone: '+60 17-9876543', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-3', username: 'khai_rul', email: 'khairul.dev@gmail.com', tier: 'Ketagih', tokens: '3,200', orders: '25', spent: 'RM 8,400.90', lastOrder: 'Aug 12, 2026', status: 'Paid', phone: '+60 19-1122334', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-4', username: 'jane_doe', email: 'janedoe99@outlook.com', tier: 'Kawan', tokens: '120', orders: '3', spent: 'RM 85.00', lastOrder: 'July 15, 2026', status: 'Paid', phone: '+60 13-5557777', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-5', username: 'ahmad_z', email: 'ahmad.z@gmail.com', tier: 'Dilamun', tokens: '1,890', orders: '18', spent: 'RM 4,120.00', lastOrder: 'Aug 11, 2026', status: 'Paid', phone: '+60 14-2223333', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-6', username: 'lily_tan', email: 'lily.tan@company.com', tier: 'Ketagih', tokens: '4,500', orders: '28', spent: 'RM 12,300.50', lastOrder: 'Aug 13, 2026', status: 'Paid', phone: '+60 16-8889999', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-7', username: 'ravi_s', email: 'ravi.shankar@gmail.com', tier: 'Dilamun', tokens: '670', orders: '15', spent: 'RM 890.75', lastOrder: 'June 20, 2026', status: 'Paid', phone: '+60 11-1234123', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-8', username: 'fatimah_n', email: 'fatimah.n@yahoo.com', tier: 'Legend', tokens: '2,340', orders: '32', spent: 'RM 5,100.00', lastOrder: 'Aug 5, 2026', status: 'Paid', phone: '+60 12-4445555', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-9', username: 'wei_jie', email: 'weijie_w@gmail.com', tier: 'Kawan', tokens: '250', orders: '8', spent: 'RM 150.00', lastOrder: 'May 18, 2026', status: 'Refund', phone: '+60 17-6667777', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-10', username: 'nur_aini', email: 'nur.aini@outlook.com', tier: 'Ketagih', tokens: '3,800', orders: '22', spent: 'RM 9,200.00', lastOrder: 'Aug 9, 2026', status: 'Paid', phone: '+60 19-8887777', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-11', username: 'danial_h', email: 'danial.hakim@gmail.com', tier: 'Legend', tokens: '1,650', orders: '45', spent: 'RM 3,200.20', lastOrder: 'July 25, 2026', status: 'Paid', phone: '+60 13-9990000', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-12', username: 'mei_ling', email: 'mei.l@yahoo.com', tier: 'Dilamun', tokens: '890', orders: '19', spent: 'RM 1,450.50', lastOrder: 'Aug 1, 2026', status: 'Paid', phone: '+60 14-7778888', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-13', username: 'kumar_a', email: 'kumar.a@gmail.com', tier: 'Kawan', tokens: '180', orders: '5', spent: 'RM 120.00', lastOrder: 'March 12, 2026', status: 'Refund', phone: '+60 16-1112222', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80' },
  { id: 'cust-14', username: 'syahirah', email: 'syahirah_o@gmail.com', tier: 'Legend', tokens: '2,750', orders: '31', spent: 'RM 6,800.00', lastOrder: 'Aug 13, 2026', status: 'Paid', phone: '+60 11-3334444', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' }
];

const getTierColor = (tier) => {
  switch (tier) {
    case 'Kawan': return 'bg-blue-100 text-blue-600';
    case 'Dilamun': return 'bg-[#E07A5F]/15 text-[#E07A5F]';
    case 'Ketagih': return 'bg-purple-100 text-purple-600';
    case 'Legend': return 'bg-[#D4AF7A]/20 text-[#A8824A]';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Paid': return 'bg-green-100 text-green-600';
    case 'Refund': return 'bg-red-100 text-red-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const QuickLink = ({ icon: Icon, title, desc, iconBg, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0 text-left">
    <div className="flex items-center space-x-4">
      <div className={`w-12 h-12 rounded-xl text-white flex items-center justify-center ${iconBg}`}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
    <ChevronRight size={18} className="text-gray-400" />
  </button>
);

const CustomDateInput = forwardRef(({ value, onClick, onClear }, ref) => (
  <div className="relative">
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick(e);
      }}
      ref={ref}
      className="flex items-center pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
    >
      {value ? value : "Last Order"}
    </button>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
      {value ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
          className="text-gray-400 hover:text-gray-600 rounded-full bg-gray-100 p-0.5"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      ) : (
        <ChevronDown size={16} className="text-gray-500 pointer-events-none" />
      )}
    </div>
  </div>
));

const Customers = () => {
  const [customers, setCustomers] = useState(initialCustomerData);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('All Tiers');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedDate, setSelectedDate] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tierOpen, setTierOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeView, setActiveView] = useState('list');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const itemsPerPage = 12;

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Render Sub-Views Early
  const renderView = () => {
    switch (activeView) {
      case 'profile': return <ViewProfile customer={selectedCustomer} onBack={() => setActiveView('list')} />;
      case 'orders': return <OrderHistory customer={selectedCustomer} onBack={() => setActiveView('list')} />;
      case 'tokens': return <TokenTransaction customer={selectedCustomer} onBack={() => setActiveView('list')} />;
      case 'vouchers': return <VoucherHistory customer={selectedCustomer} onBack={() => setActiveView('list')} />;
      case 'tiers': return <TiersHistory customer={selectedCustomer} onBack={() => setActiveView('list')} />;
      default: return null; // handled in main return
    }
  };

  if (activeView !== 'list') {
    return renderView();
  }

  // Filtering Logic
  const filteredData = customers.filter(customer => {
    const matchesSearch = customer.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.tokens.includes(searchQuery);
    const matchesTier = selectedTier === 'All Tiers' || customer.tier === selectedTier;
    const matchesStatus = selectedStatus === 'All Status' || customer.status === selectedStatus;

    let matchesDate = true;
    if (selectedDate) {
      const formattedDate = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      // Very basic match just to work with the mock data e.g. "May 5, 2026"
      matchesDate = customer.lastOrder === formattedDate || customer.lastOrder.includes(formattedDate);
    }

    return matchesSearch && matchesTier && matchesStatus && matchesDate;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExport = () => {
    alert("Exporting customers data to CSV...");
  };

  const handleAddCustomer = (e) => {
    e.preventDefault();
    alert("New customer added!");
    setIsAddModalOpen(false);
  };

  const handleEditCustomer = (e) => {
    e.preventDefault();
    alert("Customer details updated!");
    setEditingCustomer(null);
  };

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
      {/* Header section */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-500">Manage and view all your customers.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6 flex-shrink-0">
        <KPICard title="Total Customers" value="2,560" change="12.6% vs last month" icon={Wallet} iconBg="bg-[#1F3A34]" iconColor="text-white" />
        <KPICard title="New Customers" value="19" change="8.2% vs last month" icon={ShoppingBag} iconBg="bg-[#2E5E58]" iconColor="text-white" />
        <KPICard title="Active Tier Members" value="19" change="17.1% vs last month" icon={Users} iconBg="bg-[#6F9F96]" iconColor="text-white" />
        <KPICard title="Total Revenue" value="RM 25,560" change="8.7% vs last month" icon={Megaphone} iconBg="bg-[#E07A5F]" iconColor="text-white" />
        <KPICard title="Average Spend" value="RM 74.50" change="9.3% vs last month" icon={Users} iconBg="bg-[#D9C4A9]" iconColor="text-white" />
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 flex-shrink-0">
        <div className="relative w-full max-w-[400px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-[#2E5E58] focus:border-[#2E5E58] sm:text-sm"
            placeholder="Search customer by username, tokens balance..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={selectedTier}
              onChange={(e) => { setSelectedTier(e.target.value); setCurrentPage(1); }}
              onFocus={() => setTierOpen(true)}
              onBlur={() => setTierOpen(false)}
              className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer w-full"
            >
              <option value="All Tiers">All Tiers</option>
              <option value="Kawan">Kawan</option>
              <option value="Legend">Legend</option>
              <option value="Dilamun">Dilamun</option>
              <option value="Ketagih">Ketagih</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${tierOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              onFocus={() => setStatusOpen(true)}
              onBlur={() => setStatusOpen(false)}
              className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer w-full"
            >
              <option value="All Status">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Refund">Refund</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          <div className="relative">
            <DatePicker
              selected={selectedDate}
              onChange={(date) => { setSelectedDate(date); setCurrentPage(1); }}
              customInput={<CustomDateInput onClear={() => { setSelectedDate(null); setCurrentPage(1); }} />}
              dateFormat="MMM d, yyyy"
            />
          </div>

          <button onClick={handleExport} className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 lg:ml-4 cursor-pointer">
            <Download size={16} className="mr-2" /> Export
          </button>

          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
            <Plus size={16} className="mr-2" /> Add Customer
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        {/* Main Table Area */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0">
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">
                    Username
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Tier</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Tokens Balance</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Total Orders</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Total Spent</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Last Order</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Status</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginatedData.length > 0 ? paginatedData.map((customer, idx) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-[#2E5E58] flex-shrink-0 shadow-sm"></div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{customer.username}</div>
                          <div className="text-xs text-gray-500">{customer.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md ${getTierColor(customer.tier)}`}>
                        {customer.tier}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{customer.tokens}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{customer.orders}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{customer.spent}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{customer.lastOrder}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md ${getStatusColor(customer.status)}`}>
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="relative inline-block text-left">
                        <div className="bg-[#1E293B] hover:bg-[#0F172A] text-white px-2.5 py-1.5 rounded-lg inline-flex items-center gap-2 shadow-sm transition-colors">
                          <button
                            className="text-white/90 hover:text-white cursor-pointer transition-colors"
                            onClick={() => setSelectedCustomer(selectedCustomer?.id === customer.id ? null : customer)}
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === customer.id ? null : customer.id);
                            }}
                            className="text-white/90 hover:text-white cursor-pointer transition-colors"
                            title="More Options"
                          >
                            <MoreVertical size={15} />
                          </button>
                        </div>

                        {menuOpenId === customer.id && (
                          <div className="absolute right-0 top-full mt-1.5 w-32 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCustomer(customer);
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <Pencil size={13} className="text-gray-500" />
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to delete customer "${customer.username}"?`)) {
                                  setCustomers(prev => prev.filter(c => c.id !== customer.id));
                                  if (selectedCustomer?.id === customer.id) {
                                    setSelectedCustomer(null);
                                  }
                                }
                                setMenuOpenId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <Trash2 size={13} className="text-red-500" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500 text-sm">
                      No customers found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} customers
            </p>
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-50"
              >←</button>

              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1 rounded-md ${currentPage === i + 1 ? 'bg-[#2E5E58] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {i + 1}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-50"
              >→</button>
            </div>
          </div>
        </div>

        {/* Customer Overview Sidebar */}
        {selectedCustomer && (
          <div className="w-[380px] bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col relative shrink-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Customer Overview</h2>
              <button className="text-gray-400 hover:text-gray-900" onClick={() => setSelectedCustomer(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center space-x-4 mb-8">
              <div className="h-20 w-20 rounded-full bg-[#2E5E58] flex-shrink-0 shadow-sm">
                {/* Large green circle for profile picture */}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-gray-900">{selectedCustomer.username}</h3>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${getTierColor(selectedCustomer.tier)}`}>{selectedCustomer.tier}</span>
                </div>
                <p className="text-sm text-gray-500">{selectedCustomer.email}</p>
                <p className="text-sm text-gray-500">+60 11-63793812</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Member ID : C2-001</p>
              </div>
            </div>

            <div className="flex justify-between border-y border-gray-100 py-4 mb-6 text-center">
              <div>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">Tokens Balance</p>
                <p className="font-bold text-gray-900">{selectedCustomer.tokens}</p>
              </div>
              <div className="w-px bg-gray-100"></div>
              <div>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">Total Orders</p>
                <p className="font-bold text-gray-900">{selectedCustomer.orders}</p>
              </div>
              <div className="w-px bg-gray-100"></div>
              <div>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">Total Spent</p>
                <p className="font-bold text-gray-900">{selectedCustomer.spent}</p>
              </div>
            </div>

            {(() => {
              const progress = calculateTierProgress(selectedCustomer.orders);
              return (
                <div className="bg-[#1F3A34] rounded-xl p-5 mb-8 text-white relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center space-x-3">
                      <Crown size={24} className="text-yellow-400" />
                      <div>
                        <p className="font-bold">{progress.tier}</p>
                        <p className="text-xs text-white/70">Until 31 Jan 2027</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/70 mb-1">Next: {progress.nextTier}</p>
                      <p className="font-bold">{progress.tier === 'Legend' ? 'Max Tier' : `${progress.current}/${progress.target} cups`}</p>
                    </div>
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2 relative z-10">
                    <div className="bg-[#E07A5F] h-2 rounded-full" style={{ width: `${progress.percentage}%` }}></div>
                  </div>
                </div>
              );
            })()}

            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Quick Links</h3>
              <div className="flex flex-col">
                <QuickLink icon={User} title="View Profile" desc="Customer personal details" iconBg="bg-[#1F3A2A]" onClick={() => setActiveView('profile')} />
                <QuickLink icon={ClipboardList} title="Order History" desc="Past orders and invoices" iconBg="bg-[#2E5E58]" onClick={() => setActiveView('orders')} />
                <QuickLink icon={Coins} title="Token Transaction" desc="Earned and spent tokens" iconBg="bg-[#B7CFCA]" onClick={() => setActiveView('tokens')} />
                <QuickLink icon={Ticket} title="Voucher History" desc="Claimed and used vouchers" iconBg="bg-[#E07A5F]" onClick={() => setActiveView('vouchers')} />
                <QuickLink icon={BarChart3} title="Tiers History" desc="Tier upgrade timeline" iconBg="bg-[#D4AF7A]" onClick={() => setActiveView('tiers')} />
              </div>
            </div>

            <div className="mt-auto">
              <button
                onClick={() => setEditingCustomer(selectedCustomer)}
                className="w-full py-3 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ✎ Edit Customer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {(isAddModalOpen || editingCustomer) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button onClick={() => { setIsAddModalOpen(false); setEditingCustomer(null); }} className="text-gray-400 hover:text-gray-900">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={editingCustomer ? handleEditCustomer : handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  defaultValue={editingCustomer?.username || ''}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#2E5E58] focus:border-[#2E5E58]"
                  placeholder="e.g. CoffeeLover1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  defaultValue={editingCustomer?.email || ''}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#2E5E58] focus:border-[#2E5E58]"
                  placeholder="amirah@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  defaultValue={editingCustomer?.phone || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#2E5E58] focus:border-[#2E5E58]"
                  placeholder="+60 11-00000000"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingCustomer(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#2E5E58] border border-transparent rounded-lg hover:bg-[#1F3A34]"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
