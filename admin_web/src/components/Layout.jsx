import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children, currentPage, setCurrentPage, onLogout, currentTenant, currentUser }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handlePageSelect = (page) => {
    setMobileMenuOpen(false);
    if (setCurrentPage) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="flex bg-background h-screen font-sans overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={handlePageSelect}
        onLogout={onLogout}
        currentTenant={currentTenant}
        currentUser={currentUser}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col h-screen pl-0 md:pl-64 min-w-0 overflow-y-auto overflow-x-hidden">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md">
          <Header
            setCurrentPage={handlePageSelect}
            currentPage={currentPage}
            currentTenant={currentTenant}
            currentUser={currentUser}
            onOpenMenu={() => setMobileMenuOpen(true)}
          />
        </div>
        <main className="flex-1 flex flex-col">
          <div key={currentPage} className="flex-1 flex flex-col page-reveal">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
