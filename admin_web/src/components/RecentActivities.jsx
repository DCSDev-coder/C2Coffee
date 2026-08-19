import React, { useState, forwardRef } from "react";
import {
  Search, ChevronDown, X, ArrowLeft,
  Gift, UserPlus, Megaphone, User, Coffee,
  Tag, Ticket, ShoppingBag, Coins, Eye,
  Calendar, CheckCircle, RefreshCw, Filter
} from "lucide-react";
import Pagination from './Pagination';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const allActivitiesData = [
  {
    id: "ACT-001",
    title: "miraelys issued a voucher (Free Latte)",
    subtitle: "to miraelys",
    time: "10:21 AM",
    date: "Aug 19, 2026",
    type: "Voucher",
    actor: "miraelys",
    icon: Gift,
    iconBg: "bg-green-50 text-green-700",
    details: "Issued 1x Free Latte voucher template to customer miraelys (Member ID: C2-001)."
  },
  {
    id: "ACT-002",
    title: "Refund approved for order ORD-0510-002",
    subtitle: "by miraelys",
    time: "10:18 AM",
    date: "Aug 19, 2026",
    type: "Refund",
    actor: "miraelys",
    icon: UserPlus,
    iconBg: "bg-[#E07A5F]/15 text-[#E07A5F]",
    details: "Refund request for order ORD-0510-002 approved. Amount RM 15.90 returned to Touch 'n Go eWallet."
  },
  {
    id: "ACT-003",
    title: 'New campaign "Happy Hour 3PM - 5PM" published',
    subtitle: "published",
    time: "9:45 AM",
    date: "Aug 19, 2026",
    type: "Campaign",
    actor: "miraelys",
    icon: Megaphone,
    iconBg: "bg-green-50 text-green-700",
    details: "Scheduled marketing blast and promotional banners across mobile apps."
  },
  {
    id: "ACT-004",
    title: "New customer registered: Daniel Ho",
    subtitle: "via Mobile App",
    time: "9:30 AM",
    date: "Aug 19, 2026",
    type: "Customer",
    actor: "Mobile App",
    icon: User,
    iconBg: "bg-yellow-50 text-yellow-600",
    details: "New user registered with email daniel.ho@gmail.com and phone +60 12-8889922."
  },
  {
    id: "ACT-005",
    title: "Caramel Macchiato is now back in stock",
    subtitle: "at Semenyih",
    time: "9:12 AM",
    date: "Aug 19, 2026",
    type: "Inventory",
    actor: "Store Manager",
    icon: Coffee,
    iconBg: "bg-green-50 text-green-700",
    details: "Restocked 50 units of Caramel Macchiato beans and syrup at Semenyih outlet."
  },
  {
    id: "ACT-006",
    title: "New order placed: ORD-0510-014 (RM 38.50)",
    subtitle: "by alex_chong",
    time: "8:58 AM",
    date: "Aug 19, 2026",
    type: "Order",
    actor: "alex_chong",
    icon: ShoppingBag,
    iconBg: "bg-blue-50 text-blue-700",
    details: "Customer ordered 2x Shakerato Bianco and 1x Cinnamon Roll via pickup."
  },
  {
    id: "ACT-007",
    title: "Price updated for Flat White (RM 14.50 → RM 15.00)",
    subtitle: "by admin_alex",
    time: "8:45 AM",
    date: "Aug 19, 2026",
    type: "Menu",
    actor: "alex_chong",
    icon: Tag,
    iconBg: "bg-purple-50 text-purple-700",
    details: "Standard price for Flat White adjusted across all nationwide outlets."
  },
  {
    id: "ACT-008",
    title: "Reward points redeemed: 500 tokens for RM 10 Voucher",
    subtitle: "by sarah_lee",
    time: "8:30 AM",
    date: "Aug 19, 2026",
    type: "Loyalty",
    actor: "sarah_lee",
    icon: Coins,
    iconBg: "bg-amber-50 text-amber-700",
    details: "Customer redeemed 500 Loyalty tokens for RM 10 Discount voucher."
  },
  {
    id: "ACT-009",
    title: "New voucher template created: Welcome 10% OFF",
    subtitle: "by miraelys",
    time: "8:15 AM",
    date: "Aug 19, 2026",
    type: "Voucher",
    actor: "miraelys",
    icon: Ticket,
    iconBg: "bg-green-50 text-green-700",
    details: "New signup welcome voucher created with valid duration of 14 days."
  },
  {
    id: "ACT-010",
    title: "Customer tier upgraded to Legend",
    subtitle: "miraelys reached 48 orders",
    time: "7:55 AM",
    date: "Aug 19, 2026",
    type: "Customer",
    actor: "System",
    icon: User,
    iconBg: "bg-yellow-50 text-yellow-600",
    details: "Account miraelys surpassed 45 completed orders and upgraded to Legend Tier."
  },
  {
    id: "ACT-011",
    title: "Batch restock completed: Oat Milk (100 Cartons)",
    subtitle: "at Central Warehouse",
    time: "7:30 AM",
    date: "Aug 19, 2026",
    type: "Inventory",
    actor: "Warehouse Staff",
    icon: Coffee,
    iconBg: "bg-green-50 text-green-700",
    details: "Stock replenishment arrived and allocated to Beranang and Semenyih hubs."
  },
  {
    id: "ACT-012",
    title: "Campaign email blast sent to 1,245 loyalty members",
    subtitle: "Weekend Special Promo",
    time: "7:00 AM",
    date: "Aug 19, 2026",
    type: "Campaign",
    actor: "miraelys",
    icon: Megaphone,
    iconBg: "bg-green-50 text-green-700",
    details: "Broadcasted discount coupons to active loyalty club members."
  }
];

