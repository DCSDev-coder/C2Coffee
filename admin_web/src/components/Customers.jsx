import React, { useState, forwardRef, useEffect } from 'react';
import {
  Wallet, Users, Megaphone, Search, ChevronDown, Download, Plus,
  Eye, MoreVertical, X, Crown, ChevronRight, User, ClipboardList, Coins, Ticket, BarChart3, Trash2, Pencil
} from 'lucide-react';
import Pagination from './Pagination';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { exportToCSV } from '../utils/exportToCSV';
import ViewProfile from './ViewProfile';
import OrderHistory from './OrderHistory';
import TokenTransaction from './TokenTransaction';
import VoucherHistory from './VoucherHistory';
import TiersHistory from './TiersHistory';
import {
  loadAdminCustomers,
  createAdminCustomer,
  updateAdminCustomer,
  deleteAdminCustomer
} from '../lib/adminApi';

export const calculateTierProgress = (cupsStr) => {
  const cups = parseInt(cupsStr.toString().replace(/,/g, ''), 10) || 0;
  if (cups < 10) return { tier: 'Kawan', nextTier: 'Dilamun', target: 10, current: cups, percentage: (cups / 10) * 100, remaining: 10 - cups };
  if (cups < 30) return { tier: 'Dilamun', nextTier: 'Ketagih', target: 30, current: cups, percentage: (cups / 30) * 100, remaining: 30 - cups };
  if (cups < 50) return { tier: 'Ketagih', nextTier: 'Legend', target: 50, current: cups, percentage: (cups / 50) * 100, remaining: 50 - cups };
  return { tier: 'Legend', nextTier: 'Max Tier', target: cups, current: cups, percentage: 100, remaining: 0 };
};

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

const getTierColor = (tier) => {
  switch (tier) {
    case 'Kawan': return 'bg-blue-100 text-blue-600';
    case 'Dilamun': return 'bg-[#E07A5F]/15 text-[#E07A5F]';
    case 'Ketagih': return 'bg-purple-100 text-purple-600';
    case 'Legend': return 'bg-[#D4AF7A]/20 text-[#A8824A]';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const formatRm = (value) => {
  const amount = Number(value || 0);
  return `RM ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatTokens = (value) => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('en-US')} tokens`;
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
      className="peer flex items-center pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
    >
      {value || 'Select Date'}
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
        <ChevronDown size={16} className="text-gray-500 pointer-events-none transition-transform duration-200 peer-focus:-rotate-180" />
      )}
    </div>
  </div>
));

