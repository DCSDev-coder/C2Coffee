import React, { useMemo, useState } from 'react';
import { isBaristaHistoryStatus, malaysiaAttendanceDate } from '../utils/baristaHistory';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coffee,
  History,
  LogIn,
  LogOut,
  Megaphone,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from 'lucide-react';

const PURPOSE_LABELS = {
  sampling: 'Customer sampling',
  campaign: 'Marketing campaign',
  content_production: 'Content production',
  influencer: 'Influencer / creator',
  goodwill: 'Customer goodwill',
  other: 'Other approved use',
};

function formatDateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function formatShortDate(value) {
  const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
  if (!match) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${match[0]}T12:00:00+08:00`));
}

function formatUnitLabel(unitCode) {
  if (unitCode === 'millilitre') return 'ml';
  if (unitCode === 'gram') return 'g';
  return 'pcs';
}

function TabErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 shrink-0" size={18} />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      )}
    </div>
  );
}

export function OrderHistoryView({ orders, isLoading, error, onOpenOrder, formatOrderTime, itemModifiers }) {
  const [query, setQuery] = useState('');

  const historyOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...orders]
      .filter((order) => {
        return isBaristaHistoryStatus(order.status);
      })
      .filter((order) => {
        if (!normalizedQuery) return true;
        const id = String(order.id || '').toLowerCase();
        const customer = String(order.customer || '').toLowerCase();
        const itemsText = (order.items || []).map((item) => item.name || '').join(' ').toLowerCase();
        return id.includes(normalizedQuery) || customer.includes(normalizedQuery) || itemsText.includes(normalizedQuery);
      });
  }, [orders, query]);

  if (error) return <TabErrorBanner message={error} />;

  if (isLoading) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">
        Loading order history...
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Today&apos;s Order History</h2>
          <p className="text-xs text-slate-500">Completed, ready, and closed orders from today&apos;s queue.</p>
        </div>
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order ID, customer, drink..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#2E5E58]"
          />
        </label>
      </div>

      {historyOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          <History className="mx-auto mb-2 text-slate-400" size={24} />
          No history orders match this view.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {historyOrders.map((order) => {
            const status = String(order.status || 'completed').replace(/_/g, ' ');
            const isCancelled = status.toLowerCase().includes('cancel') || status.toLowerCase().includes('refund');
            return (
              <article
                key={order.id}
                onClick={() => onOpenOrder(order)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onOpenOrder(order);
                }}
                role="button"
                tabIndex={0}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#2E5E58]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-extrabold text-slate-900">{order.id}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <UserRound size={13} />
                      <span className="truncate">{order.customer || 'Customer'}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                      isCancelled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {status}
                    </span>
                    <time className="mt-1 block text-xs font-semibold text-slate-500">{formatOrderTime(order)}</time>
                  </div>
                </div>
                <div className="my-3 border-t border-slate-100" />
                <div className="space-y-1.5">
                  {(order.items || []).slice(0, 3).map((item, idx) => (
                    <div key={`${item.name}-${idx}`} className="text-sm">
                      <p className="font-bold text-slate-800 truncate">{item.qty || 1}x {item.name || 'Menu item'}</p>
                      {itemModifiers(item) && <p className="text-xs text-slate-500 truncate">{itemModifiers(item)}</p>}
                    </div>
                  ))}
                  {(order.items || []).length > 3 && (
                    <p className="text-xs font-semibold text-[#2E5E58]">+{order.items.length - 3} more items</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function MenuAvailabilityView({ data, isLoading, error, onRefresh }) {
  const [showItems, setShowItems] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const categories = useMemo(() => data?.categories || [], [data]);
  const beans = useMemo(() => data?.beans || [], [data]);
  const customizations = useMemo(() => data?.customizations || [], [data]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categories
      .filter((cat) => selectedCategoryId === null || cat.id === selectedCategoryId)
      .map((cat) => ({
        ...cat,
        items: (cat.items || []).filter((item) => {
          if (!q) return true;
          return String(item.name || '').toLowerCase().includes(q)
            || String(item.description || '').toLowerCase().includes(q);
        }),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, searchQuery, selectedCategoryId]);

  if (isLoading) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">
        Loading menu availability...
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-5">
      <TabErrorBanner message={error} onRetry={onRefresh} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Menu &amp; Option Availability {data?.store_name ? `· ${data.store_name}` : ''}
          </h2>
          <p className="text-xs text-slate-500">Read-only view of item, bean, and modifier availability visible on the barista workstation.</p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setShowItems(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${
              showItems ? 'bg-[#1F3A34] text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Coffee size={14} />
            Menu items
          </button>
          <button
            type="button"
            onClick={() => setShowItems(false)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${
              !showItems ? 'bg-[#1F3A34] text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal size={14} />
            Customizations &amp; beans
          </button>
        </div>
      </div>

      {showItems ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search menu items..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#2E5E58]"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer ${
                  selectedCategoryId === null ? 'bg-[#1F3A34] text-white' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer ${
                    selectedCategoryId === cat.id ? 'bg-[#1F3A34] text-white' : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {filteredCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              No menu items found.
            </div>
          ) : (
            <div className="space-y-5">
              {filteredCategories.map((cat) => (
                <div key={cat.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#2E5E58]">{cat.name}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {cat.items.map((item) => {
                      const available = item.is_available !== false;
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">RM {Number(item.base_price_rm || 0).toFixed(2)}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                            available ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                          }`}>
                            {available ? 'Available' : 'Out of stock'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          {beans.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#2E5E58]">Bean Blends</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {beans.map((bean) => {
                  const available = Boolean(bean.is_available);
                  return (
                    <div key={bean.code || bean.name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{bean.name}</p>
                        {bean.subtitle && <p className="truncate text-xs text-slate-500">{bean.subtitle}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                        available ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                      }`}>
                        {available ? 'Available' : 'Out of stock'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {customizations.map((group) => (
            <div key={group.type || group.category_name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#2E5E58]">{group.category_name}</h3>
              {group.description && <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(group.options || []).map((option) => {
                  const available = Boolean(option.is_available);
                  return (
                    <div key={option.code || option.value || option.name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{option.name}</p>
                        {option.subtitle && <p className="truncate text-xs text-slate-500">{option.subtitle}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                        available ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                      }`}>
                        {available ? 'Available' : 'Out of stock'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function SideWorkView({ sideWork, currentTime, canOperate, onSelectTask }) {
  const dueSideWork = sideWork.filter(
    (task) => !task.completed_at && currentTime >= new Date(`${task.scheduled_date}T${task.scheduled_time}:00+08:00`).getTime(),
  );

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${dueSideWork.length ? 'bg-amber-100 text-amber-800' : 'bg-[#F0F8F6] text-[#1F3A34]'}`}>
          <ClipboardCheck size={20} />
        </div>
        <div>
          <h2 className="font-extrabold text-slate-900">Today&apos;s side work</h2>
          <p className="text-xs text-slate-500">
            {dueSideWork.length ? `${dueSideWork.length} task${dueSideWork.length === 1 ? '' : 's'} due now` : 'Timed cleaning and upkeep tasks'}
          </p>
        </div>
      </div>

      {sideWork.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No side-work tasks scheduled for today.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sideWork.map((task) => {
            const due = !task.completed_at && currentTime >= new Date(`${task.scheduled_date}T${task.scheduled_time}:00+08:00`).getTime();
            return (
              <article key={task.id} className={`rounded-xl border p-4 ${task.completed_at ? 'border-emerald-200 bg-emerald-50' : due ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-slate-900">{task.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{task.scheduled_time}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${task.completed_at ? 'bg-emerald-100 text-emerald-800' : due ? 'bg-amber-200 text-amber-900' : 'bg-white text-slate-600'}`}>
                    {task.completed_at ? 'Completed' : due ? 'Due now' : 'Upcoming'}
                  </span>
                </div>
                {task.instructions && <p className="mt-3 text-sm leading-6 text-slate-600">{task.instructions}</p>}
                {task.completed_at ? (
                  <p className="mt-3 text-xs font-bold text-emerald-800">Completed by {task.completed_by_barista_name}</p>
                ) : canOperate ? (
                  <button
                    type="button"
                    onClick={() => onSelectTask(task)}
                    className="mt-4 w-full rounded-lg bg-[#1F3A34] px-3 py-2 text-sm font-bold text-white hover:bg-[#2E5E58] cursor-pointer"
                  >
                    Mark completed
                  </button>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-slate-500">Pending barista completion</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function MarketingDrinksView({ drinks, usages, isLoading, error, onRefresh }) {
  if (isLoading) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">
        Loading marketing drinks...
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-5">
      <TabErrorBanner message={error} onRetry={onRefresh} />

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F8F6] text-[#1F3A34]">
              <Megaphone size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900">Marketing Drink Catalog</h2>
              <p className="text-xs text-slate-500">Complimentary drinks available for barista recording.</p>
            </div>
          </div>
          {drinks.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No marketing drinks configured.</p>
          ) : (
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {drinks.map((drink) => (
                <div key={drink.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-800">
                  {drink.name}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F8F6] text-[#1F3A34]">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900">Today&apos;s Complimentary Drink Records</h2>
              <p className="text-xs text-slate-500">{usages.length} record{usages.length === 1 ? '' : 's'} logged today.</p>
            </div>
          </div>
          {usages.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No complimentary drinks recorded today.</p>
          ) : (
            <div className="mt-4 space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {usages.map((usage) => (
                <div key={usage.usage_ref || `${usage.posted_at}-${usage.barista_name}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-slate-900">{usage.usage_ref || 'Usage'}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[#2E5E58]">
                      {PURPOSE_LABELS[usage.purpose_code] || usage.purpose_code}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    By {usage.barista_name || 'Barista'} · {formatDateTime(usage.posted_at)}
                    {usage.campaign_name ? ` · ${usage.campaign_name}` : ''}
                  </p>
                  {usage.reason_note && <p className="mt-2 text-xs text-slate-700">{usage.reason_note}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(usage.items || []).map((item, idx) => (
                      <span key={`${item.name}-${idx}`} className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">
                        {item.quantity}x {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

export function BaristaInventoryView({ inventory, isLoading, error, onRefresh }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const items = useMemo(() => inventory?.items || [], [inventory]);
  const categories = useMemo(() => {
    const set = new Set(items.map((item) => String(item.category || '').trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory && String(item.category || '').trim() !== selectedCategory) return false;
      if (!q) return true;
      return String(item.name || '').toLowerCase().includes(q)
        || String(item.category || '').toLowerCase().includes(q)
        || formatUnitLabel(item.unit_code).toLowerCase().includes(q);
    });
  }, [items, searchQuery, selectedCategory]);

  if (isLoading) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">
        Loading outlet inventory...
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      <TabErrorBanner message={error} onRetry={onRefresh} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Barista Inventory {inventory?.store_name ? `· ${inventory.store_name}` : ''}
          </h2>
          <p className="text-xs text-slate-500">Read-only view of outlet stock visible to baristas.</p>
        </div>
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search ingredient, category..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#2E5E58]"
          />
        </label>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer ${
              selectedCategory === null ? 'bg-[#1F3A34] text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            All categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-bold capitalize cursor-pointer ${
                selectedCategory === cat ? 'bg-[#1F3A34] text-white' : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          <Package className="mx-auto mb-2 text-slate-400" size={24} />
          No inventory items found.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const available = Number(item.available_quantity || 0);
            const onHand = Number(item.on_hand_quantity || 0);
            const reserved = Number(item.reserved_quantity || 0);
            const unit = formatUnitLabel(item.unit_code);
            return (
              <article key={item.id} className={`rounded-xl border p-4 shadow-xs ${available <= 0 ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-slate-900">{item.name}</p>
                    <p className="mt-0.5 text-xs capitalize text-slate-500">{item.category || 'ingredient'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${
                    available <= 0 ? 'bg-red-100 text-red-700' : 'bg-[#F0F8F6] text-[#1F3A34]'
                  }`}>
                    {available} {unit}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-2 text-xs text-slate-500">
                  <span>On hand: <strong className="text-slate-700">{onHand} {unit}</strong></span>
                  <span>Reserved: <strong className="text-slate-700">{reserved} {unit}</strong></span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function TimetableAndGuidesView({
  attendance,
  attendanceHistory,
  guides,
  canOperate,
  onAttendanceMode,
  onOpenGuideType,
}) {
  const [historyMode, setHistoryMode] = useState('timetable');
  const activeAttendance = attendance?.active_attendance || [];

  const groupedByDate = useMemo(() => {
    const map = new Map();
    attendanceHistory.forEach((entry) => {
      const key = malaysiaAttendanceDate(entry.clocked_in_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [attendanceHistory]);

  return (
    <section className="mt-6 space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F8F6] text-[#1F3A34]">
              <UsersRound size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900">Shift attendance</h2>
              <p className="text-xs text-slate-500">
                {activeAttendance.length === 0 ? 'No barista clocked in' : `${activeAttendance.length} barista${activeAttendance.length === 1 ? '' : 's'} clocked in`}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {activeAttendance.map((entry) => (
              <p key={entry.id} className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                <span className="font-bold">{entry.barista_name}</span> since {formatDateTime(entry.clocked_in_at)}
              </p>
            ))}
            {activeAttendance.length === 0 && (
              <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
                No barista is currently clocked in.
              </p>
            )}
          </div>
          {canOperate ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onAttendanceMode('in')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F3A34] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] cursor-pointer"
              >
                <LogIn size={16} />
                Clock in
              </button>
              <button
                type="button"
                onClick={() => onAttendanceMode('out')}
                disabled={activeAttendance.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#B54E3D] px-3 py-2.5 text-sm font-bold text-[#B54E3D] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <LogOut size={16} />
                Clock out
              </button>
            </div>
          ) : (
            <p className="mt-4 text-xs font-semibold text-slate-500">Read-only attendance</p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F8F6] text-[#1F3A34]">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900">Staff guides</h2>
              <p className="text-xs text-slate-500">Preparation references visible to baristas</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[['attire', 'Attire guide'], ['rules', 'Store rules'], ['drink', 'Drink SOPs']].map(([type, label]) => {
              const count = guides.filter((guide) => guide.guide_type === type).length;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onOpenGuideType(type)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-bold text-slate-800 hover:border-[#2E5E58] hover:bg-[#F0F8F6] cursor-pointer"
                >
                  <span>{label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{count}</span>
                </button>
              );
            })}
          </div>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F8F6] text-[#1F3A34]">
              <CalendarDays size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900">Attendance timetable &amp; history</h2>
              <p className="text-xs text-slate-500">Clock-in and clock-out records from the last 31 days</p>
            </div>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setHistoryMode('timetable')}
              className={`rounded-lg px-3 py-1 text-xs font-bold cursor-pointer ${
                historyMode === 'timetable' ? 'bg-[#1F3A34] text-white' : 'text-slate-600'
              }`}
            >
              By date
            </button>
            <button
              type="button"
              onClick={() => setHistoryMode('log')}
              className={`rounded-lg px-3 py-1 text-xs font-bold cursor-pointer ${
                historyMode === 'log' ? 'bg-[#1F3A34] text-white' : 'text-slate-600'
              }`}
            >
              Daily log
            </button>
          </div>
        </div>

        {attendanceHistory.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">No attendance records yet.</p>
        ) : historyMode === 'timetable' ? (
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {groupedByDate.map(([dateStr, entries]) => (
              <div key={dateStr} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#2E5E58]">{formatShortDate(dateStr)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entries.map((entry) => (
                    <div key={entry.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
                      <Clock3 size={13} className="text-[#2E5E58]" />
                      <span className="font-bold text-slate-900">{entry.barista_name}</span>
                      <span className="text-slate-500">
                        {formatDateTime(entry.clocked_in_at)} – {entry.clocked_out_at ? formatDateTime(entry.clocked_out_at) : 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
            {attendanceHistory.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{entry.barista_name}</span>
                  <span className="text-xs font-semibold text-slate-500">{formatShortDate(entry.date)}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  In {formatDateTime(entry.clocked_in_at)} · {entry.clocked_out_at ? `Out ${formatDateTime(entry.clocked_out_at)}` : 'Still clocked in'}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
