import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Coffee,
  CircleDollarSign,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Users,
  Wallet
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { loadAdminDashboard } from '../lib/adminApi';
import OutletFilter from './OutletFilter';
import InfoTooltip from './InfoTooltip';

const REFRESH_INTERVAL_MS = 30000;

const formatRm = (value) => `RM ${Number(value || 0).toLocaleString('en-MY', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const formatNumber = (value) => Number(value || 0).toLocaleString('en-MY');

function useAnimatedNumber(targetValue, durationMs = 450) {
  const numericTarget = Number(targetValue || 0);
  const [displayValue, setDisplayValue] = useState(numericTarget);
  const previousRef = useRef(numericTarget);

  useEffect(() => {
    const startValue = previousRef.current;
    if (startValue === numericTarget) return;
    let rafId = 0;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startValue + (numericTarget - startValue) * eased;
      setDisplayValue(next);
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        previousRef.current = numericTarget;
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      previousRef.current = numericTarget;
    };
  }, [numericTarget, durationMs]);

  return displayValue;
}

const toDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const statusTone = (status) => {
  const value = String(status || '').toLowerCase().replace(/\s+/g, '_');
  if (value === 'collected' || value === 'completed') return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
  if (value === 'preparing') return 'bg-amber-50 text-amber-700 border border-amber-200/60';
  if (value === 'ready_for_pickup') return 'bg-sky-50 text-sky-700 border border-sky-200/60';
  if (value === 'paid' || value === 'accepted' || value === 'order_received') return 'bg-violet-50 text-violet-700 border border-violet-200/60';
  if (value === 'cancelled' || value === 'voided') return 'bg-red-50 text-red-700 border border-red-200/60';
  return 'bg-slate-100 text-slate-700 border border-slate-200/60';
};

const PAYMENT_COLORS = ['#2E5E58', '#D4AF7A'];

const StatCard = ({ title, value, detail, info, icon: Icon, iconBg, badge, highlight = false, onClick }) => (
  <button type="button" onClick={onClick} disabled={!onClick} className={`text-left bg-white p-3.5 sm:p-5 rounded-2xl border ${highlight ? 'border-[#2E5E58]/40 ring-1 ring-[#2E5E58]/15' : 'border-gray-200/80'} shadow-xs flex flex-col justify-between min-w-0 card-reveal hover-lift ${onClick ? 'cursor-pointer hover:border-[#2E5E58]/40' : 'cursor-default'} transition-all`}>
    <div className="flex items-center justify-between gap-1.5 sm:gap-2">
      <div className="flex items-center gap-1 min-w-0">
        <h2 className="text-gray-500 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider leading-tight">{title}</h2>
        {info && <InfoTooltip content={info} title={title} placement="top" />}
      </div>
      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg || 'bg-[#2E5E58]/10 text-[#2E5E58]'}`}>
        <Icon size={15} strokeWidth={2.2} />
      </div>
    </div>
    <div className="mt-2.5 sm:mt-3 flex flex-col gap-1.5">
      <p className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight tabular-nums">{value}</p>
      {badge && (
        <div className="flex">
          <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 truncate max-w-full">
            {badge}
          </span>
        </div>
      )}
      {detail && <div className="text-[10px] sm:text-[11px] font-medium text-gray-500 leading-tight">{detail}</div>}
    </div>
  </button>
);

