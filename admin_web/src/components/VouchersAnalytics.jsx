import React, { useState } from "react";
import {
  ArrowLeft, Download, Percent, Gift,
  CreditCard, Tag, Users, ChevronDown, ArrowUp
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  LineChart, Line, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const CustomInput = React.forwardRef(({ value, onClick }, ref) => (
  <button
    onClick={onClick}
    ref={ref}
    className="flex items-center gap-1 px-2.5 py-1 bg-[#1F3A34] text-white rounded-lg text-[11px] font-semibold cursor-pointer shadow-xs focus:outline-none"
  >
    <span>{value}</span>
    <ChevronDown size={12} />
  </button>
));
CustomInput.displayName = "CustomInput";

// ─── Stat Card Component (Matched to Customers & Orders KPICard) ─────────────
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

// ─── Dummy Data for Charts ───────────────────────────────────────────────────────
const timeSeriesData = [
  { day: "May 1", issued: 420, redeemed: 280, rate: 66.6 },
  { day: "May 6", issued: 650, redeemed: 410, rate: 63.0 },
  { day: "May 11", issued: 820, redeemed: 560, rate: 68.2 },
  { day: "May 16", issued: 980, redeemed: 690, rate: 70.4 },
  { day: "May 21", issued: 1100, redeemed: 780, rate: 70.9 },
  { day: "May 26", issued: 1180, redeemed: 860, rate: 72.8 },
  { day: "May 31", issued: 1240, redeemed: 920, rate: 74.1 }
];

const topVouchers = [
  { id: "VCH-1001", name: "Free Latte", redemptions: "2,980", rate: "74.5%" },
  { id: "VCH-1002", name: "15% Off Total Bill", redemptions: "2,140", rate: "68.2%" },
  { id: "VCH-1003", name: "RM 5 Instant Discount", redemptions: "1,680", rate: "62.0%" },
  { id: "VCH-1004", name: "Buy 1 Free 1 Shakerato", redemptions: "940", rate: "55.4%" },
  { id: "VCH-1005", name: "Free Cinnamon Roll", redemptions: "580", rate: "48.1%" }
];

const voucherTypeData = [
  { name: "Free Drink", value: 3162, percentage: "38.0%", color: "#1F3A34" },
  { name: "Percentage Off", value: 2080, percentage: "25.0%", color: "#2E5E58" },
  { name: "Token Discount", value: 1498, percentage: "18.0%", color: "#6F9F96" },
  { name: "Free Food", value: 998, percentage: "12.0%", color: "#E07A5F" },
  { name: "Others", value: 582, percentage: "7.0%", color: "#D4AF7A" }
];

const tierUsageData = [
  { name: "Legend", value: 3494, percentage: "42.0%", color: "#1F3A34" },
  { name: "Kawan", value: 2330, percentage: "28.0%", color: "#2E5E58" },
  { name: "Dilamun", value: 1498, percentage: "18.0%", color: "#E07A5F" },
  { name: "Ketagih", value: 998, percentage: "12.0%", color: "#D4AF7A" }
];

const recentActivityData = [
  {
    id: 1,
    time: "May 31, 2026 – 10:21 AM",
    voucher: "Free Latte",
    voucherCode: "VCH-1001",
    action: "Redeemed",
    customer: "Miraelys",
    customerId: "ID: C2-000183",
    detail: "Order ORD-0510-001",
    subDetail: "-RM 0.00"
  },
  {
    id: 2,
    time: "May 31, 2026 – 10:21 AM",
    voucher: "Free Latte",
    voucherCode: "VCH-1001",
    action: "Expired",
    customer: "Miraelys",
    customerId: "ID: C2-000183",
    detail: "Expired on 1 August, 2026",
    subDetail: ""
  },
  {
    id: 3,
    time: "May 31, 2026 – 10:21 AM",
    voucher: "Free Latte",
    voucherCode: "VCH-1001",
    action: "Redeemed",
    customer: "Miraelys",
    customerId: "ID: C2-000183",
    detail: "Order ORD-0510-001",
    subDetail: "-RM 0.00"
  },
  {
    id: 4,
    time: "May 31, 2026 – 10:21 AM",
    voucher: "Free Latte",
    voucherCode: "VCH-1001",
    action: "Redeemed",
    customer: "Miraelys",
    customerId: "ID: C2-000183",
    detail: "Order ORD-0510-001",
    subDetail: "-RM 0.00"
  },
  {
    id: 5,
    time: "May 31, 2026 – 9:45 AM",
    voucher: "15% Off Total Bill",
    voucherCode: "VCH-1002",
    action: "Redeemed",
    customer: "Alex Chong",
    customerId: "ID: C2-000184",
    detail: "Order ORD-0510-003",
    subDetail: "-RM 4.50"
  }
];

const VouchersAnalytics = ({ onBack }) => {
  const [selectedDate, setSelectedDate] = useState(new Date("2026-08-07"));
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6">
      {/* 1. Header with Back Arrow and Export Button */}
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title="Back to Vouchers"
              >
                <ArrowLeft size={22} strokeWidth={2.5} />
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">Vouchers Analytics</h1>
          </div>
          <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
            Track voucher performance, usage and redemption insights.
          </p>
        </div>

        <button
          onClick={() => alert("Exporting voucher analytics report...")}
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer shadow-xs"
        >
          <Download size={15} /> Export
        </button>
      </div>

      {/* 2. Stat Cards Row (5 Cards matching mockup) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Voucher Issued"
          value="12,560"
          change="12.6% vs 1 July - 31 July 2026"
          icon={Percent}
          iconBg="bg-[#1F3A34]"
        />
        <StatCard
          title="Voucher Redeemed"
          value="8,320"
          change="8.2% vs 1 July - 31 July 2026"
          icon={Gift}
          iconBg="bg-[#2E5E58]"
        />
        <StatCard
          title="Redemption Rate"
          value="61.2%"
          change="17.1% vs 1 July - 31 July 2026"
          icon={CreditCard}
          iconBg="bg-[#6F9F96]"
        />
        <StatCard
          title="Total Discount Given"
          value="RM 12,246.80"
          change="8.7% vs 1 July - 31 July 2026"
          icon={Tag}
          iconBg="bg-[#E07A5F]"
        />
        <StatCard
          title="Average Discount Per Voucher"
          value="RM 6.31"
          change="9.3% vs 1 July - 31 July 2026"
          icon={Users}
          iconBg="bg-[#D4AF7A]"
        />
      </div>

      {/* 3. Middle Charts Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Chart 1: Voucher Issued VS Redeemed Over Time */}
        <div className="col-span-12 lg:col-span-5 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 leading-tight">
                Voucher Issued VS Redeemed Over Time
              </h3>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E07A5F]"></span>
                  <span>Issued</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2E5E58]"></span>
                  <span>Redeemed</span>
                </div>
              </div>
            </div>
            <DatePicker
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              dateFormat="d MMM yyyy"
              customInput={<CustomInput />}
              portalId="root"
            />
          </div>

          <div className="h-52 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <defs>
                  <linearGradient id="issuedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E07A5F" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E07A5F" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="redeemedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E5E58" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2E5E58" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  dy={10}
                />
                <YAxis
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  domain={[0, 1200]}
                  ticks={[0, 200, 400, 600, 800, 1000, 1200]}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K`.replace('.0', '') : v)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="issued" name="Issued" stroke="#E07A5F" strokeWidth={2} fillOpacity={1} fill="url(#issuedGrad)" />
                <Area type="monotone" dataKey="redeemed" name="Redeemed" stroke="#2E5E58" strokeWidth={2} fillOpacity={1} fill="url(#redeemedGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Redemption Rate Over Time */}
        <div className="col-span-12 lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-sm font-bold text-gray-900 leading-tight">
              Redemption Rate Over Time
            </h3>
            <DatePicker
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              dateFormat="d MMM yyyy"
              customInput={<CustomInput />}
              portalId="root"
            />
          </div>

          <div className="h-52 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <XAxis
                  dataKey="day"
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  dy={10}
                />
                <YAxis
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Redemption Rate']}
                  contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="rate" name="Redemption Rate" stroke="#2E5E58" strokeWidth={2} dot={{ r: 3, fill: '#2E5E58' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Performing Vouchers */}
        <div className="col-span-12 lg:col-span-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Top Performing Vouchers</h3>

          <div className="divide-y divide-gray-100 flex-1 overflow-y-auto">
            <div className="grid grid-cols-12 pb-2 text-[10px] font-bold text-gray-400 uppercase">
              <span className="col-span-6">Voucher</span>
              <span className="col-span-3 text-right">Redemptions</span>
              <span className="col-span-3 text-right">Rate</span>
            </div>
            {topVouchers.map((v, i) => (
              <div key={i} className="grid grid-cols-12 py-2 items-center text-xs">
                <div className="col-span-6 flex items-center gap-2 min-w-0 pr-1">
                  <div className="w-7 h-7 rounded-full bg-[#1F3A34] text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {v.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-[11px] truncate">{v.name}</p>
                    <p className="text-[9px] text-gray-400">{v.id}</p>
                  </div>
                </div>
                <div className="col-span-3 text-right font-bold text-gray-800 text-[11px]">
                  {v.redemptions}
                </div>
                <div className="col-span-3 text-right font-bold text-green-700 text-[11px]">
                  {v.rate}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Donut Charts Row (2 Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voucher Type Performance */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Voucher Type Performance</h3>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Center-labeled Donut Chart */}
            <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(value, name, item) => [`${item.payload.percentage} (${value.toLocaleString()} redeemed)`, item.payload.name]}
                    contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Pie
                    data={voucherTypeData}
                    innerRadius={54}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {voucherTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-extrabold text-gray-900">8,320</span>
                <span className="text-[10px] text-gray-500 font-semibold uppercase">Redeemed</span>
              </div>
            </div>

            {/* Breakdown List */}
            <div className="flex-1 w-full space-y-2 text-xs">
              {voucherTypeData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span className="font-medium text-gray-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-900">{item.percentage}</span>
                    <span className="text-gray-500 w-12 text-right">{item.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between font-bold text-gray-900 text-xs">
                <span>Total Redeemed</span>
                <span>8,320</span>
              </div>
            </div>
          </div>
        </div>

        {/* Usage by Customer Tier */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Usage by Customer Tier</h3>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Center-labeled Donut Chart */}
            <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(value, name, item) => [`${item.payload.percentage} (${value.toLocaleString()} redeemed)`, `${item.payload.name} Tier`]}
                    contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Pie
                    data={tierUsageData}
                    innerRadius={54}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {tierUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-extrabold text-gray-900">8,320</span>
                <span className="text-[10px] text-gray-500 font-semibold uppercase">Redeemed</span>
              </div>
            </div>

            {/* Breakdown List */}
            <div className="flex-1 w-full space-y-2 text-xs">
              {tierUsageData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span className="font-medium text-gray-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-900">{item.percentage}</span>
                    <span className="text-gray-500 w-12 text-right">{item.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between font-bold text-gray-900 text-xs">
                <span>Total Redeemed</span>
                <span>8,320</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Table: Recent Voucher Activity */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
        <h3 className="text-base font-bold text-gray-900 mb-4">Recent Voucher Activity</h3>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-left">
                <th className="pb-3 font-bold">Date & Time</th>
                <th className="pb-3 font-bold">Voucher</th>
                <th className="pb-3 font-bold">Action</th>
                <th className="pb-3 font-bold">Customer</th>
                <th className="pb-3 font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentActivityData.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 text-gray-600 font-medium whitespace-nowrap">{row.time}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#1F3A34] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                        {row.voucher.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{row.voucher}</p>
                        <p className="text-[10px] text-gray-400">{row.voucherCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                        row.action === "Redeemed"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {row.action}
                    </span>
                  </td>
                  <td className="py-3">
                    <p className="font-bold text-gray-900">{row.customer}</p>
                    <p className="text-[10px] text-gray-400">{row.customerId}</p>
                  </td>
                  <td className="py-3">
                    <span className="font-medium text-gray-800">{row.detail}</span>
                    {row.subDetail && (
                      <span className="text-gray-500 ml-2 font-medium">{row.subDetail}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-center">
          <div className="flex space-x-1.5 items-center">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-40 cursor-pointer text-xs font-semibold"
            >
              ←
            </button>
            {[1, 2, 3, 4, 5].map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  currentPage === pageNum
                    ? "bg-[#2E5E58] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {pageNum}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(5, p + 1))}
              disabled={currentPage === 5}
              className="px-2.5 py-1 text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-40 cursor-pointer text-xs font-semibold"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VouchersAnalytics;
