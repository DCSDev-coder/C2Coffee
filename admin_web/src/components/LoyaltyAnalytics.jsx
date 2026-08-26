import React, { useState } from "react";
import {
  ArrowLeft, ChevronDown, ChevronRight, Ticket, Coins
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

//Shared Components

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

const parseNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[%,$\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const emptyRecentActivity = [];

//Main Component
const LoyaltyAnalytics = ({ overview, onBack, onViewSummary }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const summary = overview?.summary || {};
  const issuedVsRedeemedData = (Array.isArray(overview?.issuedVsRedeemed) ? overview.issuedVsRedeemed : []).map((entry) => ({
    day: entry.day,
    issued: parseNumber(entry.issued),
    redeemed: parseNumber(entry.redeemed)
  }));
  const topRewardsData = (Array.isArray(overview?.topRedeemedRewards) ? overview.topRedeemedRewards : []).map((entry, index) => ({
    rank: entry.rank ?? index + 1,
    reward: entry.reward ?? entry.reward_name ?? "Unnamed reward",
    redemptions: parseNumber(entry.redemptions ?? entry.redemption_count),
    pct: parseNumber(entry.pct ?? entry.percentage)
  }));
  const activityData = Array.isArray(overview?.recentActivity) ? overview.recentActivity : emptyRecentActivity;
  const tokenActivityData = issuedVsRedeemedData;

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
            Live loyalty overview, rewards, and activity.
          </p>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
        <StatCard
          title="Rewards Redeemed"
          value={parseNumber(summary.totalRewardRedemptions ?? 0).toLocaleString('en-US')}
          change={`${parseNumber(summary.redemptionRate).toFixed(1)}% redemption rate`}
          icon={Ticket}
          iconBg="bg-[#E07A5F]"
        />
        <StatCard
          title="Tokens Redeemed"
          value={parseNumber(summary.tokensRedeemed).toLocaleString('en-US')}
          change="Live ledger total"
          icon={Coins}
          iconBg="bg-[#D4AF7A]"
        />
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">

        {/* Top Redeemed Rewards */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[420px]">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Top Redeemed Rewards</h3>
              <p className="text-xs text-gray-500 mt-0.5">Ranked by actual redemptions.</p>
            </div>
            <button onClick={onViewSummary} className="text-xs font-bold text-[#2E5E58] hover:text-[#1F3A34] transition-colors cursor-pointer whitespace-nowrap">
              View summary
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            {topRewardsData.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                No reward redemptions yet.
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-[11px] text-gray-900 border-b border-gray-100 font-extrabold">
                    <th className="py-2 w-10 text-center">Rank</th>
                    <th className="py-2">Reward</th>
                    <th className="py-2 text-center">Redemption</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topRewardsData.slice(0, 5).map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 text-center font-bold text-gray-900">{item.rank}</td>
                      <td className="py-3 flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#1F3A34] shrink-0"></div>
                        <span className="font-bold text-gray-900">{item.reward}</span>
                      </td>
                      <td className="py-3 text-center font-bold text-gray-900">{parseNumber(item.redemptions).toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Token Activity */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[420px] lg:col-span-2">
          <div className="flex justify-between items-start mb-6 shrink-0">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Token Activity</h3>
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
            <div className="w-28 relative">
              <DatePicker portalId="root-portal" popperPlacement="bottom-end" selected={null} customInput={<CustomInput />} dateFormat="d MMM yyyy" onChange={() => { }} />
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full relative -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tokenActivityData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIssued" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E5E58" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#2E5E58" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRedeemed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8AACA5" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#8AACA5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600, angle: -20, textAnchor: 'end' }} dy={10} height={40} />
                <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }} dx={-10} tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="issued" stroke="#2E5E58" strokeWidth={3} fillOpacity={1} fill="url(#colorIssued)" />
                <Area type="monotone" dataKey="redeemed" stroke="#8AACA5" strokeWidth={3} fillOpacity={1} fill="url(#colorRedeemed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[420px] lg:col-span-3">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
            <button onClick={onBack} className="text-[10px] font-bold text-gray-500 hover:text-gray-900 flex items-center transition-colors cursor-pointer">
              View All <ChevronRight size={12} className="ml-0.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-4">
              {activityData.map((activity, idx) => (
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
