import React from 'react';
import { ArrowLeft, Award } from 'lucide-react';

const TiersHistory = ({ customer, onBack }) => {
  const history = [
    { date: 'Dec 15, 2025', action: 'Upgraded to Legend', points: '1,500 pts reached' },
    { date: 'June 20, 2025', action: 'Upgraded to Kawan', points: '500 pts reached' },
    { date: 'Jan 12, 2025', action: 'Account Created', points: '0 pts' },
  ];

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
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
          <h1 className="text-2xl font-bold text-gray-900">Tiers History</h1>
        </div>
        <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
          Progression timeline for {customer.username}
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex-1">
        <div className="relative border-l-2 border-gray-100 ml-4 space-y-10">
          {history.map((event, idx) => (
            <div key={idx} className="relative pl-8">
              <div className="absolute -left-[17px] bg-[#E07A5F] rounded-full w-8 h-8 flex items-center justify-center text-white border-4 border-white shadow-sm">
                <Award size={14} />
              </div>
              <p className="text-sm font-bold text-gray-900">{event.action}</p>
              <p className="text-xs text-gray-500 mt-1">{event.date} • {event.points}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default TiersHistory;
