import React, { useState } from "react";
import {
  Banknote, Briefcase, Wallet, ArrowRightLeft, ArrowRight,
  ChevronDown, FileText, PlusCircle, BarChart3, DownloadCloud, ArrowUp, Package
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const CustomInput = React.forwardRef(({ value, onClick }, ref) => (
  <button
    onClick={onClick}
    ref={ref}
    className="flex items-center justify-between gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold cursor-pointer shadow-sm hover:bg-gray-50 transition-colors min-w-[160px]"
  >
    <span>{value || 'Select Date'}</span>
    <ChevronDown size={16} />
  </button>
));
CustomInput.displayName = "CustomInput";

//Stat Card Component
const StatCard = ({ title, value, change, icon: Icon, iconBg, iconColor = "text-white" }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0 transition-transform duration-200 peer-focus:-rotate-180">
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


const revenueData = [
  { day: "May 1", current: 800, previous: 500 },
  { day: "May 6", current: 950, previous: 600 },
  { day: "May 11", current: 850, previous: 650 },
  { day: "May 16", current: 1200, previous: 800 },
  { day: "May 21", current: 1100, previous: 900 },
  { day: "May 26", current: 1350, previous: 950 },
  { day: "May 31", current: 1500, previous: 1050 }
];

const expenseData = [
  { name: "Cost of Goods Sold", value: 18439.94, percentage: "50.8%", color: "#1F3A34" },
  { name: "Salaries & Wages", value: 7985.80, percentage: "22.0%", color: "#2E5E58" },
  { name: "Rent & Utilities", value: 4573.68, percentage: "12.6%", color: "#8AACA5" },
  { name: "Marketing Expenses", value: 2323.14, percentage: "6.4%", color: "#E07A5F" },
  { name: "Maintenance", value: 1561.86, percentage: "4.3%", color: "#D4AF7A" }
];

const recentTransactions = [
  { id: 1, date: "Aug 19, 2026", time: "10:21 AM", desc: "Order ORD-0510-001 (miraelys)", amount: "+15.90", status: "Completed" },
  { id: 2, date: "Aug 19, 2026", time: "10:18 AM", desc: "Order ORD-0510-002 (miraelys)", amount: "+15.90", status: "Pending" },
  { id: 3, date: "Aug 19, 2026", time: "10:15 AM", desc: "Order ORD-0510-003 (miraelys)", amount: "+15.90", status: "Completed" },
  { id: 4, date: "Aug 19, 2026", time: "10:10 AM", desc: "Refund ORD-0510-004 (miraelys)", amount: "-15.90", status: "Refunded" },
  { id: 5, date: "Aug 19, 2026", time: "9:50 AM", desc: "Order ORD-0510-006 (alex_chong)", amount: "+32.50", status: "Completed" },
  { id: 6, date: "Aug 19, 2026", time: "9:45 AM", desc: "Order ORD-0510-007 (sarah_lee)", amount: "+45.00", status: "Completed" },
  { id: 7, date: "Aug 19, 2026", time: "9:30 AM", desc: "Order ORD-0510-008 (khai_rul)", amount: "+18.20", status: "Completed" }
];

const Finance = ({ setCurrentPage }) => {
  const [selectedDate, setSelectedDate] = useState(null);

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6 overflow-y-auto bg-gray-50/30">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <p className="text-gray-500 text-sm mt-0.5">Overview of the financial performance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-4 shrink-0 overflow-x-auto min-w-[800px] pb-2">
        <StatCard title="Total Revenue" value="RM 152,340.80" change="12.6% vs 1 July - 31 July 2026" icon={Banknote} iconBg="bg-[#1F3A34]" />
        <StatCard title="Gross Profit" value="RM 78,920.40" change="8.2% vs 1 July - 31 July 2026" icon={Briefcase} iconBg="bg-[#2E5E58]" />
        <StatCard title="Net Profit" value="RM 42,621.30" change="17.1% vs 1 July - 31 July 2026" icon={Wallet} iconBg="bg-[#6F9F96]" />
        <StatCard title="Total Expenses" value="RM 36,299.10" change="8.7% vs 1 July - 31 July 2026" icon={FileText} iconBg="bg-[#E07A5F]" />
        <StatCard title="Transactions" value="8,450" change="9.3% vs 1 July - 31 July 2026" icon={ArrowRightLeft} iconBg="bg-[#D4AF7A]" />
      </div>

      {/* Global Date Picker */}
      <div className="flex justify-end shrink-0">
        <DatePicker portalId="root-portal" popperPlacement="bottom-end"
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          dateFormat="d MMMM yyyy"
          customInput={<CustomInput />}
          portalId="root"
          popperPlacement="bottom-end"
        />
      </div>

      {/* Middle Charts */}
      <div className="grid grid-cols-12 gap-6 shrink-0">
        {/* Revenue Overview */}
        <div className="col-span-7 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col min-w-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Revenue Overview</h3>
              <p className="text-[10px] text-gray-500 font-medium uppercase mt-1">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">RM 152,340.80</p>

              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8AACA5]"></span>
                  <span>This Month</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E07A5F]"></span>
                  <span>Last Month</span>
                </div>
              </div>
            </div>
          </div>
          <div className="h-64 w-full mt-2 -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8AACA5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8AACA5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E07A5F" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#E07A5F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }} tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="current" name="This Month" stroke="#8AACA5" strokeWidth={3} fillOpacity={1} fill="url(#colorCurrent)" />
                <Area type="monotone" dataKey="previous" name="Last Month" stroke="#E07A5F" strokeWidth={3} fillOpacity={1} fill="url(#colorPrevious)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="col-span-5 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col min-w-0">
          <h3 className="text-base font-bold text-gray-900 mb-6">Expense Breakdown</h3>
          <div className="flex-1 flex flex-row items-center gap-6">
            <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseData} innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                    {expenseData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`RM ${value.toLocaleString()}`, name]}
                    contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-bold text-gray-900">RM 36,299.10</span>
                <span className="text-[11px] text-gray-500 font-medium">Total Expenses</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3 mt-4 md:mt-0">
              {expenseData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span className="font-bold text-gray-900">{item.name}</span>
                  </div>
                  <span className="font-bold text-gray-900">{item.percentage}</span>
                </div>
              ))}
              <div className="pt-4 text-right border-t border-gray-100">
                <button onClick={() => setCurrentPage('ExpenseBreakdownFull')} className="text-[11px] font-bold text-gray-900 hover:underline inline-flex items-center gap-1 cursor-pointer">
                  View All <ArrowRight size={14} className="ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-12 gap-6 shrink-0">
        {/* Recent Transactions */}
        <div className="col-span-7 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full min-w-0">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-base font-bold text-gray-900">Recent Transactions</h3>
            <button onClick={() => setCurrentPage('AllTransactions')} className="text-xs font-bold text-gray-900 hover:underline inline-flex items-center gap-1 cursor-pointer">
              View All <ArrowRight size={14} className="ml-0.5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto pr-2">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-100 text-left">
                  <th className="pb-3 font-bold text-gray-900 w-32">Date & Time</th>
                  <th className="pb-3 font-bold text-gray-900">Description</th>
                  <th className="pb-3 font-bold text-gray-900 w-28 text-center">Amount (RM)</th>
                  <th className="pb-3 font-bold text-gray-900 w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3">
                      <p className="font-bold text-gray-900">{tx.date}</p>
                      <p className="text-[10px] text-gray-500">{tx.time}</p>
                    </td>
                    <td className="py-3 font-bold text-gray-900">{tx.desc}</td>
                    <td className="py-3 text-center font-bold text-gray-900">{tx.amount}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.status === "Completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right side panel */}
        <div className="col-span-5 flex flex-col gap-6 min-w-0">
          {/* Profit Summary */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col flex-1">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900">Profit Summary</h3>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center text-xs font-bold text-gray-900">
                <span>Total Revenue</span>
                <span>RM 152,340.80</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-gray-900 pb-3 border-b border-gray-100">
                <span>Total Expenses</span>
                <span>-RM 36,299.10</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-gray-900 pt-1">
                <span>Net Profit</span>
                <span>RM 42,621.30</span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-medium text-gray-500">
                <span>Net Profit Margin</span>
                <span className="font-bold text-gray-900">28.0%</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => setCurrentPage("GenerateInvoice")}
                className="flex flex-col items-center justify-center p-3 bg-[#1F3A34] text-white rounded-xl shadow-sm hover:opacity-90 transition-opacity cursor-pointer gap-2"
              >
                <PlusCircle size={24} />
                <span className="text-[10px] font-bold text-center leading-tight">Generate<br />Invoice</span>
              </button>

              <button
                onClick={() => setCurrentPage("RecordExpense")}
                className="flex flex-col items-center justify-center p-3 bg-[#8AACA5] text-white rounded-xl shadow-sm hover:opacity-90 transition-opacity cursor-pointer gap-2"
              >
                <FileText size={24} />
                <span className="text-[10px] font-bold text-center leading-tight">Record<br />Expense</span>
              </button>

              <button
                onClick={() => setCurrentPage("RevenueReport")}
                className="flex flex-col items-center justify-center p-3 bg-[#E07A5F] text-white rounded-xl shadow-sm hover:opacity-90 transition-opacity cursor-pointer gap-2"
              >
                <BarChart3 size={24} />
                <span className="text-[10px] font-bold text-center leading-tight">Revenue<br />Report</span>
              </button>

              <button
                onClick={() => setCurrentPage("ExportStatement")}
                className="flex flex-col items-center justify-center p-3 bg-[#D4AF7A] text-white rounded-xl shadow-sm hover:opacity-90 transition-opacity cursor-pointer gap-2"
              >
                <DownloadCloud size={24} />
                <span className="text-[10px] font-bold text-center leading-tight">Export<br />Statement</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Finance;
