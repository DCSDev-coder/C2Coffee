import React, { useState } from 'react';
import { ArrowLeft, Download, Filter, Search, Package, ChevronDown, X, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Pagination from './Pagination';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const COLORS = ['#1F3A34', '#2E5E58', '#6F9F96', '#A8C4A2', '#E07A5F', '#D4AF7A'];

import { initialMenuData } from '../data/menuData';

const mockProductData = initialMenuData.map((item) => {
  const salesNum = parseInt(item.sales.replace(/,/g, ''), 10) || 0;
  const priceNum = parseFloat(item.price.replace('Tokens ', '')) || 0;
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    quantitySold: salesNum,
    revenue: salesNum * priceNum
  };
}).sort((a, b) => b.quantitySold - a.quantitySold);

const chartData = mockProductData.slice(0, 5).map(p => ({
  name: p.name,
  revenue: p.revenue,
  quantitySold: p.quantitySold
}));

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1F3A34] p-3 rounded-lg border-none text-white text-xs font-bold shadow-lg">
        <p className="mb-2 text-sm">{label}</p>
        <p className="mb-1">Units Sold: {data.quantitySold.toLocaleString()}</p>
        <p>Revenue: Tokens {data.revenue.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

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

const ReportByProduct = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const safeSearchTerm = (searchTerm || '').trim().toLowerCase();
  const filteredData = mockProductData.filter(product =>
    product.name.toLowerCase().includes(safeSearchTerm) ||
    product.category.toLowerCase().includes(safeSearchTerm)
  );

  const handleExport = () => {
    const csvContent = [
      ["Product Name", "Category", "Quantity Sold", "Total Revenue (Tokens)"],
      ...filteredData.map(product => [
        `"${product.name}"`, 
        `"${product.category}"`, 
        product.quantitySold, 
        product.revenue
      ])
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "product_report.csv";
    link.click();
  };

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full h-full flex flex-col space-y-6">
        <div className="shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Report</h1>
              <p className="text-sm text-gray-500 mt-1">Analyze revenue and sales volume by individual product.</p>
            </div>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
          >
            <Download size={16} /> Export
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <StatCard
            title="Total Products"
            value={mockProductData.length.toString()}
            change="1.2% vs last month"
            icon={Package}
            iconBg="bg-[#1F3A34]"
          />
          <StatCard
            title="Total Items Sold"
            value="12,560"
            change="8.2% vs last month"
            icon={ShoppingCart}
            iconBg="bg-[#2E5E58]"
          />
          <StatCard
            title="Total Revenue"
            value="Tokens 142,560"
            change="17.1% vs last month"
            icon={DollarSign}
            iconBg="bg-[#E07A5F]"
          />
          <StatCard
            title="Top Product"
            value={chartData[0]?.name || "-"}
            change="Top selling item"
            icon={TrendingUp}
            iconBg="bg-[#D4AF7A]"
          />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[350px] shrink-0">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Top 5 Products by Units Sold</h3>
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} tickFormatter={(val) => `${(val / 1000).toFixed(1)}K Units`} />
                <YAxis dataKey="name" type="category" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} width={80} />
                <Tooltip
                  cursor={{ fill: '#F3F4F6' }}
                  content={<CustomTooltip />}
                />
                <Bar dataKey="quantitySold" radius={[0, 4, 4, 0]} barSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                placeholder="Search products or categories..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3A34] text-sm"
              />
            </div>
            <div className="relative w-full sm:w-auto">
              <DatePicker portalId="root-portal"
                selected={selectedDate}
                onChange={(date) => { setSelectedDate(date); setCurrentPage(1); }}
                dateFormat="d MMM yyyy"
                popperPlacement="bottom-end"
                customInput={
                  <div className="relative">
                    <button className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 w-full sm:w-auto text-left min-w-[140px]">
                      {selectedDate ? selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select Date'}
                    </button>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <ChevronDown size={16} className="text-gray-400 transition-transform duration-200 peer-focus:-rotate-180" />
                    </div>
                    {selectedDate && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedDate(null); setCurrentPage(1); }}
                        className="absolute inset-y-0 right-8 flex items-center p-1 hover:bg-gray-100 rounded-full my-auto h-6 w-6 justify-center cursor-pointer pointer-events-auto"
                      >
                        <X size={14} className="text-gray-500" />
                      </button>
                    )}
                  </div>
                }
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Product Name</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Category</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-right">Quantity Sold</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-right">Total Revenue (Tokens)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.length > 0 ? (
                  paginatedData.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{product.category}</td>
                      <td className="px-6 py-4 text-right text-gray-600 font-medium">{product.quantitySold.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">Tokens {product.revenue.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-gray-500">
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
