import React, { useEffect, useState } from 'react';
import { Bell, Check, Menu } from 'lucide-react';
import { adminRequest } from '../lib/adminApi';
import { canAccessAdminPage } from '../lib/adminPermissions';
import UserAvatar from './UserAvatar';

const Header = ({ setCurrentPage, currentPage, currentTenant, currentUser, onOpenMenu }) => {
  const displayName = currentUser?.full_name || currentUser?.username || 'Admin';
  const [alerts, setAlerts] = useState([]);
  const [alertsUnavailable, setAlertsUnavailable] = useState(null);
  const [open, setOpen] = useState(false);
  const canSeeStockAlerts = canAccessAdminPage(currentUser?.roles, 'Supply Needs');

  useEffect(() => {
    if (!canSeeStockAlerts) return undefined;
    let active = true;
    const loadAlerts = () => {
      adminRequest('/v1/admin/inventory/alerts')
        .then((res) => {
          if (active) {
            setAlerts(Array.isArray(res?.alerts) ? res.alerts : []);
            setAlertsUnavailable(false);
          }
        })
        .catch(() => {
          if (active) setAlertsUnavailable(true);
        });
    };
    loadAlerts();
    const timer = window.setInterval(loadAlerts, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [canSeeStockAlerts]);

  const unacknowledgedCount = alerts.filter((a) => !a.admin_acknowledged_at).length;

  const acknowledgeAlert = async (alertId) => {
    try {
      await adminRequest(`/v1/admin/inventory/alerts/${alertId}/acknowledge`, { method: 'POST' });
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, admin_acknowledged_at: new Date().toISOString() } : a)));
    } catch {
      // Ignore transient errors
    }
  };

  return (
    <header className="flex justify-between md:justify-end items-center bg-transparent py-3 md:py-4 px-4 sm:px-6 md:px-8 border-b border-gray-100/60 md:border-b-0" style={{ fontFamily: '"DM Sans", sans-serif' }}>
      {/* Mobile Burger Menu Button */}
      <div className="flex items-center md:hidden">
        <button
          type="button"
          onClick={onOpenMenu}
          className="p-2 -ml-1 rounded-xl text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <Menu size={22} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-6">
        {canSeeStockAlerts && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="relative rounded-xl p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
              aria-label="Stock alerts"
              title="Stock alerts"
            >
              <Bell size={19} />
              {alertsUnavailable === false && unacknowledgedCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unacknowledgedCount > 99 ? '99+' : unacknowledgedCount}
                </span>
              )}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl z-50">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-gray-900">Stock Alerts{alertsUnavailable === false ? ` (${alerts.length})` : ''}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (setCurrentPage) setCurrentPage('Supply Needs');
                    }}
                    className="text-xs font-bold text-[#1E433A] hover:underline cursor-pointer"
                  >
                    View Supply Needs
                  </button>
                </div>
                {alertsUnavailable === null ? (
                  <p className="py-6 text-center text-xs text-gray-500" role="status">Loading stock alerts…</p>
                ) : alertsUnavailable ? (
                  <p className="py-6 text-center text-xs text-amber-700" role="status">Stock alerts are unavailable. Check your connection or contact an administrator.</p>
                ) : alerts.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-500">All inventory levels are healthy.</p>
                ) : (
                  <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {alerts.map((alert) => (
                      <div key={alert.id} className={`rounded-xl border p-2.5 text-xs ${alert.admin_acknowledged_at ? 'border-gray-100 bg-gray-50' : 'border-amber-200 bg-amber-50/50'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate">{alert.item_name}</p>
                            <p className="text-[11px] text-gray-500">{alert.store_name} · Avail {alert.available_quantity} (Alert {alert.reorder_level})</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${alert.alert_level === 'empty' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                            {alert.alert_level}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-gray-500">Barista: {String(alert.barista_action || 'pending').replace(/_/g, ' ')}</span>
                          {!alert.admin_acknowledged_at && (
                            <button
                              type="button"
                              onClick={() => void acknowledgeAlert(alert.id)}
                              className="inline-flex items-center gap-1 font-bold text-[#1E433A] hover:underline cursor-pointer"
                            >
                              <Check size={12} />
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="hidden xl:flex flex-col items-end pr-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-400">Active tenant</p>
          <p className="text-sm font-semibold text-gray-900">{currentTenant?.display_name || 'C2 Coffee & Candle'}</p>
        </div>
        <div
          onClick={() => setCurrentPage && setCurrentPage('Profile')}
          className={`flex items-center space-x-2.5 sm:space-x-3 p-1.5 rounded-xl transition-all cursor-pointer ${
            currentPage === 'Profile'
              ? 'bg-[#2E5E58]/10 ring-1 ring-[#2E5E58]'
              : 'hover:bg-gray-100/80'
          }`}
          title="View Profile"
        >
          <UserAvatar
            user={currentUser}
            name={displayName}
            bgClass="bg-[#1F3A34]"
            size="w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm"
            fallback="A"
          />
          <div className="flex flex-col min-w-0">
            <p className="text-xs sm:text-sm font-bold text-gray-900 leading-tight truncate max-w-[110px] sm:max-w-none">{displayName}</p>
            <p className="hidden sm:block text-xs text-gray-500 leading-tight truncate max-w-[140px]">{currentUser?.email || ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
