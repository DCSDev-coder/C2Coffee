import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Package, RefreshCw, Search, ShoppingCart, TrendingUp } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Pagination from './Pagination';
import { getAdminApiBaseUrl, loadAdminProductReport } from '../lib/adminApi';
import { formatReportMoney, formatReportTokens } from '../utils/reporting';
import { exportToCSV } from '../utils/exportToCSV';

const REFRESH_INTERVAL_MS = 60_000;
const COLORS = ['#1F3A34', '#2E5E58', '#6F9F96', '#A8C4A2', '#E07A5F', '#D4AF7A'];
const EMPTY_REPORT = {
  products: [],
  chartData: [],
  summary: {
    totalProducts: 0,
    totalUnitsSold: 0,
    totalRevenueRm: 0,
    topProduct: '',
    topProductUnits: 0,
    topProductRevenueRm: 0
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

const StatCard = ({ title, value, subtitle, icon: Icon, iconBg }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBg} text-white shadow-sm`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight mt-0.5 whitespace-normal">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
      {subtitle && (
        <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal mt-1">{subtitle}</p>
      )}
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-[#1F3A34] p-3 rounded-lg border-none text-white text-xs font-bold shadow-lg">
      <p className="mb-2 text-sm">{label}</p>
      <p className="mb-1">Units Sold: {Number(data.quantitySold || 0).toLocaleString('en-US')}</p>
      <p>Revenue: {formatReportMoney(data.revenueRm || 0)}</p>
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    let active = true;

    const loadReport = async () => {
      try {
        setError('');
        const response = await loadAdminProductReport(selectedDate);
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
  }, [selectedDate]);

  const overview = reportResponse || EMPTY_REPORT;
  const products = Array.isArray(overview.products) ? overview.products : [];
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

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const currentRows = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportRows = useMemo(() => [
    ['Product Name', 'Category', 'Subcategory', 'Quantity Sold', 'RM Revenue', 'Token Price', 'Last Ordered', 'Active'],
    ...filteredData.map((product) => [
      `"${product.name}"`,
      `"${product.category}"`,
      `"${product.subcategory}"`,
      Number(product.quantitySold || 0).toFixed(0),
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
      const response = await loadAdminProductReport(selectedDate);
      setReportResponse(response || EMPTY_REPORT);
      setLastUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load product report.');
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="p-6 lg:p-8 w-full h-full flex flex-col space-y-6">
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
              <h1 className="text-2xl font-bold text-gray-900">Product Report</h1>
              <p className="text-sm text-gray-500 mt-1">Live sales and revenue by individual menu item.</p>
              <p className="text-xs text-gray-400 mt-1">
                {loading ? 'Refreshing live data...' : error ? `Showing last successful data. ${error}` : `Last updated ${lastUpdatedAt?.toLocaleString('en-MY') || 'just now'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshReport()}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <StatCard
            title="Products in Report"
            value={overview.summary.totalProducts.toLocaleString('en-US')}
            subtitle="Live menu items included in this report"
            icon={Package}
            iconBg="bg-[#1F3A34]"
          />
          <StatCard
            title="Total Units Sold"
            value={overview.summary.totalUnitsSold.toLocaleString('en-US')}
            subtitle="From completed menu orders"
            icon={ShoppingCart}
            iconBg="bg-[#2E5E58]"
          />
          <StatCard
            title="Total Revenue"
            value={formatReportMoney(overview.summary.totalRevenueRm)}
            subtitle="Live RM revenue from sold items"
            icon={TrendingUp}
            iconBg="bg-[#E07A5F]"
          />
          <StatCard
            title="Best Seller"
            value={overview.summary.topProduct}
            subtitle={overview.summary.topProduct ? `${overview.summary.topProductUnits.toLocaleString('en-US')} units · ${formatReportMoney(overview.summary.topProductRevenueRm)} revenue` : ''}
            icon={TrendingUp}
            iconBg="bg-[#D4AF7A]"
          />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[360px] shrink-0">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Top 5 Products by Units Sold</h3>
              <p className="text-sm text-gray-500">Ranked from live order records.</p>
            </div>
          </div>
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} />
                <YAxis dataKey="name" type="category" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} width={110} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} content={<CustomTooltip />} />
                <Bar dataKey="quantitySold" radius={[0, 4, 4, 0]} barSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-[400px]">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
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
            <div className="relative w-full sm:w-auto">
              <DatePicker
                portalId="root-portal"
                selected={selectedDate}
                onChange={(date) => {
                  setSelectedDate(date);
                  setCurrentPage(1);
                }}
                dateFormat="d MMM yyyy"
                popperPlacement="bottom-end"
                customInput={<CustomDateInput />}
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Product</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Category</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Subcategory</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-right">Units Sold</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-right">Revenue</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-right">Token Price</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Status</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Last Ordered</th>
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
                    <td className="px-6 py-4 text-right text-gray-700 font-medium">{Number(product.quantitySold || 0).toLocaleString('en-US')}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">{formatReportMoney(product.revenueRm)}</td>
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
                    <td colSpan="8" className="py-12 text-center text-gray-500">
                      No products found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 flex shrink-0 justify-between items-center bg-white">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredData.length}
              itemName="products"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportByProduct;
