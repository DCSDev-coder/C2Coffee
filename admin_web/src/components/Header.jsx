import React from 'react';

const Header = ({ setCurrentPage, currentPage, currentTenant }) => {
  return (
    <header className="flex justify-end items-center bg-transparent py-4 px-8" style={{ fontFamily: '"DM Sans", sans-serif' }}>
      <div className="flex items-center space-x-6">
        <div className="hidden xl:flex flex-col items-end pr-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-400">Active tenant</p>
          <p className="text-sm font-semibold text-gray-900">{currentTenant?.display_name || 'C2 Coffee & Candle'}</p>
        </div>
        <button
          onClick={() => setCurrentPage && setCurrentPage('Notifications')}
          className={`relative p-2 rounded-full transition-colors cursor-pointer ${
            currentPage === 'Notifications'
              ? 'text-[#2E5E58] bg-[#2E5E58]/10'
              : 'text-gray-800 hover:text-[#2E5E58] hover:bg-gray-100'
          }`}
          title="Notifications"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"></path>
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
        </button>

        <div
          onClick={() => setCurrentPage && setCurrentPage('Profile')}
          className={`flex items-center space-x-3 p-1.5 rounded-xl transition-all cursor-pointer ${
            currentPage === 'Profile'
              ? 'bg-[#2E5E58]/10 ring-1 ring-[#2E5E58]'
              : 'hover:bg-gray-100/80'
          }`}
          title="View Profile"
        >
          <div className="w-10 h-10 rounded-full bg-[#1F3A34] flex items-center justify-center text-white font-bold text-sm overflow-hidden shadow-sm">
            M
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-bold text-gray-900 leading-tight">miraelys</p>
            <p className="text-xs text-gray-500 leading-tight">mira@gmail.com</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
