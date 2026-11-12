import React from "react";
import { ArrowLeft, Coins, Percent, Ticket } from "lucide-react";
import InfoTooltip from "./InfoTooltip";

//Stat Card Component
const StatCard = ({ title, value, change, badge, icon: Icon, iconBg, info }) => {
  const displayBadge = badge || change;
  const bg = iconBg && iconBg.includes('/') ? iconBg : 'bg-[#2E5E58]/10 text-[#2E5E58]';
  return (
    <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col justify-between min-w-0 card-reveal hover-lift cursor-default transition-all">
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <h2 className="text-gray-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">{title}</h2>
          {info && <InfoTooltip content={info} title={title} placement="top" />}
        </div>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
          <Icon size={15} strokeWidth={2.2} />
        </div>
      </div>
      <div className="mt-2.5 sm:mt-3 flex flex-col gap-1.5">
        <p className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight tabular-nums">{value}</p>
        {displayBadge && (
          <div className="flex">
            <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 truncate max-w-full">
              {displayBadge}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const parseNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[%,$\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

//Main Component
const LoyaltyProgramSummary = ({ overview, onBack }) => {
  const summary = overview?.summary || null;
  const tiersData = Array.isArray(overview?.tierBreakdown) && overview.tierBreakdown.length > 0
    ? overview.tierBreakdown.map((tier) => ({
        name: tier.tierName ?? tier.name,
        members: parseNumber(tier.members ?? tier.count ?? tier.member_count),
        percentage: parseNumber(tier.percentage),
        avgTokens: parseNumber(tier.avgTokens ?? tier.tokensAvg ?? tier.avg_tokens),
        iconBg: tier.iconBg || "bg-gray-100 text-gray-600"
      }))
    : [];
  const topReward = Array.isArray(overview?.topRedeemedRewards) && overview.topRedeemedRewards.length > 0
    ? {
        ...overview.topRedeemedRewards[0],
        redemptions: parseNumber(overview.topRedeemedRewards[0].redemptions ?? overview.topRedeemedRewards[0].redemption_count)
      }
    : null;
  const totalMembers = Number(summary?.totalMembers ?? 0);
  const averageTokensPerMember = totalMembers > 0
    ? parseNumber(summary?.tokensInCirculation ?? 0) / totalMembers
    : 0;

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
          Loyalty program metrics and tier breakdown.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-8">
        {!overview && (
          <div className="mb-6 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
            Loyalty data is not available yet.
          </div>
        )}

        {/* Expanded Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <StatCard
            title="Average Tokens per Member"
            value={overview ? averageTokensPerMember.toFixed(2) : '—'}
          change="C2 Credit balance"
            icon={Coins}
            iconBg="bg-[#6F9F96]"
          />
          <StatCard
            title="Redemption Rate"
            value={overview ? `${parseNumber(summary?.redemptionRate).toFixed(1)}%` : '—'}
            change="Issued vs redeemed"
            icon={Percent}
            iconBg="bg-[#E07A5F]"
          />
          <StatCard
            title="Most Redeemed Reward"
            value={topReward?.reward || "No redemptions"}
            change={topReward ? `${parseNumber(topReward.redemptions).toLocaleString('en-US')} redemptions` : (overview ? "No data yet" : "—")}
            icon={Ticket}
            iconBg="bg-[#D4AF7A]"
          />
          <StatCard
            title="Tokens Redeemed"
            value={overview ? parseNumber(summary?.tokensRedeemed).toLocaleString('en-US') : '—'}
            change="Ledger total"
            icon={Coins}
            iconBg="bg-[#1F3A34]"
          />
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
                {tiersData.length > 0 ? (
                  tiersData.map((tier, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] ${tier.iconBg}`}>
                          {tier.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-700">
                        {parseNumber(tier.members ?? tier.count).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-700">
                        {parseNumber(tier.percentage).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">
                        {parseNumber(tier.avgTokens ?? tier.tokensAvg).toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-10 text-center text-gray-500">
                      No tier breakdown available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyProgramSummary;
