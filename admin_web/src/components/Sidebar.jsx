import React from 'react';
import {
  LayoutDashboard, Users, ShoppingBag, Ticket, Coins,
  Coffee, Megaphone, LineChart, UserCog, ClipboardList, Settings
} from 'lucide-react';

const Sidebar = ({ currentPage, setCurrentPage }) => {
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Customers', icon: Users },
    { name: 'Orders', icon: ShoppingBag },
    { name: 'Voucher', icon: Ticket },
    { name: 'Loyalty & Tokens', icon: Coins },
    { name: 'Menu', icon: Coffee },
    { name: 'Marketing', icon: Megaphone },
    { name: 'Finance', icon: LineChart },
    { name: 'Admin Management', icon: UserCog },
    { name: 'Audit Logs', icon: ClipboardList },
    { name: 'Settings', icon: Settings }
  ];

  return (
    <div className="w-56 bg-[#2E5E58] text-white h-[calc(100vh-2rem)] fixed left-4 top-4 bottom-4 flex flex-col p-4 rounded-3xl z-10 shadow-xl overflow-y-auto" style={{ fontFamily: 'Afacad, sans-serif' }}>
      <div className="flex flex-col items-center mt-6 mb-8">
        <img src="/c2_logo.png" alt="C2 Logo" className="w-24 h-24 object-contain drop-shadow-md" />
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentPage ? currentPage === item.name : index === 0;
          return (
            <a
              key={item.name}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (setCurrentPage && (item.name === 'Dashboard' || item.name === 'Customers')) {
                  setCurrentPage(item.name);
                }
              }}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${isActive ? 'bg-[#1F3A34] font-medium' : 'hover:bg-[#1F3A34] text-white/90'}`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Icon size={18} strokeWidth={2.5} className="opacity-90" />
              </div>
              <span>{item.name}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
