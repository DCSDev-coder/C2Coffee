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
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tiers History</h1>
          <p className="text-gray-500">Progression timeline for {customer.username}</p>
        </div>
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
