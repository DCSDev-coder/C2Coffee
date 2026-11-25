import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Briefcase,
  Download,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  Users
} from 'lucide-react';
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Pagination from './Pagination';
import InfoTooltip from './InfoTooltip';
import { useResponsivePageSize } from '../utils/useResponsivePageSize';
import { getAdminApiBaseUrl, loadAdminProductReport } from '../lib/adminApi';
import { formatReportMoney, formatReportTokens } from '../utils/reporting';
import { exportToCSV } from '../utils/exportToCSV';
import OutletFilter from './OutletFilter';

const REFRESH_INTERVAL_MS = 60_000;

const formatMonthLabel = (monthKey) => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return 'All months';
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur'
  }).format(new Date(Date.UTC(year, month - 1, 1)));
};

const EMPTY_REPORT = {
  products: [],
  chartData: [],
  availableMonths: [],
  summary: {
    totalProducts: 0,
    totalUnitsSold: 0,
    totalRevenueRm: 0,
    customerUnitsSold: 0,
    customerRevenueRm: 0,
    employeeUnitsSold: 0,
    employeeRevenueRm: 0,
    topProduct: '',
    topProductUnits: 0,
    topProductRevenueRm: 0,
    topCustomerProduct: '',
    topCustomerProductUnits: 0,
    topCustomerProductRevenueRm: 0,
    topEmployeeProduct: '',
    topEmployeeProductUnits: 0,
    topEmployeeProductRevenueRm: 0
  }
};

function resolveProductImageUrl(imageUrl) {
  const value = String(imageUrl ?? '').trim();
  if (!value || /^data:/i.test(value) || /^https?:\/\//i.test(value)) {
    return value;
  }

  return `${getAdminApiBaseUrl()}${value.startsWith('/') ? value : `/${value}`}`;
}

const CustomDateInput = forwardRef(({ value, onClick }, ref) => (
  <button
    type="button"
    ref={ref}
    onClick={onClick}
    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 w-full sm:w-auto text-left min-w-[140px]"
  >
    {value || 'Select Date'}
  </button>
));

