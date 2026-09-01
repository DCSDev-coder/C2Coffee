import React, { forwardRef, useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ChefHat,
  Clock3,
  Coffee,
  CircleDollarSign,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Users,
  Wallet
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { loadAdminDashboard } from '../lib/adminApi';

const REFRESH_INTERVAL_MS = 30000;

const formatRm = (value) => `RM ${Number(value || 0).toLocaleString('en-MY', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const formatNumber = (value) => Number(value || 0).toLocaleString('en-MY');

const toDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const statusTone = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'collected') return 'bg-emerald-100 text-emerald-700';
  if (value === 'preparing') return 'bg-amber-100 text-amber-700';
  if (value === 'ready_for_pickup') return 'bg-sky-100 text-sky-700';
  if (value === 'paid' || value === 'accepted') return 'bg-violet-100 text-violet-700';
  return 'bg-slate-100 text-slate-700';
};

const StatCard = ({ title, value, detail, icon: Icon, iconColor }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 min-w-0">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm ${iconColor}`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="min-w-0">
      <h2 className="text-gray-500 text-xs font-medium leading-tight">{title}</h2>
      <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
      <p className="text-[11px] text-gray-500 mt-1 leading-tight">{detail}</p>
    </div>
  </div>
);

const ChartCard = ({ title, value, subtitle, data, dataKey, color, gradientId, formatter }) => (
  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-72">
    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
    <div className="mt-2 flex items-end gap-3">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mb-1">{subtitle}</p>
    </div>
    <div className="flex-1 mt-3 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
          <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          <Tooltip
            formatter={(amount) => formatter(amount)}
            contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
            itemStyle={{ color: '#fff' }}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#${gradientId})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const EmptyState = ({ children }) => (
  <div className="py-8 text-center text-sm text-gray-500">{children}</div>
);

