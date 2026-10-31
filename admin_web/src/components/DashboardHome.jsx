import React, { forwardRef, useCallback, useEffect, useState } from 'react';
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
import OutletFilter from './OutletFilter';
import InfoTooltip from './InfoTooltip';

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
  if (value === 'collected') return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
  if (value === 'preparing') return 'bg-amber-50 text-amber-700 border border-amber-200/60';
  if (value === 'ready_for_pickup') return 'bg-sky-50 text-sky-700 border border-sky-200/60';
  if (value === 'paid' || value === 'accepted') return 'bg-violet-50 text-violet-700 border border-violet-200/60';
  return 'bg-slate-100 text-slate-700 border border-slate-200/60';
};

const StatCard = ({ title, value, info, icon: Icon, iconBg, badge, highlight = false }) => (
  <div className={`bg-white p-4 sm:p-5 rounded-2xl border ${highlight ? 'border-[#2E5E58]/40 ring-1 ring-[#2E5E58]/15' : 'border-gray-200/80'} shadow-xs flex flex-col justify-between min-w-0 card-reveal hover-lift cursor-default transition-all`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <h2 className="text-gray-500 text-[11px] font-bold uppercase tracking-wider truncate">{title}</h2>
        {info && <InfoTooltip content={info} title={title} placement="top" />}
      </div>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg || 'bg-[#2E5E58]/10 text-[#2E5E58]'}`}>
        <Icon size={16} strokeWidth={2.2} />
      </div>
    </div>
    <div className="mt-3 flex items-baseline justify-between gap-2">
      <p className="text-2xl font-extrabold text-gray-900 tracking-tight tabular-nums">{value}</p>
      {badge && (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 truncate max-w-[100px]">
          {badge}
        </span>
      )}
    </div>
  </div>
);

const ChartCard = ({ title, value, subtitle, data, dataKey, color, gradientId, formatter, info }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col h-72 card-reveal hover-lift">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <h2 className="text-base font-bold text-gray-900 tracking-tight">{title}</h2>
        {info && <InfoTooltip content={info} title={title} />}
      </div>
      <p className="text-xs font-medium text-gray-500">{subtitle}</p>
    </div>
    <div className="mt-2 flex items-baseline gap-3">
      <p className="text-2xl font-extrabold text-gray-900 tracking-tight tabular-nums">{value}</p>
    </div>
    <div className="flex-1 mt-3 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
          <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          <Tooltip
            formatter={(amount) => formatter(amount)}
            contentStyle={{ backgroundColor: '#172D28', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
            itemStyle={{ color: '#fff' }}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#${gradientId})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const EmptyState = ({ children }) => (
  <div className="py-8 text-center text-xs font-medium text-gray-400">{children}</div>
);

const DashboardHome = ({ setCurrentPage }) => {
  const [selectedRange, setSelectedRange] = useState([null, null]);
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeStart, rangeEnd] = selectedRange;
  const rangeStartDate = toDateKey(rangeStart);
  const rangeEndDate = toDateKey(rangeEnd);

  const fetchDashboard = useCallback(async ({ showLoading = false } = {}) => {
    if (selectedPeriod === 'custom' && !rangeStartDate) return;
    if (showLoading) setLoading(true);
    try {
      const response = await loadAdminDashboard({
        startDate: selectedPeriod === 'custom' ? rangeStartDate : null,
        endDate: selectedPeriod === 'custom' ? (rangeEndDate || rangeStartDate) : null,
        period: selectedPeriod,
        storeId: selectedStoreId
      });
      setDashboard(response);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the live dashboard.');
    } finally {
      setLoading(false);
    }
  }, [rangeEndDate, rangeStartDate, selectedPeriod, selectedStoreId]);

  useEffect(() => {
    fetchDashboard({ showLoading: true });
    const interval = window.setInterval(() => fetchDashboard(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fetchDashboard]);

  const periodLabel = selectedPeriod === 'this_month'
    ? 'This month'
    : selectedPeriod === 'last_month'
      ? 'Last month'
    : selectedPeriod === '3m'
      ? 'Last 3 months'
    : selectedPeriod === '6m'
      ? 'Last 6 months'
      : selectedPeriod === '1y'
        ? 'Last 1 year'
        : rangeStartDate === rangeEndDate
          ? 'Selected day'
          : rangeStartDate && rangeEndDate
            ? `${rangeStartDate} to ${rangeEndDate}`
            : 'Custom range';
  const chartTimeLabel = dashboard?.isSingleDay ? 'Hour' : 'Date';
  const chartSubtitle = dashboard?.isSingleDay ? 'Hourly Breakdown' : periodLabel;

  const handlePeriodChange = (event) => {
    const nextPeriod = event.target.value;
    setSelectedPeriod(nextPeriod);
    if (nextPeriod !== 'custom') {
      setSelectedRange([null, null]);
    }
  };

  const handleRangeChange = (dates) => {
    const [start, end] = dates;
    setSelectedRange([start, end]);
    if (start) {
      setSelectedPeriod('custom');
    }
  };

  const CustomDateInput = forwardRef(({ value, onClick }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-lg bg-white shadow-xs text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
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
  const outletBreakdown = dashboard?.outletBreakdown || [];

  return (
    <div className="px-8 pb-8 mt-0">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Store Overview</h1>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Live store activity{dashboard?.timeZone ? ` (${dashboard.timeZone})` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <OutletFilter value={selectedStoreId} onChange={setSelectedStoreId} />
          <select
            value={selectedPeriod}
            onChange={handlePeriodChange}
            className="border border-gray-200 px-3 py-2 rounded-lg bg-white shadow-xs text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none"
            aria-label="Dashboard period"
          >
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="3m">Last 3 months</option>
            <option value="6m">Last 6 months</option>
            <option value="1y">Last 1 year</option>
            <option value="custom">Custom date range</option>
          </select>
          <DatePicker
            portalId="root-portal"
            popperPlacement="bottom-end"
            selectsRange
            startDate={rangeStart}
            endDate={rangeEnd}
            onChange={handleRangeChange}
            customInput={<CustomDateInput />}
            dateFormat="MMM d, yyyy"
            maxDate={new Date()}
          />
          <button
            type="button"
            onClick={() => fetchDashboard({ showLoading: true })}
            className="p-2 border border-gray-200 rounded-lg bg-white text-[#2E5E58] hover:bg-[#F3F7F5] transition-colors cursor-pointer shadow-xs"
            title="Refresh live data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => fetchDashboard({ showLoading: true })} className="font-semibold underline cursor-pointer">Retry</button>
        </div>
      )}

      {/* Modern, high-density KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Sales"
          value={formatRm(summary.salesToday)}
          info="Total revenue from all paid, active, and collected orders within the selected timeframe."
          icon={Wallet}
          iconBg="bg-[#1F3A34]/10 text-[#1F3A34]"
          badge={periodLabel}
        />
        <StatCard
          title="Orders"
          value={formatNumber(summary.ordersToday)}
          info="Total number of valid customer orders completed or active during this period."
          icon={ShoppingBag}
          iconBg="bg-[#2E5E58]/10 text-[#2E5E58]"
          badge={periodLabel}
        />
        <StatCard
          title="Awaiting Prep"
          value={formatNumber(summary.awaitingPreparation)}
          info="Accepted customer orders currently waiting in line for a barista."
          icon={Clock3}
          iconBg="bg-amber-50 text-amber-700"
          badge={summary.awaitingPreparation > 0 ? "Queued" : "None"}
        />
        <StatCard
          title="In Preparation"
          value={formatNumber(summary.preparing)}
          info="Orders currently being prepared at the bar."
          icon={ChefHat}
          iconBg="bg-[#E07A5F]/10 text-[#E07A5F]"
          badge={summary.preparing > 0 ? "Active" : "Idle"}
        />
        <StatCard
          title="Refund Reviews"
          value={formatNumber(summary.pendingRefunds)}
          info="Pending refund requests awaiting customer service decision or approval."
          icon={CircleDollarSign}
          iconBg={summary.pendingRefunds > 0 ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}
          badge={summary.pendingRefunds > 0 ? "Pending action" : "Zero pending"}
          highlight={summary.pendingRefunds > 0}
        />
        <StatCard
          title="Customers"
          value={formatNumber(summary.customersServed)}
          info="Count of distinct customers who placed eligible orders during this period."
          icon={Users}
          iconBg="bg-[#6F9F96]/15 text-[#2E5E58]"
          badge={periodLabel}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
        <div className="xl:col-span-6">
          <ChartCard
            title={`Sales by ${chartTimeLabel}`}
            value={formatRm(summary.salesToday)}
            subtitle={chartSubtitle}
            data={trends}
            dataKey="revenue"
            color="#2E5E58"
            gradientId="dashboardRevenue"
            formatter={formatRm}
            info="Gross sales trend over time for the selected period."
          />
        </div>
        <div className="xl:col-span-6">
          <ChartCard
            title={`Orders by ${chartTimeLabel}`}
            value={formatNumber(summary.ordersToday)}
            subtitle={chartSubtitle}
            data={trends}
            dataKey="orders"
            color="#D4AF7A"
            gradientId="dashboardOrders"
            formatter={formatNumber}
            info="Order volume distribution across the selected time period."
          />
        </div>
      </div>

      {/* Outlet Performance */}
      <section className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Outlet Performance</h2>
            <InfoTooltip content="Key operational metrics broken down by individual branch, including sales, order volume, and average order value (AOV)." title="Outlet Breakdown" />
          </div>
          <span className="text-xs font-semibold text-gray-400">{periodLabel}</span>
        </div>
        {loading && !dashboard ? <EmptyState>Loading outlet performance...</EmptyState> : outletBreakdown.length === 0 ? <EmptyState>No outlet sales for this period yet.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Outlet', 'Sales', 'Orders', 'Customers', 'Average Order Value'].map((heading) => (
                    <th key={heading} className="pb-3 pr-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {outletBreakdown.map((outlet) => (
                  <tr key={outlet.storeId} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3.5 pr-4 font-semibold text-gray-900 text-xs">{outlet.storeName}</td>
                    <td className="py-3.5 pr-4 font-bold text-[#2E5E58] text-xs tabular-nums">{formatRm(outlet.sales)}</td>
                    <td className="py-3.5 pr-4 text-gray-700 text-xs tabular-nums">{formatNumber(outlet.orders)}</td>
                    <td className="py-3.5 pr-4 text-gray-700 text-xs tabular-nums">{formatNumber(outlet.customers)}</td>
                    <td className="py-3.5 pr-4 text-gray-700 text-xs tabular-nums">{formatRm(outlet.averageOrderValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Orders & Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
        <section className="xl:col-span-8 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-gray-900 tracking-tight">Recent Orders</h2>
              <InfoTooltip content="Most recent live transactions received across all connected outlets." title="Recent Orders" />
            </div>
            <button onClick={() => setCurrentPage?.('Orders')} className="text-xs font-bold text-[#2E5E58] hover:underline cursor-pointer inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          {loading && !dashboard ? <EmptyState>Loading live orders...</EmptyState> : recentOrders.length === 0 ? <EmptyState>No orders for this period yet.</EmptyState> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[680px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Order ID</th>
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Customer</th>
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Outlet</th>
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">City</th>
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Total</th>
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 text-[#2E5E58] font-bold">{order.id}</td>
                      <td className="py-3 font-medium text-gray-900">{order.customer}</td>
                      <td className="py-3 text-gray-600">{order.storeName || '-'}</td>
                      <td className="py-3 text-gray-500">{order.city}</td>
                      <td className="py-3 font-bold text-gray-900 tabular-nums">{formatRm(order.total)}</td>
                      <td className="py-3"><span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusTone(order.status)}`}>{order.status}</span></td>
                      <td className="py-3 font-medium text-gray-400 tabular-nums">{order.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="xl:col-span-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center gap-1.5 mb-4">
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Order Activity</h2>
            <InfoTooltip content="Live stream of real-time order lifecycle events and status updates." title="Order Activity" />
          </div>
          {loading && !dashboard ? <EmptyState>Loading activity...</EmptyState> : recentActivity.length === 0 ? <EmptyState>No order activity for this period yet.</EmptyState> : (
            <div className="space-y-3.5">
              {recentActivity.map((activity, index) => (
                <div key={`${activity.title}-${index}`} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#2E5E58]/10 text-[#2E5E58] shrink-0 flex items-center justify-center mt-0.5">
                    <PackageCheck size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900 leading-tight">{activity.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">{activity.detail}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5 tabular-nums">{activity.time}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Best-Selling Items */}
      <section className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Best-Selling Items</h2>
            <InfoTooltip content="Top ranking catalog items ordered across all branches for the selected period." title="Best-Selling Items" />
          </div>
          <button onClick={() => setCurrentPage?.('Menu')} className="text-xs font-bold text-[#2E5E58] hover:underline cursor-pointer inline-flex items-center gap-1">
            Manage menu <ArrowRight size={14} />
          </button>
        </div>
        {loading && !dashboard ? <EmptyState>Loading sales data...</EmptyState> : topItems.length === 0 ? <EmptyState>No item sales for this period yet.</EmptyState> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {topItems.map((item, index) => (
              <div key={item.name} className="border border-gray-100 rounded-xl p-3.5 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-md bg-[#2E5E58]/10 text-[#2E5E58] text-xs font-bold inline-flex items-center justify-center">#{index + 1}</span>
                  <Coffee size={16} className="text-gray-400" />
                </div>
                <p className="mt-3 text-xs font-bold text-gray-900 truncate" title={item.name}>{item.name}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-gray-500 text-[11px]">{formatNumber(item.unitsSold)} sold</span>
                  <span className="font-bold text-[#2E5E58] tabular-nums">{formatRm(item.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardHome;
