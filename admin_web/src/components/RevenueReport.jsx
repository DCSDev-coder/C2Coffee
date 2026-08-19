import React from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";

const reportData = [
  { month: "Jan", revenue: 120000 },
  { month: "Feb", revenue: 135000 },
  { month: "Mar", revenue: 125000 },
  { month: "Apr", revenue: 140000 },
  { month: "May", revenue: 152340 },
  { month: "Jun", revenue: 145000 },
];

const RevenueReport = ({ onBack }) => {
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
          <h1 className="text-2xl font-bold text-gray-900">Revenue Report</h1>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm">
          <Download size={16} /> Export Report
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[400px]">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Revenue by Month (Year to Date)</h3>
        <div className="flex-1 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reportData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="month" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} dy={10} />
              <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} tickFormatter={(val) => `RM ${(val/1000).toFixed(0)}K`} />
              <Tooltip 
                cursor={{fill: '#F3F4F6'}}
                contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value) => [`RM ${value.toLocaleString()}`, "Revenue"]}
              />
              <Bar dataKey="revenue" fill="#1F3A34" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default RevenueReport;
