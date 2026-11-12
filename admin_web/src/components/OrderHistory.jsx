import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { loadAdminCustomerActivity } from '../lib/adminApi';

const OrderHistory = ({ customer, onBack }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadAdminCustomerActivity(customer.id)
      .then((data) => active && setOrders(data.orders || []))
      .catch(() => active && setOrders([]))
      .finally(() => active && setLoading(false));
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
          <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
        </div>
        <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
          Past orders for {customer.username}
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Order ID</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Date</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Items</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Total Amount</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? <tr><td colSpan="5" className="px-6 py-10 text-center text-sm text-gray-500">Loading order history...</td></tr> : orders.length === 0 ? <tr><td colSpan="5" className="px-6 py-10 text-center text-sm text-gray-500">No orders found for this customer.</td></tr> : orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-bold text-gray-900">{order.id}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(order.date).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{order.itemNames || `${order.items} items`}</td>
                <td className="px-6 py-4 text-sm font-bold text-[#E07A5F]">{order.tokensCharged} tokens <span className="block text-xs font-medium text-gray-500">RM {order.totalRm.toFixed(2)} · {order.personalTokens} personal{order.subsidyTokens ? ` · ${order.subsidyTokens} subsidy` : ''}</span></td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-green-100 text-green-700">
                    {String(order.status).replaceAll('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default OrderHistory;
