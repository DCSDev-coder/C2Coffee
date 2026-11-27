import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  Warehouse,
  X,
} from 'lucide-react';

import { adminRequest } from '../lib/adminApi';
import { showAdminError, showAdminSuccess } from '../lib/adminToast';
import { exportReportSections } from '../utils/exportToCSV';
import Inventory from './Inventory';
import StockAvailabilityAlert from './StockAvailabilityAlert';

const unitLabels = { piece: 'pcs', gram: 'g', millilitre: 'ml' };
const fmtQty = (v) => Number(v || 0).toLocaleString('en-MY', { maximumFractionDigits: 3 });

const SECTION_META = {
  supply_needs: { title: 'Supply Needs', subtitle: 'Items at or below warning stock levels across outlets, plus stock alert settings.' },
  stock_value: { title: 'Stock Value', subtitle: 'Inventory valuation by outlet and item. Shortfalls are valued at RM 0.00.' },
  purchase_orders: { title: 'Purchase Orders', subtitle: 'Create, submit, and receive supplier purchase orders.' },
  stock_return: { title: 'Stock Return', subtitle: 'Record and review stock returned to suppliers.' },
  stock_take: { title: 'Stock Take', subtitle: 'Count physical stock and reconcile variances.' },
  stock_loss_report: { title: 'Stock Loss Report', subtitle: 'Combined wastage records and negative stocktake variances.' },
  stock_transfer: { title: 'Stock Transfer', subtitle: 'Transfer inventory between outlets.' },
  audit_trail: { title: 'Audit Trail', subtitle: 'Chronological ledger of all stock movements and staff actions.' },
  wastage_record: { title: 'Wastage Record', subtitle: 'Log and review expired, damaged, or spilled inventory.' },
  suppliers: { title: 'Suppliers', subtitle: 'Manage suppliers, purchase units, and cost history.' },
};

