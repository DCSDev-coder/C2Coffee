import React from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const TokenTransaction = ({ customer, transactions: providedTransactions, onBack }) => {
  const currentBalance = customer?.tokens || customer?.tokensBalance || '0';
  const balanceNum = parseInt(currentBalance.toString().replace(/,/g, ''), 10) || 0;
  const sourceTransactions = Array.isArray(providedTransactions) ? providedTransactions : [];

  const transactions = sourceTransactions
    .map((txn) => {
      const source = txn.source || txn.desc || 'Token activity';
      const rawAmount = txn.amount ?? txn.tokens ?? 0;
      const amountValue = typeof rawAmount === 'string'
        ? Number(rawAmount.replace(/[,+]/g, '').replace(/-/g, '')) || 0
        : Number(rawAmount || 0);
      const type = txn.type || (String(txn.amount ?? txn.tokens ?? '').startsWith('-') ? 'Redeemed' : 'Earned');
      const signedAmount = typeof txn.amount === 'string' && txn.amount.trim()
        ? txn.amount
        : `${type === 'Redeemed' ? '-' : '+'}${amountValue.toLocaleString('en-US')}`;
      const parsedDate = txn.date || txn.time || '';
      const sortKey = parsedDate ? new Date(parsedDate).getTime() : 0;

      return {
        id: txn.id,
        type,
        amount: signedAmount,
        source,
        date: parsedDate,
        sortKey,
        delta: type === 'Redeemed' ? -amountValue : amountValue,
        balance: txn.balance || txn.balanceAfter || null
      };
    })
    .sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0))
    .map((txn, index, arr) => {
      if (txn.balance) {
        return txn;
      }

      let runningBalance = balanceNum;
      for (let i = 0; i < index; i += 1) {
        const previous = arr[i];
        runningBalance -= previous.delta;
      }

      return {
        ...txn,
        balance: Math.max(0, runningBalance).toLocaleString('en-US')
      };
    });

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
          Token ledger for {customer?.username || customer?.name || 'Selected member'}
        </p>
      </div>
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1">
      {transactions.length === 0 ? (
        <div className="h-full flex items-center justify-center px-6 py-10 text-sm text-gray-500">
          No token transactions available for this member.
        </div>
      ) : (
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
      )}
      </div>
    </div>
  );
};
export default TokenTransaction;
