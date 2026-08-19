import React, { useState, forwardRef } from 'react';
import { ArrowLeft, Download, FileText, Calendar, ChevronDown, X } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const CustomDateInput = forwardRef(({ value, onClick, onClear }, ref) => (
  <div className="relative">
    <button
      onClick={(e) => { e.preventDefault(); onClick(e); }}
      ref={ref}
      className="peer flex items-center pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer w-full text-left"
    >
      {value || 'Select Date'}
    </button>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      <ChevronDown size={16} className="text-gray-500 transition-transform duration-200 peer-focus:-rotate-180" />
    </div>
    {value && (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
        className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 rounded-full bg-gray-100 p-0.5 cursor-pointer"
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    )}
  </div>
));

const ExportStatement = ({ onBack }) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [format, setFormat] = useState('pdf');

  const handleExport = (e) => {
    e.preventDefault();
    alert(`Exporting statement as ${format.toUpperCase()}...`);
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
          <h1 className="text-2xl font-bold text-gray-900">Export Statement</h1>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <form onSubmit={handleExport} className="space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Calendar size={18} className="text-gray-500" /> Select Date Range
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Start Date</label>
                <DatePicker portalId="root-portal" popperPlacement="bottom-end"
                  selected={startDate}
                  onChange={(d) => setStartDate(d)}
                  customInput={<CustomDateInput onClear={() => setStartDate(null)} />}
                  dateFormat="d MMMM yyyy"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">End Date</label>
                <DatePicker portalId="root-portal" popperPlacement="bottom-end"
                  selected={endDate}
                  onChange={(d) => setEndDate(d)}
                  customInput={<CustomDateInput onClear={() => setEndDate(null)} />}
                  dateFormat="d MMMM yyyy"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText size={18} className="text-gray-500" /> Export Format
            </h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="format" 
                  value="pdf"
                  checked={format === 'pdf'}
                  onChange={() => setFormat('pdf')}
                  className="w-4 h-4 text-[#1F3A34] focus:ring-[#1F3A34]"
                />
                <span className="text-sm font-medium text-gray-700">PDF Document (.pdf)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="format" 
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  className="w-4 h-4 text-[#1F3A34] focus:ring-[#1F3A34]"
                />
                <span className="text-sm font-medium text-gray-700">CSV Spreadsheet (.csv)</span>
              </label>
            </div>
          </div>
          
          <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-3">
            <button type="button" onClick={onBack} className="px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-[#1F3A34] text-white text-sm font-bold rounded-lg hover:bg-[#2E5E58] transition-colors cursor-pointer shadow-sm">
              <Download size={16} /> Export Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExportStatement;