function StockAlertsModal({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [adminWebEnabled, setAdminWebEnabled] = useState(true);
  const [baristaPopupEnabled, setBaristaPopupEnabled] = useState(true);
  const [recipientsText, setRecipientsText] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    adminRequest('/v1/admin/inventory/alert-settings')
      .then((res) => {
        setEmailEnabled(Boolean(res.email_enabled));
        setAdminWebEnabled(Boolean(res.admin_web_enabled));
        setBaristaPopupEnabled(Boolean(res.barista_popup_enabled));
        setRecipientsText((res.email_recipients || []).join(', '));
      })
      .catch((err) => showAdminError(err.message || 'Could not load stock alert settings.'))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const handleSave = async (event) => {
    event.preventDefault();
    const recipients = recipientsText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      setSaving(true);
      await adminRequest('/v1/admin/inventory/alert-settings', {
        method: 'PUT',
        body: JSON.stringify({
          email_enabled: emailEnabled,
          email_recipients: recipients,
          admin_web_enabled: adminWebEnabled,
          barista_popup_enabled: baristaPopupEnabled,
        }),
      });
      showAdminSuccess('Stock alert settings saved.');
      onClose();
    } catch (err) {
      showAdminError(err.message || 'Could not save stock alert settings.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <form onSubmit={handleSave} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Bell size={18} className="text-[#1E433A]" />
            <h2 className="text-lg font-bold text-gray-900">Stock Alert Settings</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-xs font-semibold text-gray-500">Loading settings...</p>
        ) : (
          <div className="mt-4 space-y-4 text-xs">
            <label className="flex items-center justify-between rounded-xl border border-gray-200 p-3 cursor-pointer">
              <div>
                <p className="font-bold text-gray-900">Email digest alerts</p>
                <p className="text-gray-500">Send one email per outlet when items hit low or empty levels.</p>
              </div>
              <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} className="h-4 w-4 accent-[#1E433A]" />
            </label>

            <div>
              <label className="block font-bold text-gray-700 mb-1.5">Alert email recipients (comma-separated)</label>
              <textarea
                rows={3}
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                placeholder="ops@c2coffee.com, manager@c2coffee.com"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#1E433A]"
              />
            </div>

            <label className="flex items-center justify-between rounded-xl border border-gray-200 p-3 cursor-pointer">
              <div>
                <p className="font-bold text-gray-900">Admin Web notification bell</p>
                <p className="text-gray-500">Surface open low/empty stock alerts in the Admin Web header.</p>
              </div>
              <input type="checkbox" checked={adminWebEnabled} onChange={(e) => setAdminWebEnabled(e.target.checked)} className="h-4 w-4 accent-[#1E433A]" />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-gray-200 p-3 cursor-pointer">
              <div>
                <p className="font-bold text-gray-900">Barista counter popup</p>
                <p className="text-gray-500">Prompt baristas to confirm out-of-stock toggles (never auto-disables).</p>
              </div>
              <input type="checkbox" checked={baristaPopupEnabled} onChange={(e) => setBaristaPopupEnabled(e.target.checked)} className="h-4 w-4 accent-[#1E433A]" />
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={loading || saving} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E433A] px-4 py-2 text-xs font-bold text-white hover:bg-[#2E5E58] disabled:opacity-50 cursor-pointer">
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function CsvImportModal({ open, stores, onClose, onImported }) {
  const [storeId, setStoreId] = useState('');
  const [csvText, setCsvText] = useState('name,code,barcode,category,unit_code,reorder_level,ideal_stock_level\n');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && stores.length > 0 && !storeId) {
      setStoreId(String(stores[0].id));
    }
  }, [open, stores, storeId]);

  if (!open || typeof document === 'undefined') return null;

  const parseCsvRows = () => {
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
      return {
        name: obj.name || '',
        code: obj.code || '',
        barcode: obj.barcode || '',
        category: obj.category || 'ingredient',
        unit_code: ['piece', 'gram', 'millilitre'].includes(obj.unit_code) ? obj.unit_code : 'piece',
        reorder_level: obj.reorder_level !== '' && obj.reorder_level != null ? Number(obj.reorder_level) : undefined,
        ideal_stock_level: obj.ideal_stock_level !== '' && obj.ideal_stock_level != null ? Number(obj.ideal_stock_level) : undefined,
      };
    }).filter((r) => r.name);
  };

  const runImport = async (dryRun) => {
    const headers = csvText.split(/\r?\n/, 1)[0].split(',').map((header) => header.trim().toLowerCase());
    if (headers.some((header) => ['on_hand_quantity', 'stock_quantity', 'quantity'].includes(header))) {
      showAdminError('Stock quantities cannot be imported. Use Stock Take to update them.');
      return;
    }
    const rows = parseCsvRows();
    if (!rows.length || !storeId) {
      showAdminError('Select an outlet and provide at least one CSV data row.');
      return;
    }
    try {
      setBusy(true);
      const res = await adminRequest('/v1/admin/inventory/import-csv', {
        method: 'POST',
        body: JSON.stringify({ store_id: Number(storeId), dry_run: dryRun, rows }),
      });
      if (dryRun) {
        setPreview(res);
      } else {
        showAdminSuccess(`Imported ${res.processed} inventory rows.`);
        setPreview(null);
        onImported();
        onClose();
      }
    } catch (err) {
      showAdminError(err.message || 'CSV import failed.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} className="text-[#1E433A]" />
            <h2 className="text-lg font-bold text-gray-900">Import Inventory CSV</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 cursor-pointer"><X size={18} /></button>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Updates or creates inventory items and alert thresholds. Stock quantities are not imported; use Stock Take to update them. Never deletes rows or modifies Menu / Options &amp; Nutrition.
        </p>
        <div className="mt-4 space-y-3 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Target Outlet</label>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2">
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">CSV Data</label>
            <textarea rows={6} value={csvText} onChange={(e) => { setCsvText(e.target.value); setPreview(null); }} className="w-full rounded-xl border border-gray-200 p-3 font-mono text-[11px]" />
          </div>
          {preview && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
              Preview ready: <strong>{preview.summary?.create || 0}</strong> new item(s), <strong>{preview.summary?.update || 0}</strong> existing item(s) to update.
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => runImport(true)} disabled={busy} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
            Preview (Dry Run)
          </button>
          <button type="button" onClick={() => runImport(false)} disabled={busy || !preview} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E433A] px-4 py-2 text-xs font-bold text-white hover:bg-[#2E5E58] disabled:opacity-50 cursor-pointer">
            <Upload size={14} />
            Commit Import
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function StorehubStockPage({ section, onNavigate }) {
  // For sections powered directly by the existing tested Inventory/Operations flows,
  // delegate to Inventory with the matching tab/section pre-selected.
  if (section === 'purchase_orders' || section === 'stock_take' || section === 'stock_transfer' || section === 'suppliers') {
    const forcedSection = section === 'purchase_orders' || section === 'suppliers' ? 'purchasing' : 'operations';
    return <Inventory initialTab="operations" forcedSection={forcedSection} pageTitle={SECTION_META[section]?.title} pageSubtitle={SECTION_META[section]?.subtitle} />;
  }

  return <StorehubDedicatedView section={section} onNavigate={onNavigate} />;
}

function StorehubDedicatedView({ section, onNavigate }) {
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const meta = SECTION_META[section] || { title: 'Stock Management', subtitle: '' };

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const ctx = await adminRequest('/v1/admin/inventory/context');
      setStores(ctx.stores || []);

      const qStore = encodeURIComponent(storeId || 'all');
      if (section === 'supply_needs') {
        setData(await adminRequest(`/v1/admin/inventory/supply-needs?store_id=${qStore}`));
      } else if (section === 'stock_value') {
        setData(await adminRequest(`/v1/admin/inventory/stock-value?store_id=${qStore}`));
      } else if (section === 'stock_loss_report') {
        setData(await adminRequest(`/v1/admin/inventory/stock-loss-report?store_id=${qStore}`));
      } else if (section === 'stock_return') {
        setData(await adminRequest(`/v1/admin/inventory/supplier-returns?store_id=${qStore}`));
      } else if (section === 'wastage_record') {
        setData(await adminRequest(`/v1/admin/inventory/wastage?store_id=${qStore}`));
      } else if (section === 'audit_trail') {
        setData(await adminRequest(`/v1/admin/inventory/audit-trail?store_id=${qStore}&search=${encodeURIComponent(search)}`));
      }
    } catch (err) {
      setLoadFailed(true);
      showAdminError(err.message || `Could not load ${meta.title}.`);
    } finally {
      setLoading(false);
    }
  }, [section, storeId, search, meta.title]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const q = search.trim().toLowerCase();

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 empty:hidden"><StockAvailabilityAlert /></div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2E5E58]">Stock Management</p>
            <h1 className="mt-1 text-3xl font-extrabold text-gray-900 tracking-tight">{meta.title}</h1>
            <p className="mt-1 text-xs text-gray-500">{meta.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {section === 'supply_needs' && (
              <>
                <button
                  type="button"
                  onClick={() => setCsvModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <Upload size={14} />
                  Import CSV
                </button>
                <button
                  type="button"
                  onClick={() => setAlertsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#8ABFB4] bg-[#F0F8F6] px-3.5 py-2.5 text-xs font-bold text-[#1E433A] hover:bg-[#E2F2EE] cursor-pointer"
                >
                  <Bell size={14} />
                  Enable Stock Alerts
                </button>
              </>
            )}
            <div className="relative">
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="appearance-none pl-4 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 cursor-pointer"
              >
                <option value="all">All Stores</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="relative w-full sm:w-80">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item, outlet, or note..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-800 outline-none focus:border-[#1E433A]"
            />
          </label>
          {section === 'stock_value' && data?.can_view_costs && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-800">
              <Warehouse size={15} className="text-[#1E433A]" />
              Total Stock Value: <span className="text-[#1E433A]">RM {Number(data.total_value_rm || 0).toFixed(2)}</span>
            </div>
          )}
          {section === 'stock_value' && data?.items?.length > 0 && (
            <button
              type="button"
              onClick={() => exportReportSections([{
                title: 'Stock Value',
                headers: ['Outlet', 'Item', 'Category', 'On Hand', 'Available', 'Unit', 'Value (RM)'],
                rows: data.items.map((r) => [r.store_name, r.name, r.category, r.on_hand_quantity, r.available_quantity, unitLabels[r.unit_code] || r.unit_code, r.stock_value_rm ?? 'Restricted']),
              }], 'stock-value.csv')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              <Download size={14} />
              Export CSV
            </button>
          )}
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
          {loading ? (
            <div className="p-12 text-center text-xs font-semibold text-gray-500">Loading {meta.title.toLowerCase()}...</div>
          ) : loadFailed ? (
            <div role="alert" className="p-12 text-center text-xs font-semibold text-red-700">Could not load {meta.title.toLowerCase()}. Please try Refresh.</div>
          ) : section === 'supply_needs' ? (
            (() => {
              const rows = (data?.items || []).filter((r) => !q || `${r.name} ${r.store_name} ${r.category}`.toLowerCase().includes(q));
              if (!rows.length) {
                return (
                  <div className="p-12 text-center">
                    <Boxes className="mx-auto mb-3 text-gray-300" size={36} />
                    <p className="text-sm font-bold text-gray-700">No supply needs found</p>
                    <p className="mt-1 text-xs text-gray-500">Configure warning stock levels for your items or switch outlets.</p>
                  </div>
                );
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Outlet</th>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Available</th>
                        <th className="px-4 py-3">Warning Level</th>
                        <th className="px-4 py-3">Suggested Order</th>
                        <th className="px-4 py-3">Preferred Supplier</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => {
                        const unit = unitLabels[r.unit_code] || r.unit_code;
                        const isEmpty = Number(r.available_quantity) <= 0;
                        return (
                          <tr key={`${r.store_id}-${r.inventory_item_id}`} className="hover:bg-gray-50/60">
                            <td className="px-4 py-3 font-semibold text-gray-700">{r.store_name}</td>
                            <td className="px-4 py-3 font-bold text-gray-900">{r.name}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-0.5 font-bold ${isEmpty ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                                {fmtQty(r.available_quantity)} {unit}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{fmtQty(r.reorder_level)} {unit}</td>
                            <td className="px-4 py-3 font-bold text-[#1E433A]">{fmtQty(r.suggested_order_quantity)} {unit}</td>
                            <td className="px-4 py-3 text-gray-600">{r.preferred_supplier_name || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              {onNavigate && (
                                <button type="button" onClick={() => onNavigate('Purchase Orders')} className="rounded-lg border border-gray-200 px-2.5 py-1 font-bold text-[#1E433A] hover:bg-gray-100 cursor-pointer">
                                  Create PO
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()
          ) : section === 'stock_value' ? (
            (() => {
              const rows = (data?.items || []).filter((r) => !q || `${r.name} ${r.store_name} ${r.category}`.toLowerCase().includes(q));
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Outlet</th>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">On Hand</th>
                        <th className="px-4 py-3">Reserved</th>
                        <th className="px-4 py-3">Available</th>
                        {data?.can_view_costs && <th className="px-4 py-3">Avg Unit Cost</th>}
                        {data?.can_view_costs && <th className="px-4 py-3">Stock Value</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => {
                        const unit = unitLabels[r.unit_code] || r.unit_code;
                        return (
                          <tr key={`${r.store_id}-${r.inventory_item_id}`} className="hover:bg-gray-50/60">
                            <td className="px-4 py-3 font-semibold text-gray-700">{r.store_name}</td>
                            <td className="px-4 py-3 font-bold text-gray-900">
                              {r.name}
                              {Boolean(r.is_shortfall) && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Shortfall</span>}
                            </td>
                            <td className="px-4 py-3">{fmtQty(r.on_hand_quantity)} {unit}</td>
                            <td className="px-4 py-3 text-gray-500">{fmtQty(r.reserved_quantity)} {unit}</td>
                            <td className="px-4 py-3 font-bold">{fmtQty(r.available_quantity)} {unit}</td>
                            {data?.can_view_costs && <td className="px-4 py-3">RM {Number(r.average_unit_cost_rm || 0).toFixed(4)}</td>}
                            {data?.can_view_costs && <td className="px-4 py-3 font-bold text-[#1E433A]">RM {Number(r.stock_value_rm || 0).toFixed(2)}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()
          ) : section === 'stock_return' ? (
            (() => {
              const rows = (data?.returns || []).filter((r) => !q || `${r.item_name} ${r.supplier_name} ${r.return_ref} ${r.reason}`.toLowerCase().includes(q));
              if (!rows.length) return <div className="p-12 text-center text-xs text-gray-500"><RotateCcw className="mx-auto mb-2 text-gray-300" size={28} />No supplier stock returns recorded.</div>;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Ref</th>
                        <th className="px-4 py-3">Outlet</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3 font-bold text-gray-900">{r.return_ref}</td>
                          <td className="px-4 py-3">{r.store_name}</td>
                          <td className="px-4 py-3">{r.supplier_name}</td>
                          <td className="px-4 py-3 font-semibold">{r.item_name}</td>
                          <td className="px-4 py-3">{fmtQty(r.quantity)} {unitLabels[r.unit_code] || r.unit_code}</td>
                          <td className="px-4 py-3 text-gray-600">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()
          ) : section === 'stock_loss_report' ? (
            (() => {
              const rows = (data?.entries || []).filter((r) => !q || `${r.item_name} ${r.store_name} ${r.reason} ${r.note || ''}`.toLowerCase().includes(q));
              if (!rows.length) return <div className="p-12 text-center text-xs text-gray-500"><AlertTriangle className="mx-auto mb-2 text-gray-300" size={28} />No stock losses recorded.</div>;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Outlet</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Quantity Lost</th>
                        <th className="px-4 py-3">Reason / Ref</th>
                        {data?.can_view_costs && <th className="px-4 py-3">Cost Impact</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, idx) => (
                        <tr key={`${r.loss_source}-${r.id}-${idx}`}>
                          <td className="px-4 py-3">{r.store_name}</td>
                          <td className="px-4 py-3 capitalize font-semibold">{String(r.loss_source).replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">{r.item_name}</td>
                          <td className="px-4 py-3 text-red-700 font-bold">-{fmtQty(r.quantity)} {unitLabels[r.unit_code] || r.unit_code}</td>
                          <td className="px-4 py-3 text-gray-600">{r.reason}{r.note ? ` · ${r.note}` : ''}</td>
                          {data?.can_view_costs && <td className="px-4 py-3 font-bold">RM {Number(r.cost_rm || 0).toFixed(2)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()
          ) : section === 'wastage_record' ? (
            (() => {
              const rows = (data?.records || []).filter((r) => !q || `${r.item_name} ${r.store_name} ${r.reason_code} ${r.note || ''}`.toLowerCase().includes(q));
              if (!rows.length) return <div className="p-12 text-center text-xs text-gray-500"><Trash2 className="mx-auto mb-2 text-gray-300" size={28} />No wastage records found.</div>;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Outlet</th>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Note</th>
                        {data?.can_view_costs && <th className="px-4 py-3">Cost</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3">{r.store_name}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">{r.item_name}</td>
                          <td className="px-4 py-3 text-red-700 font-bold">-{fmtQty(r.quantity)} {unitLabels[r.unit_code] || r.unit_code}</td>
                          <td className="px-4 py-3 capitalize">{String(r.reason_code).replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-gray-600">{r.note || '—'}</td>
                          {data?.can_view_costs && <td className="px-4 py-3 font-bold">RM {Number(r.cost_rm || 0).toFixed(2)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()
          ) : (
            (() => {
              const rows = data?.movements || [];
              if (!rows.length) return <div className="p-12 text-center text-xs text-gray-500"><ClipboardList className="mx-auto mb-2 text-gray-300" size={28} />No movements found.</div>;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Outlet</th>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Change</th>
                        <th className="px-4 py-3">Balance After</th>
                        <th className="px-4 py-3">Actor</th>
                        <th className="px-4 py-3">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => {
                        const unit = unitLabels[r.unit_code] || r.unit_code;
                        const delta = Number(r.quantity_change || 0);
                        return (
                          <tr key={r.id}>
                            <td className="px-4 py-3">{r.store_name}</td>
                            <td className="px-4 py-3 font-bold text-gray-900">{r.item_name}</td>
                            <td className="px-4 py-3 capitalize">{String(r.movement_type).replace(/_/g, ' ')}</td>
                            <td className={`px-4 py-3 font-bold ${delta < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{delta > 0 ? `+${fmtQty(delta)}` : fmtQty(delta)} {unit}</td>
                            <td className="px-4 py-3 font-semibold">{fmtQty(r.balance_after)} {unit}</td>
                            <td className="px-4 py-3 text-gray-600">{r.actor_name || 'System'}</td>
                            <td className="px-4 py-3 text-gray-500">{r.note || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()
          )}
        </section>
      </div>

      <StockAlertsModal open={alertsModalOpen} onClose={() => setAlertsModalOpen(false)} />
      <CsvImportModal open={csvModalOpen} stores={stores} onClose={() => setCsvModalOpen(false)} onImported={() => void loadData()} />
    </div>
  );
}
