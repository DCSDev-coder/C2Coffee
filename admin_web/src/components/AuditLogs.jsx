import React, { useState } from "react";
import { Search, ChevronDown, Download, Users, RefreshCw, Key, ShieldAlert, Plus, Activity, X } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { exportToCSV } from '../utils/exportToCSV';
import Pagination from './Pagination';

const StatCard = ({ title, value, subtitle, icon: Icon, iconBg, iconColor = "text-white" }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-sm`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight mt-0.5 whitespace-normal">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
      {subtitle && (
        <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal mt-1">
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

const initialLogs = [
  { id: "ACT-1082", date: "Aug 19, 2026", time: "10:21 AM", username: "miraelys", email: "mira@gmail.com", action: "Created", module: "Voucher", details: 'Created voucher "Free Latte"', ip: "175.143.20.11", status: "Success" },
  { id: "ACT-1081", date: "Aug 19, 2026", time: "10:18 AM", username: "miraelys", email: "mira@gmail.com", action: "Updated", module: "Order", details: 'Refund approved for order ORD-0510-002', ip: "175.143.20.11", status: "Success" },
  { id: "ACT-1080", date: "Aug 19, 2026", time: "09:45 AM", username: "miraelys", email: "mira@gmail.com", action: "Created", module: "Marketing", details: 'New campaign "Happy Hour 3PM - 5PM" published', ip: "175.143.20.11", status: "Success" },
  { id: "ACT-1079", date: "Aug 19, 2026", time: "09:30 AM", username: "system_bot", email: "system@c2coffee.com", action: "Created", module: "Customer", details: 'New customer registered: Daniel Ho', ip: "115.164.55.90", status: "Success" },
  { id: "ACT-1078", date: "Aug 19, 2026", time: "09:12 AM", username: "store_mgr", email: "manager@c2coffee.com", action: "Updated", module: "Menu", details: 'Caramel Macchiato restocked (50 units)', ip: "210.195.120.4", status: "Success" },
  { id: "ACT-1077", date: "Aug 19, 2026", time: "08:50 AM", username: "alex_chong", email: "alex.c@yahoo.com", action: "Updated", module: "Menu", details: 'Price updated for Flat White (RM14.50 -> RM15.00)', ip: "175.140.12.88", status: "Success" },
  { id: "ACT-1076", date: "Aug 18, 2026", time: "05:30 PM", username: "miraelys", email: "mira@gmail.com", action: "Deleted", module: "Loyalty", details: 'Deleted deprecated tier "Basic"', ip: "175.143.20.11", status: "Success" },
  { id: "ACT-1075", date: "Aug 18, 2026", time: "04:12 PM", username: "sarah_lee", email: "sarah.lee88@gmail.com", action: "Login Failed", module: "Auth", details: 'Invalid password attempt', ip: "202.184.22.10", status: "Failed" },
  { id: "ACT-1074", date: "Aug 18, 2026", time: "02:20 PM", username: "alex_chong", email: "alex.c@yahoo.com", action: "Exported", module: "Finance", details: 'Exported Revenue Report (July 2026)', ip: "175.140.12.88", status: "Success" },
  { id: "ACT-1073", date: "Aug 18, 2026", time: "11:05 AM", username: "miraelys", email: "mira@gmail.com", action: "Updated", module: "Admin", details: 'Granted "Marketing Admin" role to sarah_lee', ip: "175.143.20.11", status: "Success" },
  { id: "ACT-1072", date: "Aug 18, 2026", time: "09:00 AM", username: "system_bot", email: "system@c2coffee.com", action: "Created", module: "Loyalty", details: 'Auto-issued 100 points to user #4421', ip: "127.0.0.1", status: "Success" },
  { id: "ACT-1071", date: "Aug 17, 2026", time: "06:45 PM", username: "khai_rul", email: "khairul.dev@gmail.com", action: "Updated", module: "Settings", details: 'Changed POS sync frequency to 5 mins', ip: "60.48.22.100", status: "Success" },
  { id: "ACT-1070", date: "Aug 17, 2026", time: "06:40 PM", username: "khai_rul", email: "khairul.dev@gmail.com", action: "Login", module: "Auth", details: 'Successful admin login', ip: "60.48.22.100", status: "Success" }
];

const AuditLogs = ({ onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const safeSearch = (searchTerm || "").trim().toLowerCase();
  
  const filteredData = initialLogs.filter(log => {
    const matchesSearch = 
      log.username.toLowerCase().includes(safeSearch) || 
      log.action.toLowerCase().includes(safeSearch) ||
      log.module.toLowerCase().includes(safeSearch) ||
      log.details.toLowerCase().includes(safeSearch);
      
    const matchesModule = selectedModule ? log.module === selectedModule : true;
    const matchesStatus = selectedStatus ? log.status === selectedStatus : true;
    
    // For simplicity, we just check if date exists in a real app, here we just filter if selectedDate is set
    // You could parse log.date, but we'll leave it as a mock implementation for date filtering
    const matchesDate = true; 

    return matchesSearch && matchesModule && matchesStatus && matchesDate;
  });

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleExport = () => {
    const csvContent = [
      ["Date & Time", "Username", "Email", "Action", "Module", "Details", "IP Address", "Status"],
      ...filteredData.map(log => [
        `"${log.date} ${log.time}"`,
        `"${log.username}"`,
        `"${log.email}"`,
        `"${log.action}"`,
        `"${log.module}"`,
        `"${log.details}"`,
        `"${log.ip}"`,
        `"${log.status}"`
      ])
    ];
    
    exportToCSV(csvContent, "audit_logs.csv");
  };

  const uniqueModules = [...new Set(initialLogs.map(l => l.module))];
  const uniqueStatuses = [...new Set(initialLogs.map(l => l.status))];

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full h-full flex flex-col space-y-6">
        
        {/* Header */}
        <div className="shrink-0 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-sm text-gray-500 mt-1">Track all important activities and changes in the system.</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
          <StatCard 
            title="Total Activities" 
            value="256" 
            subtitle="All actions logged" 
            icon={Activity} 
            iconBg="bg-[#1F3A34]" 
          />
          <StatCard 
            title="Admin Users" 
            value="12" 
            subtitle="Users with activities" 
            icon={Users} 
            iconBg="bg-[#2E5E58]" 
          />
          <StatCard 
            title="Changes Made" 
            value="178" 
            subtitle="Data updated" 
            icon={RefreshCw} 
            iconBg="bg-[#6F9F96]" 
          />
          <StatCard 
            title="Login Activities" 
            value="45" 
            subtitle="User login events" 
            icon={Key} 
            iconBg="bg-[#E07A5F]" 
          />
          <StatCard 
            title="Failed Attempts" 
            value="8" 
            subtitle="Unsuccessful attempts" 
            icon={ShieldAlert} 
            iconBg="bg-[#D4AF7A]" 
          />
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col flex-1 min-h-[500px]">
          
          {/* Filters Row */}
          <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row justify-between gap-4 shrink-0">
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by admin, action or module..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3A34] text-sm"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative">
                <select
                  value={selectedModule}
                  onChange={(e) => { setSelectedModule(e.target.value); setCurrentPage(1); }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer"
                >
                  <option value="">All Modules</option>
                  {uniqueModules.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none transition-transform duration-200 peer-focus:-rotate-180" size={16} />
              </div>

              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer"
                >
                  <option value="">All Status</option>
                  {uniqueStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none transition-transform duration-200 peer-focus:-rotate-180" size={16} />
              </div>

              <DatePicker
                portalId="root-portal" popperPlacement="bottom-end"
                selected={selectedDate}
                onChange={(date) => { setSelectedDate(date); setCurrentPage(1); }}
                dateFormat="d MMM yyyy"
                customInput={
                  <div className="relative">
                    <button className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 text-left min-w-[140px] cursor-pointer">
                      {selectedDate ? selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select Date'}
                    </button>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <ChevronDown size={16} className="text-gray-400 transition-transform duration-200 peer-focus:-rotate-180" />
                    </div>
                    {selectedDate && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedDate(null); setCurrentPage(1); }}
                        className="absolute inset-y-0 right-8 flex items-center p-1 hover:bg-gray-100 rounded-full my-auto h-6 w-6 justify-center cursor-pointer pointer-events-auto"
                      >
                        <X size={14} className="text-gray-500" />
                      </button>
                    )}
                  </div>
                }
              />

              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Download size={16} /> Export
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Date & Time</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Username</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Action</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Module</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Details</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">IP Address</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.length > 0 ? (
                  paginatedData.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-gray-900 font-medium">{log.date}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{log.time}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1F3A34] text-white flex items-center justify-center shrink-0">
                            {/* Initials placeholder */}
                            <span className="text-xs font-bold">{log.username.substring(0, 2).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-gray-900 font-bold leading-tight">{log.username}</p>
                            <p className="text-gray-500 text-xs leading-tight mt-0.5">{log.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{log.action}</td>
                      <td className="px-6 py-4 text-gray-700">{log.module}</td>
                      <td className="px-6 py-4 text-gray-700 max-w-[250px] truncate" title={log.details}>{log.details}</td>
                      <td className="px-6 py-4 text-gray-700">{log.ip}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${
                          log.status === "Success" 
                            ? "bg-green-100 text-green-700" 
                            : "bg-red-100 text-red-700"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                      No logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex shrink-0">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filteredData.length}
              itemName="admin"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
