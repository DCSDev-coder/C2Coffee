import React from 'react';
import { ArrowLeft, Ticket } from 'lucide-react';

const VoucherHistory = ({ customer, onBack }) => {
  const vouchers = [
    { id: 'VCH-001', name: 'RM10 Off Next Purchase', status: 'Used', date: 'May 2, 2026', color: 'bg-gray-100 text-gray-600' },
    { id: 'VCH-002', name: 'Free Shipping', status: 'Active', date: 'Valid until June 1, 2026', color: 'bg-green-100 text-green-700' },
    { id: 'VCH-003', name: '20% Discount Storewide', status: 'Expired', date: 'Expired April 1, 2026', color: 'bg-red-100 text-red-700' },
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
          <h1 className="text-2xl font-bold text-gray-900">Voucher History</h1>
        </div>
        <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
          Claimed and used vouchers for {customer.username}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 h-fit">
        {vouchers.map(v => (
          <div key={v.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col items-center text-center h-fit">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${v.color}`}>
              <Ticket size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{v.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{v.date}</p>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${v.color}`}>
              {v.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
export default VoucherHistory;
