import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowRightLeft, ClipboardCheck, PackageCheck, Plus,
  ReceiptText, Save, Trash2, TrendingUp, Truck, X
} from 'lucide-react';

import { adminRequest } from '../lib/adminApi';
import { showAdminError, showAdminSuccess } from '../lib/adminToast';
import InfoTooltip from './InfoTooltip';

const number = (value) => Number(value || 0);
const qty = (value) => number(value).toLocaleString('en-MY', { maximumFractionDigits: 3 });
const money = (value) => `RM ${number(value).toFixed(2)}`;
const unitLabels = { piece: 'pcs', gram: 'g', millilitre: 'ml' };
const localDateTimeValue = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xs ${className}`}>{children}</section>;
}

function Modal({ title, description, onClose, children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="mx-auto my-auto w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-4 sm:p-5 bg-white/80 backdrop-blur-xs">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function SubmitButton({ saving, children }) {
  return (
    <button
      disabled={saving}
      className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors disabled:opacity-50 cursor-pointer"
    >
      <Save size={15} />
      <span>{saving ? 'Saving...' : children}</span>
    </button>
  );
}

function ItemLineEditor({ lines, setLines, items, mode = 'quantity', catalog = [], canViewCosts = false }) {
  const add = () =>
    setLines([
      ...lines,
      {
        inventory_item_id: '',
        quantity: '',
        counted_purchase_units: '0',
        counted_loose_units: '0',
        ordered_purchase_units: '',
      }
    ]);

  const update = (index, field, value) =>
    setLines(lines.map((line, rowIndex) => (rowIndex === index ? { ...line, [field]: value } : line)));

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const catalogItem = catalog.find((row) => String(row.inventory_item_id) === String(line.inventory_item_id));
        return (
        <div key={index} className="rounded-2xl border border-gray-200/80 bg-[#FAFBFB] p-4 space-y-3">
          <div className={`grid gap-3 ${mode === 'stocktake' ? 'sm:grid-cols-[1fr_125px_125px_40px]' : 'sm:grid-cols-[1fr_150px_40px]'}`}>
            <select
              required
              value={line.inventory_item_id}
              onChange={(event) => update(index, 'inventory_item_id', event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
            >
              <option value="">Select inventory item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({unitLabels[item.unit_code] || item.unit_code})
                </option>
              ))}
            </select>
            {mode === 'stocktake' ? (
              <>
                <input
                  required min="0" step="0.001" type="number"
                  aria-label="Full purchase units counted"
                  placeholder={`${catalogItem?.purchase_unit_name || 'Packages'} counted`}
                  value={line.counted_purchase_units}
                  onChange={(event) => update(index, 'counted_purchase_units', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
                <input
                  required min="0" step="0.001" type="number"
                  aria-label="Loose stock units counted"
                  placeholder="Loose units"
                  value={line.counted_loose_units}
                  onChange={(event) => update(index, 'counted_loose_units', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </>
            ) : (
              <input
                required min="0.001" step="0.001" type="number"
                placeholder={mode === 'purchase' ? 'Order quantity' : 'Quantity'}
                value={mode === 'purchase' ? line.ordered_purchase_units : line.quantity}
                onChange={(event) => update(index, mode === 'purchase' ? 'ordered_purchase_units' : 'quantity', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              />
            )}
            <button
              type="button"
              aria-label="Remove line"
              onClick={() => setLines(lines.filter((_, rowIndex) => rowIndex !== index))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 shadow-2xs hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          </div>
          {mode === 'purchase' && catalogItem && (
            <div className="rounded-xl border border-[#CFE0DC] bg-[#F3F8F6] px-3.5 py-2.5 text-[11px] text-gray-600">
              Ordered as <strong>{catalogItem.purchase_unit_name}</strong> · {qty(catalogItem.stock_units_per_purchase_unit)} stock units each · minimum {qty(catalogItem.minimum_order_quantity)}
              {canViewCosts && <> · {money(catalogItem.latest_purchase_unit_cost_rm)} each</>}
            </div>
          )}
          {mode === 'stocktake' && catalogItem && (
            <p className="text-[11px] text-gray-500">
              1 {catalogItem.purchase_unit_name} = {qty(catalogItem.stock_units_per_purchase_unit)} base stock units. Enter full packages and any loose units separately.
            </p>
          )}
        </div>
      )})}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <Plus size={14} />
        <span>Add item line</span>
      </button>
    </div>
  );
}

export default function InventoryOperations({ storeId, stores, items, onInventoryChanged }) {
  const [section, setSection] = useState('supply');
  const [data, setData] = useState({ can_view_costs: false, supply_needs: [], suppliers: [], supplier_items: [], purchase_orders: [], transfers: [], stocktakes: [] });
  const [optionData, setOptionData] = useState({ options: [], recipes: [] });
  const [analytics, setAnalytics] = useState([]);
  const [procurementReport, setProcurementReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [supplier, setSupplier] = useState({ name: '', code: '', contact_name: '', email: '', phone: '', payment_terms: '', default_lead_time_days: '0', notes: '' });
  const [supplierItem, setSupplierItem] = useState({
    supplier_id: '',
    inventory_item_id: '',
    supplier_sku: '',
    supplier_barcode: '',
    purchase_unit_name: 'unit',
    stock_units_per_purchase_unit: '1',
    latest_purchase_unit_cost_rm: '',
    minimum_order_quantity: '1',
    lead_time_days: '',
    is_preferred: true
  });
  const [po, setPo] = useState({ supplier_id: '', expected_at: '', notes: '', lines: [] });
  const [poDetail, setPoDetail] = useState(null);
  const [receipt, setReceipt] = useState({ received_at: '', delivery_order_ref: '', supplier_invoice_ref: '', notes: '', lines: [] });
  const [transfer, setTransfer] = useState({ to_store_id: '', notes: '', lines: [] });
  const [stocktake, setStocktake] = useState({ notes: '', lines: [] });
  const [wastage, setWastage] = useState({ inventory_item_id: '', quantity: '', reason_code: 'expired', note: '' });
  const [supplierReturn, setSupplierReturn] = useState({ supplier_id: '', inventory_item_id: '', quantity: '', reason: '' });
  const [levels, setLevels] = useState({ item_id: '', reorder_level: '', ideal_stock_level: '' });
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [optionRecipe, setOptionRecipe] = useState([]);

  const activeItems = useMemo(() => items.filter((item) => Boolean(item.is_active)), [items]);
  const otherStores = useMemo(() => stores.filter((store) => String(store.id) !== String(storeId) && store.status === 'active'), [storeId, stores]);
  const selectedSupplierCatalog = useMemo(
    () => (data.supplier_items || []).filter((row) => String(row.supplier_id) === String(po.supplier_id)),
    [data.supplier_items, po.supplier_id]
  );
  const selectedSupplierItems = useMemo(
    () => selectedSupplierCatalog.map((catalogItem) => activeItems.find((item) => String(item.id) === String(catalogItem.inventory_item_id))).filter(Boolean),
    [activeItems, selectedSupplierCatalog]
  );
  const stocktakeCatalog = useMemo(() => {
    const preferred = (data.supplier_items || []).filter((row) => Boolean(row.is_preferred));
    const fallback = (data.supplier_items || []).filter((row) => !preferred.some((entry) => String(entry.inventory_item_id) === String(row.inventory_item_id)));
    return [...preferred, ...fallback];
  }, [data.supplier_items]);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [operations, options, procurement] = await Promise.all([
        adminRequest(`/v1/admin/inventory/operations?store_id=${encodeURIComponent(storeId)}`),
        adminRequest('/v1/admin/inventory/option-recipes'),
        adminRequest(`/v1/admin/inventory/procurement-report?store_id=${encodeURIComponent(storeId)}`)
      ]);
      setData(operations);
      setOptionData(options);
      setProcurementReport(procurement.purchase_orders || []);
      if (operations.can_view_costs) {
        const cost = await adminRequest(`/v1/admin/inventory/cost-analytics?store_id=${encodeURIComponent(storeId)}`);
        setAnalytics(cost.items || []);
      } else {
        setAnalytics([]);
      }
      setSelectedOptionId((current) => current || String(options.options?.[0]?.id || ''));
    } catch (error) {
      showAdminError(error.message || 'Inventory operations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setOptionRecipe(
      (optionData.recipes || [])
        .filter((row) => String(row.option_group_option_id) === String(selectedOptionId))
        .map((row) => ({ inventory_item_id: String(row.inventory_item_id), quantity_delta: String(row.quantity_delta) }))
    );
  }, [optionData.recipes, selectedOptionId]);

  const run = async (action, successMessage, refreshStock = false) => {
    setSaving(true);
    try {
      await action();
      setModal(null);
      await load();
      if (refreshStock) await onInventoryChanged?.();
      showAdminSuccess(successMessage);
    } catch (error) {
      showAdminError(error.message || 'The inventory action could not be completed.');
    } finally {
      setSaving(false);
    }
  };

  const createSupplier = (event) => {
    event.preventDefault();
    return run(() => adminRequest('/v1/admin/inventory/suppliers', { method: 'POST', body: JSON.stringify(supplier) }), 'Supplier added.');
  };

  const linkSupplierItem = (event) => {
    event.preventDefault();
    return run(
      () =>
        adminRequest('/v1/admin/inventory/supplier-items', {
          method: 'POST',
          body: JSON.stringify({
            ...supplierItem,
            supplier_id: Number(supplierItem.supplier_id),
            inventory_item_id: Number(supplierItem.inventory_item_id),
            stock_units_per_purchase_unit: Number(supplierItem.stock_units_per_purchase_unit),
            latest_purchase_unit_cost_rm: Number(supplierItem.latest_purchase_unit_cost_rm || 0),
            minimum_order_quantity: Number(supplierItem.minimum_order_quantity || 1),
            lead_time_days: supplierItem.lead_time_days === '' ? null : Number(supplierItem.lead_time_days)
          })
        }),
      'Supplier item saved.'
    );
  };

  const createPo = (event) => {
    event.preventDefault();
    return run(
      () =>
        adminRequest('/v1/admin/inventory/purchase-orders', {
          method: 'POST',
          body: JSON.stringify({
            ...po,
            store_id: Number(storeId),
            supplier_id: Number(po.supplier_id),
            expected_at: po.expected_at || null,
            lines: po.lines.map((line) => ({
              inventory_item_id: Number(line.inventory_item_id),
              ordered_purchase_units: Number(line.ordered_purchase_units)
            }))
          })
        }),
      'Draft purchase order created.'
    );
  };

  const createTransfer = (event) => {
    event.preventDefault();
    return run(
      () =>
        adminRequest('/v1/admin/inventory/transfers', {
          method: 'POST',
          body: JSON.stringify({
            ...transfer,
            from_store_id: Number(storeId),
            to_store_id: Number(transfer.to_store_id),
            lines: transfer.lines.map((line) => ({ inventory_item_id: Number(line.inventory_item_id), quantity: Number(line.quantity) }))
          })
        }),
      'Stock transfer submitted.',
      true
    );
  };

  const createStocktake = (event) => {
    event.preventDefault();
    return run(
      () =>
        adminRequest('/v1/admin/inventory/stocktakes', {
          method: 'POST',
          body: JSON.stringify({
            ...stocktake,
            store_id: Number(storeId),
            lines: stocktake.lines.map((line) => ({
              inventory_item_id: Number(line.inventory_item_id),
              counted_purchase_units: Number(line.counted_purchase_units || 0),
              counted_loose_units: Number(line.counted_loose_units || 0)
            }))
          })
        }),
      'Stock count submitted for approval.'
    );
  };

  const recordWastage = (event) => {
    event.preventDefault();
    return run(
      () =>
        adminRequest('/v1/admin/inventory/wastage', {
          method: 'POST',
          body: JSON.stringify({
            ...wastage,
            store_id: Number(storeId),
            inventory_item_id: Number(wastage.inventory_item_id),
            quantity: Number(wastage.quantity)
          })
        }),
      'Wastage recorded.',
      true
    );
  };

  const recordReturn = (event) => {
    event.preventDefault();
    return run(
      () =>
        adminRequest('/v1/admin/inventory/supplier-returns', {
          method: 'POST',
          body: JSON.stringify({
            ...supplierReturn,
            store_id: Number(storeId),
            supplier_id: Number(supplierReturn.supplier_id),
            inventory_item_id: Number(supplierReturn.inventory_item_id),
            quantity: Number(supplierReturn.quantity)
          })
        }),
      'Supplier return recorded.',
      true
    );
  };

  const saveLevels = (event) => {
    event.preventDefault();
    return run(
      () =>
        adminRequest(`/v1/admin/inventory/items/${levels.item_id}/levels`, {
          method: 'PATCH',
          body: JSON.stringify({
            store_id: Number(storeId),
            reorder_level: Number(levels.reorder_level),
            ideal_stock_level: Number(levels.ideal_stock_level)
          })
        }),
      'Stock alert levels saved.',
      true
    );
  };

  const saveOptionRecipe = () =>
    run(
      () =>
        adminRequest(`/v1/admin/inventory/option-recipes/${selectedOptionId}`, {
          method: 'PUT',
          body: JSON.stringify({
            components: optionRecipe.map((row) => ({
              inventory_item_id: Number(row.inventory_item_id),
              quantity_delta: Number(row.quantity_delta)
            }))
          })
        }),
      'Option inventory recipe saved.'
    );

  const openPurchaseOrder = async (poRow, receiveMode = false) => {
    try {
      const detail = await adminRequest(`/v1/admin/inventory/purchase-orders/${poRow.id}`);
      setPoDetail(detail);
      setReceipt({
        received_at: localDateTimeValue(),
        delivery_order_ref: '',
        supplier_invoice_ref: '',
        notes: '',
        lines: (detail.lines || [])
          .filter((line) => number(line.remaining_purchase_units) > 0)
          .map((line) => ({
            line_id: line.id,
            delivered_purchase_units: String(line.remaining_purchase_units),
            rejected_purchase_units: '0',
            rejection_reason: ''
          }))
      });
      setModal(receiveMode ? 'receivePo' : 'poDetail');
    } catch (error) {
      showAdminError(error.message || 'Purchase order details could not be loaded.');
    }
  };

  const submitReceipt = (event) => {
    event.preventDefault();
    return run(
      () => adminRequest(`/v1/admin/inventory/purchase-orders/${poDetail.purchase_order.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          ...receipt,
          received_at: receipt.received_at || undefined,
          lines: receipt.lines
            .filter((line) => number(line.delivered_purchase_units) > 0)
            .map((line) => ({
              line_id: Number(line.line_id),
              delivered_purchase_units: number(line.delivered_purchase_units),
              rejected_purchase_units: number(line.rejected_purchase_units),
              rejection_reason: line.rejection_reason
            }))
        })
      }),
      'Delivery recorded and accepted stock added to inventory.',
      true
    );
  };

  const cancelPo = (poRow) => run(
    () => adminRequest(`/v1/admin/inventory/purchase-orders/${poRow.id}/cancel`, { method: 'POST' }),
    'Purchase order cancelled.'
  );

  const nav = [
    ['supply', 'Supply needs'],
    ['purchasing', 'Suppliers & orders'],
    ['operations', 'Stock operations'],
    ['options', 'Option recipes'],
    ...(data.can_view_costs ? [['analytics', 'Cost analytics']] : [])
  ];

  if (loading && !data.suppliers.length) {
    return (
      <div className="mt-6 rounded-2xl border border-gray-200/80 bg-white p-10 text-center text-xs font-semibold text-[#1E433A] shadow-2xs">
        Loading inventory operations...
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Sub-Navigation Pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {nav.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSection(value)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              section === value
                ? 'bg-[#1E433A] text-white shadow-xs'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* SECTION 1: Supply Needs */}
      {section === 'supply' && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-gray-100 p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" />
                <h2 className="text-base font-bold text-gray-900">Supply Needs</h2>
                <InfoTooltip
                  title="Replenishment Calculation"
                  content="Items at or below their alert level. Suggested order quantity brings available stock up to the ideal level after taking into account outstanding orders."
                />
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                Actionable low-stock alerts and recommended reorder quantities.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm divide-y divide-gray-100">
                <thead className="bg-[#FAFBFB] text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Item</th>
                    <th className="px-3.5 py-3.5">Available</th>
                    <th className="px-3.5 py-3.5">Alert / Ideal</th>
                    <th className="px-3.5 py-3.5">On Order</th>
                    <th className="px-3.5 py-3.5">Suggested Order</th>
                    <th className="px-3.5 py-3.5">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {(data.supply_needs || []).map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-5 py-3.5 text-xs font-bold text-gray-900">{row.name}</td>
                      <td className="px-3.5 py-3.5 text-xs text-gray-700">
                        {qty(row.available_quantity)} {unitLabels[row.unit_code]}
                      </td>
                      <td className="px-3.5 py-3.5 text-xs text-gray-500">
                        {qty(row.reorder_level)} / {qty(row.ideal_stock_level)}
                      </td>
                      <td className="px-3.5 py-3.5 text-xs text-gray-600">{qty(row.already_ordered_quantity)}</td>
                      <td className="px-3.5 py-3.5 text-xs font-bold text-amber-700">{qty(row.suggested_order_quantity)}</td>
                      <td className="px-3.5 py-3.5 text-xs text-gray-600">{row.preferred_supplier_name || 'Not linked'}</td>
                    </tr>
                  ))}
                  {!data.supply_needs?.length && (
                    <tr>
                      <td colSpan="6" className="px-5 py-10 text-center text-xs text-gray-500">
                        All items are currently above alert levels. No replenishment needed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-[#1E433A]" />
              <h2 className="text-base font-bold text-gray-900">Stock Planning</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Configure minimum alert thresholds and target ideal holding quantities for each item at this store.
            </p>
            <button
              type="button"
              onClick={() => setModal('levels')}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors cursor-pointer"
            >
              <TrendingUp size={15} />
              <span>Configure Stock Levels</span>
            </button>
          </Card>
        </div>
      )}

      {/* SECTION 2: Suppliers & Orders */}
      {section === 'purchasing' && (
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Suppliers */}
          <Card>
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-[#1E433A]" />
                <h2 className="text-base font-bold text-gray-900">Suppliers</h2>
              </div>
              {data.can_view_costs && <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModal('supplier')}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Add supplier
                </button>
                <button
                  type="button"
                  onClick={() => setModal('supplierItem')}
                  className="rounded-xl bg-[#1E433A] px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors cursor-pointer"
                >
                  Link item
                </button>
              </div>}
            </div>
            <div className="mt-4 space-y-2.5">
              {(data.suppliers || []).map((row) => (
                <div key={row.id} className="rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold text-gray-900">{row.name}</p>
                    <span className="rounded-full bg-[#E8F3F0] px-2 py-0.5 text-[10px] font-bold text-[#1E433A]">
                      {row.linked_item_count} item(s)
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {row.phone || row.email || 'No contact details'}{row.default_lead_time_days ? ` · ${row.default_lead_time_days} day lead time` : ''}
                  </p>
                  <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                    {(data.supplier_items || []).filter((entry) => String(entry.supplier_id) === String(row.id)).map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2 text-[11px] text-gray-600">
                        <span>{entry.inventory_item_name}{entry.is_preferred ? ' · Preferred' : ''}</span>
                        <span className="text-right text-gray-400">
                          {entry.purchase_unit_name} × {qty(entry.stock_units_per_purchase_unit)}
                          {data.can_view_costs ? ` · ${money(entry.latest_purchase_unit_cost_rm)}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!data.suppliers?.length && (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">
                  No suppliers added yet. Click “Add supplier” to create one.
                </div>
              )}
            </div>
          </Card>

          {/* Purchase Orders */}
          <Card>
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <ReceiptText size={18} className="text-[#1E433A]" />
                <h2 className="text-base font-bold text-gray-900">Purchase Orders</h2>
              </div>
              <button
                type="button"
                onClick={() => setModal('po')}
                disabled={!data.suppliers?.length}
                className="rounded-xl bg-[#1E433A] px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors disabled:opacity-50 cursor-pointer"
              >
                + New PO
              </button>
            </div>
            <div className="mt-4 space-y-2.5">
              {(data.purchase_orders || []).map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-2xs">
                  <div>
                    <p className="text-xs font-bold text-gray-900">{row.purchase_order_ref}</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {row.supplier_name} · {row.line_count} item(s){data.can_view_costs ? ` · ${money(row.total_rm)}` : ''} · <span className="capitalize">{row.status.replaceAll('_', ' ')}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openPurchaseOrder(row)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 cursor-pointer"
                    >
                      View
                    </button>
                    {row.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => run(() => adminRequest(`/v1/admin/inventory/purchase-orders/${row.id}/submit`, { method: 'POST' }), 'Purchase order submitted.')}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 cursor-pointer"
                      >
                        Submit
                      </button>
                    )}
                    {['submitted', 'partially_received'].includes(row.status) && (
                      <button
                        type="button"
                        onClick={() => openPurchaseOrder(row, true)}
                        className="rounded-xl bg-[#1E433A] px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] cursor-pointer"
                      >
                        Receive delivery
                      </button>
                    )}
                    {['draft', 'submitted'].includes(row.status) && (
                      <button
                        type="button"
                        onClick={() => cancelPo(row)}
                        className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-2xs hover:bg-red-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!data.purchase_orders?.length && (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">
                  No purchase orders created yet.
                </div>
              )}
            </div>
            {!!procurementReport.length && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <h3 className="text-xs font-bold text-gray-900">Recent receiving summary</h3>
                <div className="mt-2 space-y-1.5">
                  {procurementReport.slice(0, 5).map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3 text-[11px] text-gray-500">
                      <span>{row.purchase_order_ref} · {row.supplier_name}</span>
                      <span>{qty(row.accepted_purchase_units)} received · {qty(row.outstanding_purchase_units)} outstanding · {qty(row.rejected_purchase_units)} rejected</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SECTION 3: Stock Operations */}
      {section === 'operations' && (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Transfers */}
          <Card>
            <div className="flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-[#1E433A]" />
              <h2 className="text-base font-bold text-gray-900">Inter-Store Transfers</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Transfer physical inventory between outlets. Source stock is deducted when submitted.
            </p>
            <button
              type="button"
              onClick={() => setModal('transfer')}
              disabled={!otherStores.length}
              className="mt-4 rounded-xl bg-[#1E433A] px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors disabled:opacity-50 cursor-pointer"
            >
              + Create transfer
            </button>
            <div className="mt-4 space-y-2">
              {(data.transfers || []).slice(0, 6).map((row) => (
                <div key={row.id} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs">
                  <p className="font-bold text-gray-900">{row.transfer_ref}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {row.from_store_name} → {row.to_store_name} · <span className="capitalize">{row.status}</span>
                  </p>
                  {row.status === 'submitted' && String(row.to_store_id) === String(storeId) && (
                    <button
                      type="button"
                      onClick={() => run(() => adminRequest(`/v1/admin/inventory/transfers/${row.id}/receive`, { method: 'POST' }), 'Transfer received.', true)}
                      className="mt-2 text-xs font-bold text-[#1E433A] hover:underline cursor-pointer"
                    >
                      Receive transfer →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Stocktake */}
          <Card>
            <div className="flex items-center gap-2">
              <ClipboardCheck size={18} className="text-[#1E433A]" />
              <h2 className="text-base font-bold text-gray-900">Stock Count (Stocktake)</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Conduct periodic physical counts. Balances update only after review and approval.
            </p>
            <button
              type="button"
              onClick={() => setModal('stocktake')}
              className="mt-4 rounded-xl bg-[#1E433A] px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors cursor-pointer"
            >
              + Start stock count
            </button>
            <div className="mt-4 space-y-2">
              {(data.stocktakes || []).slice(0, 6).map((row) => (
                <div key={row.id} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs">
                  <p className="font-bold text-gray-900">{row.stocktake_ref}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {row.line_count} item(s) · Variance {qty(row.absolute_variance)} · <span className="capitalize">{row.status}</span>
                  </p>
                  {row.status === 'submitted' && (
                    <button
                      type="button"
                      onClick={() => run(() => adminRequest(`/v1/admin/inventory/stocktakes/${row.id}/approve`, { method: 'POST' }), 'Stock count approved and balances updated.', true)}
                      className="mt-2 text-xs font-bold text-[#1E433A] hover:underline cursor-pointer"
                    >
                      Approve variance →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Wastage & Returns */}
          <Card>
            <div className="flex items-center gap-2">
              <PackageCheck size={18} className="text-[#1E433A]" />
              <h2 className="text-base font-bold text-gray-900">Wastage & Returns</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Track spoilage, expired stock, quality returns, and supplier refunds separately.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModal('wastage')}
                className="rounded-xl bg-[#1E433A] px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors cursor-pointer"
              >
                Record wastage
              </button>
              <button
                type="button"
                onClick={() => setModal('return')}
                disabled={!data.suppliers?.length}
                className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Return to supplier
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* SECTION 4: Option Recipes */}
      {section === 'options' && (
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-base font-bold text-gray-900">Menu Option Choices</h2>
              <p className="mt-0.5 text-xs text-gray-500">e.g. Oat milk swap, Extra espresso shot, Takeaway cup.</p>
            </div>
            <div className="mt-4 max-h-[500px] space-y-1.5 overflow-y-auto pr-1">
              {(optionData.options || []).map((option) => {
                const isSelected = String(option.id) === String(selectedOptionId);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedOptionId(String(option.id))}
                    className={`w-full rounded-xl px-4 py-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1E433A] text-white shadow-xs'
                        : 'border border-gray-200/70 bg-white text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold">{option.option_name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {option.component_count} item(s)
                      </span>
                    </div>
                    <p className={`mt-0.5 text-[11px] ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                      {option.group_name}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Inventory Deltas for Selected Option</h2>
                <InfoTooltip
                  title="Option Delta Logic"
                  content="Enter positive amounts to deduct extra inventory (e.g. +30ml oat milk). Enter negative amounts to substitute out default base ingredients (e.g. -200ml fresh milk)."
                />
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                Positive values deduct stock; negative values subtract from base recipe consumption.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {optionRecipe.map((row, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-[1fr_160px_38px] items-center">
                  <select
                    value={row.inventory_item_id}
                    onChange={(event) =>
                      setOptionRecipe(optionRecipe.map((entry, rowIndex) => (rowIndex === index ? { ...entry, inventory_item_id: event.target.value } : entry)))
                    }
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                  >
                    <option value="">Select inventory item</option>
                    {activeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Qty delta (+ / -)"
                    value={row.quantity_delta}
                    onChange={(event) =>
                      setOptionRecipe(optionRecipe.map((entry, rowIndex) => (rowIndex === index ? { ...entry, quantity_delta: event.target.value } : entry)))
                    }
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                  />
                  <button
                    type="button"
                    onClick={() => setOptionRecipe(optionRecipe.filter((_, rowIndex) => rowIndex !== index))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 shadow-2xs hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {!optionRecipe.length && (
                <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-500">
                  No stock adjustments for this modifier option.
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setOptionRecipe([...optionRecipe, { inventory_item_id: '', quantity_delta: '' }])}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors cursor-pointer"
              >
                + Add component
              </button>
              <button
                type="button"
                onClick={saveOptionRecipe}
                disabled={!selectedOptionId || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Save size={15} />
                <span>Save option recipe</span>
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* SECTION 5: Cost Analytics */}
      {section === 'analytics' && (
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900">Cost & Stock Valuation</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Weighted average cost, rolling 30-day consumption, and recent purchase cost range.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm divide-y divide-gray-100">
              <thead className="bg-[#FAFBFB] text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Item</th>
                  <th className="px-3.5 py-3.5">On Hand</th>
                  <th className="px-3.5 py-3.5">Avg Unit Cost</th>
                  <th className="px-3.5 py-3.5">Total Value</th>
                  <th className="px-3.5 py-3.5">30-Day Usage</th>
                  <th className="px-3.5 py-3.5">Cost Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {analytics.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-5 py-3.5 text-xs font-bold text-gray-900">{row.name}</td>
                    <td className="px-3.5 py-3.5 text-xs text-gray-700">
                      {qty(row.on_hand_quantity)} {unitLabels[row.unit_code]}
                    </td>
                    <td className="px-3.5 py-3.5 text-xs text-gray-700">{money(row.average_unit_cost_rm)}</td>
                    <td className="px-3.5 py-3.5 text-xs font-bold text-[#1E433A]">{money(row.stock_value_rm)}</td>
                    <td className="px-3.5 py-3.5 text-xs text-gray-600">{qty(row.consumed_last_30_days)}</td>
                    <td className="px-3.5 py-3.5 text-xs text-gray-600">
                      {money(row.lowest_recent_purchase_cost_rm)} – {money(row.highest_recent_purchase_cost_rm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODALS */}
      {modal === 'levels' && (
        <Modal
          title="Configure Stock Alert & Ideal Levels"
          description="Reorder level triggers a dashboard alert. Ideal level represents target restock volume."
          onClose={() => setModal(null)}
        >
          <form onSubmit={saveLevels} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Select Item</label>
              <select
                required
                value={levels.item_id}
                onChange={(event) => {
                  const item = items.find((row) => String(row.id) === event.target.value);
                  setLevels({
                    item_id: event.target.value,
                    reorder_level: item?.reorder_level || '',
                    ideal_stock_level: item?.ideal_stock_level || ''
                  });
                }}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              >
                <option value="">Select item</option>
                {activeItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reorder Alert Quantity</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="e.g. 10.000"
                  value={levels.reorder_level}
                  onChange={(event) => setLevels({ ...levels, reorder_level: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Ideal Stock Quantity</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="e.g. 50.000"
                  value={levels.ideal_stock_level}
                  onChange={(event) => setLevels({ ...levels, ideal_stock_level: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
            </div>
            <div className="flex justify-end pt-3 border-t border-gray-100">
              <SubmitButton saving={saving}>Save Levels</SubmitButton>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'supplier' && (
        <Modal title="Add Supplier" onClose={() => setModal(null)}>
          <form onSubmit={createSupplier} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Supplier Name *</label>
              <input
                required
                placeholder="e.g. Farm Fresh Malaysia"
                value={supplier.name}
                onChange={(event) => setSupplier({ ...supplier, name: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Supplier Code (Optional)</label>
              <input
                placeholder="e.g. SUP-FF"
                value={supplier.code}
                onChange={(event) => setSupplier({ ...supplier, code: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Contact Person</label>
                <input
                  placeholder="e.g. David Lee"
                  value={supplier.contact_name}
                  onChange={(event) => setSupplier({ ...supplier, contact_name: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone</label>
                <input
                  placeholder="e.g. +60123456789"
                  value={supplier.phone}
                  onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                placeholder="e.g. orders@farmfresh.com"
                value={supplier.email}
                onChange={(event) => setSupplier({ ...supplier, email: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Payment Terms</label>
                <input
                  placeholder="e.g. Net 30, COD"
                  value={supplier.payment_terms}
                  onChange={(event) => setSupplier({ ...supplier, payment_terms: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Default Lead Time (Days)</label>
                <input
                  type="number" min="0" max="365"
                  value={supplier.default_lead_time_days}
                  onChange={(event) => setSupplier({ ...supplier, default_lead_time_days: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
            </div>
            <div className="flex justify-end pt-3 border-t border-gray-100">
              <SubmitButton saving={saving}>Add Supplier</SubmitButton>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'supplierItem' && (
        <Modal
          title="Link Item to Supplier"
          description="Define how the supplier packages and prices this inventory item."
          onClose={() => setModal(null)}
        >
          <form onSubmit={linkSupplierItem} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Select Supplier *</label>
              <select
                required
                value={supplierItem.supplier_id}
                onChange={(event) => setSupplierItem({ ...supplierItem, supplier_id: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              >
                <option value="">Select supplier</option>
                {data.suppliers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Select Inventory Item *</label>
              <select
                required
                value={supplierItem.inventory_item_id}
                onChange={(event) => setSupplierItem({ ...supplierItem, inventory_item_id: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              >
                <option value="">Select inventory item</option>
                {activeItems.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Purchase Unit</label>
                <input
                  required
                  placeholder="e.g. carton, bag"
                  value={supplierItem.purchase_unit_name}
                  onChange={(event) => setSupplierItem({ ...supplierItem, purchase_unit_name: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Stock Units per Unit</label>
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="e.g. 12"
                  value={supplierItem.stock_units_per_purchase_unit}
                  onChange={(event) => setSupplierItem({ ...supplierItem, stock_units_per_purchase_unit: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cost per Unit (RM)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="e.g. 84.00"
                  value={supplierItem.latest_purchase_unit_cost_rm}
                  onChange={(event) => setSupplierItem({ ...supplierItem, latest_purchase_unit_cost_rm: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Supplier SKU</label>
                <input
                  placeholder="Supplier's item code"
                  value={supplierItem.supplier_sku}
                  onChange={(event) => setSupplierItem({ ...supplierItem, supplier_sku: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Supplier Barcode</label>
                <input
                  placeholder="Scan or enter barcode"
                  value={supplierItem.supplier_barcode}
                  onChange={(event) => setSupplierItem({ ...supplierItem, supplier_barcode: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Minimum Order Quantity</label>
                <input
                  required type="number" min="0.001" step="0.001"
                  value={supplierItem.minimum_order_quantity}
                  onChange={(event) => setSupplierItem({ ...supplierItem, minimum_order_quantity: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Item Lead Time (Days)</label>
                <input
                  type="number" min="0" max="365" placeholder="Use supplier default"
                  value={supplierItem.lead_time_days}
                  onChange={(event) => setSupplierItem({ ...supplierItem, lead_time_days: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={supplierItem.is_preferred}
                onChange={(event) => setSupplierItem({ ...supplierItem, is_preferred: event.target.checked })}
                className="rounded text-[#1E433A] focus:ring-[#1E433A]"
              />
              Preferred supplier for this item
            </label>
            <div className="flex justify-end pt-3 border-t border-gray-100">
              <SubmitButton saving={saving}>Save Supplier Item</SubmitButton>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'po' && (
        <Modal title="New Purchase Order" description="Quantities are entered in the supplier's purchase units." onClose={() => setModal(null)}>
          <form onSubmit={createPo} className="space-y-4">
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Select Supplier *</label>
                <select
                  required
                  value={po.supplier_id}
                  onChange={(event) => setPo({ ...po, supplier_id: event.target.value, lines: [] })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                >
                  <option value="">Select supplier</option>
                  {data.suppliers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Expected Delivery (Optional)</label>
                <input
                  type="datetime-local"
                  value={po.expected_at}
                  onChange={(event) => setPo({ ...po, expected_at: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
            </div>
            {!po.supplier_id && (
              <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
                Choose a supplier first. Only items linked to that supplier can be ordered.
              </div>
            )}
            {po.supplier_id && !selectedSupplierItems.length && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
                This supplier has no linked inventory items. Close this form and use “Link item” first.
              </div>
            )}
            {po.supplier_id && selectedSupplierItems.length > 0 && (
              <ItemLineEditor
                lines={po.lines}
                setLines={(lines) => setPo({ ...po, lines })}
                items={selectedSupplierItems}
                catalog={selectedSupplierCatalog}
                canViewCosts={data.can_view_costs}
                mode="purchase"
              />
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Order Notes (Optional)</label>
              <textarea
                rows="2"
                value={po.notes}
                onChange={(event) => setPo({ ...po, notes: event.target.value })}
                placeholder="Delivery instructions or supplier reference"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              />
            </div>
            <div className="flex justify-end pt-3 border-t border-gray-100">
              <SubmitButton saving={saving || !po.lines.length}>Create Draft Order</SubmitButton>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'poDetail' && poDetail && (
        <Modal
          title={poDetail.purchase_order.purchase_order_ref}
          description={`${poDetail.purchase_order.supplier_name} · ${String(poDetail.purchase_order.status).replaceAll('_', ' ')}`}
          onClose={() => setModal(null)}
        >
          <div className="space-y-5">
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#FAFBFB] text-[10px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-3 py-3">Ordered</th>
                    <th className="px-3 py-3">Accepted</th>
                    <th className="px-3 py-3">Outstanding</th>
                    {poDetail.can_view_costs && <th className="px-3 py-3">Unit cost</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {poDetail.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 font-bold text-gray-900">{line.inventory_item_name}</td>
                      <td className="px-3 py-3 text-gray-600">{qty(line.ordered_purchase_units)} {line.purchase_unit_name}</td>
                      <td className="px-3 py-3 text-gray-600">{qty(line.received_purchase_units)}</td>
                      <td className="px-3 py-3 font-bold text-amber-700">{qty(line.remaining_purchase_units)}</td>
                      {poDetail.can_view_costs && <td className="px-3 py-3 text-gray-600">{money(line.purchase_unit_cost_rm)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900">Receiving history</h3>
              <div className="mt-2 space-y-2">
                {(poDetail.receipts || []).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-gray-200 bg-[#FAFBFB] p-3 text-[11px] text-gray-600">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-gray-900">{entry.receipt_ref}</strong>
                      <span>{new Date(entry.received_at).toLocaleString('en-MY')}</span>
                    </div>
                    <p className="mt-1">
                      {qty(entry.accepted_purchase_units)} accepted · {qty(entry.rejected_purchase_units)} rejected · by {entry.received_by_name}
                    </p>
                    {(entry.delivery_order_ref || entry.supplier_invoice_ref) && (
                      <p className="mt-1 text-gray-400">DO: {entry.delivery_order_ref || '—'} · Invoice: {entry.supplier_invoice_ref || '—'}</p>
                    )}
                  </div>
                ))}
                {!poDetail.receipts?.length && <p className="text-xs text-gray-500">No deliveries have been recorded.</p>}
              </div>
            </div>
            {['submitted', 'partially_received'].includes(poDetail.purchase_order.status) && (
              <div className="flex justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModal('receivePo')}
                  className="rounded-xl bg-[#1E433A] px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] cursor-pointer"
                >
                  Receive delivery
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {modal === 'receivePo' && poDetail && (
        <Modal
          title={`Receive ${poDetail.purchase_order.purchase_order_ref}`}
          description="Record only what physically arrived. Rejected quantities do not increase available stock."
          onClose={() => setModal(null)}
        >
          <form onSubmit={submitReceipt} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Received At</label>
                <input
                  required type="datetime-local" value={receipt.received_at}
                  onChange={(event) => setReceipt({ ...receipt, received_at: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Delivery Order No.</label>
                <input
                  value={receipt.delivery_order_ref}
                  onChange={(event) => setReceipt({ ...receipt, delivery_order_ref: event.target.value })}
                  placeholder="DO reference"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Supplier Invoice No.</label>
                <input
                  value={receipt.supplier_invoice_ref}
                  onChange={(event) => setReceipt({ ...receipt, supplier_invoice_ref: event.target.value })}
                  placeholder="Invoice reference"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-[#1E433A]"
                />
              </div>
            </div>
            <div className="space-y-3">
              {receipt.lines.map((receiptLine, index) => {
                const orderLine = poDetail.lines.find((line) => String(line.id) === String(receiptLine.line_id));
                const updateReceiptLine = (field, value) => setReceipt({
                  ...receipt,
                  lines: receipt.lines.map((line, rowIndex) => rowIndex === index ? { ...line, [field]: value } : line)
                });
                const accepted = Math.max(0, number(receiptLine.delivered_purchase_units) - number(receiptLine.rejected_purchase_units));
                return (
                  <div key={receiptLine.line_id} className="rounded-2xl border border-gray-200 bg-[#FAFBFB] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-gray-900">{orderLine?.inventory_item_name}</p>
                        <p className="text-[11px] text-gray-500">Outstanding: {qty(orderLine?.remaining_purchase_units)} {orderLine?.purchase_unit_name}</p>
                      </div>
                      <span className="rounded-full bg-[#E8F3F0] px-2.5 py-1 text-[10px] font-bold text-[#1E433A]">{qty(accepted)} accepted</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Delivered quantity</label>
                        <input
                          required type="number" min="0" step="0.001"
                          value={receiptLine.delivered_purchase_units}
                          onChange={(event) => updateReceiptLine('delivered_purchase_units', event.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#1E433A]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Rejected or damaged</label>
                        <input
                          required type="number" min="0" step="0.001"
                          value={receiptLine.rejected_purchase_units}
                          onChange={(event) => updateReceiptLine('rejected_purchase_units', event.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#1E433A]"
                        />
                      </div>
                    </div>
                    {number(receiptLine.rejected_purchase_units) > 0 && (
                      <input
                        required
                        value={receiptLine.rejection_reason}
                        onChange={(event) => updateReceiptLine('rejection_reason', event.target.value)}
                        placeholder="Reason for rejection or damage"
                        className="mt-3 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <textarea
              rows="2" value={receipt.notes}
              onChange={(event) => setReceipt({ ...receipt, notes: event.target.value })}
              placeholder="Receiving notes (optional)"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#1E433A]"
            />
            <div className="flex justify-end border-t border-gray-100 pt-4">
              <SubmitButton saving={saving || !receipt.lines.some((line) => number(line.delivered_purchase_units) > 0)}>Save Receipt & Update Stock</SubmitButton>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'transfer' && (
        <Modal
          title="Create Stock Transfer"
          description="Stock leaves this outlet immediately upon submission, and adds to destination upon receipt."
          onClose={() => setModal(null)}
        >
          <form onSubmit={createTransfer} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Destination Outlet *</label>
              <select
                required
                value={transfer.to_store_id}
                onChange={(event) => setTransfer({ ...transfer, to_store_id: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              >
                <option value="">Select destination outlet</option>
                {otherStores.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <ItemLineEditor lines={transfer.lines} setLines={(lines) => setTransfer({ ...transfer, lines })} items={activeItems} />
            <div className="flex justify-end pt-3 border-t border-gray-100">
              <SubmitButton saving={saving}>Submit Transfer</SubmitButton>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'stocktake' && (
        <Modal
          title="Submit Physical Stock Count"
          description="Balances do not change until approved by a manager or administrator."
          onClose={() => setModal(null)}
        >
          <form onSubmit={createStocktake} className="space-y-4">
            <ItemLineEditor
              lines={stocktake.lines}
              setLines={(lines) => setStocktake({ ...stocktake, lines })}
              items={activeItems}
              catalog={stocktakeCatalog}
              mode="stocktake"
            />
            <div className="flex justify-end pt-3 border-t border-gray-100">
              <SubmitButton saving={saving}>Submit Stock Count</SubmitButton>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'wastage' && (
        <Modal title="Record Wastage or Spoilage" onClose={() => setModal(null)}>
          <form onSubmit={recordWastage} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Select Item *</label>
              <select
                required
                value={wastage.inventory_item_id}
                onChange={(event) => setWastage({ ...wastage, inventory_item_id: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              >
                <option value="">Select inventory item</option>
                {activeItems.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Quantity Lost *</label>
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="e.g. 2.000"
                  value={wastage.quantity}
                  onChange={(event) => setWastage({ ...wastage, quantity: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reason Code</label>
                <select
                  value={wastage.reason_code}
                  onChange={(event) => setWastage({ ...wastage, reason_code: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                >
                  <option value="expired">Expired</option>
                  <option value="damaged">Damaged</option>
                  <option value="spillage">Spillage</option>
                  <option value="quality">Quality issue</option>
                  <option value="staff_use">Staff use</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notes (Optional)</label>
              <input
                placeholder="e.g. Broken packaging during transport"
                value={wastage.note}
                onChange={(event) => setWastage({ ...wastage, note: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              />
            </div>
            <div className="flex justify-end pt-3 border-t border-gray-100">
              <SubmitButton saving={saving}>Record Wastage</SubmitButton>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'return' && (
        <Modal title="Return Stock to Supplier" onClose={() => setModal(null)}>
          <form onSubmit={recordReturn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Select Supplier *</label>
              <select
                required
                value={supplierReturn.supplier_id}
                onChange={(event) => setSupplierReturn({ ...supplierReturn, supplier_id: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              >
                <option value="">Select supplier</option>
                {data.suppliers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Select Item *</label>
              <select
                required
                value={supplierReturn.inventory_item_id}
                onChange={(event) => setSupplierReturn({ ...supplierReturn, inventory_item_id: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              >
                <option value="">Select inventory item</option>
                {activeItems.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Quantity Returned *</label>
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                placeholder="e.g. 5.000"
                value={supplierReturn.quantity}
                onChange={(event) => setSupplierReturn({ ...supplierReturn, quantity: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reason for Return *</label>
              <input
                required
                placeholder="e.g. Near-expiry batch on delivery"
                value={supplierReturn.reason}
                onChange={(event) => setSupplierReturn({ ...supplierReturn, reason: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
              />
            </div>
            <div className="flex justify-end pt-3 border-t border-gray-100">
              <SubmitButton saving={saving}>Record Return</SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
