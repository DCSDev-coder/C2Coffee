import React from 'react';

const Header = ({ setCurrentPage, currentPage, currentTenant, currentUser }) => {
  const displayName = currentUser?.full_name || currentUser?.username || 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex justify-end items-center bg-transparent py-4 px-8" style={{ fontFamily: '"DM Sans", sans-serif' }}>
      <div className="flex items-center space-x-6">
        <div className="hidden xl:flex flex-col items-end pr-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-400">Active tenant</p>
          <p className="text-sm font-semibold text-gray-900">{currentTenant?.display_name || 'C2 Coffee & Candle'}</p>
        </div>
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
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-bold text-gray-900 leading-tight">{displayName}</p>
            <p className="text-xs text-gray-500 leading-tight">{currentUser?.email || ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