const CombinedTrendCard = ({ title, value, subtitle, data, info }) => {
  const [chartMode, setChartMode] = useState('trend');

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col h-80 sm:h-96 card-reveal hover-lift">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight truncate">{title}</h2>
          {info && <InfoTooltip content={info} title={title} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setChartMode('trend')}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${chartMode === 'trend' ? 'bg-[#1F3A34] text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Value & Orders
            </button>
            <button
              type="button"
              onClick={() => setChartMode('split')}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${chartMode === 'split' ? 'bg-[#1F3A34] text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Direct vs Credit
            </button>
          </div>
          <p className="text-xs font-medium text-gray-500 hidden sm:block">{subtitle}</p>
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <p className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight tabular-nums">{value}</p>
      </div>
      <div className="flex-1 mt-3 min-h-0 overflow-x-auto overflow-y-hidden touch-pan-x pb-1">
        <div className="h-full min-w-[520px] sm:min-w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'trend' ? (
              <AreaChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardCombinedRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E5E58" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#2E5E58" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="time" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
                <YAxis yAxisId="value" axisLine={false} tick={false} width={8} />
                <YAxis yAxisId="orders" orientation="right" axisLine={false} tick={false} width={8} allowDecimals={false} />
                <Tooltip
                  formatter={(amount, name) => [name === 'Order value' ? formatRm(amount) : formatNumber(amount), name]}
                  contentStyle={{ backgroundColor: '#172D28', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend verticalAlign="top" align="right" height={28} iconType="line" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                <Area yAxisId="value" type="monotone" name="Order value" dataKey="revenue" stroke="#2E5E58" strokeWidth={2.2} fillOpacity={1} fill="url(#dashboardCombinedRevenue)" isAnimationActive animationDuration={500} />
                <Line yAxisId="orders" type="monotone" name="Orders" dataKey="orders" stroke="#D4AF7A" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive animationDuration={500} />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="time" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(v) => `RM ${v}`} width={54} />
                <Tooltip
                  formatter={(amount, name) => [formatRm(amount), name]}
                  contentStyle={{ backgroundColor: '#172D28', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend verticalAlign="top" align="right" height={28} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                <Bar dataKey="directRevenue" name="Direct (RM)" stackId="sales" fill="#2E5E58" radius={[0, 0, 0, 0]} isAnimationActive animationDuration={500} />
                <Bar dataKey="tokenRevenue" name="C2 Credit (RM)" stackId="sales" fill="#D4AF7A" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={500} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const PaymentMixCard = ({ data, total, periodLabel }) => (
  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col min-h-80 card-reveal hover-lift">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Sales by payment</h2>
        <InfoTooltip content="Sales composition for eligible orders in the selected period. Direct payments are cash/payment settlements; C2 Credit is RM-equivalent order value, not cash revenue." title="Sales by payment" />
      </div>
      <span className="text-xs font-medium text-gray-500 shrink-0">{periodLabel}</span>
    </div>
    <div className="flex-1 min-h-0 flex items-center gap-3 mt-2">
      {data.length === 0 ? <EmptyState>No sales for this period yet.</EmptyState> : (
        <>
          <div className="w-1/2 min-w-0 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="sales" nameKey="label" innerRadius="58%" outerRadius="82%" paddingAngle={3} stroke="none">
                  {data.map((entry, index) => <Cell key={entry.label} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [formatRm(value), name]}
                  contentStyle={{ backgroundColor: '#172D28', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-1/2 space-y-3 min-w-0">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total sales</p>
              <p className="mt-1 text-xl font-extrabold text-gray-900 tabular-nums">{formatRm(total)}</p>
            </div>
            {data.map((entry, index) => (
              <div key={entry.label} className="flex items-start gap-2">
                <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">{entry.label}</p>
                  <p className="text-[11px] text-gray-500 tabular-nums">
                    {formatRm(entry.sales)}{entry.orders == null ? '' : ` · ${formatNumber(entry.orders)} orders`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  </div>
);

const OutletSalesCard = ({ data, periodLabel }) => (
  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col min-h-80 card-reveal hover-lift">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Sales by outlet</h2>
        <InfoTooltip content="RM-equivalent sales by outlet for eligible orders in the selected period. Use this to compare branch contribution." title="Sales by outlet" />
      </div>
      <span className="text-xs font-medium text-gray-500 shrink-0">{periodLabel}</span>
    </div>
    <div className="flex-1 min-h-0 mt-3">
      {data.length === 0 ? <EmptyState>No outlet sales for this period yet.</EmptyState> : (
        <ResponsiveContainer width="100%" height="100%" minHeight={230}>
          <BarChart data={data.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="#F1F5F9" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(value) => `RM ${value}`} />
            <YAxis type="category" dataKey="storeName" width={92} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
            <Tooltip
              formatter={(value) => [formatRm(value), 'Sales']}
              contentStyle={{ backgroundColor: '#172D28', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
              itemStyle={{ color: '#fff' }}
            />
            <Bar dataKey="sales" name="Sales" fill="#2E5E58" radius={[0, 5, 5, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

const EmptyState = ({ children }) => (
  <div className="py-8 text-center text-xs font-medium text-gray-400">{children}</div>
);

const DashboardHome = ({ setCurrentPage }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedRange, setSelectedRange] = useState([null, null]);
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
    : selectedPeriod === 'this_week'
      ? 'This week'
    : selectedPeriod === 'this_year'
      ? 'This year'
      : selectedPeriod === 'today'
        ? 'Today'
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
  };

  const handleRangeChange = (dates) => {
    const [start, end] = dates;
    setSelectedRange([start, end]);
    if (start) setSelectedPeriod('custom');
  };

  const CustomDateInput = forwardRef(({ value, onClick }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-lg bg-white shadow-xs text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <CalendarDays size={14} className="text-[#2E5E58]" />
      <span>{value || 'Choose dates'}</span>
    </button>
  ));

  const summary = dashboard?.summary || {
    salesToday: 0,
    ordersToday: 0,
    cashCollectedRm: 0,
    tokenOrderValueRm: 0,
    subsidyUsedTokens: 0,
    personalTokensUsed: 0,
    pendingPaymentValueRm: 0,
    customersServed: 0,
    newCustomersRegistered: 0,
    pendingRefunds: 0,
    coverage: {}
  };
  const coverage = summary.coverage || {};
  const trends = dashboard?.trends || [];
  const recentOrders = dashboard?.recentOrders || [];
  const recentActivity = dashboard?.recentActivity || [];
  const topItems = dashboard?.topItems || [];
  const outletBreakdown = dashboard?.outletBreakdown || [];
  const salesByPayment = dashboard?.salesByPayment ?? [
    { label: 'Direct payments', sales: Number(summary.cashCollectedRm || 0), orders: null },
    { label: 'C2 Credit', sales: Number(summary.tokenOrderValueRm || 0), orders: null }
  ].filter((entry) => entry.sales > 0);

  const [showAllOutlets, setShowAllOutlets] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAllTopItems, setShowAllTopItems] = useState(false);
  const [topItemsMetric, setTopItemsMetric] = useState('unitsSold');

  const animCash = useAnimatedNumber(summary.cashCollectedRm);
  const animTokenValue = useAnimatedNumber(summary.tokenOrderValueRm);
  const animOrders = useAnimatedNumber(summary.ordersToday);
  const animPending = useAnimatedNumber(summary.pendingPaymentValueRm);
  const animRefunds = useAnimatedNumber(summary.pendingRefunds);
  const animCustomers = useAnimatedNumber(summary.customersServed);
  const animTotalSales = useAnimatedNumber(summary.salesToday);
  const averageOrderValueRm = summary.averageOrderValueRm ?? (summary.ordersToday > 0 ? summary.salesToday / summary.ordersToday : 0);
  const directSharePct = summary.salesToday > 0 ? Math.round((Number(summary.cashCollectedRm || 0) / Number(summary.salesToday)) * 100) : 0;
  const creditSharePct = summary.salesToday > 0 ? 100 - directSharePct : 0;

  const visibleOutlets = showAllOutlets ? outletBreakdown : outletBreakdown.slice(0, 5);
  const visibleOrders = showAllOrders ? recentOrders : recentOrders.slice(0, 5);
  const visibleActivity = showAllActivity ? recentActivity : recentActivity.slice(0, 5);
  const visibleTopItems = showAllTopItems ? topItems : topItems.slice(0, 5);

  return (
    <div className="px-4 sm:px-6 md:px-8 pb-8 mt-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Store Overview</h1>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Live store activity{dashboard?.timeZone ? ` (${dashboard.timeZone})` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <OutletFilter value={selectedStoreId} onChange={setSelectedStoreId} className="w-full sm:w-auto" />
          <select
            value={selectedPeriod}
            onChange={handlePeriodChange}
            className="border border-gray-200 px-3 py-2 rounded-lg bg-white shadow-xs text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none flex-1 sm:flex-initial"
            aria-label="Dashboard period"
          >
            <option value="today">Today</option>
            <option value="this_week">This week</option>
            <option value="this_month">This month</option>
            <option value="this_year">This year</option>
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
            className="p-2 border border-gray-200 rounded-lg bg-white text-[#2E5E58] hover:bg-[#F3F7F5] transition-colors cursor-pointer shadow-xs shrink-0"
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
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <StatCard
          title="Direct Payments"
          value={formatRm(animCash)}
          detail={`${formatNumber(summary.directOrderCount)} direct orders`}
          info="Direct RM payments collected during the selected timeframe."
          icon={Wallet}
          iconBg="bg-[#1F3A34]/10 text-[#1F3A34]"
          badge={periodLabel}
          onClick={() => setCurrentPage?.('Finance')}
        />
        <StatCard
          title="Token Order Value"
          value={formatRm(animTokenValue)}
          detail={<div className="grid grid-cols-2 gap-x-2 gap-y-0.5"><span>Personal: <strong className="text-gray-700">{formatNumber(summary.personalTokensUsed)}</strong></span><span>Subsidy: <strong className="text-gray-700">{formatNumber(summary.subsidyUsedTokens)}</strong></span></div>}
          info="RM-equivalent menu value of C2 Credit-funded orders. The detail below shows how much came from personal C2 Credit and how much came from company allowance. This is not cash revenue."
          icon={CircleDollarSign}
          iconBg="bg-sky-50 text-sky-700"
          badge={`${formatNumber(summary.tokenOrderCount)} credit orders`}
          onClick={() => setCurrentPage?.('Finance')}
        />
        <StatCard
          title="Orders"
          value={formatNumber(Math.round(animOrders))}
          detail={<span>Avg <strong className="text-gray-700">{formatRm(averageOrderValueRm)}</strong> / order</span>}
          info="Total number of valid customer orders completed or active during this period, with Average Order Value (AOV)."
          icon={ShoppingBag}
          iconBg="bg-[#2E5E58]/10 text-[#2E5E58]"
          badge={periodLabel}
          onClick={() => setCurrentPage?.('Orders')}
        />
        <StatCard
          title="Pending Payments"
          value={formatRm(animPending)}
          info="RM value of orders waiting for payment confirmation."
          icon={Clock3}
          iconBg="bg-amber-50 text-amber-700"
          badge={periodLabel}
          onClick={() => setCurrentPage?.('Orders')}
        />
        <StatCard
          title="Refund Reviews"
          value={formatNumber(Math.round(animRefunds))}
          info="Pending refund requests awaiting customer service decision or approval."
          icon={CircleDollarSign}
          iconBg={summary.pendingRefunds > 0 ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}
          badge={summary.pendingRefunds > 0 ? "Pending action" : "Zero pending"}
          highlight={summary.pendingRefunds > 0}
          onClick={() => setCurrentPage?.('Refunds')}
        />
        <StatCard
          title="Customers"
          value={formatNumber(Math.round(animCustomers))}
          detail={
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span>Employees: <strong className="text-gray-700">{formatNumber(summary.employeeCustomersServed)}</strong></span>
              <span>Non-employees: <strong className="text-gray-700">{formatNumber(summary.nonEmployeeCustomersServed)}</strong></span>
            </div>
          }
          info="Distinct customers who placed eligible orders during this period, split between employee/intern accounts and non-employee customers."
          icon={Users}
          iconBg="bg-[#6F9F96]/15 text-[#2E5E58]"
          badge={periodLabel}
          onClick={() => setCurrentPage?.('Customers')}
        />
      </div>

      {/* Sales Mix & Audit Summary */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-6">
        <div className="xl:col-span-5 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-gray-900">Combined Sales & Payment Split</h2>
                <InfoTooltip content="Total RM-equivalent sales combining direct RM payments and C2 Credit order value for the selected period." title="Combined Sales" />
              </div>
              <p className="mt-1.5 text-2xl font-extrabold text-gray-900 tabular-nums">{formatRm(animTotalSales)}</p>
            </div>
            <span className="rounded-lg bg-[#2E5E58]/10 px-2.5 py-1 text-xs font-bold text-[#2E5E58] tabular-nums">
              AOV {formatRm(averageOrderValueRm)}
            </span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1.5">
              <span>Direct: {directSharePct}% ({formatRm(summary.cashCollectedRm)})</span>
              <span>C2 Credit: {creditSharePct}% ({formatRm(summary.tokenOrderValueRm)})</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 flex">
              <div className="h-full bg-[#2E5E58] transition-all duration-500" style={{ width: `${directSharePct}%` }} />
              <div className="h-full bg-[#D4AF7A] transition-all duration-500" style={{ width: `${creditSharePct}%` }} />
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-gray-900">Order Pipeline & Audit Watch</h2>
              <InfoTooltip content="Live order stage distribution alongside discounts given and cancelled/voided orders for quick auditing." title="Order Pipeline & Audit Watch" />
            </div>
            <button type="button" onClick={() => setCurrentPage?.('Orders')} className="text-xs font-bold text-[#2E5E58] hover:underline cursor-pointer inline-flex items-center gap-1">
              Inspect orders <ArrowRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              ['Awaiting prep', formatNumber(summary.awaitingPreparation), 'Paid / accepted', 'bg-violet-50 text-violet-700 border-violet-200/60'],
              ['Preparing', formatNumber(summary.preparing), 'In kitchen', 'bg-amber-50 text-amber-700 border-amber-200/60'],
              ['Ready', formatNumber(summary.readyForPickup), 'For pickup', 'bg-sky-50 text-sky-700 border-sky-200/60'],
              ['Completed', formatNumber(summary.collectedCount), 'Collected', 'bg-emerald-50 text-emerald-700 border-emerald-200/60'],
              ['Discounts', formatRm(summary.totalDiscountRm), `${formatNumber(summary.discountedOrderCount)} orders`, 'bg-slate-50 text-slate-800 border-slate-200'],
              ['Cancelled', formatNumber(summary.cancelledCount), formatRm(summary.cancelledValueRm), Number(summary.cancelledCount || 0) > 0 ? 'bg-red-50 text-red-700 border-red-200/80' : 'bg-slate-50 text-slate-600 border-slate-200']
            ].map(([label, val, sub, tone]) => (
              <button
                key={label}
                type="button"
                onClick={() => setCurrentPage?.('Orders')}
                className={`rounded-xl border p-2.5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer ${tone}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
                <p className="mt-1 text-base font-extrabold tabular-nums">{val}</p>
                <p className="mt-0.5 text-[10px] font-semibold opacity-75 truncate">{sub}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Business Overview</h2>
            <InfoTooltip content="Quick links into the customer, voucher, gift-card, menu, inventory, and subsidy records used for management review." title="Business Overview" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ['Customers', formatNumber(coverage.activeCustomers), `${formatNumber(summary.newCustomersRegistered)} new · ${formatNumber(coverage.pendingCustomers)} pending`, Users, 'bg-[#6F9F96]/15 text-[#2E5E58]', 'Customers'],
            ['Vouchers', formatNumber(coverage.activeVouchers), `${formatNumber(coverage.voucherRedemptions)} redeemed`, PackageCheck, 'bg-violet-50 text-violet-700', 'Voucher'],
            ['Gift cards', formatNumber(coverage.activeGiftCards), `${formatRm(coverage.giftCardValueRm)} value`, Wallet, 'bg-amber-50 text-amber-700', 'Gift Cards'],
            ['Active menu', formatNumber(coverage.activeMenuItems), 'published items', Coffee, 'bg-emerald-50 text-emerald-700', 'Menu'],
            ['Low stock', formatNumber(coverage.lowStockItems), 'needs review', ShoppingBag, coverage.lowStockItems > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500', 'Inventory'],
            ['Allowance issued', formatNumber(coverage.subsidyIssuedTokens), `${formatNumber(coverage.subsidyConsumedTokens)} consumed`, CircleDollarSign, 'bg-sky-50 text-sky-700', 'C2 Credit Ledger']
          ].map(([title, value, subtitle, Icon, iconBg, targetPage]) => (
            <button
              key={title}
              type="button"
              onClick={() => setCurrentPage?.(targetPage)}
              className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-left transition-colors hover:border-gray-200 hover:bg-gray-100/70 cursor-pointer"
            >
              <div className="flex items-center gap-2"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}><Icon size={15} /></div><p className="text-xs font-bold text-gray-600">{title}</p></div>
              <p className="mt-3 text-xl font-extrabold tabular-nums text-gray-900">{value}</p>
              <p className="mt-1 text-[11px] text-gray-500">{subtitle}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Combined finance and volume trend */}
      <div className="mb-6">
        <CombinedTrendCard
          title={`Order value and volume by ${chartTimeLabel}`}
          value={`${formatRm(summary.salesToday)} · ${formatNumber(summary.ordersToday)} orders`}
          subtitle={chartSubtitle}
          data={trends}
          info="Compare combined RM-equivalent order value and order volume across the selected period. Direct cash and token-funded value are separated in the KPI cards above."
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <PaymentMixCard data={salesByPayment} total={summary.salesToday} periodLabel={periodLabel} />
        <OutletSalesCard data={outletBreakdown} periodLabel={periodLabel} />
      </div>

      {/* Outlet Performance */}
      <section className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Outlet Performance</h2>
            <InfoTooltip content="Key operational metrics broken down by individual branch, including sales, order volume, and average order value (AOV)." title="Outlet Breakdown" />
          </div>
          <span className="text-xs font-semibold text-gray-400 shrink-0">{periodLabel}</span>
        </div>
        {loading && !dashboard ? <EmptyState>Loading outlet performance...</EmptyState> : outletBreakdown.length === 0 ? <EmptyState>No outlet sales for this period yet.</EmptyState> : (
          <div>
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
                  {visibleOutlets.map((outlet) => (
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
            {outletBreakdown.length > 5 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-500 font-medium">
                  Showing top {visibleOutlets.length} of {outletBreakdown.length} outlets
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllOutlets(!showAllOutlets)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E5E58] hover:text-[#1F3A34] px-3 py-1.5 rounded-lg hover:bg-[#2E5E58]/10 transition-colors cursor-pointer border border-[#2E5E58]/20"
                >
                  {showAllOutlets ? (
                    <>Show top 5 only <ChevronUp size={14} /></>
                  ) : (
                    <>Click for more ({outletBreakdown.length - 5} remaining) <ChevronDown size={14} /></>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Recent Orders & Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
        <section className="xl:col-span-8 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Recent Orders</h2>
              <InfoTooltip content="Most recent live transactions received across all connected outlets." title="Recent Orders" />
            </div>
            <button onClick={() => setCurrentPage?.('Orders')} className="text-xs font-bold text-[#2E5E58] hover:underline cursor-pointer inline-flex items-center gap-1 shrink-0">
              View all <ArrowRight size={14} />
            </button>
          </div>
          {loading && !dashboard ? <EmptyState>Loading live orders...</EmptyState> : recentOrders.length === 0 ? <EmptyState>No orders for this period yet.</EmptyState> : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[680px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Order ID</th>
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Customer</th>
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Outlet</th>
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Total</th>
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Payment</th>
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 text-center">Status</th>
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {visibleOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3 text-[#2E5E58] font-bold">{order.id}</td>
                        <td className="py-3 font-medium text-gray-900">{order.customer}</td>
                        <td className="py-3 text-gray-600">{order.storeName || '-'}</td>
                        <td className="py-3 font-bold text-gray-900 tabular-nums">{formatRm(order.total)}</td>
                        <td className="py-3 text-gray-600">
                          {String(order.paymentMode).toLowerCase() === 'direct' ? (
                            <span className="font-semibold">Direct (RM)</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold">{order.subsidyTokenAmount > 0 ? 'Company allowance + personal C2 Credit' : 'Personal C2 Credit'}</span>
                              <span className="text-[11px] text-gray-500 tabular-nums">
                                {order.subsidyTokenAmount > 0 ? `${formatNumber(order.subsidyTokenAmount)} subsidy · ${formatNumber(order.personalTokenAmount)} personal` : `${formatNumber(order.tokenAmount)} tokens`}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-flex items-center justify-center text-center px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${statusTone(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 font-medium text-gray-400 tabular-nums">{order.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recentOrders.length > 5 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 font-medium">
                    Showing top {visibleOrders.length} of {recentOrders.length} orders
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllOrders(!showAllOrders)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E5E58] hover:text-[#1F3A34] px-3 py-1.5 rounded-lg hover:bg-[#2E5E58]/10 transition-colors cursor-pointer border border-[#2E5E58]/20"
                  >
                    {showAllOrders ? (
                      <>Show top 5 only <ChevronUp size={14} /></>
                    ) : (
                      <>Click for more ({recentOrders.length - 5} remaining) <ChevronDown size={14} /></>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="xl:col-span-4 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center gap-1.5 mb-4">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Order Activity</h2>
            <InfoTooltip content="Live stream of real-time order lifecycle events and status updates." title="Order Activity" />
          </div>
          {loading && !dashboard ? <EmptyState>Loading activity...</EmptyState> : recentActivity.length === 0 ? <EmptyState>No order activity for this period yet.</EmptyState> : (
            <div>
              <div className="space-y-3.5">
                {visibleActivity.map((activity, index) => (
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
              {recentActivity.length > 5 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 font-medium">
                    Showing top {visibleActivity.length} of {recentActivity.length} events
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllActivity(!showAllActivity)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E5E58] hover:text-[#1F3A34] px-3 py-1.5 rounded-lg hover:bg-[#2E5E58]/10 transition-colors cursor-pointer border border-[#2E5E58]/20"
                  >
                    {showAllActivity ? (
                      <>Show top 5 only <ChevronUp size={14} /></>
                    ) : (
                      <>Click for more ({recentActivity.length - 5} remaining) <ChevronDown size={14} /></>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Best-Selling Items */}
      <section className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Best-Selling Items</h2>
            <InfoTooltip content="Top ranking catalog items ordered across all branches for the selected period." title="Best-Selling Items" />
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setTopItemsMetric('unitsSold')}
                className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${topItemsMetric === 'unitsSold' ? 'bg-[#1F3A34] text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Units Sold
              </button>
              <button
                type="button"
                onClick={() => setTopItemsMetric('revenue')}
                className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${topItemsMetric === 'revenue' ? 'bg-[#1F3A34] text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Revenue (RM)
              </button>
            </div>
            <button onClick={() => setCurrentPage?.('Product Report')} className="text-xs font-bold text-[#2E5E58] hover:underline cursor-pointer inline-flex items-center gap-1 shrink-0">
              Product report <ArrowRight size={14} />
            </button>
          </div>
        </div>
        {loading && !dashboard ? <EmptyState>Loading sales data...</EmptyState> : topItems.length === 0 ? <EmptyState>No item sales for this period yet.</EmptyState> : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <div className="lg:col-span-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visibleTopItems} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(v) => topItemsMetric === 'revenue' ? `RM ${v}` : v} />
                  <YAxis type="category" dataKey="name" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} />
                  <Tooltip
                    formatter={(val) => [topItemsMetric === 'revenue' ? formatRm(val) : `${formatNumber(val)} sold`, topItemsMetric === 'revenue' ? 'Revenue' : 'Units']}
                    contentStyle={{ backgroundColor: '#172D28', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey={topItemsMetric} fill={topItemsMetric === 'revenue' ? '#2E5E58' : '#D4AF7A'} radius={[0, 6, 6, 0]} barSize={18} isAnimationActive animationDuration={500} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleTopItems.map((item, index) => (
                <div key={item.name} className="border border-gray-100 rounded-xl p-3.5 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-md bg-[#2E5E58]/10 text-[#2E5E58] text-xs font-bold inline-flex items-center justify-center">#{index + 1}</span>
                    <Coffee size={16} className="text-gray-400" />
                  </div>
                  <p className="mt-2.5 text-xs font-bold text-gray-900 truncate" title={item.name}>{item.name}</p>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-gray-500 text-[11px]">{formatNumber(item.unitsSold)} sold</span>
                    <span className="font-bold text-[#2E5E58] tabular-nums">{formatRm(item.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardHome;
