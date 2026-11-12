import { useState, useEffect } from 'react';

/**
 * Custom hook to dynamically return 5 items per page on mobile screens (< 768px),
 * and standard desktop page size (default: 10) on desktop screens.
 */
export function useResponsivePageSize(mobileSize = 5, desktopSize = 10) {
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? mobileSize : desktopSize;
    }
    return desktopSize;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setPageSize(window.innerWidth < 768 ? mobileSize : desktopSize);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
