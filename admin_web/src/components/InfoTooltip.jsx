import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

/**
 * Robust, responsive information tooltip and popover.
 * - Supports both smooth hover and click-to-pin (locked open so it never suddenly disappears).
 * - Rendered via document.body portal with z-99999 so it is never clipped by table overflow or card boundaries.
 * - Viewport auto-flip and edge clamping: automatically flips below if near the top edge, and stays within screen bounds.
 * - Includes an invisible hover bridge so moving cursor between trigger and tooltip never drops.
 */
export default function InfoTooltip({
  content,
  title,
  placement = 'auto',
  size = 14,
  className = '',
  buttonClassName = '',
  ariaLabel = 'More information',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [coords, setCoords] = useState(null);
  const [actualPlacement, setActualPlacement] = useState('bottom');
  const [arrowLeft, setArrowLeft] = useState(0);

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const leaveTimerRef = useRef(null);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return null;
    const triggerRect = triggerRef.current.getBoundingClientRect();

    const popoverRect = popoverRef.current
      ? popoverRef.current.getBoundingClientRect()
      : { width: 280, height: 100 };

    const padding = 12; // Minimum distance from viewport edge
    const gap = 10; // Distance from trigger button
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceAbove = triggerRect.top;
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const neededHeight = popoverRect.height + gap + padding;

    let placeAbove = false;
    if (placement === 'top') {
      placeAbove = spaceAbove >= neededHeight || spaceAbove > spaceBelow;
    } else if (placement === 'bottom') {
      placeAbove = spaceBelow < neededHeight && spaceAbove > spaceBelow;
    } else {
      // Auto: if near top edge (< neededHeight), flip below; otherwise place where space is larger
      if (spaceAbove < neededHeight) {
        placeAbove = false;
      } else if (spaceBelow < neededHeight) {
        placeAbove = true;
      } else {
        placeAbove = spaceAbove > spaceBelow;
      }
    }

    let top = placeAbove
      ? triggerRect.top - popoverRect.height - gap
      : triggerRect.bottom + gap;

    top = Math.max(padding, Math.min(viewportHeight - popoverRect.height - padding, top));

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    let left = triggerCenterX - popoverRect.width / 2;
    left = Math.max(padding, Math.min(viewportWidth - popoverRect.width - padding, left));

    const arrowX = triggerCenterX - left;
    const clampedArrowX = Math.max(16, Math.min(popoverRect.width - 16, arrowX));

    return {
      coords: { top, left },
      actualPlacement: placeAbove ? 'top' : 'bottom',
      arrowLeft: clampedArrowX,
    };
  }, [placement]);

  const updatePosition = useCallback(() => {
    const result = computePosition();
    if (result) {
      setCoords(result.coords);
      setActualPlacement(result.actualPlacement);
      setArrowLeft(result.arrowLeft);
    }
  }, [computePosition]);

  const showTooltip = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    const result = computePosition();
    if (result) {
      setCoords(result.coords);
      setActualPlacement(result.actualPlacement);
      setArrowLeft(result.arrowLeft);
    }
    setIsOpen(true);
  };

  const scheduleHide = () => {
    if (isPinned) return; // Never hide on mouse leave if pinned by click
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsPinned(false);
    }, 350); // Generous 350ms grace period so cursor can move naturally
  };

  const cancelHide = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
  };

  const handleTriggerClick = (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (isPinned) {
      // If already pinned, clicking it again closes it
      setIsOpen(false);
      setIsPinned(false);
    } else {
      // Pin it open so it stays permanently until clicked outside or closed
      showTooltip();
      setIsPinned(true);
    }
  };

  const closeTooltip = () => {
    cancelHide();
    setIsOpen(false);
    setIsPinned(false);
  };

  // Live resize, scroll, and outside click listeners
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        closeTooltip();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeTooltip();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  return (
    <span
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={scheduleHide}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className={`inline-flex items-center justify-center p-1 rounded-full text-gray-400 hover:text-[#1E433A] hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E5E58]/40 cursor-pointer ${
          isPinned ? 'text-[#1E433A] bg-emerald-50' : ''
        } ${buttonClassName}`}
      >
        <Info size={size} strokeWidth={2.2} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          role="tooltip"
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: coords ? `${coords.top}px` : '0px',
            left: coords ? `${coords.left}px` : '0px',
            opacity: coords ? 1 : 0,
            transform: coords ? 'none' : 'scale(0.95)',
            zIndex: 99999,
          }}
          className="w-72 max-w-[calc(100vw-24px)] rounded-xl bg-[#172D28] text-white p-3.5 shadow-2xl border border-white/10 text-xs leading-relaxed pointer-events-auto transition-all duration-150 select-text"
        >
          {/* Invisible hover bridge to prevent dead zones between trigger and tooltip */}
          <div
            className={`absolute left-0 right-0 h-4 pointer-events-auto ${
              actualPlacement === 'top' ? '-bottom-4' : '-top-4'
            }`}
          />

          {/* Arrow */}
          <span
            className={`absolute w-2.5 h-2.5 bg-[#172D28] border-white/15 rotate-45 pointer-events-none ${
              actualPlacement === 'top'
                ? '-bottom-1.5 border-b border-r'
                : '-top-1.5 border-t border-l'
            }`}
            style={{
              left: `${arrowLeft}px`,
              transform: 'translateX(-50%) rotate(45deg)',
            }}
          />

          {/* Header with Title and Close button */}
          <div className="flex items-start justify-between gap-2 mb-1">
            {title ? (
              <p className="font-bold text-[11px] uppercase tracking-wider text-emerald-300">
                {title}
              </p>
            ) : <span />}
            <button
              type="button"
              onClick={closeTooltip}
              className="text-white/40 hover:text-white p-0.5 -mr-1 -mt-1 rounded-md transition-colors cursor-pointer"
              title="Close tooltip (Esc)"
              aria-label="Close"
            >
              <X size={13} />
            </button>
          </div>

          <div className="text-gray-200 text-xs font-normal leading-relaxed">
            {content}
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}
