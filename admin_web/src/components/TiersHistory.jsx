import React from 'react';
import { ArrowLeft, Award, Crown } from 'lucide-react';

const TiersHistory = ({ customer, progress, onBack }) => {
  const isMaxTier = progress.nextTier === 'Max Tier';
  return (
    <div className="px-4 sm:px-6 md:px-8 pb-8 pt-2 h-full flex flex-col">
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
          <h1 className="text-2xl font-bold text-gray-900">Tier Progress</h1>
        </div>
        <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
          Current loyalty rank for {customer.username}
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 md:p-8 flex-1">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-2xl bg-[#1F3A34] p-5 sm:p-6 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Crown size={22} className="text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/65">Current tier</p>
                  <p className="text-xl font-bold">{progress.tier}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold tabular-nums">{progress.current}</p>
                <p className="text-xs text-white/65">qualifying cups / 180 days</p>
              </div>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-black/30">
              <div className="h-full rounded-full bg-[#E07A5F]" style={{ width: `${progress.percentage}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/75">
              <span>{isMaxTier ? 'Highest active tier reached' : `${progress.remaining} cups remaining`}</span>
              <span>{isMaxTier ? 'Max Tier' : `Next: ${progress.nextTier} at ${progress.target}`}</span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <Award size={20} className="mt-0.5 shrink-0 text-[#E07A5F]" />
            <div>
              <p className="text-sm font-bold text-gray-900">How this rank is calculated</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Tier progress uses the customer&apos;s persisted qualifying-cup total for the rolling 180-day window. It does not use total orders, C2 Credit balance, or fabricated history events.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default TiersHistory;
