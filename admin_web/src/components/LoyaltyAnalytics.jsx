import React, { useState } from "react";
import {
  ArrowLeft, Search, ChevronDown, Download, Users, RefreshCw, Coins, Ticket, Star, StarHalf, ArrowUp, CheckCircle2, Percent, Crown, ChevronRight
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ─── Shared Components ──────────────────────────────────────────────────────────

const CustomInput = React.forwardRef(({ value, onClick }, ref) => (
  <button
    onClick={onClick}
    ref={ref}
    className="flex items-center gap-1 px-2.5 py-1 bg-[#1F3A34] text-white rounded-lg text-[11px] font-semibold cursor-pointer shadow-xs focus:outline-none"
  >
    <span>{value || 'Select Date'}</span>
    <ChevronDown size={12} />
  </button>
));
CustomInput.displayName = "CustomInput";

const CustomFilterInput = React.forwardRef(({ value, onClick, onClear }, ref) => (
  <div className="relative">
    <button
      onClick={(e) => { e.preventDefault(); onClick(e); }}
      ref={ref}
      className="flex items-center pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
    >
      {value || 'Select Date'}
    </button>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      <ChevronDown size={16} className="text-gray-500" />
    </div>
  </div>
));
CustomFilterInput.displayName = "CustomFilterInput";

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

// ─── Dummy Data ─────────────────────────────────────────────────────────────

const tokensIssuedVsRedeemed = [
  { day: "May 1", issued: 1200, redeemed: 800 },
  { day: "May 6", issued: 1100, redeemed: 900 },
  { day: "May 16", issued: 1300, redeemed: 1000 },
  { day: "May 21", issued: 1050, redeemed: 850 },
  { day: "May 26", issued: 1250, redeemed: 950 },
  { day: "May 31", issued: 1400, redeemed: 1100 }
];

const tokensBySource = [
  { name: "Purchase", value: 3162, percentage: "38.0%", color: "#1F3A34" },
  { name: "Top up", value: 3162, percentage: "38.0%", color: "#2E5E58" },
  { name: "Campaign / Promo", value: 3162, percentage: "38.0%", color: "#E07A5F" },
  { name: "Referrals", value: 3162, percentage: "38.0%", color: "#D4AF7A" }
];

const topRedeemedRewards = [
  { rank: 1, reward: "Free Latte", redemptions: "2,980", pct: "74.5%" },
  { rank: 2, reward: "15% Off Total Bill", redemptions: "2,140", pct: "68.2%" },
  { rank: 3, reward: "RM 5 Instant Discount", redemptions: "1,680", pct: "62.0%" },
  { rank: 4, reward: "Buy 1 Free 1 Shakerato", redemptions: "940", pct: "55.4%" },
  { rank: 5, reward: "Free Cinnamon Roll", redemptions: "580", pct: "48.1%" }
];

const tokenActivityTime = [
  { range: "Apr 27 - May 3", issued: 4000, redeemed: 2800 },
  { range: "May 4 - May 10", issued: 3500, redeemed: 3000 },
  { range: "May 11 - May 17", issued: 4200, redeemed: 3200 },
  { range: "May 18 - May 24", issued: 3800, redeemed: 2900 },
  { range: "May 25 - May 31", issued: 4500, redeemed: 3500 }
];

const recentActivity = [
  { id: 1, user: "miraelys", action: "earned 10 tokens", desc: "Purchase - Order ORD-0510-001", time: "10:21 AM" },
  { id: 2, user: "miraelys", action: "redeemed Free Latte", desc: "Voucher VCH-1001", time: "10:21 AM" },
  { id: 3, user: "miraelys", action: "earned 10 tokens", desc: "Top Up Wallet", time: "10:21 AM" },
  { id: 4, user: "miraelys", action: "earned 10 tokens", desc: "Purchase - Order ORD-0510-001", time: "10:21 AM" },
  { id: 5, user: "miraelys", action: "earned 10 tokens", desc: "Purchase - Order ORD-0510-001", time: "10:21 AM" }
];

// ─── Main Component ─────────────────────────────────────────────────────────────

const LoyaltyAnalytics = ({ onBack, onViewSummary }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All Type");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedDate, setSelectedDate] = useState(null);
  
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  // Custom Legends for Recharts
  const renderTokensBySourceLegend = () => (
    <div className="flex flex-col space-y-3 mt-4">
      {tokensBySource.map((entry, index) => (
        <div key={`item-${index}`} className="flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span className="text-gray-900">{entry.name}</span>
          </div>
          <div className="flex gap-4 text-right">
            <span className="text-gray-900">{entry.percentage}</span>
            <span className="text-gray-900 w-8">{entry.value.toLocaleString()}</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between text-[11px] font-bold pt-3 border-t border-gray-100 mt-2">
        <span className="text-gray-900">Total Redeemed</span>
        <span className="text-gray-900">8,320</span>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col px-8 pb-8 pt-2 space-y-6 overflow-y-auto bg-gray-50/30">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title="Back"
              >
                <ArrowLeft size={22} strokeWidth={2.5} />
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">Loyalty & Tokens</h1>
          </div>
          <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
            Manage customer loyalty tiers, points and token transactions.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 shrink-0">
        <StatCard title="Total Members" value="2,138" change="12.6% vs 1 July - 31 July 2026" icon={Users} iconBg="bg-[#1F3A34]" />
        <StatCard title="Total Tokens in Circulation" value="128,560" change="8.2% vs 1 July - 31 July 2026" icon={RefreshCw} iconBg="bg-[#2E5E58]" />
        <StatCard title="Tokens Issued" value="15,230" change="17.1% vs 1 July - 31 July 2026" icon={Coins} iconBg="bg-[#6F9F96]" />
        <StatCard title="Tokens Redeemed" value="8,450" change="2.3% vs 1 July - 31 July 2026" icon={Ticket} iconBg="bg-[#8AACA5]" />
        <StatCard title="Points Earned" value="22,780" change="8.3% vs 1 July - 31 July 2026" icon={Star} iconBg="bg-[#E07A5F]" />
        <StatCard title="Redemption Rate" value="55.5%" change="6.5% vs 1 July - 31 July 2026" icon={Percent} iconBg="bg-[#D4AF7A]" />
      </div>

      {/* Filters */}
      <div className="flex justify-end mb-4 shrink-0">
        <button onClick={() => alert("Exporting data...")} className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer shadow-sm whitespace-nowrap">
          <Download size={16} className="mr-1.5" />
          Export
        </button>
      </div>

      {/* Grid Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        
        {/* Tokens Issued vs Redeemed */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[380px]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Tokens Issued vs Redeemed</h3>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2E5E58]"></span>
                  <span>Issued</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E07A5F]"></span>
                  <span>Redeemed</span>
                </div>
              </div>
            </div>
            <div className="w-28 relative">
              <DatePicker selected={null} customInput={<CustomInput />} dateFormat="d MMM yyyy" onChange={()=>{}} />
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full relative -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tokensIssuedVsRedeemed} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIssued" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E5E58" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2E5E58" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRedeemed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E07A5F" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#E07A5F" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600, angle: -20, textAnchor: 'end' }} dy={10} height={40} />
                <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }} dx={-10} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}K` : val} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="issued" stroke="#2E5E58" strokeWidth={3} fillOpacity={1} fill="url(#colorIssued)" />
                <Area type="monotone" dataKey="redeemed" stroke="#E07A5F" strokeWidth={3} fillOpacity={1} fill="url(#colorRedeemed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tokens by Source */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[380px]">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-gray-900">Tokens by Source</h3>
            <div className="w-28 relative">
              <DatePicker selected={null} customInput={<CustomInput />} dateFormat="d MMM yyyy" onChange={()=>{}} />
            </div>
          </div>
          <div className="flex-1 flex items-center min-h-0">
            <div className="w-1/2 h-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    formatter={(value, name, item) => [`${value}% (${item.payload.count})`, name]}
                    contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Pie data={tokensBySource} cx="50%" cy="50%" innerRadius="65%" outerRadius="90%" paddingAngle={2} dataKey="value" stroke="none">
                    {tokensBySource.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-24 h-24 rounded-full bg-[#1F3A34] flex flex-col items-center justify-center text-white shadow-sm">
                  <span className="text-xl font-bold leading-tight">15,230</span>
                  <span className="text-[10px] font-medium leading-tight mt-0.5">Total Issued</span>
                </div>
              </div>
            </div>
            <div className="w-1/2 pl-4">
              {renderTokensBySourceLegend()}
            </div>
          </div>
        </div>

        {/* Loyalty Program Summary (Top half) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[380px]">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-lg font-bold text-gray-900">Loyalty Program Summary</h3>
            <button onClick={onViewSummary} className="text-sm font-bold text-[#2E5E58] hover:text-[#1F3A34] transition-colors cursor-pointer">
              View All
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 pb-2">
            <div className="bg-[#2E5E58] rounded-xl p-4 text-white relative overflow-hidden mb-4 shrink-0">
            {/* Background elements */}
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <Crown size={32} className="text-white" />
              <div>
                <p className="text-sm font-bold">Members by Tier</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 relative z-10">
              <div className="text-center">
                <p className="text-[10px] font-medium text-white/80">Legend</p>
                <p className="font-bold text-sm">414</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium text-white/80">Dilamun</p>
                <p className="font-bold text-sm">414</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium text-white/80">Ketagih</p>
                <p className="font-bold text-sm">414</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium text-white/80">Kawan</p>
                <p className="font-bold text-sm">414</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 shrink-0">
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#6F9F96] flex items-center justify-center text-white shrink-0">
                  <Coins size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-medium">Average Tokens per Member</p>
                  <p className="text-sm font-bold text-gray-900">60.12</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-gray-900">
                <ArrowUp size={12} /> 7.3%
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#E07A5F] flex items-center justify-center text-white shrink-0">
                  <Percent size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-medium">Redemption Rate</p>
                  <p className="text-sm font-bold text-gray-900">55.5%</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-gray-900">
                <ArrowUp size={12} /> 7.3%
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF7A] flex items-center justify-center text-white shrink-0">
                  <Ticket size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-medium">Most Redeemed Reward</p>
                  <p className="text-sm font-bold text-gray-900">Free Latte</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">2,980</p>
                <p className="text-[8px] text-gray-400 font-medium leading-none">Redemptions</p>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        
        {/* Top Redeemed Rewards */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[420px]">
          <h3 className="text-lg font-bold text-gray-900 mb-4 shrink-0">Top Redeemed Rewards</h3>
          <div className="flex-1 overflow-y-auto pr-2">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[11px] text-gray-900 border-b border-gray-100 font-extrabold">
                  <th className="py-2 w-10 text-center">Rank</th>
                  <th className="py-2">Reward</th>
                  <th className="py-2 text-center">Redemption</th>
                  <th className="py-2 text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topRedeemedRewards.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 text-center font-bold text-gray-900">{item.rank}</td>
                    <td className="py-3 flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#1F3A34] shrink-0"></div>
                      <span className="font-bold text-gray-900">{item.reward}</span>
                    </td>
                    <td className="py-3 text-center font-bold text-gray-900">{item.redemptions}</td>
                    <td className="py-3 text-right font-bold text-gray-900">{item.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Token Activity Over Time */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[420px]">
          <div className="flex justify-between items-start mb-6 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Token Activity Over Time</h3>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2E5E58]"></span>
                  <span>Issued</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8AACA5]"></span>
                  <span>Redeemed</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full relative -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tokenActivityTime} margin={{ top: 0, right: 0, left: 35, bottom: 0 }} barGap={2} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="range" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 600, angle: -20, textAnchor: 'end' }} dy={10} height={40} />
                <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }} dx={-10} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}K` : val} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="issued" fill="#2E5E58" radius={[2, 2, 0, 0]} />
                <Bar dataKey="redeemed" fill="#8AACA5" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[420px]">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
            <button onClick={onBack} className="text-[10px] font-bold text-gray-500 hover:text-gray-900 flex items-center transition-colors cursor-pointer">
              View All <ChevronRight size={12} className="ml-0.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-4">
              {recentActivity.map((activity, idx) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1F3A34] shrink-0 shadow-sm mt-1"></div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-900">
                        {activity.user} <span className="font-normal">{activity.action}</span>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{activity.desc}</p>
                    </div>
                  </div>
                  <span className="text-[9px] text-gray-400 font-medium whitespace-nowrap mt-1">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoyaltyAnalytics;
