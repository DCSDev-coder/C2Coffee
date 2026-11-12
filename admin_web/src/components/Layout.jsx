import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children, currentPage, setCurrentPage, onLogout, currentTenant, currentUser }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef(null);

  const handlePageSelect = (page) => {
    setMobileMenuOpen(false);
    if (setCurrentPage) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      setShowScrollTop(el.scrollTop > 200);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
      <div
        ref={scrollRef}
        className="flex-1 flex flex-col h-screen pl-0 md:pl-64 min-w-0 overflow-y-auto overflow-x-hidden relative"
      >
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md">
          <Header
            setCurrentPage={handlePageSelect}
            currentPage={currentPage}
            currentTenant={currentTenant}
            currentUser={currentUser}
            onOpenMenu={() => setMobileMenuOpen(true)}
          />
        </div>
        <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <div key={currentPage} className="flex-1 flex flex-col min-w-0 page-reveal">
            {children}
          </div>
        </main>

        {/* Floating Green Scroll-to-Top Button with White Arrow */}
        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Scroll to top"
            title="Scroll to top"
            className="fixed bottom-6 right-6 z-40 p-3 sm:p-3.5 rounded-full bg-[#1F3A34] hover:bg-[#2E5E58] text-white shadow-lg shadow-[#1F3A34]/25 hover:shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer flex items-center justify-center animate-fade-in"
          >
            <ArrowUp size={20} className="text-white" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Layout;
