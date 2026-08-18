import React from "react";
import { ArrowLeft, Users, Coins, Percent, Ticket, ArrowUp } from "lucide-react";

// ─── Stat Card Component ───────────────────────────────────────────────────────
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

// ─── Main Component ─────────────────────────────────────────────────────────────
const LoyaltyProgramSummary = ({ onBack }) => {
  const metrics = [
    { title: "Average Tokens per Member", value: "60.12", change: "7.3%", icon: Coins, iconBg: "bg-[#6F9F96]" },
    { title: "Redemption Rate", value: "55.5%", change: "7.3%", icon: Percent, iconBg: "bg-[#E07A5F]" },
    { title: "Most Redeemed Reward", value: "Free Latte", change: "", icon: Ticket, iconBg: "bg-[#D4AF7A]" },
    { title: "Total Points Earned", value: "22,780", change: "8.3%", icon: Coins, iconBg: "bg-[#1F3A34]" }
  ];

  const tiersData = [
    { name: "Legend", count: 414, percentage: "25%", tokensAvg: 1200, iconBg: "bg-[#D4AF7A]/20 text-[#A8824A]" },
    { name: "Dilamun", count: 414, percentage: "25%", tokensAvg: 800, iconBg: "bg-[#E07A5F]/15 text-[#E07A5F]" },
    { name: "Ketagih", count: 414, percentage: "25%", tokensAvg: 450, iconBg: "bg-purple-100 text-purple-600" },
    { name: "Kawan", count: 414, percentage: "25%", tokensAvg: 100, iconBg: "bg-blue-100 text-blue-600" }
  ];

  return (
    <div className="h-full flex flex-col p-8 bg-gray-50/50">
      {/* Header */}
      <div className="mb-6 shrink-0">
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
          <h1 className="text-2xl font-bold text-gray-900">Loyalty Program Summary</h1>
        </div>
        <p className={`text-sm text-gray-500 mt-1 ${onBack ? "ml-8" : ""}`}>
          Detailed overview of all loyalty program metrics and tier breakdown.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-8">
        {/* Expanded Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((m, idx) => (
            <StatCard key={idx} {...m} />
          ))}
        </div>

        {/* Detailed Tier Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Members by Tier Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
                  <th className="px-6 py-4">Tier Level</th>
                  <th className="px-6 py-4 text-center">Total Members</th>
                  <th className="px-6 py-4 text-center">% of Base</th>
                  <th className="px-6 py-4 text-right">Avg Tokens / Member</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tiersData.map((tier, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] ${tier.iconBg}`}>
                        {tier.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-700">
                      {tier.count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-700">
                      {tier.percentage}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      {tier.tokensAvg.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyProgramSummary;