const Customers = () => {
  const [customers, setCustomers] = useState([]);
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchCustomers = async ({ keepSelection = false, silent = false } = {}) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        setLoadError('');
        const response = await loadAdminCustomers();
        if (!isMounted) return;

        const nextCustomers = Array.isArray(response?.customers) ? response.customers : [];
        setCustomers(nextCustomers);

        if (keepSelection) {
          setSelectedCustomer((prev) => {
            if (!prev) return null;
            return nextCustomers.find((customer) => customer.id === prev.id) || null;
          });
        }
      } catch (error) {
        console.error('Failed to load customers', error);
        setLoadError(error?.message || 'Failed to load customers.');
        setCustomers([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCustomers();

    const refreshCustomers = () => {
      fetchCustomers({ keepSelection: true, silent: true });
    };

    const intervalId = window.setInterval(refreshCustomers, 30000);
    const handleFocus = () => refreshCustomers();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCustomers();
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


  const renderView = () => {
    switch (activeView) {
      case 'profile': return <ViewProfile customer={selectedCustomer} onBack={() => setActiveView('list')} />;
      case 'orders': return <OrderHistory customer={selectedCustomer} onBack={() => setActiveView('list')} />;
      case 'tokens': return <TokenTransaction customer={selectedCustomer} onBack={() => setActiveView('list')} />;
      case 'vouchers': return <VoucherHistory customer={selectedCustomer} onBack={() => setActiveView('list')} />;
      case 'tiers': return <TiersHistory customer={selectedCustomer} onBack={() => setActiveView('list')} />;
      default: return null;
    }
  };

  if (activeView !== 'list') {
    return renderView();
  }

  const filteredData = customers.filter(customer => {
    const matchesSearch = customer.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(customer.tokenBalance ?? customer.tokens ?? '').includes(searchQuery);
    const matchesTier = selectedTier === 'All Tiers' || customer.tier === selectedTier;
    const matchesStatus = selectedStatus === 'All Status' || customer.status === selectedStatus;

    let matchesDate = true;
    if (selectedDate) {
      const formattedDate = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      matchesDate = customer.lastOrder === formattedDate || customer.joinedAt === formattedDate;
    }

    return matchesSearch && matchesTier && matchesStatus && matchesDate;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExport = () => {
    const rows = [
      ["Name", "Tier", "Total Spent (Tokens)", "Total Spent (RM)", "Token Balance", "Status"],
      ...filteredData.map(c => [
        `"${c.username}"`,
        `"${c.tier}"`,
        `"${formatTokens(c.totalSpentTokens)}"`,
        `"${formatRm(c.totalSpentRm)}"`,
        `"${c.tokenBalance.toLocaleString('en-US')}"`,
        `"${c.status}"`
      ])
    ];
    exportToCSV(rows, "customers.csv");
  };

  const handleAddCustomer = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      phone: String(form.get('phone') || '').trim(),
      displayName: String(form.get('username') || '').trim(),
      email: String(form.get('email') || '').trim()
    };

    createAdminCustomer(payload)
      .then((response) => {
        if (response?.customer) {
          setCustomers((prev) => [response.customer, ...prev]);
          setSelectedCustomer(response.customer);
        }
        setIsAddModalOpen(false);
      })
      .catch((error) => {
        alert(`Error adding customer: ${error.message}`);
      });
  };

  const handleEditCustomer = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      phone: String(form.get('phone') || '').trim(),
      displayName: String(form.get('username') || '').trim(),
      email: String(form.get('email') || '').trim()
    };

    updateAdminCustomer(editingCustomer.id, payload)
      .then((response) => {
        if (response?.customer) {
          setCustomers((prev) => prev.map((customer) => (customer.id === response.customer.id ? response.customer : customer)));
          setSelectedCustomer((prev) => (prev?.id === response.customer.id ? response.customer : prev));
        }
        setEditingCustomer(null);
      })
      .catch((error) => {
      alert(`Error updating customer: ${error.message}`);
      });
  };

  const totalCustomers = customers.length;
  const activeTierMembers = customers.filter((customer) => customer.tier !== 'Kawan').length;
  const totalSpendRm = customers.reduce((sum, customer) => sum + Number(customer.totalSpentRm || 0), 0);
  const totalSpendTokens = customers.reduce((sum, customer) => sum + Number(customer.totalSpentTokens || 0), 0);
  const averageSpendRm = totalCustomers > 0 ? totalSpendRm / totalCustomers : 0;
  const averageSpendTokens = totalCustomers > 0 ? totalSpendTokens / totalCustomers : 0;

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
      {/* Header section */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-500">Manage and view all your customers.</p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 flex-shrink-0">
        <KPICard title="Total Customers" value={totalCustomers.toLocaleString('en-US')} change="Live from admin API" icon={Wallet} iconBg="bg-[#1F3A34]" iconColor="text-white" />
        <KPICard title="Active Tier Members" value={activeTierMembers.toLocaleString('en-US')} change="Customers above Kawan tier" icon={Users} iconBg="bg-[#6F9F96]" iconColor="text-white" />
        <KPICard title="Order Tokens Spent" value={formatTokens(totalSpendTokens)} change={`RM equivalent: ${formatRm(totalSpendRm)}`} icon={Megaphone} iconBg="bg-[#E07A5F]" iconColor="text-white" />
        <KPICard title="Average Order Tokens Spent" value={formatTokens(averageSpendTokens)} change={`RM equivalent: ${formatRm(averageSpendRm)}`} icon={Users} iconBg="bg-[#D9C4A9]" iconColor="text-white" />
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
              className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer w-full"
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

          <div className="relative transition-transform duration-200 peer-focus:-rotate-180">
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              onFocus={() => setStatusOpen(true)}
              onBlur={() => setStatusOpen(false)}
              className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer w-full"
            >
              <option value="All Status">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Refund">Refund</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          <div className="relative transition-transform duration-200 peer-focus:-rotate-180">
            <DatePicker portalId="root-portal" popperPlacement="bottom-end"
              selected={selectedDate}
              onChange={(date) => { setSelectedDate(date); setCurrentPage(1); }}
              customInput={<CustomDateInput onClear={() => { setSelectedDate(null); setCurrentPage(1); }} />}
              dateFormat="MMM d, yyyy"
            />
          </div>

          <button onClick={handleExport} className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 lg:ml-4 cursor-pointer">
            <Download size={16} className="mr-2" /> Export
          </button>

          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center px-4 py-2 bg-[#1F3A34] text-white border-transparent text-sm font-bold rounded-lg hover:bg-[#2E5E58] transition-colors shadow-sm cursor-pointer">
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
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Wallet Tokens</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Total Orders</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Order Tokens Spent</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Last Order</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Status</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {isLoading && paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500 text-sm">
                      Loading customers...
                    </td>
                  </tr>
                ) : paginatedData.length > 0 ? paginatedData.map((customer) => (
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
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                      <div className="flex flex-col">
                        <span>{customer.spentTokens || formatTokens(customer.totalSpentTokens)}</span>
                        <span className="text-xs text-gray-500">{customer.spent}</span>
                      </div>
                    </td>
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
                                  deleteAdminCustomer(customer.id)
                                    .then(() => {
                                      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
                                      if (selectedCustomer?.id === customer.id) {
                                        setSelectedCustomer(null);
                                      }
                                    })
                                    .catch((error) => {
                                      alert(`Error deleting customer: ${error.message}`);
                                    });
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
          <div className="px-6 py-4 border-t border-gray-200 flex shrink-0 bg-white">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredData.length}
              itemName="customers"
            />
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
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-gray-900">{selectedCustomer.username}</h3>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${getTierColor(selectedCustomer.tier)}`}>{selectedCustomer.tier}</span>
                </div>
                <p className="text-sm text-gray-500">{selectedCustomer.email}</p>
                <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Member ID : C2-{String(selectedCustomer.id).padStart(3, '0')}</p>
              </div>
            </div>

            <div className="flex justify-between border-y border-gray-100 py-4 mb-6 text-center">
              <div>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">Wallet Tokens</p>
                <p className="font-bold text-gray-900">{selectedCustomer.tokens}</p>
              </div>
              <div className="w-px bg-gray-100"></div>
              <div>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">Total Orders</p>
                <p className="font-bold text-gray-900">{selectedCustomer.orders}</p>
              </div>
              <div className="w-px bg-gray-100"></div>
              <div>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">Order Tokens Spent</p>
                <p className="font-bold text-gray-900">{selectedCustomer.spentTokens || formatTokens(selectedCustomer.totalSpentTokens)}</p>
                <p className="text-[11px] text-gray-500 mt-1">RM equivalent: {selectedCustomer.spent}</p>
              </div>
            </div>

            {(() => {
              const progress = calculateTierProgress(selectedCustomer.cupsLast180d ?? selectedCustomer.orders);
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
                  name="username"
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
                  name="email"
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
                  name="phone"
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
