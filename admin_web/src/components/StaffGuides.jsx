import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ImagePlus,
  Trash2,
  BookOpen,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { adminRequest, getAdminApiBaseUrl } from '../lib/adminApi';
import { requestAdminConfirm } from '../lib/adminDialog';
import InfoTooltip from './InfoTooltip';

const guideLabels = { attire: 'Attire guide', rules: 'Store rules', drink: 'Drink preparation' };

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImageViewerModal({ guides, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const currentGuide = guides[currentIndex];

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.35, 4));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(prev - 0.35, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      resetZoom();
    }
  }, [currentIndex, resetZoom]);

  const goToNext = useCallback(() => {
    if (currentIndex < guides.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetZoom();
    }
  }, [currentIndex, guides.length, resetZoom]);

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        zoomOut();
      } else if (e.key === '0') {
        resetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrev, goToNext, zoomIn, zoomOut, resetZoom]);

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  // Dragging / panning
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double click toggle zoom
  const handleDoubleClick = () => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2);
    }
  };

  if (!currentGuide) return null;

  const guideTitle = currentGuide.menu_item_name || currentGuide.guide_title || guideLabels[currentGuide.guide_type];

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex flex-col bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900/90 border-b border-white/10 text-white z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="p-2 rounded-xl bg-white/10 text-emerald-400 shrink-0">
            <BookOpen size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white truncate max-w-xs sm:max-w-md">{guideTitle}</h3>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {guideLabels[currentGuide.guide_type]}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Image {currentIndex + 1} of {guides.length}
            </p>
          </div>
        </div>

        {/* Toolbar & Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/10">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-slate-200 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
              title="Zoom out (-)"
              aria-label="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-semibold text-slate-300 w-12 text-center select-none">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= 4}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-slate-200 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
              title="Zoom in (+)"
              aria-label="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-slate-200 hover:text-white transition-colors cursor-pointer border-l border-white/10 ml-0.5"
              title="Reset zoom (0)"
              aria-label="Reset zoom"
            >
              <RotateCcw size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-red-500/30 hover:text-red-300 text-slate-300 transition-colors cursor-pointer ml-1 sm:ml-2 border border-white/10"
            title="Close viewer (Esc)"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Canvas / Image Area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDoubleClick={handleDoubleClick}
        className={`flex-1 overflow-hidden relative flex items-center justify-center p-4 ${
          scale > 1
            ? isDragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : 'cursor-zoom-in'
        }`}
      >
        {/* Navigation Previous Button */}
        {guides.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition-all border border-white/15 shadow-xl disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
            title="Previous guide (Left arrow)"
            aria-label="Previous guide"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Scaled / Panned Image Container */}
        <div
          className="transition-transform duration-75 ease-out select-none"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={`${getAdminApiBaseUrl()}${currentGuide.image_url}`}
            alt={guideTitle}
            draggable={false}
            className="max-h-[82vh] max-w-[85vw] object-contain rounded-lg shadow-2xl pointer-events-none bg-white"
          />
        </div>

        {/* Navigation Next Button */}
        {guides.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            disabled={currentIndex === guides.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition-all border border-white/15 shadow-xl disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
            title="Next guide (Right arrow)"
            aria-label="Next guide"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Bottom Hint Bar */}
      <div className="py-2.5 px-4 bg-slate-900/80 border-t border-white/10 text-center text-xs text-slate-400 shrink-0 flex items-center justify-center gap-4">
        <span>Scroll or use buttons to zoom</span>
        <span className="hidden sm:inline text-white/20">•</span>
        <span className="hidden sm:inline">Double click to quick zoom</span>
        <span className="hidden sm:inline text-white/20">•</span>
        <span className="hidden sm:inline">Drag to pan when zoomed</span>
        <span className="hidden sm:inline text-white/20">•</span>
        <span>Use arrow keys to browse</span>
      </div>
    </div>,
    document.body
  );
}

