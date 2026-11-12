import React from 'react';
import { Menu } from 'lucide-react';

const Header = ({ setCurrentPage, currentPage, currentTenant, currentUser, onOpenMenu }) => {
  const displayName = currentUser?.full_name || currentUser?.username || 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex justify-between md:justify-end items-center bg-transparent py-3 md:py-4 px-4 sm:px-6 md:px-8 border-b border-gray-100/60 md:border-b-0" style={{ fontFamily: '"DM Sans", sans-serif' }}>
      {/* Mobile Burger Menu Button */}
      <div className="flex items-center md:hidden">
        <button
          type="button"
          onClick={onOpenMenu}
          className="p-2 -ml-1 rounded-xl text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <Menu size={22} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-6">
        <div className="hidden xl:flex flex-col items-end pr-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-400">Active tenant</p>
          <p className="text-sm font-semibold text-gray-900">{currentTenant?.display_name || 'C2 Coffee & Candle'}</p>
        </div>
        <div
          onClick={() => setCurrentPage && setCurrentPage('Profile')}
          className={`flex items-center space-x-2.5 sm:space-x-3 p-1.5 rounded-xl transition-all cursor-pointer ${
            currentPage === 'Profile'
              ? 'bg-[#2E5E58]/10 ring-1 ring-[#2E5E58]'
              : 'hover:bg-gray-100/80'
          }`}
          title="View Profile"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#1F3A34] flex items-center justify-center text-white font-bold text-xs sm:text-sm overflow-hidden shadow-sm shrink-0">
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-xs sm:text-sm font-bold text-gray-900 leading-tight truncate max-w-[110px] sm:max-w-none">{displayName}</p>
            <p className="hidden sm:block text-xs text-gray-500 leading-tight truncate max-w-[140px]">{currentUser?.email || ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
