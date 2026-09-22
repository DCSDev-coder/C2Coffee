import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { adminRequest, getAdminApiBaseUrl } from '../lib/adminApi';
import { playOrderAlertSound, primeOrderAlertSound, registerBaristaBrowserPush, stopBaristaBrowserPush } from '../lib/baristaPush';

const ORDER_REMINDER_AFTER_MS = 5 * 60 * 1000;
const ORDER_REMINDER_INTERVAL_MS = 60 * 1000;
const READY_PICKUP_HIDE_AFTER_MS = 20 * 60 * 1000;

const STAGES = [
  {
    key: 'new',
    title: 'New orders',
    description: 'Start these drinks next.',
    accent: 'border-amber-200 bg-amber-50',
    icon: Clock3,
  },
  {
    key: 'preparing',
    title: 'Preparing',
    description: 'Currently being made.',
    accent: 'border-[#D6E7E3] bg-[#F0F8F6]',
    icon: Coffee,
  },
  {
    key: 'ready',
    title: 'Ready for pickup',
    description: 'Waiting for the customer.',
    accent: 'border-emerald-200 bg-emerald-50',
    icon: CheckCircle2,
  },
];

function getStage(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'paid' || normalized === 'accepted') return 'new';
  if (normalized.includes('preparing')) return 'preparing';
  if (normalized.includes('ready')) return 'ready';
  return null;
}

function formatOrderTime(order) {
  const parsed = new Date(order.createdAt);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(parsed);
  }
  return order.time || 'Just now';
}

function orderWaitMinutes(order, now) {
  const createdAt = new Date(order.createdAt || order.created_at || '').getTime();
  if (Number.isNaN(createdAt)) return null;
  return Math.max(0, Math.floor((now - createdAt) / 60000));
}

function isNewOrderOverdue(order, now) {
  const waitMinutes = orderWaitMinutes(order, now);
  return waitMinutes !== null && waitMinutes * 60000 >= ORDER_REMINDER_AFTER_MS;
}

function waitingLabel(order, now) {
  const minutes = orderWaitMinutes(order, now);
  if (minutes === null) return 'Waiting';
  return `Waiting ${Math.max(1, minutes)} min`;
}

function isReadyOrderPastPickupWindow(order, now) {
  const readyAt = new Date(order.readyAt || order.ready_at || '').getTime();
  return !Number.isNaN(readyAt) && now - readyAt >= READY_PICKUP_HIDE_AFTER_MS;
}

function itemModifiers(item) {
  const values = [
    item.bean,
    item.espressoShot,
    item.temperature,
    item.sparkling,
    item.milk,
    item.sweetness,
    item.iceLevel,
  ].filter(Boolean);

  if (values.length > 0) return values.join(' · ');
  return Array.isArray(item.modifiers)
    ? item.modifiers.map((modifier) => modifier.option).filter(Boolean).join(' · ')
    : '';
}

function formatCoverageTime(value) {
  return String(value || '').slice(0, 5) || '--:--';
}

function formatAttendanceTime(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '--:--'
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(parsed);
}

function malaysiaDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatScheduleDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00+08:00`));
}

function normalizeGuideName(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function guideForItem(guides, itemName) {
  const normalizedItemName = normalizeGuideName(itemName);
  return guides.find((guide) => (
    guide.guide_type === 'drink'
    && normalizeGuideName(guide.menu_item_name || guide.guide_title) === normalizedItemName
  ));
}

function OrderCard({ order, stage, isUpdating, canOperate, guides, now, onOpen, onAdvance, onOpenGuide }) {
  const itemCount = (order.items || []).reduce(
    (total, item) => total + Number(item.qty || 0),
    0,
  );
  const action = stage === 'new'
    ? { label: 'Start preparing', nextStatus: 'preparing' }
    : stage === 'preparing'
      ? { label: 'Mark ready', nextStatus: 'ready_for_pickup' }
      : null;
  const isOverdue = stage === 'new' && isNewOrderOverdue(order, now);

  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${isOverdue ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'}`}>
      <div
        className={`w-full text-left ${canOperate ? 'cursor-pointer' : ''}`}
        onClick={canOperate ? () => onOpen(order) : undefined}
        onKeyDown={canOperate ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') onOpen(order);
        } : undefined}
        role={canOperate ? 'button' : undefined}
        tabIndex={canOperate ? 0 : undefined}
        aria-label={canOperate ? `Open order ${order.id}` : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold text-slate-900">{order.id}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <UserRound size={14} />
              <span className="truncate">{order.customer || 'Customer'}</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <time className="block text-xs font-semibold text-slate-500">{formatOrderTime(order)}</time>
            {isOverdue && <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">{waitingLabel(order, now)}</span>}
          </div>
        </div>

        <div className="my-3 border-t border-slate-100" />

        <div className="space-y-2">
          {(order.items || []).slice(0, 3).map((item, index) => {
            const guide = guideForItem(guides, item.name);
            return (
            <div key={`${item.name}-${index}`} className="text-sm text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900">{item.qty || 1}x {item.name || 'Menu item'}</span>
                {guide && canOperate && <button type="button" onClick={(event) => { event.stopPropagation(); onOpenGuide(guide); }} className="shrink-0 rounded-md border border-[#8ABFB4] bg-[#F0F8F6] px-2 py-1 text-[11px] font-extrabold text-[#1F3A34] hover:bg-[#E2F2EE]">SOP</button>}
              </div>
              {itemModifiers(item) && <p className="mt-0.5 truncate text-xs text-slate-500">{itemModifiers(item)}</p>}
            </div>
            );
          })}
          {(order.items || []).length > 3 && (
            <p className="text-xs font-semibold text-[#2E5E58]">+{order.items.length - 3} more item types</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs font-medium text-slate-500">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
        {action && canOperate ? (
          <button
            type="button"
            onClick={() => onAdvance(order.id, action.nextStatus)}
            disabled={isUpdating}
            className="rounded-lg bg-[#1F3A34] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#2E5E58] disabled:cursor-wait disabled:opacity-60"
          >
            {isUpdating ? 'Updating...' : action.label}
          </button>
        ) : stage === 'ready' ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Awaiting collection</span>
        ) : (
          <span className="text-xs font-semibold text-slate-500">Read-only</span>
        )}
      </div>
    </article>
  );
}

function OrderDetails({ order, guides, onClose, isUpdating, onAdvance, onOpenGuide }) {
  if (!order) return null;
  const stage = getStage(order.status);
  const action = stage === 'new'
    ? { label: 'Start preparing', nextStatus: 'preparing' }
    : stage === 'preparing'
      ? { label: 'Mark ready for pickup', nextStatus: 'ready_for_pickup' }
      : null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/35 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={`Order ${order.id}`}>
      <section className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E5E58]">Order details</p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{order.id}</h2>
            <p className="mt-1 text-sm text-slate-500">{order.customer || 'Customer'} · {formatOrderTime(order)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close order details">
            <X size={21} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="rounded-xl bg-[#F0F8F6] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2E5E58]">Customer</p>
            <p className="mt-1 font-bold text-slate-900">{order.customer || 'Customer'}</p>
            {order.phone && <p className="mt-1 text-sm text-slate-600">{order.phone}</p>}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-extrabold text-slate-900">Make this order</h3>
            <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {(order.items || []).map((item, index) => {
                const guide = guideForItem(guides, item.name);
                return (
                <div key={`${item.name}-${index}`} className="p-4">
                  <div className="flex justify-between gap-3">
                    <p className="font-bold text-slate-900">{item.qty || 1}x {item.name || 'Menu item'}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {guide && <button type="button" onClick={() => onOpenGuide(guide)} className="rounded-md border border-[#8ABFB4] bg-[#F0F8F6] px-2 py-1 text-[11px] font-extrabold text-[#1F3A34] hover:bg-[#E2F2EE]">Open SOP</button>}
                      {item.remarks && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">Note</span>}
                    </div>
                  </div>
                  {itemModifiers(item) && <p className="mt-1 text-sm leading-6 text-slate-600">{itemModifiers(item)}</p>}
                  {item.remarks && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{item.remarks}</p>}
                </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-5">
          {action ? (
            <button
              type="button"
              onClick={() => onAdvance(order.id, action.nextStatus)}
              disabled={isUpdating}
              className="w-full rounded-xl bg-[#1F3A34] px-4 py-3 text-sm font-extrabold text-white hover:bg-[#2E5E58] disabled:cursor-wait disabled:opacity-60"
            >
              {isUpdating ? 'Updating order...' : action.label}
            </button>
          ) : (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-800">Ready for customer collection</p>
          )}
        </div>
      </section>
    </div>
  );
}

function AttendanceDialog({ mode, attendance, isSubmitting, onClose, onSubmit }) {
  const [baristaId, setBaristaId] = useState('');
  const [pin, setPin] = useState('');
  const activeIds = new Set((attendance?.active_attendance || []).map((entry) => Number(entry.barista_id)));
  const availableBaristas = (attendance?.baristas || []).filter((barista) => (
    mode === 'in'
      ? barista.pin_configured && !activeIds.has(Number(barista.id))
      : activeIds.has(Number(barista.id))
  ));
  const title = mode === 'in' ? 'Clock in' : 'Clock out';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (baristaId && /^\d{6}$/.test(pin)) onSubmit(Number(baristaId), pin);
        }}
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Select your name and confirm with your six-digit PIN.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close attendance form"><X size={20} /></button>
        </div>

        {availableBaristas.length === 0 ? (
          <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No eligible barista profile is available. Ask an administrator to check the profile and PIN setup.</p>
        ) : (
          <>
            <label className="mt-6 block text-sm font-bold text-slate-700">Your name
              <select value={baristaId} onChange={(event) => setBaristaId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900">
                <option value="">Select your name</option>
                {availableBaristas.map((barista) => <option key={barista.id} value={barista.id}>{barista.name}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-sm font-bold text-slate-700">Six-digit PIN
              <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" type="password" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base text-slate-900" />
            </label>
            <button disabled={isSubmitting || !baristaId || pin.length !== 6} className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 ${mode === 'in' ? 'bg-[#1F3A34] hover:bg-[#2E5E58]' : 'bg-[#B54E3D] hover:bg-[#963D2D]'}`}>
              {isSubmitting ? 'Updating attendance...' : title}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

function GuidesDialog({ guideType, guides, initialGuideId, onClose }) {
  const titles = { attire: 'Attire guide', rules: 'Store rules', drink: 'Drink SOPs' };
  const matchingGuides = guides.filter((guide) => guide.guide_type === guideType);
  const [query, setQuery] = useState('');
  const [selectedGuideId, setSelectedGuideId] = useState(initialGuideId || null);
  const [zoom, setZoom] = useState(100);
  const selectedGuide = matchingGuides.find((guide) => String(guide.id) === String(selectedGuideId));
  const searchableGuides = matchingGuides.filter((guide) => {
    const name = guide.menu_item_name || guide.guide_title || '';
    return normalizeGuideName(name).includes(normalizeGuideName(query));
  });

  useEffect(() => {
    setSelectedGuideId(initialGuideId || null);
    setQuery('');
    setZoom(100);
  }, [guideType, initialGuideId]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={titles[guideType]}>
      <section className="flex h-full w-full max-w-6xl flex-col bg-white shadow-2xl sm:h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E5E58]">Staff guides</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">{titles[guideType]}</h2></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close guide"><X size={21} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {selectedGuide ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setSelectedGuideId(null)} className="text-sm font-bold text-[#2E5E58] hover:underline">All {titles[guideType]}</button>
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  <button type="button" onClick={() => setZoom((value) => Math.max(75, value - 25))} disabled={zoom <= 75} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40" aria-label="Zoom out"><ZoomOut size={18} /></button>
                  <span className="min-w-14 text-center text-xs font-bold text-slate-600">{zoom}%</span>
                  <button type="button" onClick={() => setZoom((value) => Math.min(200, value + 25))} disabled={zoom >= 200} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40" aria-label="Zoom in"><ZoomIn size={18} /></button>
                </div>
              </div>
              <article className="mt-4 max-h-[calc(100dvh-14rem)] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                <img src={`${getAdminApiBaseUrl()}${selectedGuide.image_url}`} alt={selectedGuide.menu_item_name || selectedGuide.guide_title || titles[guideType]} className="mx-auto block max-w-none bg-white object-contain" style={{ width: `${zoom}%` }} />
              </article>
              <p className="mt-3 text-base font-extrabold text-slate-800">{selectedGuide.menu_item_name || selectedGuide.guide_title || titles[guideType]}</p>
            </>
          ) : (
            <>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Search drink or guide" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-base text-slate-900 outline-none focus:border-[#2E5E58] focus:ring-2 focus:ring-[#D6E7E3]" />
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {searchableGuides.map((guide) => (
                  <button key={guide.id} type="button" onClick={() => setSelectedGuideId(guide.id)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-[#2E5E58] hover:bg-[#F0F8F6]">
                    <img src={`${getAdminApiBaseUrl()}${guide.image_url}`} alt="" className="h-16 w-12 rounded-md bg-slate-50 object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{guide.menu_item_name || guide.guide_title || titles[guideType]}</span>
                    <ZoomIn size={17} className="shrink-0 text-[#2E5E58]" />
                  </button>
                ))}
              </div>
              {searchableGuides.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No matching guide was found.</p>}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function BaristaConsole({ currentUser, view = 'orders' }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState('');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [weeklySchedule, setWeeklySchedule] = useState([]);
  const [guides, setGuides] = useState([]);
  const [attendanceMode, setAttendanceMode] = useState(null);
  const [guideType, setGuideType] = useState(null);
  const [initialGuideId, setInitialGuideId] = useState(null);
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);
  const [pushStatus, setPushStatus] = useState({ status: 'idle', message: '' });
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const lastReminderAtByOrderId = useRef(new Map());
  const isWorkspace = view === 'workspace';
  const canOperate = Array.isArray(currentUser?.roles)
    && currentUser.roles.length === 1
    && currentUser.roles[0] === 'barista';

  const loadOrders = async ({ silent = false } = {}) => {
    try {
      setError('');
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);

      const response = await adminRequest('/v1/admin/orders');
      const nextOrders = Array.isArray(response?.orders) ? response.orders : [];
      setOrders(nextOrders);
      setSelectedOrder((current) => current ? nextOrders.find((order) => order.id === current.id) || null : null);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load the order queue. Check the connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadStaffWorkspace = async () => {
    const [attendanceResult, scheduleResult, guidesResult] = await Promise.allSettled([
      adminRequest('/v1/barista/attendance/status'),
      adminRequest('/v1/barista/weekly-schedule'),
      adminRequest('/v1/barista/guides'),
    ]);

    if (attendanceResult.status === 'fulfilled') setAttendance(attendanceResult.value || null);
    if (scheduleResult.status === 'fulfilled') {
      const datedShifts = Array.isArray(scheduleResult.value?.scheduled_shifts) ? scheduleResult.value.scheduled_shifts : [];
      setWeeklySchedule(datedShifts.length > 0 ? datedShifts : (Array.isArray(scheduleResult.value?.weekly_schedule) ? scheduleResult.value.weekly_schedule : []));
    }
    if (guidesResult.status === 'fulfilled') setGuides(Array.isArray(guidesResult.value?.guides) ? guidesResult.value.guides : []);

    if ([attendanceResult, scheduleResult, guidesResult].every((result) => result.status === 'rejected')) {
      const failedResult = [attendanceResult, scheduleResult, guidesResult].find((result) => result.status === 'rejected');
      setError(failedResult?.reason?.message || 'Unable to load the staff workspace. Please refresh the page.');
    }
  };

  useEffect(() => {
    void loadOrders();
    void loadStaffWorkspace();
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
      void loadOrders({ silent: true });
    }, 15000);
    const refreshOnFocus = () => void loadOrders({ silent: true });
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, []);

  useEffect(() => {
    const primeAudio = () => void primeOrderAlertSound();
    // Existing alert permissions do not provide a new click. Prime audio on the
    // barista's first normal interaction after opening the console instead.
    window.addEventListener('pointerdown', primeAudio, { once: true });
    window.addEventListener('keydown', primeAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', primeAudio);
      window.removeEventListener('keydown', primeAudio);
    };
  }, []);

  useEffect(() => {
    if (!canOperate || isWorkspace) return undefined;
    let active = true;
    void registerBaristaBrowserPush({
      onOrderAlert: () => {
        setNewOrderAlert('New paid order received. The queue has been refreshed.');
        void loadOrders({ silent: true });
      },
    }).then((nextStatus) => {
      if (active) setPushStatus(nextStatus);
    }).catch(() => {
      if (active) setPushStatus({ status: 'error', message: 'Browser alerts could not be started. Please try again.' });
    });
    return () => {
      active = false;
      stopBaristaBrowserPush();
    };
  }, [canOperate, isWorkspace]);

  const enableBrowserPush = async () => {
    try {
      setIsEnablingPush(true);
      await primeOrderAlertSound();
      const nextStatus = await registerBaristaBrowserPush({
        requestPermission: true,
        onOrderAlert: () => {
          setNewOrderAlert('New paid order received. The queue has been refreshed.');
          void loadOrders({ silent: true });
        },
      });
      setPushStatus(nextStatus);
    } catch {
      setPushStatus({ status: 'error', message: 'Browser alerts could not be enabled. Please try again.' });
    } finally {
      setIsEnablingPush(false);
    }
  };

  const updateAttendance = async (baristaId, pin) => {
    if (!attendanceMode) return;
    try {
      setIsUpdatingAttendance(true);
      setError('');
      await adminRequest(`/v1/barista/attendance/clock-${attendanceMode}`, {
        method: 'POST',
        body: JSON.stringify({ barista_id: baristaId, pin }),
      });
      setAttendanceMode(null);
      await loadStaffWorkspace();
    } catch (attendanceError) {
      setError(attendanceError?.message || 'Attendance could not be updated. Check the name and PIN, then try again.');
    } finally {
      setIsUpdatingAttendance(false);
    }
  };

  const stagedOrders = useMemo(() => {
    const groups = { new: [], preparing: [], ready: [] };
    orders.forEach((order) => {
      const stage = getStage(order.status);
      // Hiding after twenty minutes declutters the counter queue only. The
      // persisted order remains ready for pickup for the customer and admin.
      if (stage && !(stage === 'ready' && isReadyOrderPastPickupWindow(order, currentTime))) {
        groups[stage].push(order);
      }
    });
    return groups;
  }, [currentTime, orders]);
  const overdueNewOrders = useMemo(
    () => stagedOrders.new.filter((order) => isNewOrderOverdue(order, currentTime)),
    [currentTime, stagedOrders.new],
  );
  const overdueOrderIds = useMemo(
    () => overdueNewOrders.map((order) => order.id).sort(),
    [overdueNewOrders],
  );

  useEffect(() => {
    if (!canOperate || isWorkspace) return;

    const overdueIds = new Set(overdueOrderIds);
    for (const orderId of lastReminderAtByOrderId.current.keys()) {
      if (!overdueIds.has(orderId)) lastReminderAtByOrderId.current.delete(orderId);
    }

    const now = Date.now();
    const needsReminder = overdueOrderIds.some((orderId) => {
      const lastReminderAt = lastReminderAtByOrderId.current.get(orderId) || 0;
      return now - lastReminderAt >= ORDER_REMINDER_INTERVAL_MS;
    });
    if (!needsReminder) return;

    playOrderAlertSound();
    overdueOrderIds.forEach((orderId) => lastReminderAtByOrderId.current.set(orderId, now));
  }, [canOperate, isWorkspace, overdueOrderIds]);

  const todayWeekday = new Date().getDay() || 7;
  const hasDatedSchedule = weeklySchedule.some((entry) => entry.shift_date);
  const todayCoverage = hasDatedSchedule
    ? weeklySchedule.filter((entry) => entry.shift_date === malaysiaDate())
    : weeklySchedule.filter((entry) => Number(entry.weekday) === todayWeekday);
  const upcomingSchedule = hasDatedSchedule ? weeklySchedule : [];
  const activeAttendance = attendance?.active_attendance || [];
  const advanceOrder = async (orderId, status) => {
    try {
      setUpdatingOrderId(orderId);
      setError('');
      await adminRequest(`/v1/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadOrders({ silent: true });
    } catch (updateError) {
      setError(updateError?.message || 'The order could not be updated. Refresh the queue and try again.');
    } finally {
      setUpdatingOrderId('');
    }
  };

  return (
    <div className="min-h-full bg-[#F7F7F4] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2E5E58]">Counter workspace</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{isWorkspace ? 'Barista Workspace' : 'Barista Console'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{isWorkspace ? 'Check today’s coverage, manage attendance, and open preparation guides.' : 'Follow orders from new to ready for pickup. This browser workspace does not print receipts automatically.'}</p>
          </div>
          <div className="flex items-center gap-3">
            {!canOperate && <span className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">Read-only view</span>}
            {canOperate && !isWorkspace && pushStatus.status === 'enabled' && <span className="hidden rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 sm:inline">Browser alerts on</span>}
            {canOperate && !isWorkspace && pushStatus.status !== 'enabled' && (
              <button
                type="button"
                onClick={() => void enableBrowserPush()}
                disabled={isEnablingPush || pushStatus.status === 'configuration' || pushStatus.status === 'unsupported'}
                title={pushStatus.message}
                className="inline-flex items-center gap-2 rounded-xl border border-[#8ABFB4] bg-[#F0F8F6] px-4 py-2.5 text-sm font-bold text-[#1F3A34] shadow-sm hover:bg-[#E2F2EE] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <BellRing size={16} />
                {isEnablingPush ? 'Enabling alerts...' : 'Enable order alerts'}
              </button>
            )}
            {!isWorkspace && lastUpdated && <span className="hidden text-xs font-medium text-slate-500 sm:inline">Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
            {canOperate && !isWorkspace && (
              <button
                type="button"
                onClick={() => void loadOrders({ silent: true })}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-[#2E5E58] disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            )}
          </div>
        </header>

        {canOperate && !isWorkspace && pushStatus.message && pushStatus.status !== 'enabled' && (
          <p className="mt-3 text-xs font-semibold text-slate-500">{pushStatus.message}</p>
        )}

        {!isWorkspace && newOrderAlert && (
          <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
            <span>{newOrderAlert}</span>
            <button type="button" onClick={() => setNewOrderAlert('')} className="text-xs font-extrabold text-emerald-800 underline">Dismiss</button>
          </div>
        )}

        {canOperate && !isWorkspace && overdueNewOrders.length > 0 && (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{overdueNewOrders.length} new order{overdueNewOrders.length === 1 ? '' : 's'} {overdueNewOrders.length === 1 ? 'has' : 'have'} waited at least five minutes. A reminder chime repeats every minute until preparation starts.</span>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        )}

        {!isWorkspace && (isLoading ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">Loading the order queue...</div>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {STAGES.map(({ key, title, description, accent, icon: Icon }) => (
              <section key={key} className={`rounded-2xl border p-4 ${key === 'new' && overdueNewOrders.length > 0 ? 'border-red-300 bg-red-50' : accent}`}>
                <div className="flex items-center justify-between gap-4 px-1 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#1F3A34] shadow-sm"><Icon size={20} /></div>
                    <div>
                      <h2 className="font-extrabold text-slate-900">{title}</h2>
                      <p className="text-xs text-slate-600">{description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-sm font-extrabold text-slate-700 shadow-sm">{stagedOrders[key].length}</span>
                </div>

                <div className="space-y-3">
                  {stagedOrders[key].map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      stage={key}
                      isUpdating={updatingOrderId === order.id}
                      canOperate={canOperate}
                      guides={guides}
                      now={currentTime}
                      onOpen={canOperate ? setSelectedOrder : () => {}}
                      onAdvance={advanceOrder}
                      onOpenGuide={(guide) => { setInitialGuideId(guide.id); setGuideType('drink'); }}
                    />
                  ))}
                  {stagedOrders[key].length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center text-sm font-medium text-slate-500">No orders here.</div>
                  )}
                </div>
              </section>
            ))}
          </div>

        ))}

        {isWorkspace && (
          <section className="mt-8 space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F8F6] text-[#1F3A34]"><UsersRound size={20} /></div><div><h2 className="font-extrabold text-slate-900">Shift attendance</h2><p className="text-xs text-slate-500">{activeAttendance.length === 0 ? 'No barista clocked in' : `${activeAttendance.length} barista${activeAttendance.length === 1 ? '' : 's'} clocked in`}</p></div></div>
              <div className="mt-4 space-y-2">
                {activeAttendance.map((entry) => <p key={entry.id} className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700"><span className="font-bold">{entry.barista_name}</span> since {formatAttendanceTime(entry.clocked_in_at)}</p>)}
                {activeAttendance.length === 0 && <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">Use your name and PIN to begin a shift.</p>}
              </div>
              {canOperate && <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => setAttendanceMode('in')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F3A34] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58]"><LogIn size={16} />Clock in</button><button type="button" onClick={() => setAttendanceMode('out')} disabled={activeAttendance.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#B54E3D] px-3 py-2.5 text-sm font-bold text-[#B54E3D] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><LogOut size={16} />Clock out</button></div>}
              {!canOperate && <p className="mt-4 text-xs font-semibold text-slate-500">Read-only attendance</p>}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F8F6] text-[#1F3A34]"><BookOpen size={20} /></div><div><h2 className="font-extrabold text-slate-900">Staff guides</h2><p className="text-xs text-slate-500">Preparation references</p></div></div>
              <div className="mt-4 space-y-2">
                {[['attire', 'Attire guide'], ['rules', 'Store rules'], ['drink', 'Drink SOPs']].map(([type, label]) => {
                  const count = guides.filter((guide) => guide.guide_type === type).length;
                  return canOperate ? <button key={type} type="button" onClick={() => { setInitialGuideId(null); setGuideType(type); }} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-bold text-slate-800 hover:border-[#2E5E58] hover:bg-[#F0F8F6]"><span>{label}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{count}</span></button> : <div key={type} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700"><span>{label}</span><span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">{count}</span></div>;
                })}
              </div>
              {!canOperate && <p className="mt-4 text-xs font-semibold text-slate-500">Read-only guide summary</p>}
            </article>
            </div>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F8F6] text-[#1F3A34]"><CalendarDays size={20} /></div><div><h2 className="font-extrabold text-slate-900">Upcoming timetable</h2><p className="text-xs text-slate-500">Published shifts for today and the next 30 days</p></div></div>
              {upcomingSchedule.length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Object.entries(upcomingSchedule.reduce((groups, shift) => {
                  const date = shift.shift_date;
                  if (!groups[date]) groups[date] = [];
                  groups[date].push(shift);
                  return groups;
                }, {})).map(([date, shifts]) => <div key={date} className="rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-extrabold text-slate-800">{formatScheduleDate(date)}</h3><div className="mt-3 space-y-2">{shifts.map((shift, index) => <p key={`${shift.barista_id}-${shift.starts_at}-${index}`} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700"><span className="font-bold">{shift.barista_name}</span><br /><span className="text-xs text-slate-500">{formatCoverageTime(shift.starts_at)} - {formatCoverageTime(shift.ends_at)}</span></p>)}</div></div>)}
              </div> : <div className="mt-4 space-y-3"><p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">No dated timetable has been published yet.</p>{todayCoverage.length > 0 && <div className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-600"><span className="font-bold text-slate-800">Today's legacy coverage:</span> {todayCoverage.map((shift) => `${shift.barista_name} ${formatCoverageTime(shift.starts_at)}-${formatCoverageTime(shift.ends_at)}`).join(', ')}</div>}</div>}
            </article>
          </section>
        )}
      </div>

      {canOperate && <OrderDetails
        order={selectedOrder}
        guides={guides}
        onClose={() => setSelectedOrder(null)}
        isUpdating={updatingOrderId === selectedOrder?.id}
        onAdvance={advanceOrder}
        onOpenGuide={(guide) => { setInitialGuideId(guide.id); setGuideType('drink'); }}
      />}
      {canOperate && attendanceMode && <AttendanceDialog mode={attendanceMode} attendance={attendance} isSubmitting={isUpdatingAttendance} onClose={() => setAttendanceMode(null)} onSubmit={updateAttendance} />}
      {canOperate && guideType && <GuidesDialog guideType={guideType} guides={guides} initialGuideId={initialGuideId} onClose={() => { setGuideType(null); setInitialGuideId(null); }} />}
    </div>
  );
}