export default function StaffGuides() {
  const [guides, setGuides] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [type, setType] = useState('drink');
  const [menuItemId, setMenuItemId] = useState('');
  const [guideTitle, setGuideTitle] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Lightbox / Image Viewer state
  const [viewingIndex, setViewingIndex] = useState(null);

  const visibleGuides = guides.filter((guide) => guide.guide_type === type);

  const load = async () => {
    const [guideData, menuData] = await Promise.all([
      adminRequest('/v1/admin/barista-guides'),
      adminRequest('/v1/admin/menu'),
    ]);
    setGuides(guideData.guides || []);
    setMenuItems((menuData.categories || []).flatMap((category) => category.items || []));
  };

  useEffect(() => {
    load().catch(() => setError('Unable to load staff guides. Please refresh.'));
  }, []);

  const addGuide = async (event) => {
    event.preventDefault();
    if (!file || (type === 'drink' && !menuItemId)) {
      setError(type === 'drink' ? 'Select a drink and image first.' : 'Choose an image first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const upload = await adminRequest('/v1/admin/barista-guides/uploads', {
        method: 'POST',
        body: JSON.stringify({ file_name: file.name, data_url: dataUrl }),
      });
      await adminRequest('/v1/admin/barista-guides', {
        method: 'POST',
        body: JSON.stringify({
          guide_type: type,
          menu_item_id: type === 'drink' ? Number(menuItemId) : null,
          guide_title: type === 'drink' ? null : (guideTitle.trim() || null),
          image_url: upload.image_url,
        }),
      });
      setFile(null);
      setMenuItemId('');
      setGuideTitle('');
      await load();
    } catch (err) {
      setError(err.message || 'Unable to save the guide image.');
    } finally {
      setSaving(false);
    }
  };

  const removeGuide = async (id) => {
    if (!await requestAdminConfirm({
      title: 'Delete staff guide?',
      message: 'This image will be removed from the C2 Store guide library.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) return;

    await adminRequest(`/v1/admin/barista-guides/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 lg:p-8 space-y-7">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900">Staff Guides</h1>
            <InfoTooltip content="Visual SOP and dress code reference materials presented on the Barista Workspace." title="Staff Guides" />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Upload image-only attire, store-rule, and drink preparation guides for the C2 Store Barista Workspace.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200/80 pb-3">
          {Object.entries(guideLabels).map(([key, label]) => {
            const count = guides.filter((g) => g.guide_type === key).length;
            const isActive = type === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setType(key);
                  setFile(null);
                  setMenuItemId('');
                  setGuideTitle('');
                  setViewingIndex(null);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1F3A34] text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200/80 hover:bg-gray-50'
                }`}
              >
                <span>{label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Upload form card */}
        <form onSubmit={addGuide} className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xs hover:shadow-xs transition-shadow grid gap-4 md:grid-cols-4 items-end">
          <label className="text-sm font-semibold text-gray-700">
            Guide type
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setFile(null);
                setMenuItemId('');
                setGuideTitle('');
              }}
              className="mt-2 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent bg-white"
            >
              <option value="drink">Drink preparation</option>
              <option value="attire">Attire guide</option>
              <option value="rules">Store rules</option>
            </select>
          </label>

          {type === 'drink' && (
            <label className="text-sm font-semibold text-gray-700">
              Drink
              <select
                value={menuItemId}
                onChange={(event) => setMenuItemId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent bg-white"
              >
                <option value="">Select drink</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          )}

          {type !== 'drink' && (
            <label className="text-sm font-semibold text-gray-700">
              Guide title <span className="font-normal text-gray-400">(optional)</span>
              <input
                value={guideTitle}
                maxLength={120}
                onChange={(event) => setGuideTitle(event.target.value)}
                placeholder={type === 'attire' ? 'e.g. Opening uniform' : 'e.g. Closing checklist'}
                className="mt-2 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
              />
            </label>
          )}

          <label className="text-sm font-semibold text-gray-700">
            Guide image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-2 block w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-[#1F3A34] hover:file:bg-emerald-100 cursor-pointer"
            />
          </label>

          <button
            disabled={saving}
            className="rounded-xl bg-[#1F3A34] hover:bg-[#2E5E58] px-5 py-2.5 font-bold text-white transition-colors disabled:opacity-50 cursor-pointer text-sm shadow-xs h-[42px] flex items-center justify-center"
          >
            {saving ? 'Saving...' : 'Upload guide'}
          </button>

          {error && (
            <p className="md:col-span-4 text-sm font-medium text-red-600 bg-red-50 border border-red-200/80 p-3 rounded-xl">
              {error}
            </p>
          )}
        </form>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">{guideLabels[type]}</h2>
            <InfoTooltip content={`Active ${guideLabels[type].toLowerCase()} visuals distributed to barista counter displays. Click any card to inspect or zoom.`} title={guideLabels[type]} />
          </div>
          <span className="rounded-full bg-[#E8F2EF] px-3 py-1 text-xs font-bold text-[#1F3A34]">
            {visibleGuides.length} {visibleGuides.length === 1 ? 'guide' : 'guides'}
          </span>
        </div>

        {visibleGuides.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleGuides.map((guide, index) => (
              <article
                key={guide.id}
                className="group overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs hover:shadow-md hover:border-gray-300 transition-all flex flex-col"
              >
                {/* Clickable Image Container */}
                <div
                  onClick={() => setViewingIndex(index)}
                  className="relative h-60 w-full bg-gray-50 border-b border-gray-100 flex items-center justify-center p-3 cursor-zoom-in overflow-hidden"
                  title="Click to view full image and zoom"
                >
                  <img
                    src={`${getAdminApiBaseUrl()}${guide.image_url}`}
                    alt={guide.menu_item_name || guide.guide_title || guideLabels[guide.guide_type]}
                    className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                  {/* Subtle hover overlay badge */}
                  <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 text-white text-xs font-semibold backdrop-blur-xs shadow-lg">
                      <ZoomIn size={14} /> Click to view & zoom
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4">
                  <div
                    onClick={() => setViewingIndex(index)}
                    className="p-2 rounded-lg bg-emerald-50 text-[#2E5E58] shrink-0 cursor-pointer hover:bg-emerald-100 transition-colors"
                  >
                    <BookOpen size={18} />
                  </div>
                  <div
                    onClick={() => setViewingIndex(index)}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <p className="font-bold text-gray-900 truncate group-hover:text-[#1F3A34] transition-colors">
                      {guide.menu_item_name || guide.guide_title || guideLabels[guide.guide_type]}
                    </p>
                    <p className="truncate text-xs text-gray-500 mt-0.5">
                      {guide.guide_type === 'drink' ? 'Drink preparation' : guideLabels[guide.guide_type]}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGuide(guide.id);
                    }}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    aria-label="Delete guide"
                    title="Delete guide"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-500 bg-white">
            <ImagePlus className="mx-auto mb-3 text-gray-400" size={32} />
            <p className="font-medium text-gray-600">No {guideLabels[type].toLowerCase()} images have been uploaded.</p>
            <p className="text-xs text-gray-400 mt-1">Upload a PNG, JPEG, or WebP image to publish to the Barista Workspace.</p>
          </div>
        )}
      </div>

      {/* Fullscreen Interactive Lightbox Modal */}
      {viewingIndex !== null && (
        <ImageViewerModal
          guides={visibleGuides}
          initialIndex={viewingIndex}
          onClose={() => setViewingIndex(null)}
        />
      )}
    </div>
  );
}
