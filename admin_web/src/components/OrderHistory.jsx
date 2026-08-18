import React from 'react';
import { ArrowLeft } from 'lucide-react';

const OrderHistory = ({ customer, onBack }) => {
  const orders = [
    { id: 'ORD-2026-001', date: 'May 5, 2026', items: 3, total: 'RM 145.00', status: 'Delivered' },
    { id: 'ORD-2026-002', date: 'April 28, 2026', items: 1, total: 'RM 25.50', status: 'Delivered' },
    { id: 'ORD-2026-003', date: 'April 15, 2026', items: 5, total: 'RM 320.00', status: 'Delivered' },
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
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-bold text-gray-900">{order.id}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{order.date}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{order.items} items</td>
                <td className="px-6 py-4 text-sm font-bold text-[#E07A5F]">{order.total}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md bg-green-100 text-green-700">
                    {order.status}
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
