import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, Users, ShoppingBag, Ticket, Coins, Crown, Package,
  Coffee, Megaphone, LineChart, UserCog, ClipboardList, Settings, LogOut, UserCheck, Printer, SlidersHorizontal, BookOpen, RotateCcw
} from 'lucide-react';

import { canAccessAdminPage } from '../lib/adminPermissions';

const Sidebar = ({ currentPage, setCurrentPage, onLogout, currentTenant, currentUser }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, section: 'Daily work' },
    { name: 'Orders', icon: ShoppingBag, section: 'Daily work' },
    { name: 'Refunds', icon: RotateCcw, section: 'Daily work' },
    { name: 'Customers', icon: Users, section: 'Daily work' },
    { name: 'Menu', icon: Coffee, section: 'Menu setup' },
    { name: 'Options & Nutrition', icon: SlidersHorizontal, section: 'Menu setup' },
    { name: 'Marketing', icon: Megaphone, section: 'Marketing & loyalty' },
    { name: 'Voucher', icon: Ticket, section: 'Marketing & loyalty' },
    { name: 'Token Ledger', icon: Coins, section: 'Marketing & loyalty' },
    { name: 'Tier Management', icon: Crown, section: 'Marketing & loyalty' },
    { name: 'Finance', icon: LineChart, section: 'Reports' },
    { name: 'Product Report', icon: Package, section: 'Reports' },
    { name: 'Barista Management', icon: UserCheck, section: 'Staff & store' },
    { name: 'Staff Guides', icon: BookOpen, section: 'Staff & store' },
    { name: 'Operations', icon: Printer, section: 'Staff & store' },
    { name: 'Admin Management', icon: UserCog, section: 'Administration' },
    { name: 'Audit Logs', icon: ClipboardList, section: 'Administration' },
    { name: 'Settings', icon: Settings, section: 'Administration' }
  ];

  const visibleMenuItems = menuItems.filter((item) => canAccessAdminPage(currentUser?.roles, item.name));

  return (
    <div className="w-56 bg-[#2E5E58] text-white h-[calc(100vh-2rem)] fixed left-4 top-4 bottom-4 flex flex-col p-4 rounded-3xl z-10 shadow-xl overflow-y-auto" style={{ fontFamily: 'Afacad, sans-serif' }}>
      <div
        className="flex flex-col items-center mt-6 mb-8 cursor-pointer"
        onClick={() => {
          if (setCurrentPage) setCurrentPage('Dashboard');
        }}
      >
        <img src="/c2_logo.png" alt="C2 Logo" className="w-24 h-24 object-contain drop-shadow-md" />
        <div className="mt-3 px-3 py-1.5 rounded-full bg-white/10 text-center border border-white/15">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">Tenant</p>
          <p className="text-sm font-bold leading-tight">{currentTenant?.display_name || 'C2 Coffee & Candle'}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {visibleMenuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentPage ? currentPage === item.name : index === 0;
          const startsSection = index === 0 || visibleMenuItems[index - 1].section !== item.section;
          return (
            <React.Fragment key={item.name}>
              {startsSection && (
                <p className={`px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45 ${index === 0 ? 'mb-1' : 'mb-1 mt-5'}`}>
                  {item.section}
                </p>
              )}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (setCurrentPage) {
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
            </React.Fragment>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowLogoutModal(true);
          }}
          className="flex items-center justify-center space-x-2 w-full px-4 py-3 rounded-xl bg-[#1F3A34] hover:bg-red-500/10 border border-transparent hover:border-red-500/30 text-white/90 hover:text-red-400 transition-all shadow-sm"
        >
          <LogOut size={18} strokeWidth={2.5} />
          <span className="font-medium">Log Out</span>
        </a>
      </div>
      {showLogoutModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ fontFamily: 'Recoleta, serif' }}>
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full border border-gray-100 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-5 ring-4 ring-red-50">
              <LogOut size={28} strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-medium mb-2 text-gray-900">Log Out</h3>
            <p className="text-gray-500 mb-8 text-sm">
              Are you sure you want to log out of your admin session? You will need to sign in again.
            </p>
            <div className="flex space-x-4 w-full">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  if (onLogout) onLogout();
                }}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm shadow-red-200"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Sidebar;
