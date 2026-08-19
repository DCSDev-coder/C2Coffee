import React from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const expenseData = [
  { name: "Cost of Goods Sold", value: 18439.94, percentage: "50.8%", color: "#1F3A34" },
  { name: "Salaries & Wages", value: 7985.80, percentage: "22.0%", color: "#2E5E58" },
  { name: "Rent & Utilities", value: 4573.68, percentage: "12.6%", color: "#8AACA5" },
  { name: "Marketing Expenses", value: 2323.14, percentage: "6.4%", color: "#E07A5F" },
  { name: "Maintenance", value: 1561.86, percentage: "4.3%", color: "#D4AF7A" },
  { name: "Office Supplies", value: 852.12, percentage: "2.3%", color: "#4B6B65" },
  { name: "Insurance", value: 562.56, percentage: "1.6%", color: "#B8C7C4" }
];

const totalExpenses = expenseData.reduce((acc, curr) => acc + curr.value, 0);

const ExpenseBreakdownFull = ({ onBack }) => {
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
          <h1 className="text-2xl font-bold text-gray-900">Expense Breakdown</h1>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm">
          <Download size={16} /> Export Data
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-10">
        
        {/* Left side: Large Chart */}
        <div className="flex-1 max-w-md mx-auto relative flex items-center justify-center">
          <div className="w-full aspect-square relative shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseData} innerRadius="65%" outerRadius="90%" paddingAngle={2} dataKey="value" stroke="none">
                  {expenseData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip 
                formatter={(value, name) => [`RM ${value.toLocaleString()}`, name]}
                contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                itemStyle={{ color: '#fff' }}
              /></PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-900">RM {totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              <span className="text-xs text-gray-500 font-medium mt-1">Total Expenses</span>
            </div>
          </div>
        </div>

        {/* Right side: Detailed List */}
        <div className="flex-1 w-full space-y-4">
          <h3 className="text-lg font-bold text-gray-900 pb-2 border-b border-gray-100">Category Details</h3>
          <div className="space-y-4 overflow-y-auto pr-2 max-h-[500px]">
            {expenseData.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}20` }}>
                     <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{item.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{item.percentage} of total expenses</p>
                  </div>
                </div>
                <span className="font-bold text-gray-900 text-sm">RM {item.value.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExpenseBreakdownFull;
