import React, { useState, forwardRef } from "react";
import {
  Search, ChevronDown, X, Clock, ShieldCheck,
  Gift, UserPlus, Megaphone, User, Coffee,
  Download, ArrowLeft, Tag, Ticket, Activity,
  Calendar, CheckCircle, AlertCircle, Eye
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Pagination from './Pagination';

const initialActivities = [
  {
    id: "ACT-1082",
    title: "miraelys issued a voucher (Free Latte)",
    subtitle: "to miraelys",
    category: "Voucher",
    actor: "miraelys",
    target: "miraelys",
    time: "10:21 AM",
    date: "Aug 19, 2026",
    status: "Completed",
    ip: "175.143.20.11",
    details: "Issued 1x Free Latte voucher via Admin Voucher Tool. Expiry set to 30 days.",
    icon: Gift,
    iconBg: "bg-green-50 text-green-700"
  },
  {
    id: "ACT-1081",
    title: "Refund approved for order ORD-0510-002",
    subtitle: "by miraelys",
    category: "Refund",
    actor: "miraelys",
    target: "ORD-0510-002",
    time: "10:18 AM",
    date: "Aug 19, 2026",
    status: "Approved",
    ip: "175.143.20.11",
    details: "Refund of RM 15.90 processed via Touch 'n Go eWallet. Reason: Quality Issued.",
    icon: UserPlus,
    iconBg: "bg-[#E07A5F]/15 text-[#E07A5F]"
  },
  {
    id: "ACT-1080",
    title: 'New campaign "Happy Hour 3PM - 5PM" published',
    subtitle: "published",
    category: "Campaign",
    actor: "miraelys",
    target: "Happy Hour Campaign",
    time: "9:45 AM",
    date: "Aug 19, 2026",
    status: "Active",
    ip: "175.143.20.11",
    details: "Push notification and in-app banner scheduled for all Klang Valley outlets.",
    icon: Megaphone,
    iconBg: "bg-green-50 text-green-700"
  },
  {
    id: "ACT-1079",
    title: "New customer registered: Daniel Ho",
    subtitle: "via Mobile App",
    category: "Customer",
    actor: "System",
    target: "Daniel Ho (cust-19)",
    time: "9:30 AM",
    date: "Aug 19, 2026",
    status: "Completed",
    ip: "115.164.55.90",
    details: "Customer signed up with mobile number +60 12-8889922. Assigned Kawan tier.",
    icon: User,
    iconBg: "bg-yellow-50 text-yellow-600"
  },
  {
    id: "ACT-1078",
    title: "Caramel Macchiato is now back in stock",
    subtitle: "at Semenyih",
    category: "Inventory",
    actor: "Store Manager",
    target: "Caramel Macchiato",
    time: "9:12 AM",
    date: "Aug 19, 2026",
    status: "In Stock",
    ip: "210.195.120.4",
    details: "Inventory status updated to available with 50 units restocked.",
    icon: Coffee,
    iconBg: "bg-green-50 text-green-700"
  },
  {
    id: "ACT-1077",
    title: "Price updated for Flat White",
    subtitle: "by admin_alex",
    category: "Menu",
    actor: "alex_chong",
    target: "Flat White",
    time: "8:50 AM",
    date: "Aug 19, 2026",
    status: "Updated",
    ip: "175.140.12.88",
    details: "Base price adjusted from RM 14.50 to RM 15.00 across all outlets.",
    icon: Tag,
    iconBg: "bg-blue-50 text-blue-600"
  },
  {
    id: "ACT-1076",
    title: "Voucher template created: Welcome 10% OFF",
    subtitle: "by miraelys",
    category: "Voucher",
    actor: "miraelys",
    target: "Welcome Promo",
    time: "8:30 AM",
    date: "Aug 19, 2026",
    status: "Completed",
    ip: "175.143.20.11",
    details: "Discount coupon created with minimum spend RM 20 and max discount RM 5.",
    icon: Ticket,
    iconBg: "bg-purple-50 text-purple-600"
  },
  {
    id: "ACT-1075",
    title: "Audit export downloaded",
    subtitle: "by amirahbalqis",
    category: "Admin",
    actor: "Amirah Balqis",
    target: "Audit_2026-08.csv",
    time: "8:15 AM",
    date: "Aug 19, 2026",
    status: "Downloaded",
    ip: "175.143.20.11",
    details: "Exported 30-day activity logs covering 1,240 records.",
    icon: Download,
    iconBg: "bg-gray-100 text-gray-700"
  }
];

const CATEGORIES = ["All Categories", "Voucher", "Refund", "Campaign", "Customer", "Inventory", "Menu", "Admin"];
const ITEMS_PER_PAGE = 10;

const CustomDateInput = forwardRef(({ value, onClick, onClear }, ref) => (
  <div className="relative">
    <button
      ref={ref}
      onClick={(e) => { e.preventDefault(); onClick(e); }}
      className="flex items-center pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer"
    >
      {value || 'Select Date'}
    </button>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      <ChevronDown size={16} className="text-gray-500" />
    </div>
    {value && (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
        className="absolute right-7 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 rounded-full bg-gray-100 p-0.5 cursor-pointer"
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    )}
  </div>
));

const ActivityDetailPanel = ({ activity, onClose }) => {
  const Icon = activity.icon || Activity;
  return (
    <div className="w-[360px] lg:w-[380px] bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col shrink-0 overflow-y-auto p-5 space-y-4">
      <div className="border-b border-gray-100 pb-3">
        <div className="flex justify-between items-start">
          <h2 className="text-base font-bold text-gray-900">Activity Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 cursor-pointer">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-bold text-gray-900">{activity.id}</p>
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-[#2E5E58]/15 text-[#2E5E58]">
            {activity.category}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{activity.date} at {activity.time}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${activity.iconBg}`}>
          <Icon size={22} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-tight">{activity.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{activity.subtitle}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100 space-y-3">
        <div>
          <h3 className="text-xs font-bold text-gray-900 mb-2">Event Information</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500 text-[11px]">Actor / Performed By</p>
              <p className="font-bold text-gray-900 mt-0.5">{activity.actor}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[11px]">Target Entity</p>
              <p className="font-bold text-gray-900 mt-0.5 truncate">{activity.target}</p>
            </div>
            <div className="col-span-2 mt-1">
              <p className="text-gray-500 text-[11px]">IP Address</p>
              <p className="font-bold text-gray-900 mt-0.5">{activity.ip}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-900 mb-1">Description & Audit Payload</h3>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs text-gray-800 font-mono leading-relaxed">
            {activity.details}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100 mt-auto">
        <button
          onClick={onClose}
          className="w-full py-2 px-4 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-center"
        >
          Close Panel
        </button>
      </div>
    </div>
  );
};

const AuditLogs = ({ onBack, onNavigate }) => {
  const [activities] = useState(initialActivities);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [catOpen, setCatOpen] = useState(false);

  const resetPage = () => setCurrentPage(1);

  const filtered = activities.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      a.id.toLowerCase().includes(q) ||
      a.title.toLowerCase().includes(q) ||
      a.actor.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q);
    const matchCat = categoryFilter === "All Categories" || a.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title="Back to Dashboard"
              >
                <ArrowLeft size={22} strokeWidth={2.5} />
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">Recent Activity & Audit Logs</h1>
          </div>
          <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
            Track and inspect all admin actions, customer events, and system updates in real time.
          </p>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 shrink-0">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#1F3A34] text-white shadow-sm">
            <Activity size={22} strokeWidth={2} />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-semibold">Total Events Today</p>
            <p className="text-xl font-bold text-gray-900">142</p>
            <p className="text-[11px] text-green-500 font-medium">^ 12.6% vs yesterday</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#2E5E58] text-white shadow-sm">
            <ShieldCheck size={22} strokeWidth={2} />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-semibold">Admin Actions</p>
            <p className="text-xl font-bold text-gray-900">48</p>
            <p className="text-[11px] text-green-500 font-medium">^ 8.2% vs yesterday</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#6F9F96] text-white shadow-sm">
            <User size={22} strokeWidth={2} />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-semibold">Customer Events</p>
            <p className="text-xl font-bold text-gray-900">64</p>
            <p className="text-[11px] text-green-500 font-medium">^ 17.1% vs yesterday</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#D4AF7A] text-white shadow-sm">
            <Coffee size={22} strokeWidth={2} />
          </div>
          <div>
            <p className="text-gray-500 text-xs font-semibold">Store & Inventory</p>
            <p className="text-xl font-bold text-gray-900">30</p>
            <p className="text-[11px] text-green-500 font-medium">^ 5.4% vs yesterday</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 shrink-0">
        <div className="relative w-full max-w-[440px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search activities, admin actor, ID, target..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-[#2E5E58] focus:border-[#2E5E58] text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); resetPage(); }}
              onFocus={() => setCatOpen(true)}
              onBlur={() => setCatOpen(false)}
              className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${catOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          <div className="relative">
            <DatePicker
              selected={selectedDate}
              onChange={(d) => { setSelectedDate(d); resetPage(); }}
              customInput={<CustomDateInput onClear={() => { setSelectedDate(null); resetPage(); }} />}
              dateFormat="MMM d, yyyy"
            />
          </div>

          <button
            onClick={() => alert("Exporting full audit trail to CSV...")}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
          >
            <Download size={16} className="mr-2" /> Export
          </button>
        </div>
      </div>

      {/* Main Content: Table + Detail Panel */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0">
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  {["Log ID", "Activity", "Category", "Performed By", "Time", "Action"].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-gray-900 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginated.length > 0 ? (
                  paginated.map((item) => {
                    const isSelected = selectedActivity?.id === item.id;
                    const Icon = item.icon || Activity;
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          isSelected ? "bg-gray-50" : ""
                        }`}
                      >
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.id}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.iconBg}`}>
                              <Icon size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 leading-snug">{item.title}</p>
                              <p className="text-xs text-gray-500">{item.subtitle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-gray-100 text-gray-700">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.actor}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-600 font-medium">
                          {item.date} {item.time}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setSelectedActivity(isSelected ? null : item)}
                            className="bg-[#1E293B] hover:bg-[#0F172A] text-white px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                            title="View Activity Details"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 text-sm">
                      No activities found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex shrink-0">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filtered.length}
              itemName="activity records"
            />
          </div>
        </div>

        {/* Right Side Detail Panel */}
        {selectedActivity && (
          <ActivityDetailPanel
            activity={selectedActivity}
            onClose={() => setSelectedActivity(null)}
          />
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
