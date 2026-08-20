import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children, currentPage, setCurrentPage, onLogout, currentTenant, currentUser }) => {
  return (
    <div className="flex bg-background h-screen font-sans overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onLogout={onLogout}
        currentTenant={currentTenant}
      />
      <div className="flex-1 flex flex-col h-screen pl-64 min-w-0 overflow-y-auto overflow-x-hidden">
        <div className="sticky top-0 z-40 bg-background">
          <Header setCurrentPage={setCurrentPage} currentPage={currentPage} currentTenant={currentTenant} currentUser={currentUser} />
        </div>
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
