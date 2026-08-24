/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
import { adminRequest } from "../lib/adminApi";
import { ArrowLeft, Download, Percent, Gift } from "lucide-react";
import { exportToCSV } from "../utils/exportToCSV";

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
          <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal">{change}</p>
        </div>
      )}
    </div>
  </div>
);

const VouchersAnalytics = ({ onBack, vouchers }) => {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const safeVouchers = Array.isArray(vouchers) ? vouchers : [];

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      try {
        const response = await adminRequest("/v1/admin/vouchers/analytics");
        if (!cancelled) {
          setAnalytics(response);
        }
      } catch (error) {
        if (!cancelled) {
          setAnalytics(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    if (analytics?.summary) {
      return {
        total: Number(analytics.summary.totalVouchers || 0),
        active: Number(analytics.summary.activeVouchers || 0),
        issued: Number(analytics.summary.issuedVouchers || 0),
        redeemed: Number(analytics.summary.redeemedVouchers || 0),
        rate: Number(analytics.summary.redemptionRate || 0).toFixed(1)
      };
    }

    const issued = safeVouchers.reduce((acc, voucher) => acc + Number(voucher.issued || 0), 0);
    const redeemed = safeVouchers.reduce((acc, voucher) => acc + Number(voucher.redeemed || 0), 0);
    const active = safeVouchers.filter((voucher) => voucher.status === "Active").length;
    const rate = issued > 0 ? ((redeemed / issued) * 100).toFixed(1) : "0.0";
    const total = safeVouchers.length;

    return { issued, redeemed, active, rate, total };
  }, [analytics, safeVouchers]);

  const topVouchers = useMemo(() => {
    if (Array.isArray(analytics?.topVouchers) && analytics.topVouchers.length > 0) {
      return analytics.topVouchers;
    }

    return [...safeVouchers]
      .sort(
        (a, b) =>
          Number(b.redeemed || 0) - Number(a.redeemed || 0) ||
          Number(b.issued || 0) - Number(a.issued || 0)
      )
      .slice(0, 10);
  }, [analytics, safeVouchers]);

  const recentActivity = useMemo(() => {
    if (Array.isArray(analytics?.recentActivity) && analytics.recentActivity.length > 0) {
      return analytics.recentActivity;
    }

    return [];
  }, [analytics]);

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6">
      <div className="shrink-0 flex items-center justify-between gap-4">
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
            {isLoading ? "Loading live analytics..." : "Live voucher performance from the backend analytics endpoint."}
          </p>
        </div>

        <button
          onClick={() => {
            const rows = [
              ["Voucher Code", "Name", "Type", "Status", "Issued", "Redeemed", "Redemption Rate"],
              ...topVouchers.map((voucher) => {
                const issued = Number(voucher.issued || 0);
                const redeemed = Number(voucher.redeemed || 0);
                const rate = issued > 0 ? `${((redeemed / issued) * 100).toFixed(1)}%` : "0.0%";

                return [
                  `"${voucher.id}"`,
                  `"${voucher.name}"`,
                  `"${voucher.type || ""}"`,
                  `"${voucher.status || ""}"`,
                  issued,
                  redeemed,
                  `"${rate}"`
                ];
              })
            ];
            exportToCSV(rows, "vouchers_analytics.csv");
          }}
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer shadow-xs"
        >
          <Download size={15} /> Export
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Vouchers"
          value={summary.total.toLocaleString()}
          change="Live from current data"
          icon={Percent}
          iconBg="bg-[#1F3A34]"
        />
        <StatCard
          title="Active Vouchers"
          value={summary.active.toLocaleString()}
          change="Live from current data"
          icon={Gift}
          iconBg="bg-[#2E5E58]"
        />
        <StatCard
          title="Redemption Rate"
          value={`${summary.rate}%`}
          change="Issued vs redeemed"
          icon={Percent}
          iconBg="bg-[#D4AF7A]"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col flex-1 min-h-0 space-y-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Top Vouchers</h3>
            <p className="text-xs text-gray-500 mt-1">Sorted by redeemed count, then issued count.</p>
          </div>
        </div>

        <div className="overflow-x-auto flex-1 min-h-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-left">
                <th className="pb-3 font-bold">Voucher</th>
                <th className="pb-3 font-bold">Type</th>
                <th className="pb-3 font-bold">Status</th>
                <th className="pb-3 font-bold text-right">Issued</th>
                <th className="pb-3 font-bold text-right">Redeemed</th>
                <th className="pb-3 font-bold text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topVouchers.length > 0 ? (
                topVouchers.map((voucher) => {
                  const issued = Number(voucher.issued || 0);
                  const redeemed = Number(voucher.redeemed || 0);
                  const rate = issued > 0 ? ((redeemed / issued) * 100).toFixed(1) : "0.0";

                  return (
                    <tr key={voucher.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 pr-3">
                        <div>
                          <p className="font-bold text-gray-900">{voucher.name}</p>
                          <p className="text-[10px] text-gray-400">{voucher.id}</p>
                        </div>
                      </td>
                      <td className="py-3 text-gray-700">{voucher.type || "-"}</td>
                      <td className="py-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                            voucher.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : voucher.status === "Expired"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {voucher.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold text-gray-800">{issued.toLocaleString()}</td>
                      <td className="py-3 text-right font-bold text-gray-800">{redeemed.toLocaleString()}</td>
                      <td className="py-3 text-right font-bold text-green-700">{rate}%</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-gray-500">
                    No voucher data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Recent Activity</h3>
              <p className="text-xs text-gray-500 mt-1">Latest voucher issue, redeem, and revoke events.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-left">
                  <th className="pb-3 font-bold">Time</th>
                  <th className="pb-3 font-bold">Voucher</th>
                  <th className="pb-3 font-bold">Action</th>
                  <th className="pb-3 font-bold">Customer</th>
                  <th className="pb-3 font-bold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentActivity.length > 0 ? (
                  recentActivity.map((row) => {
                    const eventTime = row.eventAt ? new Date(row.eventAt) : null;
                    const timeLabel =
                      eventTime && !Number.isNaN(eventTime.getTime())
                        ? eventTime.toLocaleString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "numeric",
                            minute: "numeric",
                            hour12: true
                          })
                        : "-";

                    const actionTone =
                      row.action === "Redeemed"
                        ? "bg-green-100 text-green-800"
                        : row.action === "Revoked"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700";

                    return (
                      <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 text-gray-600 font-medium whitespace-nowrap">{timeLabel}</td>
                        <td className="py-3">
                          <div>
                            <p className="font-bold text-gray-900">{row.voucherName}</p>
                            <p className="text-[10px] text-gray-400">{row.voucherCode}</p>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${actionTone}`}>
                            {row.action}
                          </span>
                        </td>
                        <td className="py-3">
                          <p className="font-bold text-gray-900">{row.customer?.displayName || "-"}</p>
                          <p className="text-[10px] text-gray-400">{row.customer?.email || row.customer?.phone || "-"}</p>
                        </td>
                        <td className="py-3 text-gray-700">{row.issuedReason || "-"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-gray-500">
                      No recent activity available yet.
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

export default VouchersAnalytics;
