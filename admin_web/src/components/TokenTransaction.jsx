import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { loadAdminCustomerActivity } from '../lib/adminApi';

const SOURCE_LABELS = {
  employee_allowance_issue: 'Monthly company allowance added',
  employee_allowance_spend: 'Company allowance used for order',
  employee_allowance_expiry: 'Company allowance expired',
  employee_allowance_role_revoke: 'Company allowance removed',
  employee_allowance_role_restore: 'Company allowance restored',
  refund_return: 'Order refund returned',
  order_spend: 'C2 Credit used for order',
  topup_paid: 'C2 Credit top-up',
  topup_refund: 'Top-up refund',
  admin_adjustment: 'Admin adjustment',
  promo_credit: 'Promotional credit',
  voucher_subsidy: 'Voucher credit',
  referral_reward: 'Referral reward',
  gift_card_redeem: 'Gift card redeemed',
  gift_card_redemption: 'Gift card redeemed'
};

const formatActivityDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const TokenTransaction = ({ customer, transactions: providedTransactions, onBack }) => {
  const currentBalance = customer?.tokens || customer?.tokensBalance || '0';
  const balanceNum = parseInt(currentBalance.toString().replace(/,/g, ''), 10) || 0;
  const sourceTransactions = Array.isArray(providedTransactions) ? providedTransactions : [];
  const [loadedTransactions, setLoadedTransactions] = useState(sourceTransactions);
  const [loading, setLoading] = useState(!providedTransactions);
  useEffect(() => {
    if (providedTransactions) return undefined;
    let active = true;
    loadAdminCustomerActivity(customer.id).then((data) => active && setLoadedTransactions(data.tokenTransactions || [])).catch(() => active && setLoadedTransactions([])).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customer.id, providedTransactions]);

  const transactions = (providedTransactions ? sourceTransactions : loadedTransactions)
    .map((txn) => {
      const sourceKey = txn.sourceType || txn.source || txn.desc || 'credit_activity';
      const source = SOURCE_LABELS[sourceKey] || String(sourceKey).replace(/_/g, ' ');
      const rawAmount = txn.amount ?? txn.tokens ?? 0;
      const amountValue = typeof rawAmount === 'string'
        ? Number(rawAmount.replace(/[,+]/g, '').replace(/-/g, '')) || 0
        : Number(rawAmount || 0);
      const isDebit = txn.direction === 'debit'
        || txn.type === 'Redeemed'
        || String(txn.amount ?? txn.tokens ?? '').startsWith('-');
      const type = sourceKey === 'employee_allowance_issue'
        ? 'Allowance added'
        : sourceKey === 'employee_allowance_spend'
          ? 'Allowance used'
          : sourceKey === 'refund_return'
            ? 'Refund returned'
            : isDebit ? 'Credit used' : 'Credit added';
      const signedAmount = typeof txn.amount === 'string' && txn.amount.trim()
        ? txn.amount
        : `${isDebit ? '-' : '+'}${amountValue.toLocaleString('en-US')}`;
      const parsedDate = txn.date || txn.time || '';
      const sortKey = parsedDate ? new Date(parsedDate).getTime() : 0;

      return {
        id: txn.id,
        type,
        isDebit,
        amount: signedAmount,
        source,
        date: parsedDate,
        sortKey,
        delta: isDebit ? -amountValue : amountValue,
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
          <h1 className="text-2xl font-bold text-gray-900">C2 Credit Activity</h1>
        </div>
        <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
          Balance changes for {customer?.username || customer?.name || 'selected member'}
        </p>
      </div>
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1">
      {loading ? (
        <div className="h-full flex items-center justify-center px-6 py-10 text-sm text-gray-500">Loading C2 Credit activity...</div>
      ) : transactions.length === 0 ? (
        <div className="h-full flex items-center justify-center px-6 py-10 text-sm text-gray-500">
          No C2 Credit activity is available for this member.
        </div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Reference</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Activity</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Description</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Date &amp; Time</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Change</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-900">Balance After</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{txn.id}</td>
                <td className="px-6 py-4">
                  <span className={`flex items-center space-x-1 text-sm font-bold ${txn.isDebit ? 'text-red-500' : 'text-green-600'}`}>
                    {txn.isDebit ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    <span>{txn.type}</span>
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{txn.source}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatActivityDate(txn.date)}</td>
                <td className={`px-6 py-4 text-sm font-bold ${txn.isDebit ? 'text-red-500' : 'text-green-600'}`}>{txn.amount}</td>
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