const ACTIVITY_TYPES = ["All Types", "Voucher", "Refund", "Campaign", "Customer", "Inventory", "Order", "Menu", "Loyalty"];
const ITEMS_PER_PAGE = 10;

const getActivityTypeBadgeColor = (type) => {
  switch (type) {
    case "Voucher":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200/70";
    case "Refund":
      return "bg-[#E07A5F]/15 text-[#E07A5F] border border-[#E07A5F]/20";
    case "Campaign":
      return "bg-teal-50 text-teal-700 border border-teal-200/70";
    case "Customer":
      return "bg-amber-50 text-amber-700 border border-amber-200/70";
    case "Inventory":
      return "bg-[#2E5E58]/10 text-[#2E5E58] border border-[#2E5E58]/20";
    case "Order":
      return "bg-blue-50 text-blue-700 border border-blue-200/70";
    case "Menu":
      return "bg-purple-50 text-purple-700 border border-purple-200/70";
    case "Loyalty":
      return "bg-[#D4AF7A]/20 text-[#A8824A] border border-[#D4AF7A]/30";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-200/70";
  }
};

const CustomDateInput = forwardRef(({ value, onClick, onClear }, ref) => (
  <div className="relative">
    <button
      ref={ref}
      onClick={(e) => { e.preventDefault(); onClick(e); }}
      className="peer flex items-center pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer"
    >
      {value || 'Select Date'}
    </button>
    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      <ChevronDown size={16} className="text-gray-500 transition-transform duration-200 peer-focus:-rotate-180" />
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

const ActivityDetailDrawer = ({ activity, onClose }) => {
  const Icon = activity.icon;
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
          <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${getActivityTypeBadgeColor(activity.type)}`}>
            {activity.type}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{activity.date} – {activity.time}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${activity.iconBg}`}>
          <Icon size={22} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-snug">{activity.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{activity.subtitle}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100 space-y-3">
        <div>
          <h3 className="text-xs font-bold text-gray-900 mb-2">Event Information</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500 text-[11px]">Customer</p>
              <p className="font-bold text-gray-900 mt-0.5">{activity.actor}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[11px]">Type</p>
              <p className="font-bold text-gray-900 mt-0.5">{activity.type}</p>
            </div>
            <div className="col-span-2 mt-1">
              <p className="text-gray-500 text-[11px]">Timestamp</p>
              <p className="font-bold text-gray-900 mt-0.5">{activity.date} at {activity.time}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-900 mb-1">Details</h3>
          <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
            {activity.details}
          </p>
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

const RecentActivities = ({ onBack }) => {
  const [activities] = useState(allActivitiesData);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [typeOpen, setTypeOpen] = useState(false);

  const resetPage = () => setCurrentPage(1);

  const filtered = activities.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      a.id.toLowerCase().includes(q) ||
      a.title.toLowerCase().includes(q) ||
      a.subtitle.toLowerCase().includes(q) ||
      a.actor.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q);
    const matchType = typeFilter === "All Types" || a.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
      {/* Header with Back Arrow and Title */}
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Recent Activity</h1>
          </div>
          <p className="text-gray-500 text-sm mt-0.5 ml-8">View and track all recent actions and updates across the platform.</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 shrink-0">
        {/* Search */}
        <div className="relative w-full max-w-[440px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search recent activities, keywords, customer..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-[#2E5E58] focus:border-[#2E5E58] text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); resetPage(); }}
              onFocus={() => setTypeOpen(true)}
              onBlur={() => setTypeOpen(false)}
              className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${typeOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Date Picker */}
          <div className="relative transition-transform duration-200 peer-focus:-rotate-180">
            <DatePicker portalId="root-portal" popperPlacement="bottom-end"
              selected={selectedDate}
              onChange={(d) => { setSelectedDate(d); resetPage(); }}
              customInput={<CustomDateInput onClear={() => { setSelectedDate(null); resetPage(); }} />}
              dateFormat="MMM d, yyyy"
            />
          </div>
        </div>
      </div>

      {/* Main Content: Activity Feed Card + Side Details Panel */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        {/* Activity Feed Container */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0">
          <div className="p-5 flex-1 overflow-y-auto divide-y divide-gray-100">
            {paginated.length > 0 ? (
              paginated.map((item) => {
                const isSelected = selectedActivity?.id === item.id;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedActivity(isSelected ? null : item)}
                    className={`py-3.5 px-3 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected ? "bg-gray-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center shadow-xs ${item.iconBg}`}>
                        <Icon size={18} strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 leading-tight">
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-500 font-normal mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${getActivityTypeBadgeColor(item.type)}`}>
                        {item.type}
                      </span>
                      <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                        {item.time}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedActivity(isSelected ? null : item);
                        }}
                        className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-gray-500 text-sm">
                No activities found matching your search and filter criteria.
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex shrink-0">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filtered.length}
              itemName="activities"
            />
          </div>
        </div>

        {/* Right Side Detail Panel */}
        {selectedActivity && (
          <ActivityDetailDrawer
            activity={selectedActivity}
            onClose={() => setSelectedActivity(null)}
          />
        )}
      </div>
    </div>
  );
};

export default RecentActivities;
