import React, { useState } from 'react';
import { ArrowLeft, Save, Plus } from 'lucide-react';

const GenerateInvoice = ({ onBack }) => {
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Invoice generated successfully!');
    onBack();
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Generate Invoice</h1>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Customer Name</label>
            <input 
              type="text" 
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1F3A34] focus:border-[#1F3A34] outline-none text-sm"
              placeholder="Enter customer name"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
            <input 
              type="text" 
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1F3A34] focus:border-[#1F3A34] outline-none text-sm"
              placeholder="Invoice description (e.g., Catering Services)"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Amount (RM)</label>
            <input 
              type="number" 
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1F3A34] focus:border-[#1F3A34] outline-none text-sm"
              placeholder="0.00"
            />
          </div>
          
          <div className="pt-4 flex items-center justify-end gap-3">
            <button type="button" onClick={onBack} className="px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-[#1F3A34] text-white text-sm font-bold rounded-lg hover:bg-[#2E5E58] transition-colors cursor-pointer shadow-sm">
              <Plus size={16} /> Create Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GenerateInvoice;