const DashboardHome = ({ setCurrentPage }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const response = await loadAdminDashboard(toDateKey(selectedDate));
      setDashboard(response);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the live dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard({ showLoading: true });
    const interval = window.setInterval(() => fetchDashboard(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [selectedDate]);

  const CustomDateInput = forwardRef(({ value, onClick }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-lg bg-white shadow-sm text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <CalendarDays size={14} className="text-[#2E5E58]" />
      <span>{value || 'Today'}</span>
    </button>
  ));

  const summary = dashboard?.summary || {
    salesToday: 0,
    ordersToday: 0,
    awaitingPreparation: 0,
    preparing: 0,
    customersServed: 0,
    pendingRefunds: 0
  };
  const trends = dashboard?.trends || [];
  const recentOrders = dashboard?.recentOrders || [];
  const recentActivity = dashboard?.recentActivity || [];
  const topItems = dashboard?.topItems || [];

  return (
    <div className="px-8 pb-8 mt-0" style={{ fontFamily: '"DM Sans", sans-serif' }}>
      <div className="flex justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Live tenant data{dashboard?.timeZone ? ` in ${dashboard.timeZone}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker
            portalId="root-portal"
            popperPlacement="bottom-end"
            selected={selectedDate}
            onChange={setSelectedDate}
            customInput={<CustomDateInput />}
            dateFormat="MMM d, yyyy"
            maxDate={new Date()}
          />
          <button
            type="button"
            onClick={() => fetchDashboard({ showLoading: true })}
            className="p-2 border border-gray-200 rounded-lg bg-white text-[#2E5E58] hover:bg-[#F3F7F5] transition-colors cursor-pointer"
            title="Refresh live data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => fetchDashboard({ showLoading: true })} className="font-semibold underline cursor-pointer">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 mb-6">
        <StatCard title="Sales Today" value={formatRm(summary.salesToday)} detail="Paid, active and collected orders" icon={Wallet} iconColor="bg-[#1F3A34]" />
        <StatCard title="Orders Today" value={formatNumber(summary.ordersToday)} detail="Orders currently counted as sales" icon={ShoppingBag} iconColor="bg-[#2E5E58]" />
        <StatCard title="Awaiting Preparation" value={formatNumber(summary.awaitingPreparation)} detail="Paid orders waiting for a barista" icon={Clock3} iconColor="bg-[#D4AF7A]" />
        <StatCard title="In Preparation" value={formatNumber(summary.preparing)} detail="Orders being prepared now" icon={ChefHat} iconColor="bg-[#E07A5F]" />
        <StatCard title="Refunds Awaiting Review" value={formatNumber(summary.pendingRefunds)} detail="Pending customer-service decisions" icon={CircleDollarSign} iconColor="bg-[#B45309]" />
        <StatCard title="Customers Served" value={formatNumber(summary.customersServed)} detail="Unique customers with eligible orders" icon={Users} iconColor="bg-[#6F9F96]" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
        <div className="xl:col-span-6">
          <ChartCard title="Sales By Time" value={formatRm(summary.salesToday)} subtitle="Selected business day" data={trends} dataKey="revenue" color="#2E5E58" gradientId="dashboardRevenue" formatter={formatRm} />
        </div>
        <div className="xl:col-span-6">
          <ChartCard title="Orders By Time" value={formatNumber(summary.ordersToday)} subtitle="Selected business day" data={trends} dataKey="orders" color="#D4AF7A" gradientId="dashboardOrders" formatter={formatNumber} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
        <section className="xl:col-span-8 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Recent Orders</h2>
            <button onClick={() => setCurrentPage?.('Orders')} className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:underline cursor-pointer inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          {loading && !dashboard ? <EmptyState>Loading live orders...</EmptyState> : recentOrders.length === 0 ? <EmptyState>No orders for this day yet.</EmptyState> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[680px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 font-bold text-gray-900">Order ID</th>
                    <th className="pb-3 font-bold text-gray-900">Customer</th>
                    <th className="pb-3 font-bold text-gray-900">City</th>
                    <th className="pb-3 font-bold text-gray-900">Total</th>
                    <th className="pb-3 font-bold text-gray-900">Status</th>
                    <th className="pb-3 font-bold text-gray-900">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 text-[#2E5E58] font-semibold">{order.id}</td>
                      <td className="py-3 font-medium text-gray-800">{order.customer}</td>
                      <td className="py-3 text-gray-600">{order.city}</td>
                      <td className="py-3 font-semibold text-gray-800">{formatRm(order.total)}</td>
                      <td className="py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${statusTone(order.status)}`}>{order.status}</span></td>
                      <td className="py-3 font-medium text-gray-600">{order.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="xl:col-span-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Order Activity</h2>
          {loading && !dashboard ? <EmptyState>Loading activity...</EmptyState> : recentActivity.length === 0 ? <EmptyState>No order activity for this day yet.</EmptyState> : (
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={`${activity.title}-${index}`} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#EEF5F2] text-[#2E5E58] flex-shrink-0 flex items-center justify-center"><PackageCheck size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 leading-tight">{activity.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.detail}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">{activity.time}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Best-Selling Items</h2>
            <p className="text-xs text-gray-500 mt-1">Based on paid and active orders for the selected day.</p>
          </div>
          <button onClick={() => setCurrentPage?.('Menu')} className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:underline cursor-pointer inline-flex items-center gap-1">
            Manage menu <ArrowRight size={14} />
          </button>
        </div>
        {loading && !dashboard ? <EmptyState>Loading sales data...</EmptyState> : topItems.length === 0 ? <EmptyState>No item sales for this day yet.</EmptyState> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {topItems.map((item, index) => (
              <div key={item.name} className="border border-gray-100 rounded-xl p-4 bg-[#FCFDFD]">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#D4AF7A] text-white text-xs font-bold inline-flex items-center justify-center">{index + 1}</span>
                  <Coffee size={19} className="text-[#2E5E58]" />
                </div>
                <p className="mt-4 text-sm font-bold text-gray-900 truncate" title={item.name}>{item.name}</p>
                <p className="mt-1 text-xs text-gray-500">{formatNumber(item.unitsSold)} sold</p>
                <p className="mt-2 text-sm font-semibold text-[#2E5E58]">{formatRm(item.revenue)} base value</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardHome;
