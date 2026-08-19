import React, { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const RecordExpense = ({ onBack }) => {
  const [expenseName, setExpenseName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Cost of Goods Sold');
  const [date, setDate] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Expense recorded successfully!');
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
          <h1 className="text-2xl font-bold text-gray-900">Record Expense</h1>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Expense Name</label>
            <input 
              type="text" 
              required
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1F3A34] focus:border-[#1F3A34] outline-none text-sm"
              placeholder="e.g., Office Supplies"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1F3A34] focus:border-[#1F3A34] outline-none text-sm bg-white"
            >
              <option value="Cost of Goods Sold">Cost of Goods Sold</option>
              <option value="Salaries & Wages">Salaries & Wages</option>
              <option value="Rent & Utilities">Rent & Utilities</option>
              <option value="Marketing Expenses">Marketing Expenses</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
            <div className="w-full border border-gray-300 rounded-lg overflow-hidden">
              <DatePicker
                selected={date}
                onChange={(d) => setDate(d)}
                className="w-full px-4 py-2 outline-none text-sm"
                dateFormat="d MMMM yyyy"
              />
            </div>
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
              <Save size={16} /> Save Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordExpense;
