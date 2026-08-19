import React from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const TokenTransaction = ({ customer, onBack }) => {
  const currentBalance = customer?.tokens || customer?.tokensBalance || '0';
  const balanceNum = parseInt(currentBalance.toString().replace(/,/g, ''), 10) || 0;

  const transactions = [
    { id: 'TXN-001', type: 'Earned', amount: '+145', source: 'Order ORD-2026-001', date: 'Aug 19, 2026', balance: currentBalance },
    { id: 'TXN-002', type: 'Redeemed', amount: '-500', source: 'Voucher Redemption', date: 'Aug 19, 2026', balance: (balanceNum - 145).toLocaleString() },
    { id: 'TXN-003', type: 'Earned', amount: '+25', source: 'Order ORD-2026-002', date: 'Aug 19, 2026', balance: (balanceNum - 145 + 500).toLocaleString() },
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
          <h1 className="text-2xl font-bold text-gray-900">Token Transactions</h1>
        </div>
        <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
          Token ledger for {customer.username}
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Transaction ID</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Type</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Source / Detail</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Date</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Amount</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Balance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{txn.id}</td>
                <td className="px-6 py-4">
                  <span className={`flex items-center space-x-1 text-sm font-bold ${txn.type === 'Earned' ? 'text-green-600' : 'text-red-500'}`}>
                    {txn.type === 'Earned' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    <span>{txn.type}</span>
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{txn.source}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{txn.date}</td>
                <td className={`px-6 py-4 text-sm font-bold ${txn.type === 'Earned' ? 'text-green-600' : 'text-red-500'}`}>{txn.amount}</td>
                <td className="px-6 py-4 text-sm font-bold text-gray-900">{txn.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default TokenTransaction;
