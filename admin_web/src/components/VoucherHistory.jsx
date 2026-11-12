import React, { useEffect, useState } from 'react';
import { ArrowLeft, Ticket } from 'lucide-react';
import { loadAdminCustomerActivity } from '../lib/adminApi';

const VoucherHistory = ({ customer, onBack }) => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadAdminCustomerActivity(customer.id).then((data) => active && setVouchers(data.redeemedVouchers || [])).catch(() => active && setVouchers([])).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customer.id]);

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
          <h1 className="text-2xl font-bold text-gray-900">Voucher History</h1>
        </div>
        <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
          Claimed and used vouchers for {customer.username}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 h-fit">
        {loading ? <div className="col-span-full text-center text-sm text-gray-500 py-10">Loading redeemed vouchers...</div> : vouchers.length === 0 ? <div className="col-span-full text-center text-sm text-gray-500 py-10">No redeemed vouchers or tier rewards found.</div> : vouchers.map(v => (
          <div key={v.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col items-center text-center h-fit">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${v.color}`}>
              <Ticket size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{v.name}</h3>
            <p className="text-sm text-gray-500 mb-2">Redeemed {new Date(v.redeemedAt).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <p className="text-xs text-gray-500 mb-4">{v.type === 'tier_reward' ? 'Tier reward' : v.issuedReason}{v.orderId ? ` · Order ${v.orderId}` : ''}</p>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
              Redeemed
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
export default VoucherHistory;
