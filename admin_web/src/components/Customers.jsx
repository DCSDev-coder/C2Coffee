import React, { useState, forwardRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Wallet, Users, Megaphone, Search, ChevronDown, Download, Upload, Plus,
  X, Crown, ChevronRight, User, ClipboardList, Coins, Ticket, BarChart3
} from 'lucide-react';
import Pagination from './Pagination';
import InfoTooltip from './InfoTooltip';
import { useResponsivePageSize } from '../utils/useResponsivePageSize';
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
  importAdminCustomers,
  updateAdminCustomer,
  deleteAdminCustomer,
  loadAdminTierConfigs
} from '../lib/adminApi';

// oxlint-disable-next-line react/only-export-components
export const calculateTierProgress = (cupsStr, tiers = []) => {
  const cups = parseInt(cupsStr.toString().replace(/,/g, ''), 10) || 0;
  const activeTiers = Array.isArray(tiers) && tiers.length > 0
    ? [...tiers].filter((t) => t.isActive).sort((a, b) => a.minCups - b.minCups)
    : [];

  if (activeTiers.length === 0) {
    if (cups < 10) return { tier: 'Sipper', nextTier: 'Brewer', target: 10, current: cups, percentage: (cups / 10) * 100, remaining: 10 - cups, isBaseTier: true };
    if (cups < 30) return { tier: 'Brewer', nextTier: 'Roaster', target: 30, current: cups, percentage: (cups / 30) * 100, remaining: 30 - cups, isBaseTier: false };
    if (cups < 50) return { tier: 'Roaster', nextTier: 'Legendary', target: 50, current: cups, percentage: (cups / 50) * 100, remaining: 50 - cups, isBaseTier: false };
    return { tier: 'Legendary', nextTier: 'Max Tier', target: cups, current: cups, percentage: 100, remaining: 0, isBaseTier: false };
  }

  let currentTier = activeTiers[0];
  for (const tier of activeTiers) {
    if (cups >= tier.minCups) {
      currentTier = tier;
    } else {
      break;
    }
  }

  const currentIndex = activeTiers.findIndex((t) => t.code === currentTier.code);
  const nextTier = currentIndex >= 0 ? activeTiers[currentIndex + 1] ?? null : null;
  const target = nextTier ? nextTier.minCups : currentTier.minCups;
  const remaining = nextTier ? Math.max(0, nextTier.minCups - cups) : 0;
  const range = nextTier ? Math.max(1, nextTier.minCups - currentTier.minCups) : 1;
  const progressInTier = nextTier ? Math.max(0, cups - currentTier.minCups) : range;
  const percentage = nextTier ? Math.min(100, Math.round((progressInTier / range) * 100)) : 100;

  return {
    tier: currentTier.name,
    nextTier: nextTier ? nextTier.name : 'Max Tier',
    target,
    current: cups,
    percentage,
    remaining,
    isBaseTier: currentIndex === 0
  };
};

// oxlint-disable-next-line react/only-export-components
export const resolveTierProgress = (customer, tiers = []) => customer?.tierProgress ?? calculateTierProgress(customer?.cupsLast180d ?? customer?.orders, tiers);

const hasPurchaseHistory = (customer) => Number(customer?.orderCount ?? customer?.orders ?? 0) > 0;

