import { useState, useEffect } from 'react';

const PAGE_SIZE_STORAGE_KEY = 'admin-table-page-size';

const readStoredPageSize = (fallback) => {
  if (typeof window === 'undefined') return fallback;
  const stored = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
  return [5, 10, 25, 50, 100].includes(stored) ? stored : fallback;
};

/**
 * Custom hook to dynamically return 5 items per page on mobile screens (< 768px),
 * and standard desktop page size (default: 10) on desktop screens.
 */
export function useResponsivePageSize(mobileSize = 5, desktopSize = 10) {
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return readStoredPageSize(window.innerWidth < 768 ? mobileSize : desktopSize);
    }
    return desktopSize;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setPageSize(readStoredPageSize(window.innerWidth < 768 ? mobileSize : desktopSize));
    };
    const handlePageSizeChange = (event) => {
      const nextSize = Number(event.detail);
      if ([5, 10, 25, 50, 100].includes(nextSize)) setPageSize(nextSize);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('admin-table-page-size-change', handlePageSizeChange);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('admin-table-page-size-change', handlePageSizeChange);
    };
  }, [mobileSize, desktopSize]);

  return pageSize;
}

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < breakpoint;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
