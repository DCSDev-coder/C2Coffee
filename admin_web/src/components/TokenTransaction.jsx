import React from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const TokenTransaction = ({ customer, onBack }) => {
  const transactions = [
    { id: 'TXN-001', type: 'Earned', amount: '+145', source: 'Order ORD-2026-001', date: 'May 5, 2026', balance: '1,560' },
    { id: 'TXN-002', type: 'Spent', amount: '-500', source: 'Voucher Redemption', date: 'May 1, 2026', balance: '1,415' },
    { id: 'TXN-003', type: 'Earned', amount: '+25', source: 'Order ORD-2026-002', date: 'April 28, 2026', balance: '1,915' },
  ];

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={onBack} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Token Transactions</h1>
          <p className="text-gray-500">Token ledger for {customer.username}</p>
        </div>
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
