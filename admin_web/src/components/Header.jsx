import React from 'react';

const Header = () => {
  return (
    <header className="flex justify-end items-center bg-transparent py-4 px-8" style={{ fontFamily: '"DM Sans", sans-serif' }}>
      <div className="flex items-center space-x-6">
        <button className="relative p-2 text-gray-800 hover:text-[#2E5E58] transition-colors">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"></path>
          </svg>
        </button>

        <div className="flex items-center space-x-3 cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white overflow-hidden shadow-sm">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-bold text-gray-800">miraelys</p>
            <p className="text-xs text-gray-500">amirahbalqis951@gmail.com</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