const StatCard = ({ title, value, subtitle, badge, icon: Icon, iconBg, info }) => {
  const displayBadge = badge || subtitle;
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

function SortableHeader({ label, columnKey, currentKey, direction, onSort, info, className = "" }) {
  const isSorted = currentKey === columnKey;
  return (
    <th className={`px-6 py-4 font-bold text-[11px] text-gray-500 uppercase tracking-wider whitespace-nowrap ${className}`}>
      <div className={`flex items-center gap-1.5 ${className.includes('text-right') ? 'justify-end' : className.includes('text-center') ? 'justify-center' : ''}`}>
        <button
          type="button"
          onClick={() => onSort(columnKey)}
          className={`group inline-flex items-center gap-1.5 hover:text-[#1E433A] cursor-pointer focus:outline-none transition-colors select-none ${
            isSorted ? "text-[#1E433A] font-bold" : ""
          }`}
          title={`Sort by ${label} ${isSorted && direction === "asc" ? "(Descending)" : "(Ascending)"}`}
        >
          <span>{label}</span>
          <span className="inline-flex items-center">
            {isSorted ? (
              direction === "asc" ? (
                <ArrowUp size={13} className="text-[#1E433A]" strokeWidth={2.5} />
              ) : (
                <ArrowDown size={13} className="text-[#1E433A]" strokeWidth={2.5} />
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
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-[#1F3A34] p-3 rounded-lg border-none text-white text-xs font-bold shadow-lg">
      <p className="mb-2 text-sm">{label}</p>
      <p className="mb-1">Customers: {Number(data.customerUnitsSold || 0).toLocaleString('en-US')} units</p>
      <p className="mb-1">Employee / Intern: {Number(data.employeeUnitsSold || 0).toLocaleString('en-US')} units</p>
      <p className="mb-1">Total Units: {Number(data.quantitySold || 0).toLocaleString('en-US')}</p>
      <p>Total Revenue: {formatReportMoney(data.revenueRm || 0)}</p>
    </div>
  );
};

const ReportByProduct = ({ onBack }) => {
  const [reportResponse, setReportResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [productSortKey, setProductSortKey] = useState('unitsSold');
  const [productSortDirection, setProductSortDirection] = useState('desc');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const itemsPerPage = useResponsivePageSize(5, 10);

  useEffect(() => {
    let active = true;

    const loadReport = async () => {
      try {
        setError('');
        const response = await loadAdminProductReport(selectedDate, selectedStoreId, selectedMonth || null);
        if (!active) return;
        setReportResponse(response || EMPTY_REPORT);
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load product report.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadReport();
    const timer = window.setInterval(() => {
      void loadReport();
    }, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedDate, selectedStoreId, selectedMonth]);

  const overview = reportResponse || EMPTY_REPORT;
  const products = useMemo(
    () => Array.isArray(overview.products) ? overview.products : [],
    [overview.products]
  );
  const chartData = Array.isArray(overview.chartData) ? overview.chartData : [];

  const safeSearchTerm = searchTerm.trim().toLowerCase();
  const filteredData = useMemo(() => {
    return products.filter((product) => (
      String(product.name ?? '').toLowerCase().includes(safeSearchTerm)
      || String(product.category ?? '').toLowerCase().includes(safeSearchTerm)
      || String(product.subcategory ?? '').toLowerCase().includes(safeSearchTerm)
      || String(product.productKind ?? '').toLowerCase().includes(safeSearchTerm)
    ));
  }, [products, safeSearchTerm]);

  const handleProductSort = (key) => {
    if (productSortKey === key) {
      setProductSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setProductSortKey(key);
      setProductSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal, bVal;
      if (productSortKey === 'name') {
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
      } else if (productSortKey === 'category') {
        aVal = (a.category || '').toLowerCase();
        bVal = (b.category || '').toLowerCase();
      } else if (productSortKey === 'subcategory') {
        aVal = (a.subcategory || '').toLowerCase();
        bVal = (b.subcategory || '').toLowerCase();
      } else if (productSortKey === 'unitsSold') {
        aVal = Number(a.quantitySold || 0);
        bVal = Number(b.quantitySold || 0);
      } else if (productSortKey === 'customerUnits') {
        aVal = Number(a.customerUnitsSold || 0);
        bVal = Number(b.customerUnitsSold || 0);
      } else if (productSortKey === 'employeeUnits') {
        aVal = Number(a.employeeUnitsSold || 0);
        bVal = Number(b.employeeUnitsSold || 0);
      } else if (productSortKey === 'customerRevenue') {
        aVal = Number(a.customerRevenueRm || 0);
        bVal = Number(b.customerRevenueRm || 0);
      } else if (productSortKey === 'revenue') {
        aVal = Number(a.revenueRm || 0);
        bVal = Number(b.revenueRm || 0);
      } else if (productSortKey === 'tokenPrice') {
        aVal = Number(a.basePriceToken || 0);
        bVal = Number(b.basePriceToken || 0);
      } else if (productSortKey === 'status') {
        aVal = a.isActive ? 1 : 0;
        bVal = b.isActive ? 1 : 0;
      } else if (productSortKey === 'lastOrdered') {
        aVal = a.lastOrderedAt ? new Date(a.lastOrderedAt).getTime() : 0;
        bVal = b.lastOrderedAt ? new Date(b.lastOrderedAt).getTime() : 0;
      }

      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null || aVal === '') return 1;
      if (bVal === undefined || bVal === null || bVal === '') return -1;
      const res = aVal > bVal ? 1 : -1;
      return productSortDirection === 'asc' ? res : -res;
    });
  }, [filteredData, productSortKey, productSortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const currentRows = showAllProducts ? sortedData : sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportRows = useMemo(() => [
    ['Product Name', 'Category', 'Subcategory', 'Customer Units', 'Employee/Intern Units', 'Total Units', 'Customer Revenue (RM)', 'Employee/Intern Value (RM)', 'Total Revenue (RM)', 'Token Price', 'Last Ordered', 'Active'],
    ...filteredData.map((product) => [
      `"${product.name}"`,
      `"${product.category}"`,
      `"${product.subcategory}"`,
      Number(product.customerUnitsSold || 0).toFixed(0),
      Number(product.employeeUnitsSold || 0).toFixed(0),
      Number(product.quantitySold || 0).toFixed(0),
      Number(product.customerRevenueRm || 0).toFixed(2),
      Number(product.employeeRevenueRm || 0).toFixed(2),
      Number(product.revenueRm || 0).toFixed(2),
      Number(product.basePriceToken || 0).toFixed(0),
      `"${product.lastOrderedAt || ''}"`,
      product.isActive ? 'Yes' : 'No'
    ])
  ], [filteredData]);

  const handleExport = () => {
    exportToCSV(exportRows, 'product_report.csv');
  };

  const refreshReport = async () => {
    try {
      const response = await loadAdminProductReport(selectedDate, selectedStoreId, selectedMonth || null);
      setReportResponse(response || EMPTY_REPORT);
      setLastUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load product report.');
    }
  };

  const availableMonths = Array.isArray(overview.availableMonths) ? overview.availableMonths : [];
  const scopeLabel = `${selectedDate ? selectedDate.toLocaleDateString('en-MY', { dateStyle: 'medium' }) : selectedMonth ? formatMonthLabel(selectedMonth) : 'All-time'} · ${selectedStoreId ? 'Selected outlet' : 'All outlets'}`;

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col space-y-6">
        <div className="shrink-0 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              title="Back to Finance"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-gray-900">Product Report</h1>
                <span className="rounded-full bg-[#EEF6F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#1F5A4D]">
                  {scopeLabel}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Live sales and revenue by individual menu item.</p>
              <p className="text-xs text-gray-400 mt-1">
                {loading ? 'Refreshing live data...' : error ? `Showing last successful data. ${error}` : `Last updated ${lastUpdatedAt?.toLocaleString('en-MY') || 'just now'}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter product report by month"
              value={selectedMonth}
              onChange={(event) => {
                setSelectedMonth(event.target.value);
                if (event.target.value) setSelectedDate(null);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2E5E58]/30 shadow-sm cursor-pointer"
            >
              <option value="">All months</option>
              {availableMonths.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatMonthLabel(monthKey)}
                </option>
              ))}
            </select>
            <OutletFilter value={selectedStoreId} onChange={setSelectedStoreId} />
            <button
              type="button"
              onClick={() => void refreshReport()}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
          <StatCard
            title="Customer Sales"
            value={formatReportMoney(overview.summary.customerRevenueRm)}
            subtitle={`${Number(overview.summary.customerUnitsSold || 0).toLocaleString('en-US')} units sold to customers`}
            icon={Users}
            iconBg="bg-[#1F3A34]/10 text-[#1F3A34]"
            info="Product sales and units ordered by non-employee customers."
          />
          <StatCard
            title="Employee / Intern"
            value={`${Number(overview.summary.employeeUnitsSold || 0).toLocaleString('en-US')} units`}
            subtitle={`${formatReportMoney(overview.summary.employeeRevenueRm)} order value`}
            icon={Briefcase}
            iconBg="bg-blue-500/10 text-blue-700"
            info="Units and order value ordered by employees and interns."
          />
          <StatCard
            title="Top Customer Choice"
            value={overview.summary.topCustomerProduct || '—'}
            subtitle={overview.summary.topCustomerProduct ? `${Number(overview.summary.topCustomerProductUnits || 0).toLocaleString('en-US')} units · ${formatReportMoney(overview.summary.topCustomerProductRevenueRm)}` : 'No customer orders'}
            icon={ShoppingCart}
            iconBg="bg-emerald-500/10 text-emerald-700"
            info="Most popular product among customers by units sold."
          />
          <StatCard
            title="Top Employee / Intern Choice"
            value={overview.summary.topEmployeeProduct || '—'}
            subtitle={overview.summary.topEmployeeProduct ? `${Number(overview.summary.topEmployeeProductUnits || 0).toLocaleString('en-US')} units · ${formatReportMoney(overview.summary.topEmployeeProductRevenueRm)}` : 'No employee/intern orders'}
            icon={TrendingUp}
            iconBg="bg-amber-500/15 text-amber-700"
            info="Most popular product among employees and interns by units ordered."
          />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[360px] shrink-0">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Top 5 Products by Units Sold</h3>
                <InfoTooltip content="Top five products ranked by total units sold, split between customers and employees/interns." title="Top Products" />
              </div>
              <p className="text-sm text-gray-500">Customer vs employee/intern demand across top-selling items.</p>
            </div>
          </div>
          <div className="flex-1 w-full overflow-x-auto overflow-y-hidden touch-pan-x pb-2">
            <div className="h-[320px] min-w-[500px] sm:min-w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} />
                  <YAxis dataKey="name" type="category" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} width={120} />
                  <Tooltip cursor={{ fill: '#F3F4F6' }} content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                  <Bar dataKey="customerUnitsSold" name="Customers" stackId="units" fill="#1F3A34" radius={[0, 0, 0, 0]} barSize={24} />
                  <Bar dataKey="employeeUnitsSold" name="Employee / Intern" stackId="units" fill="#D4AF7A" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-[400px]">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search products, categories, or subcategories..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3A34] text-sm"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0 shrink-0">
              <div className="relative shrink-0">
                <DatePicker
                  portalId="root-portal"
                  selected={selectedDate}
                  isClearable
                  onChange={(date) => {
                    setSelectedDate(date);
                    if (date) setSelectedMonth('');
                    setCurrentPage(1);
                  }}
                  dateFormat="d MMM yyyy"
                  popperPlacement="bottom-end"
                  customInput={<CustomDateInput />}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 backdrop-blur-xs border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <SortableHeader label="Product" columnKey="name" currentKey={productSortKey} direction={productSortDirection} onSort={handleProductSort} info="Product name and icon." />
                  <SortableHeader label="Category" columnKey="category" currentKey={productSortKey} direction={productSortDirection} onSort={handleProductSort} info="Main menu classification e.g. Drinks, Food." />
                  <SortableHeader label="Subcategory" columnKey="subcategory" currentKey={productSortKey} direction={productSortDirection} onSort={handleProductSort} info="Specific menu item subgroup." />
                  <SortableHeader label="Customer Units" columnKey="customerUnits" currentKey={productSortKey} direction={productSortDirection} onSort={handleProductSort} info="Quantity ordered by non-employee customers." className="text-right" />
                  <SortableHeader label="Employee / Intern" columnKey="employeeUnits" currentKey={productSortKey} direction={productSortDirection} onSort={handleProductSort} info="Quantity ordered by employees and interns." className="text-right" />
                  <SortableHeader label="Total Units" columnKey="unitsSold" currentKey={productSortKey} direction={productSortDirection} onSort={handleProductSort} info="Total quantity ordered." className="text-right" />
                  <SortableHeader label="Customer Revenue" columnKey="customerRevenue" currentKey={productSortKey} direction={productSortDirection} onSort={handleProductSort} info="RM revenue from customer orders." className="text-right" />
                  <SortableHeader label="Token Price" columnKey="tokenPrice" currentKey={productSortKey} direction={productSortDirection} onSort={handleProductSort} info="Base price in loyalty tokens." className="text-right" />
                  <SortableHeader label="Status" columnKey="status" currentKey={productSortKey} direction={productSortDirection} onSort={handleProductSort} info="Availability state in menu catalog." />
                  <SortableHeader label="Last Ordered" columnKey="lastOrdered" currentKey={productSortKey} direction={productSortDirection} onSort={handleProductSort} info="Timestamp of most recent customer order." />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentRows.length > 0 ? currentRows.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {product.imageUrl ? (
                            <img src={resolveProductImageUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={16} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{product.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">{product.category}</td>
                    <td className="px-6 py-4 text-gray-700 font-medium">{product.subcategory}</td>
                    <td className="px-6 py-4 text-right text-gray-900 font-semibold">{Number(product.customerUnitsSold || 0).toLocaleString('en-US')}</td>
                    <td className="px-6 py-4 text-right text-blue-700 font-semibold">{Number(product.employeeUnitsSold || 0).toLocaleString('en-US')}</td>
                    <td className="px-6 py-4 text-right text-gray-700 font-medium">{Number(product.quantitySold || 0).toLocaleString('en-US')}</td>
                    <td className="px-6 py-4 text-right font-bold text-[#1F5A4D]">{formatReportMoney(product.customerRevenueRm)}</td>
                    <td className="px-6 py-4 text-right text-gray-700 font-medium">{formatReportTokens(product.basePriceToken)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">
                      {product.lastOrderedAt ? new Date(product.lastOrderedAt).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                    </td>
                  </tr>
                    )) : (
                  <tr>
                    <td colSpan="10" className="py-12 text-center text-gray-500">
                      No products found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 shrink-0 bg-white">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredData.length}
              itemName="products"
              showAll={showAllProducts}
              onToggleShowAll={() => setShowAllProducts(!showAllProducts)}
              action={(
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
                >
                  <Download size={14} /> Export
                </button>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportByProduct;
