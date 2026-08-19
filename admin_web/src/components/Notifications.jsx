import React, { useState } from "react";
import { 
  Bell, ChevronDown, CheckCircle2, Search, X, Filter,
  MessageSquare, UserPlus, Gift, AlertCircle, ShoppingBag, Truck,
  Settings, Check, CreditCard, User, Percent, Megaphone, Laptop, 
  CheckCheck, Clock, ArrowLeft
} from "lucide-react";
import Pagination from './Pagination';

// Custom icons matching exact mockup style
const BasketIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const CardIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);

const PersonIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const PercentBadgeIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="19" x2="5" y1="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

const MegaPhoneIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m3 11 18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

const DeviceIcon = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="12" x="3" y="4" rx="2" />
    <line x1="2" x2="22" y1="20" y2="20" />
  </svg>
);

const allNotificationsData = [
  {
    id: "notif-1",
    title: "New order received",
    description: "Order #ORD-1049 has been placed by miraelys.",
    time: "2m ago",
    category: "Orders",
    icon: BasketIcon,
    read: false,
    timestamp: 1
  },
  {
    id: "notif-2",
    title: "Payment received",
    description: "Payment of RM 25.90 from miraelys.",
    time: "2m ago",
    category: "Payments",
    icon: CardIcon,
    read: false,
    timestamp: 2
  },
  {
    id: "notif-3",
    title: "New customer registered",
    description: "miraelys has created an account.",
    time: "2m ago",
    category: "Customers",
    icon: PersonIcon,
    read: false,
    timestamp: 3
  },
  {
    id: "notif-4",
    title: "New voucher created",
    description: '"Welcome20" voucher has been created.',
    time: "2m ago",
    category: "Vouchers",
    icon: PercentBadgeIcon,
    read: true,
    timestamp: 4
  },
  {
    id: "notif-5",
    title: "Campaign scheduled",
    description: '"Summer Special Campaign" will start on 19 Aug 2026.',
    time: "2m ago",
    category: "Marketing",
    icon: MegaPhoneIcon,
    read: true,
    timestamp: 5
  },
  {
    id: "notif-6",
    title: "Order status updated",
    description: "Order #ORD-1046 is now completed.",
    time: "2m ago",
    category: "Orders",
    icon: BasketIcon,
    read: true,
    timestamp: 6
  },
  {
    id: "notif-7",
    title: "Refund processed",
    description: "Refund of Rm 12.90 for Order #ORD-1042.",
    time: "2m ago",
    category: "Payments",
    icon: CardIcon,
    read: true,
    timestamp: 7
  },
  {
    id: "notif-8",
    title: "System update complete",
    description: "System backup was completed successfully.",
    time: "2m ago",
    category: "System",
    icon: DeviceIcon,
    read: true,
    timestamp: 8
  },
  {
    id: "notif-9",
    title: "New order received",
    description: "Order #ORD-1048 has been placed by alex_chong.",
    time: "15m ago",
    category: "Orders",
    icon: BasketIcon,
    read: true,
    timestamp: 9
  },
  {
    id: "notif-10",
    title: "Order status updated",
    description: "Order #ORD-1047 is ready for pickup at Semenyih.",
    time: "25m ago",
    category: "Orders",
    icon: BasketIcon,
    read: true,
    timestamp: 10
  },
  {
    id: "notif-11",
    title: "Payment received",
    description: "Payment of RM 45.00 from sarah_lee.",
    time: "35m ago",
    category: "Payments",
    icon: CardIcon,
    read: true,
    timestamp: 11
  },
  {
    id: "notif-12",
    title: "Refund processed",
    description: "Refund of RM 15.90 for Order #ORD-1041.",
    time: "45m ago",
    category: "Payments",
    icon: CardIcon,
    read: true,
    timestamp: 12
  },
  {
    id: "notif-13",
    title: "New customer registered",
    description: "Daniel Ho has created an account via Mobile App.",
    time: "1h ago",
    category: "Customers",
    icon: PersonIcon,
    read: true,
    timestamp: 13
  },
  {
    id: "notif-14",
    title: "New voucher created",
    description: '"LATTE50" voucher has been created by miraelys.',
    time: "2h ago",
    category: "Vouchers",
    icon: PercentBadgeIcon,
    read: true,
    timestamp: 14
  },
  {
    id: "notif-15",
    title: "Campaign scheduled",
    description: '"Happy Hour 3PM - 5PM" broadcast scheduled.',
    time: "3h ago",
    category: "Marketing",
    icon: MegaPhoneIcon,
    read: true,
    timestamp: 15
  },
  {
    id: "notif-16",
    title: "New order received",
    description: "Order #ORD-1045 has been placed by khai_rul.",
    time: "4h ago",
    category: "Orders",
    icon: BasketIcon,
    read: true,
    timestamp: 16
  },
  {
    id: "notif-17",
    title: "Order status updated",
    description: "Order #ORD-1044 is now preparing.",
    time: "5h ago",
    category: "Orders",
    icon: BasketIcon,
    read: true,
    timestamp: 17
  },
  {
    id: "notif-18",
    title: "System update complete",
    description: "Automated daily settlement report generated.",
    time: "6h ago",
    category: "System",
    icon: DeviceIcon,
    read: true,
    timestamp: 18
  }
];

