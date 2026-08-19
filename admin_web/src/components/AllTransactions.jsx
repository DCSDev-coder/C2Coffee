import React, { useState } from 'react';
import { ArrowLeft, Download, Filter, Search } from 'lucide-react';

const generateTransactions = () => {
  const list = [];
  const statuses = ["Completed", "Refunded", "Pending"];
  const descriptions = ["Order ORD-0510-001", "Top Up Wallet", "Voucher Redeemed (VCH-1001)", "Payment Gateway Fee", "Subscription Renewal"];
  
  for(let i=1; i<=25; i++) {
    const desc = descriptions[Math.floor(Math.random() * descriptions.length)];
    const isNegative = desc.includes("Fee") || desc.includes("Redeemed") || desc.includes("Renewal");
    const amount = isNegative ? `-${(Math.random() * 50 + 5).toFixed(2)}` : `+${(Math.random() * 150 + 20).toFixed(2)}`;
    
    list.push({
      id: i,
      date: `May ${Math.max(1, 31 - i)}, 2026`,
      time: `${Math.floor(Math.random() * 12 + 1)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')} ${Math.random() > 0.5 ? 'AM' : 'PM'}`,
      desc: desc,
      amount: amount,
      status: statuses[Math.floor(Math.random() * statuses.length)]
    });
  }
  return list;
};

const allTransactions = generateTransactions();

const AllTransactions = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = allTransactions.filter(tx => 
    tx.desc.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tx.date.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6 overflow-y-auto bg-gray-50/30">
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            title="Back to Finance"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">All Transactions</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm">
            <Filter size={16} /> Filter
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-[500px]">
        {/* Toolbar */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="relative w-64">
            <input 
              type="text" 
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3A34] focus:border-[#1F3A34]"
            />
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500">Showing {filtered.length} transactions</p>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-gray-50/80 backdrop-blur-sm shadow-sm z-10">
              <tr className="border-b border-gray-200 text-left">
                <th className="px-5 py-4 font-bold text-gray-900 w-40">Date & Time</th>
                <th className="px-5 py-4 font-bold text-gray-900">Description</th>
                <th className="px-5 py-4 font-bold text-gray-900 w-32 text-center">Amount (RM)</th>
                <th className="px-5 py-4 font-bold text-gray-900 w-32">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-gray-900">{tx.date}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tx.time}</p>
                  </td>
                  <td className="px-5 py-4 font-bold text-gray-900">{tx.desc}</td>
                  <td className={`px-5 py-4 text-center font-bold ${tx.amount.startsWith('-') ? 'text-gray-900' : 'text-green-700'}`}>
                    {tx.amount}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                      tx.status === "Completed" ? "bg-green-100 text-green-700" : 
                      tx.status === "Refunded" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-5 py-12 text-center text-gray-500 font-medium">
                    No transactions found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllTransactions;