const KPICard = ({ title, value, change, badge, icon: Icon, iconBg, info }) => {
  const displayBadge = badge || change;
  const bg = iconBg || 'bg-[#2E5E58]/10 text-[#2E5E58]';
  return (
    <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col justify-between min-w-0 card-reveal hover-lift cursor-default transition-all">
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <h2 className="text-gray-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">{title}</h2>
          {info && <InfoTooltip content={info} title={title} placement="top" />}
        </div>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
          <Icon size={15} strokeWidth={2.2} />
        </div>
      </div>
      <div className="mt-2.5 sm:mt-3 flex flex-col gap-1.5">
        <p className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight tabular-nums">{value}</p>
        {displayBadge && (
          <div className="flex">
            <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 truncate max-w-full">
              {displayBadge}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

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

const formatRm = (value) => {
  const amount = Number(value || 0);
  return `RM ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatTokens = (value) => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('en-US')} tokens`;
};

const subsidyRoleForCustomer = (customer) => customer?.subsidyRole || (customer?.isEmployee ? 'employee' : 'none');
const subsidyRoleLabel = (role) => ({ employee: 'Employee', intern: 'Intern', boss: 'Boss', none: 'No subsidy' }[role] || 'No subsidy');

const Avatar = ({ customer, size = 'md' }) => {
  const initials = String(customer?.username || 'C2')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const sizeClass = size === 'lg' ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-sm';

  return customer?.avatar ? (
    <img
      src={customer.avatar}
      alt={`${customer.username} profile`}
      className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-gray-200`}
      onError={(event) => {
        event.currentTarget.replaceWith(Object.assign(document.createElement('span'), {
          className: `${sizeClass} shrink-0 rounded-full bg-[#2E5E58] text-white flex items-center justify-center font-bold`,
          textContent: initials,
          ariaLabel: `${customer.username} profile`
        }));
      }}
    />
  ) : (
    <div className={`${sizeClass} shrink-0 rounded-full bg-[#2E5E58] text-white flex items-center justify-center font-bold`} aria-label={`${customer.username} profile`}>
      {initials}
    </div>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Active': return 'bg-green-100 text-green-600';
    case 'Pending signup': return 'bg-amber-100 text-amber-800';
    case 'Inactive': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getCustomerActivityStatus = (customer) => {
  if (customer.status === 'Pending signup') return 'Pending signup';
  if (Number(customer.orderCount ?? customer.orders ?? 0) === 0) return 'No orders yet';
  if (customer.status === 'Inactive') return 'Inactive';
  return 'Active';
};

const QuickLink = ({ icon: Icon, title, desc, iconBg, onClick }) => (
  <button type="button" onClick={onClick} className="w-full flex items-center justify-between py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0 text-left">
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

const parseCsvLine = (line) => {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
};

const normalizeImportHeader = (value) => value.trim().toLowerCase().replace(/[\s_-]+/g, '');

const normalizeImportedPhone = (value, rowNumber) => {
  const raw = String(value || '').trim();
  if (!raw) throw new Error(`Row ${rowNumber} is missing a phone number.`);
  if (/\d(?:\.\d+)?e[+-]?\d+/i.test(raw)) {
    throw new Error(`Row ${rowNumber} has a phone number stored as scientific notation (${raw}). Re-export the POS file with the Phone column formatted as text.`);
  }

  const compact = raw.replace(/[^\d+]/g, '');
  let phone = compact;
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  else if (phone.startsWith('60')) phone = `+${phone}`;
  else if (phone.startsWith('0')) phone = `+60${phone.slice(1)}`;

  if (!/^\+\d{9,15}$/.test(phone)) {
    throw new Error(`Row ${rowNumber} has an invalid Malaysian phone number.`);
  }
  return phone;
};

const parseCustomerImportCsv = (content) => {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error('The CSV must contain a header row and at least one customer.');
  }

  const headers = parseCsvLine(lines[0]).map(normalizeImportHeader);
  const phoneIndex = headers.findIndex((header) => ['phone', 'phonee164', 'mobile', 'mobilenumber'].includes(header));
  const nameIndex = headers.findIndex((header) => ['name', 'displayname', 'username', 'customername'].includes(header));
  const firstNameIndex = headers.findIndex((header) => ['firstname', 'givenname'].includes(header));
  const lastNameIndex = headers.findIndex((header) => ['lastname', 'familyname', 'surname'].includes(header));
  const emailIndex = headers.findIndex((header) => header === 'email');
  const employeeIndex = headers.findIndex((header) => ['employee', 'isemployee'].includes(header));
  const subsidyRoleIndex = headers.findIndex((header) => ['subsidyrole', 'subsidy', 'role'].includes(header));

  if (phoneIndex === -1) {
    throw new Error('The CSV needs a phone column. Use the downloadable template for the required format.');
  }

  const rows = [];
  const issues = [];
  const seenPhones = new Set();
  lines.slice(1).forEach((line, index) => {
    const cells = parseCsvLine(line);
    const rowNumber = index + 2;
    const rawPhone = String(cells[phoneIndex] || '').trim();
    // POS exports include a second-row instruction, not a customer record.
    if (/optional\.|country code/i.test(rawPhone)) return;

    try {
      const phone = normalizeImportedPhone(rawPhone, rowNumber);
      if (seenPhones.has(phone)) {
        throw new Error(`Row ${rowNumber} repeats the phone number ${phone}.`);
      }
      const displayName = nameIndex === -1
        ? [cells[firstNameIndex], cells[lastNameIndex]].filter(Boolean).join(' ').trim()
        : String(cells[nameIndex] || '').trim();
      const email = emailIndex === -1 ? '' : String(cells[emailIndex] || '').trim();
      const employeeValue = employeeIndex === -1 ? '' : String(cells[employeeIndex] || '').trim().toLowerCase();
      const requestedRole = subsidyRoleIndex === -1 ? '' : String(cells[subsidyRoleIndex] || '').trim().toLowerCase();
      const subsidyRole = ['employee', 'intern', 'boss', 'none'].includes(requestedRole)
        ? requestedRole
        : ['yes', 'true', '1', 'employee'].includes(employeeValue) ? 'employee' : 'none';

      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error(`Row ${rowNumber} has an invalid email address.`);
      }

      seenPhones.add(phone);
      rows.push({
        phone,
        displayName: displayName || undefined,
        email,
        isEmployee: subsidyRole !== 'none',
        subsidyRole
      });
    } catch (error) {
      issues.push(error?.message || `Row ${rowNumber} could not be imported.`);
    }
  });

  if (rows.length > 500) {
    throw new Error('Import up to 500 customers at one time. Split larger files into smaller CSV files.');
  }
  return { rows, issues };
};

const Customers = ({ currentUser }) => {
  const canManageCustomers = Array.isArray(currentUser?.roles) && currentUser.roles.includes('super_admin');
  const [customers, setCustomers] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('All Tiers');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedEmployment, setSelectedEmployment] = useState('All Customers');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState([null, null]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tierOpen, setTierOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeView, setActiveView] = useState('list');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [customerConfirmation, setCustomerConfirmation] = useState(null);
  const [confirmationPassword, setConfirmationPassword] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importError, setImportError] = useState('');
  const [importIssues, setImportIssues] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const itemsPerPage = useResponsivePageSize(5, 10);

  useEffect(() => {
    let isMounted = true;

    const fetchCustomers = async ({ keepSelection = false, silent = false } = {}) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        setLoadError('');
        const [response, tierRes] = await Promise.all([
          loadAdminCustomers(),
          loadAdminTierConfigs().catch(() => ({ tiers: [] }))
        ]);
        if (!isMounted) return;

        const nextCustomers = Array.isArray(response?.customers) ? response.customers : [];
        setCustomers(nextCustomers);
        if (Array.isArray(tierRes?.tiers)) {
          setTiers(tierRes.tiers);
        }

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
      customer.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(customer.tokenBalance ?? customer.tokens ?? '').includes(searchQuery);
    const matchesTier = selectedTier === 'All Tiers' || customer.tier === selectedTier || customer.tierCode === selectedTier;
    const matchesStatus = selectedStatus === 'All Status' || getCustomerActivityStatus(customer) === selectedStatus;
    const matchesEmployment = selectedEmployment === 'All Customers'
      || (selectedEmployment === 'Employees' && customer.isEmployee)
      || (selectedEmployment === 'Customers' && !customer.isEmployee);

    const customerDate = customer.lastOrderAt ? new Date(customer.lastOrderAt) : null;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    let rangeStart = null;
    let rangeEnd = null;
    if (selectedPeriod === 'today') rangeStart = startOfToday;
    if (selectedPeriod === 'this_week') rangeStart = startOfWeek;
    if (selectedPeriod === 'this_month') rangeStart = startOfMonth;
    if (selectedPeriod === 'this_year') rangeStart = startOfYear;
    if (selectedPeriod === 'custom') {
      rangeStart = selectedDateRange[0] ? new Date(selectedDateRange[0].getTime()) : null;
      rangeEnd = selectedDateRange[1] ? new Date(selectedDateRange[1].getTime()) : rangeStart;
      if (rangeStart) rangeStart.setHours(0, 0, 0, 0);
      if (rangeEnd) rangeEnd.setHours(23, 59, 59, 999);
    }
    const matchesDate = selectedPeriod === 'all' || !rangeStart
      ? true
      : Boolean(customerDate && customerDate >= rangeStart && (!rangeEnd ? customerDate <= now : customerDate <= rangeEnd));

    return matchesSearch && matchesTier && matchesStatus && matchesEmployment && matchesDate;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = showAllCustomers ? filteredData : filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

  const downloadImportTemplate = () => {
    exportToCSV([
      ['name', 'phone', 'email', 'subsidy_role'],
      ['Example Customer', '+60123456789', 'customer@example.com', 'none']
    ], 'c2-customer-import-template.csv');
  };

  const resetImport = () => {
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName('');
    setImportPassword('');
    setImportError('');
    setImportIssues([]);
    setImportResult(null);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportError('');
    setImportResult(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportRows([]);
      setImportFileName('');
      setImportIssues([]);
      setImportError('Please choose a CSV file.');
      return;
    }

    try {
      const parsed = parseCustomerImportCsv(await file.text());
      setImportRows(parsed.rows);
      setImportIssues(parsed.issues);
      setImportFileName(file.name);
    } catch (error) {
      setImportRows([]);
      setImportFileName('');
      setImportIssues([]);
      setImportError(error?.message || 'This CSV could not be read.');
    }
  };

  const submitImport = async (event) => {
    event.preventDefault();
    if (!importRows.length || !importPassword || isImporting) return;

    setIsImporting(true);
    setImportError('');
    try {
      const result = await importAdminCustomers({
        customers: importRows,
        confirmation_password: importPassword
      });
      setImportResult({ ...result, rejected_rows: importIssues });
      setImportPassword('');
      const response = await loadAdminCustomers();
      setCustomers(Array.isArray(response?.customers) ? response.customers : []);
    } catch (error) {
      setImportError(error?.message || 'The customer import could not be completed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddCustomer = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      phone: String(form.get('phone') || '').trim(),
      displayName: String(form.get('username') || '').trim(),
      email: String(form.get('email') || '').trim(),
      subsidyRole: String(form.get('subsidyRole') || 'none'),
      isEmployee: form.get('subsidyRole') !== 'none'
    };

    setCustomerConfirmation({ type: 'create', payload, label: payload.displayName || 'this customer' });
    setConfirmationPassword('');
  };

  const handleEditCustomer = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      phone: String(form.get('phone') || '').trim(),
      displayName: String(form.get('username') || '').trim(),
      email: String(form.get('email') || '').trim(),
      subsidyRole: String(form.get('subsidyRole') || 'none'),
      isEmployee: form.get('subsidyRole') !== 'none'
    };

    setCustomerConfirmation({ type: 'edit', payload, customer: editingCustomer, label: editingCustomer.username });
    setConfirmationPassword('');
  };

  const confirmCustomerAction = async () => {
    if (!customerConfirmation || !confirmationPassword) return;

    setIsConfirming(true);
    try {
      const payload = {
        ...customerConfirmation.payload,
        confirmation_password: confirmationPassword
      };
      let response;
      if (customerConfirmation.type === 'create') {
        response = await createAdminCustomer(payload);
      } else if (customerConfirmation.type === 'edit') {
        response = await updateAdminCustomer(customerConfirmation.customer.id, payload);
      } else {
        response = await deleteAdminCustomer(customerConfirmation.customer.id, payload);
      }

      if (customerConfirmation.type === 'delete') {
        setCustomers((prev) => prev.filter((customer) => customer.id !== customerConfirmation.customer.id));
        if (selectedCustomer?.id === customerConfirmation.customer.id) {
          setSelectedCustomer(null);
        }
      } else if (response?.customer) {
        setCustomers((prev) => customerConfirmation.type === 'create'
          ? [response.customer, ...prev]
          : prev.map((customer) => (customer.id === response.customer.id ? response.customer : customer))
        );
        setSelectedCustomer((prev) => (prev?.id === response.customer.id ? response.customer : prev));
      }

      setIsAddModalOpen(false);
      setEditingCustomer(null);
      setCustomerConfirmation(null);
      setConfirmationPassword('');
    } catch (error) {
      setCustomerConfirmation((current) => ({
        ...current,
        error: error?.message || 'The customer change could not be saved.'
      }));
    } finally {
      setIsConfirming(false);
    }
  };

  const submitCustomerConfirmation = () => {
    void confirmCustomerAction();
  };

  const totalCustomers = filteredData.length;
  const activeTiers = tiers.filter((t) => t.isActive);
  const baseTierName = activeTiers[0]?.name || 'Sipper';
  const activeTierMembers = filteredData.filter((customer) => !resolveTierProgress(customer, tiers).isBaseTier).length;
  const employeeCustomers = filteredData.filter((customer) => customer.isEmployee).length;
  const nonEmployeeCustomers = filteredData.filter((customer) => !customer.isEmployee).length;
  const totalSpendRm = filteredData.reduce((sum, customer) => sum + Number(customer.totalSpentRm || 0), 0);
  const totalSpendTokens = filteredData.reduce((sum, customer) => sum + Number(customer.totalPersonalTokens || 0), 0);
  const totalSubsidyTokens = filteredData.reduce((sum, customer) => sum + Number(customer.totalSubsidyTokens || 0), 0);
  const totalOrders = filteredData.reduce((sum, customer) => sum + Number(customer.orderCount ?? customer.orders ?? 0), 0);
  const totalOrderTokens = filteredData.reduce((sum, customer) => sum + Number(customer.totalSpentTokens || 0), 0);
  const averageSpendRm = totalOrders > 0 ? totalSpendRm / totalOrders : 0;
  const averageSpendTokens = totalOrders > 0 ? totalOrderTokens / totalOrders : 0;

  return (
    <div className="px-4 sm:px-6 md:px-8 pb-8 pt-2 h-full flex flex-col">
      {/* Header section */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-500 text-xs sm:text-sm">Customer accounts, profiles, and order activity.</p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 flex-shrink-0">
        <KPICard title="Customers" value={totalCustomers.toLocaleString('en-US')} badge={`${employeeCustomers} employees · ${nonEmployeeCustomers} non-employees`} icon={Wallet} iconBg="bg-[#1F3A34]/10 text-[#1F3A34]" />
        <KPICard title="Active Tier Members" value={activeTierMembers.toLocaleString('en-US')} badge={`Customers above ${baseTierName} tier`} icon={Users} iconBg="bg-[#6F9F96]/20 text-[#2E5E58]" />
        <KPICard title="Token Usage" value={formatTokens(totalSpendTokens)} badge={`Subsidy: ${formatTokens(totalSubsidyTokens)}`} icon={Megaphone} iconBg="bg-[#E07A5F]/15 text-[#E07A5F]" />
        <KPICard title="Average Order Tokens Spent" value={formatTokens(averageSpendTokens)} badge={`RM equivalent: ${formatRm(averageSpendRm)}`} icon={Users} iconBg="bg-amber-500/15 text-amber-700" />
      </div>

      {/* Search, filters, and actions */}
      <div className="mb-6 flex-shrink-0 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
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

          {canManageCustomers && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setImportError('');
                  setImportResult(null);
                  setIsImportModalOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <Upload size={16} className="mr-2" /> Import CSV
              </button>
              <button type="button" onClick={() => setIsAddModalOpen(true)} className="inline-flex items-center justify-center rounded-lg bg-[#1F3A34] px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#2E5E58]">
                <Plus size={16} className="mr-2" /> Add Customer
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-gray-400">Filter by</span>
          <div className="relative">
            <select
              value={selectedTier}
              onChange={(e) => { setSelectedTier(e.target.value); setCurrentPage(1); }}
              onFocus={() => setTierOpen(true)}
              onBlur={() => setTierOpen(false)}
              className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer w-full"
            >
              <option value="All Tiers">All Tiers</option>
              {tiers.length > 0 ? (
                tiers.map((tier) => (
                  <option key={tier.id || tier.code} value={tier.name}>
                    {tier.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="Sipper">Sipper</option>
                  <option value="Brewer">Brewer</option>
                  <option value="Roaster">Roaster</option>
                  <option value="Legendary">Legendary</option>
                </>
              )}
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
              <option value="Active">Active</option>
              <option value="No orders yet">No orders yet</option>
              <option value="Pending signup">Pending signup</option>
              <option value="Inactive">Inactive</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          <div className="relative">
            <select
              value={selectedEmployment}
              onChange={(e) => { setSelectedEmployment(e.target.value); setCurrentPage(1); }}
              className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer w-full"
              aria-label="Filter by employee status"
            >
              <option value="All Customers">All Customers</option>
              <option value="Employees">Employees</option>
              <option value="Customers">Non-employees</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className="text-gray-500" />
            </div>
          </div>

          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => { setSelectedPeriod(e.target.value); if (e.target.value !== 'custom') setSelectedDateRange([null, null]); setCurrentPage(1); }}
              className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="this_year">This year</option>
              <option value="custom">Choose dates</option>
            </select>
          </div>
          {selectedPeriod === 'custom' && (
            <DatePicker
              portalId="root-portal"
              popperPlacement="bottom-end"
              selectsRange
              startDate={selectedDateRange[0]}
              endDate={selectedDateRange[1]}
              onChange={(range) => { setSelectedDateRange(range); setCurrentPage(1); }}
              customInput={<CustomDateInput onClear={() => { setSelectedDateRange([null, null]); setCurrentPage(1); }} />}
              dateFormat="MMM d, yyyy"
            />
          )}
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
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">C2 Credit Tokens</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Total Orders</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Personal / Subsidy</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Last Order</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {isLoading && paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500 text-sm">
                      Loading customers...
                    </td>
                  </tr>
                ) : paginatedData.length > 0 ? paginatedData.map((customer) => (
                  <tr
                    key={customer.id}
                    className={`cursor-pointer transition-colors hover:bg-gray-50 ${selectedCustomer?.id === customer.id ? 'bg-gray-50' : ''}`}
                    onClick={() => {
                      setSelectedCustomer(customer);
                    }}
                  >
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar customer={customer} />
                        <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-bold text-gray-900">{customer.username}</div>
                          {subsidyRoleForCustomer(customer) !== 'none' && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                              {subsidyRoleLabel(subsidyRoleForCustomer(customer))}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{customer.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {hasPurchaseHistory(customer) ? (
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md ${getTierColor(customer.tier)}`}>
                          {customer.tier}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-gray-400">No tier yet</span>
                      )}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{customer.tokens}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{customer.orders}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                      <div className="flex flex-col">
                        <span>Personal: {formatTokens(customer.totalPersonalTokens)}</span>
                        <span className="text-xs text-amber-700">Subsidy: {formatTokens(customer.totalSubsidyTokens)}</span>
                        <span className="text-xs text-gray-500">{customer.spent}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{customer.lastOrder}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md ${getStatusColor(getCustomerActivityStatus(customer))}`}>
                        {getCustomerActivityStatus(customer)}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500 text-sm">
                      No customers found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 sm:px-6 py-3.5 border-t border-gray-200 shrink-0 bg-white">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredData.length}
              itemName="customers"
              showAll={showAllCustomers}
              onToggleShowAll={() => setShowAllCustomers(!showAllCustomers)}
              action={(
                <button onClick={handleExport} className="flex items-center gap-1.5 px-3.5 py-1.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 cursor-pointer shadow-2xs">
                  <Download size={14} /> Export
                </button>
              )}
            />
          </div>
        </div>

        {/* Customer Overview Sidebar */}
        {selectedCustomer && (
          <div className="w-full xl:w-[380px] bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col relative shrink-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Customer Overview</h2>
              <button className="text-gray-400 hover:text-gray-900" onClick={() => setSelectedCustomer(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-3">
                <Avatar customer={selectedCustomer} size="lg" />
                <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-gray-900">{selectedCustomer.username}</h3>
                  {hasPurchaseHistory(selectedCustomer) && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${getTierColor(selectedCustomer.tier)}`}>{selectedCustomer.tier}</span>
                  )}
                  {subsidyRoleForCustomer(selectedCustomer) !== 'none' && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">{subsidyRoleLabel(subsidyRoleForCustomer(selectedCustomer))}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{selectedCustomer.email}</p>
                <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Member ID : C2-{String(selectedCustomer.id).padStart(3, '0')}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between border-y border-gray-100 py-4 mb-6 text-center">
              <div>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">C2 Credit Tokens</p>
                <p className="font-bold text-gray-900">{selectedCustomer.tokens}</p>
              </div>
              <div className="w-px bg-gray-100"></div>
              <div>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">Total Orders</p>
                <p className="font-bold text-gray-900">{selectedCustomer.orders}</p>
              </div>
              <div className="w-px bg-gray-100"></div>
              <div>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">Personal Tokens</p>
                <p className="font-bold text-gray-900">{formatTokens(selectedCustomer.totalPersonalTokens)}</p>
                <p className="text-[11px] text-amber-700 mt-1">Subsidy: {formatTokens(selectedCustomer.totalSubsidyTokens)}</p>
                <p className="text-[11px] text-gray-500 mt-1">RM equivalent: {selectedCustomer.spent}</p>
              </div>
            </div>

            {(() => {
              const progress = calculateTierProgress(selectedCustomer.cupsLast180d ?? selectedCustomer.orders);
              if (!hasPurchaseHistory(selectedCustomer)) {
                return (
                  <div className="bg-[#1F3A34] rounded-xl p-5 mb-8 text-white relative overflow-hidden">
                    <div className="flex items-center space-x-3 relative z-10">
                      <Crown size={24} className="text-white/60" />
                      <div>
                        <p className="font-bold">No tier yet</p>
                        <p className="text-xs text-white/70">Complete your first eligible purchase to enter Sipper.</p>
                      </div>
                    </div>
                  </div>
                );
              }
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
                <QuickLink icon={User} title="View Profile" desc="Personal details and contact information" iconBg="bg-[#1F3A2A]" onClick={() => setActiveView('profile')} />
                <QuickLink icon={ClipboardList} title="Order History" desc={`${selectedCustomer.orders} order${Number(selectedCustomer.orders) === 1 ? '' : 's'} · invoices and status`} iconBg="bg-[#2E5E58]" onClick={() => setActiveView('orders')} />
                <QuickLink icon={Coins} title="Token Transactions" desc={`${formatTokens(selectedCustomer.totalPersonalTokens)} personal · ${formatTokens(selectedCustomer.totalSubsidyTokens)} subsidy`} iconBg="bg-[#B7CFCA]" onClick={() => setActiveView('tokens')} />
                <QuickLink icon={Ticket} title="Voucher History" desc="View claimed and used vouchers" iconBg="bg-[#E07A5F]" onClick={() => setActiveView('vouchers')} />
                <QuickLink icon={BarChart3} title="Tier Progress" desc={hasPurchaseHistory(selectedCustomer) ? `${selectedCustomer.tier} progress and upgrades` : 'No tier activity yet'} iconBg="bg-[#D4AF7A]" onClick={() => setActiveView('tiers')} />
              </div>
            </div>

            {canManageCustomers && <div className="mt-auto">
              <button
                onClick={() => setEditingCustomer(selectedCustomer)}
                className="w-full py-3 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ✎ Edit Customer
              </button>
            </div>}
          </div>
        )}
      </div>

      {isImportModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex min-h-full items-start justify-center py-4 sm:items-center w-full">
            <form onSubmit={submitImport} className="my-auto w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Import Customers</h2>
                <p className="mt-1 text-sm text-gray-500">Import up to 500 existing POS customers from a CSV file.</p>
              </div>
              <button type="button" onClick={resetImport} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer" aria-label="Close customer import">
                <X size={20} />
              </button>
            </div>

            {!importResult ? (
              <>
                <div className="mt-5 rounded-xl border border-[#B7CFCA] bg-[#F3F7F6] p-4 text-sm text-gray-700">
                  <p className="font-bold text-gray-900">Use the import template</p>
                <p className="mt-1">Required: <span className="font-medium">phone</span> in international format, for example <span className="font-medium">+60123456789</span>. Optional: name, email, subsidy_role (none, employee, intern, boss).</p>
                  <button type="button" onClick={downloadImportTemplate} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1F3A34] hover:text-[#2E5E58]">
                    <Download size={15} /> Download CSV template
                  </button>
                </div>

                <label className="mt-5 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center hover:border-[#2E5E58] hover:bg-[#F3F7F6]">
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleImportFile} />
                  <span>
                    <Upload size={22} className="mx-auto text-[#2E5E58]" />
                    <span className="mt-2 block text-sm font-bold text-gray-900">Choose customer CSV</span>
                    <span className="mt-1 block text-xs text-gray-500">Do not upload passwords, card data, or token balances.</span>
                  </span>
                </label>

                {importFileName && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
                    <span className="font-bold text-gray-900">{importFileName}</span>
                    <span className="ml-2 text-gray-500">{importRows.length} customer{importRows.length === 1 ? '' : 's'} ready to import</span>
                  </div>
                )}
                {importIssues.length > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-bold">{importIssues.length} row{importIssues.length === 1 ? '' : 's'} will be excluded</p>
                    <p className="mt-1">The valid rows can still be imported. Fix these rows in the POS export before a later import.</p>
                    <ul className="mt-2 max-h-28 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                      {importIssues.slice(0, 10).map((issue) => <li key={issue}>{issue}</li>)}
                    </ul>
                    {importIssues.length > 10 && <p className="mt-2 text-xs">Plus {importIssues.length - 10} more excluded rows.</p>}
                  </div>
                )}
                {importRows.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                    <div className="grid grid-cols-3 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500">
                      <span>Name</span><span>Phone</span><span>Subsidy role</span>
                    </div>
                    {importRows.slice(0, 5).map((customer) => (
                      <div key={customer.phone} className="grid grid-cols-3 border-t border-gray-100 px-4 py-2 text-sm text-gray-700">
                        <span>{customer.displayName || 'C2 Member'}</span><span>{customer.phone}</span><span>{subsidyRoleLabel(customer.subsidyRole || (customer.isEmployee ? 'employee' : 'none'))}</span>
                      </div>
                    ))}
                    {importRows.length > 5 && <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">Plus {importRows.length - 5} more customers.</p>}
                  </div>
                )}
                {importError && <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{importError}</p>}

                <label className="mt-5 block text-sm font-medium text-gray-700">
                  Confirm with your current password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={importPassword}
                    onChange={(event) => setImportPassword(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#2E5E58] focus:ring-[#2E5E58]"
                  />
                </label>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={resetImport} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">Cancel</button>
                  <button type="submit" disabled={!importRows.length || !importPassword || isImporting} className="rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-medium text-white hover:bg-[#2E5E58] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                    {isImporting ? 'Importing...' : `Import ${importRows.length || ''} customer${importRows.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-6">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  <p className="font-bold">Customer import completed</p>
                  <p className="mt-1">Created: {importResult.created || 0}. Linked existing account: {importResult.linked_existing || 0}. Already in this outlet: {importResult.skipped_existing || 0}.</p>
                  <p className="mt-1">Rejected before import: {importResult.rejected_rows?.length || 0}.</p>
                  {(importResult.created || 0) > 0 && <p className="mt-2 text-amber-800">New imports remain pending until each customer completes Sign Up in the mobile app.</p>}
                </div>
                {importResult.rejected_rows?.length > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-bold">Excluded row details</p>
                    <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                      {importResult.rejected_rows.slice(0, 20).map((issue) => <li key={issue}>{issue}</li>)}
                    </ul>
                    {importResult.rejected_rows.length > 20 && <p className="mt-2 text-xs">Plus {importResult.rejected_rows.length - 20} more excluded rows.</p>}
                  </div>
                )}
                <p className="mt-4 text-sm text-gray-500">New customers must complete Sign Up in the mobile app before they can log in.</p>
                <div className="mt-6 flex justify-end"><button type="button" onClick={resetImport} className="rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-medium text-white hover:bg-[#2E5E58] cursor-pointer">Done</button></div>
              </div>
            )}
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add/Edit Customer Modal */}
      {(isAddModalOpen || editingCustomer) && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button onClick={() => { setIsAddModalOpen(false); setEditingCustomer(null); }} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
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
              <label className="block rounded-lg border border-[#B7CFCA] bg-[#F3F7F6] p-3 text-sm text-gray-700">
                <span className="block font-semibold text-gray-900">Company subsidy role</span>
                <span className="block text-xs text-gray-500">Boss is unlimited for eligible drinks. Employee and Intern use the monthly policy configured in Token Ledger.</span>
                <select
                  name="subsidyRole"
                  defaultValue={subsidyRoleForCustomer(editingCustomer)}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-[#2E5E58] focus:border-[#2E5E58]"
                >
                  <option value="none">No subsidy</option>
                  <option value="employee">Employee</option>
                  <option value="intern">Intern</option>
                  <option value="boss">Boss (unlimited)</option>
                </select>
              </label>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingCustomer(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#2E5E58] border border-transparent rounded-lg hover:bg-[#1F3A34] cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {customerConfirmation && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-gray-900">
              {customerConfirmation.type === 'delete'
                ? 'Delete customer?'
                : customerConfirmation.type === 'edit'
                  ? 'Save customer changes?'
                  : 'Create customer?'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {customerConfirmation.type === 'delete'
                ? `Delete ${customerConfirmation.label}?`
                : customerConfirmation.type === 'edit'
                  ? `Apply the changes to ${customerConfirmation.label}?`
                  : `Create ${customerConfirmation.label}?`}
            </p>
            {customerConfirmation.error && (
              <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                {customerConfirmation.error}
              </div>
            )}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="customer-action-confirmation-password">
                Confirm with your current password
              </label>
              <input
                id="customer-action-confirmation-password"
                type="password"
                autoComplete="current-password"
                value={confirmationPassword}
                onChange={(event) => setConfirmationPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#2E5E58] focus:ring-[#2E5E58]"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => {
                  setCustomerConfirmation(null);
                  setConfirmationPassword('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={isConfirming || !confirmationPassword}
                onClick={submitCustomerConfirmation}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 cursor-pointer ${customerConfirmation.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#2E5E58] hover:bg-[#1F3A34]'}`}
              >
                {isConfirming ? 'Confirming...' : customerConfirmation.type === 'delete' ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Customers;