const filterCategories = [
  { name: "All Notifications", icon: Bell, key: "All" },
  { name: "Orders", icon: BasketIcon, key: "Orders" },
  { name: "Payments", icon: CardIcon, key: "Payments" },
  { name: "Customers", icon: PersonIcon, key: "Customers" },
  { name: "Vouchers", icon: PercentBadgeIcon, key: "Vouchers" },
  { name: "Marketing", icon: MegaPhoneIcon, key: "Marketing" },
  { name: "System", icon: DeviceIcon, key: "System" }
];

const ITEMS_PER_PAGE = 10;

const Notifications = ({ onBack }) => {
  const [notifications, setNotifications] = useState(allNotificationsData);
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("Newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Compute category counts
  const getCategoryCount = (key) => {
    if (key === "All") return notifications.length;
    return notifications.filter((n) => n.category === key).length;
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggleRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Filtered notifications
  const filtered = notifications.filter((n) => {
    if (activeCategory === "All") return true;
    return n.category === activeCategory;
  });

  // Sorted notifications
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "Newest") return a.timestamp - b.timestamp;
    if (sortBy === "Oldest") return b.timestamp - a.timestamp;
    if (sortBy === "Unread First") {
      if (a.read === b.read) return a.timestamp - b.timestamp;
      return a.read ? 1 : -1;
    }
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paginated = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
                title="Back"
              >
                <ArrowLeft size={22} strokeWidth={2.5} />
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#2E5E58] text-white">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
            Stay updated with everyday that happens in your system
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#2E5E58] transition-colors cursor-pointer"
          >
            <CheckCheck size={14} className="text-[#2E5E58]" /> Mark all as read
          </button>
        )}
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left Column: Filter by Panel */}
        <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col shrink-0 h-fit">
          <h2 className="text-lg font-bold text-gray-900 mb-3 px-2">Filter by</h2>

          <div className="space-y-1">
            {filterCategories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.key;
              const count = getCategoryCount(cat.key);

              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    setActiveCategory(cat.key);
                    setCurrentPage(1);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#9DB2AB] text-white shadow-xs"
                      : "text-gray-800 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon size={18} strokeWidth={2} />
                    <span>{cat.name}</span>
                  </div>
                  <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-gray-700"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Notifications List Panel */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col min-w-0">
          {/* Top Bar inside panel */}
          <div className="flex items-center justify-between mb-4 pb-2 shrink-0">
            <h2 className="text-lg font-bold text-gray-900">
              {activeCategory === "All" ? "All Notifications" : `${activeCategory} Notifications`}
            </h2>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <span>Sort By: {sortBy}</span>
                <ChevronDown size={14} className={`text-gray-500 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
              </button>

              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  {["Newest", "Oldest", "Unread First"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setSortBy(opt);
                        setSortOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                        sortBy === opt ? "bg-[#2E5E58] text-white font-bold" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notifications Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 pr-1">
            {paginated.length > 0 ? (
              paginated.map((notif) => {
                const Icon = notif.icon;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleToggleRead(notif.id)}
                    className={`py-3.5 px-3 flex items-center justify-between rounded-xl transition-all cursor-pointer ${
                      !notif.read
                        ? "bg-[#2E5E58]/[0.04] hover:bg-[#2E5E58]/[0.08]"
                        : "hover:bg-gray-50/70"
                    }`}
                    title={!notif.read ? "Click to mark as read" : "Click to mark as unread"}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      {/* Dark teal forest icon badge matching screenshot */}
                      <div className="w-11 h-11 rounded-xl bg-[#2E5E58] flex items-center justify-center text-white shrink-0 shadow-sm relative">
                        <Icon size={20} strokeWidth={2} />
                        {!notif.read && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm leading-tight ${!notif.read ? "font-bold text-gray-950" : "font-semibold text-gray-800"}`}>
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-[#2E5E58]/15 text-[#2E5E58]">
                              Unread
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-normal mt-0.5">
                          {notif.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                        {notif.time}
                      </span>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-[#2E5E58] shrink-0" title="Unread"></span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center text-gray-500 text-sm">
                No notifications found in this category.
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="pt-4 border-t border-gray-100 flex shrink-0">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filtered.length}
              itemName="notifications"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
