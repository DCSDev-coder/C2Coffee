import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive, AlertTriangle, Boxes, Download, Link2, PackagePlus, RefreshCw,
  RotateCcw, Save, ShoppingCart, Trash2, Warehouse, Search, ChevronDown,
  ArrowUp, ArrowDown, ArrowUpDown, X
} from 'lucide-react';

import { adminRequest } from '../lib/adminApi';
import { requestAdminConfirm } from '../lib/adminDialog';
import { showAdminError, showAdminSuccess } from '../lib/adminToast';
import { exportToCSV } from '../utils/exportToCSV';
import InfoTooltip from './InfoTooltip';
import InventoryOperations from './InventoryOperations';

const unitLabels = { piece: 'pcs', gram: 'g', millilitre: 'ml' };
const emptyItem = { name: '', code: '', barcode: '', category: 'ingredient', unit_code: 'piece' };
const currentMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit' });
const number = (value) => Number(value || 0);
const formatQuantity = (value) => number(value).toLocaleString('en-MY', { maximumFractionDigits: 3 });

function SectionCard({ children, className = '' }) {
  return <section className={`rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xs ${className}`}>{children}</section>;
}

function KPICard({ title, value, badge, info, icon: Icon, iconBg = "bg-[#1E433A]", iconColor = "text-white" }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-200/80 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-xs`}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
            {info && <InfoTooltip content={info} title={title} />}
          </div>
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight mt-0.5">{value}</p>
        </div>
      </div>
      {badge && (
        <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold bg-[#E8F3F0] text-[#1E433A]">
          {badge}
        </span>
      )}
    </div>
  );
}

function SortableHeader({ label, columnKey, currentKey, direction, onSort, info, className = "" }) {
  const isSorted = currentKey === columnKey;
  return (
    <th className={`px-5 py-3.5 font-bold text-[11px] text-gray-500 uppercase tracking-wider whitespace-nowrap ${className}`}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSort(columnKey)}
          className={`group inline-flex items-center gap-1.5 hover:text-[#1E433A] cursor-pointer focus:outline-none transition-colors select-none ${
            isSorted ? "text-[#1E433A] font-bold" : ""
          }`}
          title={`Sort by ${label} ${isSorted && direction === "asc" ? "(Descending)" : "(Ascending)"}`}
        >
          <span>{label}</span>
          <span className="inline-flex items-center">
            {isSorted ? (
              direction === "asc" ? (
                <ArrowUp size={13} className="text-[#1E433A]" strokeWidth={2.5} />
              ) : (
                <ArrowDown size={13} className="text-[#1E433A]" strokeWidth={2.5} />
              )
            ) : (
              <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            )}
          </span>
        </button>
        {info && <InfoTooltip content={info} title={label} />}
      </div>
    </th>
  );
}

export default function Inventory() {
  const [tab, setTab] = useState('stock');
  const [context, setContext] = useState({ stores: [], menu_items: [] });
  const [storeId, setStoreId] = useState('');
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [report, setReport] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState(emptyItem);
  const [movement, setMovement] = useState({ inventory_item_id: '', supplier_id: '', movement_type: 'purchase', quantity: '', unit_cost_rm: '', reorder_level: '', note: '' });
  const [movementCatalog, setMovementCatalog] = useState({ suppliers: [], supplier_items: [] });
  const [itemStatusFilter, setItemStatusFilter] = useState('active');
  const [stockSearch, setStockSearch] = useState('');
  const [stockSortKey, setStockSortKey] = useState('name');
  const [stockSortDirection, setStockSortDirection] = useState('asc');
  const [reportSortKey, setReportSortKey] = useState('name');
  const [reportSortDirection, setReportSortDirection] = useState('asc');
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [recipeDraft, setRecipeDraft] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeCategory, setRecipeCategory] = useState('all');
  const [openPopup, setOpenPopup] = useState(null);
  const [canViewCosts, setCanViewCosts] = useState(false);

  const selectedStore = context.stores.find((store) => String(store.id) === String(storeId));
  const activeItems = useMemo(() => items.filter((item) => Boolean(item.is_active)), [items]);

  const lowStockCount = useMemo(() => items.filter((item) => number(item.reorder_level) > 0 && number(item.available_quantity) <= number(item.reorder_level)).length, [items]);
  const stockValue = useMemo(() => items.reduce((sum, item) => sum + number(item.on_hand_quantity) * number(item.average_unit_cost_rm), 0), [items]);
  const linkedMenuCount = useMemo(() => context.menu_items.filter((item) => number(item.recipe_component_count) > 0).length, [context.menu_items]);
  const recipeCategories = useMemo(() => [...new Set(context.menu_items.map((item) => item.category_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [context.menu_items]);

  // Filtered & Sorted Stock Balances
  const visibleItems = useMemo(() => {
    let result = items.filter((item) => {
      const matchesStatus = itemStatusFilter === 'all' || (itemStatusFilter === 'active' ? Boolean(item.is_active) : !item.is_active);
      const query = stockSearch.trim().toLowerCase();
      const matchesSearch = !query || `${item.name} ${item.code || ''} ${item.barcode || ''} ${item.category || ''}`.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (stockSortKey) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'on_hand':
          comparison = number(a.on_hand_quantity) - number(b.on_hand_quantity);
          break;
        case 'reserved':
          comparison = number(a.reserved_quantity) - number(b.reserved_quantity);
          break;
        case 'available':
          comparison = number(a.available_quantity) - number(b.available_quantity);
          break;
        case 'linked_recipes':
          comparison = number(a.linked_menu_item_count) - number(b.linked_menu_item_count);
          break;
        default:
          comparison = 0;
      }
      return stockSortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [items, itemStatusFilter, stockSearch, stockSortKey, stockSortDirection]);

  // Filtered & Sorted Monthly Report
  const sortedReport = useMemo(() => {
    const list = [...report];
    list.sort((a, b) => {
      let comparison = 0;
      switch (reportSortKey) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'opening':
          comparison = number(a.opening_stock) - number(b.opening_stock);
          break;
        case 'purchased':
          comparison = number(a.purchased) - number(b.purchased);
          break;
        case 'consumed':
          comparison = number(a.consumed) - number(b.consumed);
          break;
        case 'wasted':
          comparison = number(a.wasted) - number(b.wasted);
          break;
        case 'adjusted':
          comparison = number(a.adjusted) - number(b.adjusted);
          break;
        case 'closing':
          comparison = number(a.closing_stock) - number(b.closing_stock);
          break;
        case 'cost':
          comparison = number(a.purchase_cost_rm) - number(b.purchase_cost_rm);
          break;
        default:
          comparison = 0;
      }
      return reportSortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [report, reportSortKey, reportSortDirection]);

  const filteredMenuItems = useMemo(() => {
    const query = recipeSearch.trim().toLowerCase();
    return context.menu_items.filter((item) => {
      const matchesSearch = !query || `${item.name} ${item.code || ''} ${item.category_name || ''}`.toLowerCase().includes(query);
      const matchesCategory = recipeCategory === 'all' || item.category_name === recipeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [context.menu_items, recipeCategory, recipeSearch]);

  const movementSupplierItems = useMemo(
    () => movementCatalog.supplier_items.filter((row) => String(row.supplier_id) === String(movement.supplier_id)),
    [movementCatalog.supplier_items, movement.supplier_id]
  );
  const movementItems = useMemo(() => {
    if (movement.movement_type !== 'purchase' || !movement.supplier_id) return activeItems;
    const linkedIds = new Set(movementSupplierItems.map((row) => String(row.inventory_item_id)));
    return activeItems.filter((item) => linkedIds.has(String(item.id)));
  }, [activeItems, movement.movement_type, movement.supplier_id, movementSupplierItems]);

  const handleStockSort = (key) => {
    if (stockSortKey === key) {
      setStockSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setStockSortKey(key);
      setStockSortDirection('asc');
    }
  };

  const handleReportSort = (key) => {
    if (reportSortKey === key) {
      setReportSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setReportSortKey(key);
      setReportSortDirection('asc');
    }
  };

  const loadContext = useCallback(async () => {
    const response = await adminRequest('/v1/admin/inventory/context');
    const next = { stores: response.stores || [], menu_items: response.menu_items || [] };
    setContext(next);
    setStoreId((current) => current || String(next.stores.find((store) => store.status === 'active')?.id || next.stores[0]?.id || ''));
    setSelectedMenuItemId((current) => current || String(next.menu_items[0]?.id || ''));
  }, []);

  const loadStock = useCallback(async () => {
    if (!storeId) return;
    const response = await adminRequest(`/v1/admin/inventory?store_id=${encodeURIComponent(storeId)}`);
    setItems(response.items || []);
    setCanViewCosts(Boolean(response.can_view_costs));
  }, [storeId]);

  const loadRecipes = useCallback(async () => {
    const response = await adminRequest('/v1/admin/inventory/recipes');
    setRecipes(response.recipes || []);
  }, []);

  const loadReport = useCallback(async () => {
    if (!storeId || !month) return;
    const response = await adminRequest(`/v1/admin/inventory/report?store_id=${encodeURIComponent(storeId)}&month=${encodeURIComponent(month)}`);
    setReport(response.items || []);
  }, [month, storeId]);

  const loadMovementCatalog = useCallback(async () => {
    if (!storeId) return;
    const response = await adminRequest(`/v1/admin/inventory/operations?store_id=${encodeURIComponent(storeId)}`);
    setMovementCatalog({ suppliers: response.suppliers || [], supplier_items: response.supplier_items || [] });
  }, [storeId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadContext(), loadRecipes()])
      .catch((error) => showAdminError(error.message || 'Inventory setup could not be loaded.'))
      .finally(() => setLoading(false));
  }, [loadContext, loadRecipes]);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    Promise.all([loadStock(), loadReport()])
      .catch((error) => showAdminError(error.message || 'Inventory balances could not be loaded.'))
      .finally(() => setLoading(false));
  }, [loadReport, loadStock, storeId]);

  useEffect(() => {
    if (openPopup !== 'movement') return;
    loadMovementCatalog().catch((error) => showAdminError(error.message || 'Supplier catalogue could not be loaded.'));
  }, [loadMovementCatalog, openPopup]);

  useEffect(() => {
    const components = recipes
      .filter((row) => String(row.menu_item_id) === String(selectedMenuItemId))
      .map((row) => ({ inventory_item_id: String(row.inventory_item_id), quantity_per_menu_item: String(row.quantity_per_menu_item) }));
    setRecipeDraft(components);
  }, [recipes, selectedMenuItemId]);

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadContext(), loadStock(), loadRecipes(), loadReport()]);
    } catch (error) {
      showAdminError(error.message || 'Inventory could not be refreshed.');
    } finally {
      setLoading(false);
    }
  };

  const createItem = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminRequest('/v1/admin/inventory/items', { method: 'POST', body: JSON.stringify(newItem) });
      setNewItem(emptyItem);
      await Promise.all([loadStock(), loadContext()]);
      setOpenPopup(null);
      showAdminSuccess('Inventory item created. Add stock before linking it to live menu items.');
    } catch (error) {
      showAdminError(error.message || 'Inventory item could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const recordMovement = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminRequest('/v1/admin/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({
          ...movement,
          store_id: Number(storeId),
          inventory_item_id: Number(movement.inventory_item_id),
          supplier_id: movement.movement_type === 'purchase' ? Number(movement.supplier_id) : null,
          quantity: Number(movement.quantity),
          unit_cost_rm: movement.movement_type === 'purchase' ? Number(movement.unit_cost_rm || 0) : undefined,
          reorder_level: movement.reorder_level === '' ? undefined : Number(movement.reorder_level),
          adjustment_direction: movement.movement_type === 'adjustment' ? (movement.adjustment_direction || 'increase') : undefined
        })
      });
      setMovement({ inventory_item_id: '', supplier_id: '', movement_type: 'purchase', quantity: '', unit_cost_rm: '', reorder_level: '', note: '' });
      await Promise.all([loadStock(), loadReport()]);
      setOpenPopup(null);
      showAdminSuccess('Stock movement recorded.');
    } catch (error) {
      showAdminError(error.message || 'Stock movement could not be recorded.');
    } finally {
      setSaving(false);
    }
  };

  const toggleItemActive = async (item) => {
    const nextActive = !item.is_active;
    const action = nextActive ? 'reactivate' : 'deactivate';
    const confirmed = await requestAdminConfirm({
      title: `${nextActive ? 'Reactivate' : 'Deactivate'} inventory item?`,
      message: `“${item.name}” ${nextActive ? 'will be available for stock entries and menu recipes again.' : 'will be unavailable for new stock entries and menu recipes. Existing history will be preserved.'}`,
      confirmLabel: nextActive ? 'Reactivate' : 'Deactivate',
      tone: nextActive ? 'warning' : 'danger'
    });
    if (!confirmed) return;
    setSaving(true);
    try {
      await adminRequest(`/v1/admin/inventory/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextActive })
      });
      await Promise.all([loadStock(), loadContext()]);
      showAdminSuccess(`Inventory item ${action}d.`);
    } catch (error) {
      showAdminError(error.message || `Inventory item could not be ${action}d.`);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item) => {
    const confirmed = await requestAdminConfirm({
      title: 'Delete inventory item permanently?',
      message: `Permanently delete “${item.name}”? This cannot be undone, and deletion is allowed only when no related data exists.`,
      confirmLabel: 'Delete permanently',
      tone: 'danger'
    });
    if (!confirmed) return;
    setSaving(true);
    try {
      await adminRequest(`/v1/admin/inventory/items/${item.id}`, { method: 'DELETE' });
      await Promise.all([loadStock(), loadContext()]);
      showAdminSuccess('Inventory item deleted.');
    } catch (error) {
      showAdminError(error.message || 'This item cannot be deleted because it has related data.');
    } finally {
      setSaving(false);
    }
  };

  const addRecipeRow = () => setRecipeDraft((current) => [...current, { inventory_item_id: '', quantity_per_menu_item: '' }]);
  const updateRecipeRow = (index, key, value) => setRecipeDraft((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  const removeRecipeRow = (index) => setRecipeDraft((current) => current.filter((_, rowIndex) => rowIndex !== index));

  const saveRecipe = async () => {
    if (!selectedMenuItemId) return;
    if (recipeDraft.some((row) => !row.inventory_item_id || number(row.quantity_per_menu_item) <= 0)) {
      showAdminError('Choose an inventory item and enter a positive quantity for every recipe component.');
      return;
    }
    setSaving(true);
    try {
      await adminRequest(`/v1/admin/inventory/recipes/${selectedMenuItemId}`, {
        method: 'PUT',
        body: JSON.stringify({
          components: recipeDraft.map((row) => ({
            inventory_item_id: Number(row.inventory_item_id),
            quantity_per_menu_item: Number(row.quantity_per_menu_item)
          }))
        })
      });
      await Promise.all([loadRecipes(), loadContext(), loadStock()]);
      showAdminSuccess('Menu inventory recipe saved.');
    } catch (error) {
      showAdminError(error.message || 'Recipe could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const exportReport = () => {
    exportToCSV([
      ['Item', 'Category', 'Unit', 'Opening', 'Purchased', 'Consumed', 'Waste', 'Adjustments', 'Refund reversals', 'Closing stock', 'Purchase cost (RM)'],
      ...sortedReport.map((row) => [
        row.name,
        row.category,
        unitLabels[row.unit_code] || row.unit_code,
        row.opening_stock,
        row.purchased,
        row.consumed,
        row.wasted,
        row.adjusted,
        row.refund_reversed,
        row.closing_stock,
        row.purchase_cost_rm
      ])
    ], `inventory-${selectedStore?.code || 'outlet'}-${month}.csv`);
  };

  if (loading && !context.stores.length) {
    return <div className="flex min-h-[420px] items-center justify-center text-sm font-semibold text-[#1E433A]">Loading inventory...</div>;
  }

  const tabItems = [
    { id: 'stock', label: 'Stock balances' },
    { id: 'recipes', label: 'Menu recipes' },
    { id: 'operations', label: 'Supply & operations' },
    { id: 'report', label: 'Monthly usage report' }
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#2E5E58]">Stock Control</span>
              <InfoTooltip
                title="Inventory System"
                content="Manage physical ingredient and packaging stock, track store receipts, and link recipes for automated stock deduction on orders."
              />
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-gray-900 tracking-tight">Inventory</h1>
            <p className="mt-1.5 text-xs text-gray-500">Track stock purchases, link recipes to customer orders, and monitor outlet consumption.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-none cursor-pointer"
              >
                {context.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}{store.status !== 'active' ? ' (Archived)' : ''}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronDown size={14} className="text-gray-500" />
              </div>
            </div>
            <button
              type="button"
              onClick={refreshAll}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-[#1E433A]' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {!context.stores.length && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900 shadow-2xs">
            Create an outlet before configuring inventory balances and recipes.
          </div>
        )}

        {/* Operational KPI Summary Cards */}
        <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            title="Active Items"
            value={activeItems.length}
            badge="Catalog"
            info="Total number of active ingredient, packaging, and supply items in inventory."
            icon={Boxes}
            iconBg="bg-[#1E433A]"
          />
          <KPICard
            title="Stock Value"
            value={canViewCosts ? `RM ${stockValue.toFixed(2)}` : 'Restricted'}
            badge="Valuation"
            info="Total estimated inventory value on hand calculated from purchase costs."
            icon={Warehouse}
            iconBg="bg-[#2E5E58]"
          />
          <KPICard
            title="Low Stock Alert"
            value={lowStockCount}
            badge={lowStockCount > 0 ? `${lowStockCount} items` : 'Healthy'}
            info="Items currently at or below their configured reorder alert quantity."
            icon={AlertTriangle}
            iconBg={lowStockCount > 0 ? "bg-amber-600" : "bg-[#2E5E58]"}
          />
          <KPICard
            title="Recipes Linked"
            value={`${linkedMenuCount}/${context.menu_items.length}`}
            badge={`${context.menu_items.length > 0 ? Math.round((linkedMenuCount / context.menu_items.length) * 100) : 0}% Done`}
            info="Active menu items connected to automated inventory recipes."
            icon={Link2}
            iconBg="bg-[#8C6D53]"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200/80 pb-3">
          {tabItems.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                tab === id
                  ? 'bg-[#1E433A] text-white shadow-xs'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* TAB 1: Stock Balances */}
        {tab === 'stock' && (
          <div className="mt-6 space-y-6">
            <SectionCard className="p-0 overflow-hidden">
              {/* Header and Controls */}
              <div className="border-b border-gray-100 p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-gray-900">
                        Current inventory at {selectedStore?.name || 'outlet'}
                      </h2>
                      <InfoTooltip
                        title="Stock Quantities"
                        content="Quantity on hand is total stock in the outlet. Reserved indicates amounts locked for pending orders. Available is what can be used for new sales."
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      View live stock balances, reserved orders, and replenishment alert thresholds.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenPopup('item')}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#1E433A] bg-white px-3.5 py-2 text-xs font-bold text-[#1E433A] shadow-2xs hover:bg-[#E8F1EF] transition-colors cursor-pointer"
                    >
                      <PackagePlus size={15} />
                      <span>Add item</span>
                    </button>
                    {canViewCosts && (
                      <button
                        type="button"
                        onClick={() => setOpenPopup('movement')}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors cursor-pointer"
                      >
                        <ShoppingCart size={15} />
                        <span>Manual stock entry</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative w-full sm:max-w-xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Search size={14} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      placeholder="Search inventory items..."
                      className="block w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-800 placeholder-gray-400 shadow-2xs outline-none focus:border-[#1E433A]"
                    />
                  </div>
                  <div className="relative w-full sm:w-auto">
                    <select
                      aria-label="Filter inventory items by status"
                      value={itemStatusFilter}
                      onChange={(event) => setItemStatusFilter(event.target.value)}
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3.5 pr-8 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-none cursor-pointer"
                    >
                      <option value="active">Active items only</option>
                      <option value="archived">Inactive items</option>
                      <option value="all">All items</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                      <ChevronDown size={13} className="text-gray-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm divide-y divide-gray-100">
                  <thead className="bg-[#FAFBFB] border-b border-gray-100 text-xs">
                    <tr>
                      <SortableHeader
                        label="Inventory item"
                        columnKey="name"
                        currentKey={stockSortKey}
                        direction={stockSortDirection}
                        onSort={handleStockSort}
                      />
                      <SortableHeader
                        label="On hand"
                        columnKey="on_hand"
                        currentKey={stockSortKey}
                        direction={stockSortDirection}
                        onSort={handleStockSort}
                        info="Physical quantity present in this store location."
                      />
                      <SortableHeader
                        label="Reserved"
                        columnKey="reserved"
                        currentKey={stockSortKey}
                        direction={stockSortDirection}
                        onSort={handleStockSort}
                        info="Units allocated to orders in progress that have not been collected yet."
                      />
                      <SortableHeader
                        label="Available"
                        columnKey="available"
                        currentKey={stockSortKey}
                        direction={stockSortDirection}
                        onSort={handleStockSort}
                        info="Quantity on hand minus reserved. This is what can safely be sold."
                      />
                      <SortableHeader
                        label="Recipes using"
                        columnKey="linked_recipes"
                        currentKey={stockSortKey}
                        direction={stockSortDirection}
                        onSort={handleStockSort}
                      />
                      <th className="px-5 py-3.5 text-right font-bold text-[11px] uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {visibleItems.map((item) => {
                      const low = number(item.reorder_level) > 0 && number(item.available_quantity) <= number(item.reorder_level);
                      return (
                        <tr key={item.id} className={`transition-colors hover:bg-gray-50/75 ${!item.is_active ? 'opacity-60 bg-gray-50/40' : ''}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-bold text-gray-900 text-xs">{item.name}</p>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                                  <span className="capitalize">{item.category}</span>
                                  <span>·</span>
                                  <span className="font-medium text-gray-700">{unitLabels[item.unit_code] || item.unit_code}</span>
                                  {item.code && (
                                    <>
                                      <span>·</span>
                                      <span className="font-mono text-gray-400">{item.code}</span>
                                    </>
                                  )}
                                  {!item.is_active && (
                                    <span className="ml-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.2 text-[10px] font-bold text-gray-600">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-gray-800 text-xs">
                            {formatQuantity(item.on_hand_quantity)}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-gray-500 text-xs">
                            {formatQuantity(item.reserved_quantity)}
                          </td>
                          <td className="px-5 py-3.5 text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${low ? 'text-amber-700' : 'text-[#1E433A]'}`}>
                                {formatQuantity(item.available_quantity)}
                              </span>
                              {low && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60">
                                  <AlertTriangle size={10} />
                                  <span>Low</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-gray-700">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]">
                              {item.linked_menu_item_count} {item.linked_menu_item_count === 1 ? 'item' : 'items'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleItemActive(item)}
                                disabled={saving}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                                title={item.is_active ? 'Deactivate item' : 'Reactivate item'}
                              >
                                {item.is_active ? <Archive size={13} className="text-gray-500" /> : <RotateCcw size={13} className="text-emerald-600" />}
                                <span>{item.is_active ? 'Deactivate' : 'Reactivate'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteItem(item)}
                                disabled={saving}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                                title="Delete permanently if no transactions exist"
                              >
                                <Trash2 size={13} className="text-red-500" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!visibleItems.length && (
                      <tr>
                        <td colSpan="6" className="px-5 py-12 text-center text-xs text-gray-500">
                          No inventory items match your filter criteria. Click “Add item” above to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* TAB 2: Menu Recipes */}
        {tab === 'recipes' && (
          <div className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            {/* Left: Menu Item Selector */}
            <SectionCard>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Select Menu Item</h2>
                  <p className="mt-0.5 text-xs text-gray-500">Pick a menu item to review or update its recipe.</p>
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search size={14} className="text-gray-400" />
                  </div>
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-800 placeholder-gray-400 shadow-2xs outline-none focus:border-[#1E433A]"
                    placeholder="Search menu items..."
                    value={recipeSearch}
                    onChange={(event) => setRecipeSearch(event.target.value)}
                  />
                </div>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3.5 pr-8 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-none cursor-pointer"
                    value={recipeCategory}
                    onChange={(event) => setRecipeCategory(event.target.value)}
                  >
                    <option value="all">All menu categories</option>
                    {recipeCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                    <ChevronDown size={13} className="text-gray-500" />
                  </div>
                </div>
              </div>

              <div className="mt-4 max-h-[500px] space-y-1.5 overflow-y-auto pr-1">
                {filteredMenuItems.map((item) => {
                  const isSelected = String(item.id) === String(selectedMenuItemId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedMenuItemId(String(item.id))}
                      className={`w-full rounded-xl px-4 py-3 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1E433A] text-white shadow-xs'
                          : 'border border-gray-200/70 bg-white text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold">{item.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.recipe_component_count || 0} component(s)
                        </span>
                      </div>
                      <p className={`mt-0.5 text-[11px] ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                        {item.category_name}
                      </p>
                    </button>
                  );
                })}
                {!filteredMenuItems.length && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-500">
                    No menu items match this search or category filter.
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Right: Recipe Editor */}
            <SectionCard>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">
                      Recipe for {context.menu_items.find((item) => String(item.id) === String(selectedMenuItemId))?.name || 'Menu Item'}
                    </h2>
                    <InfoTooltip
                      title="Recipe Breakdown"
                      content="Specify how much of each raw inventory item is consumed when 1 portion of this menu item is ordered. Inventory balances will automatically decrement upon order confirmation."
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">Enter quantity required per serving.</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {recipeDraft.map((row, index) => (
                  <div key={`${index}-${row.inventory_item_id}`} className="grid grid-cols-[1fr_140px_38px] gap-2.5 items-center">
                    <select
                      value={row.inventory_item_id}
                      onChange={(event) => updateRecipeRow(index, 'inventory_item_id', event.target.value)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-2xs focus:border-[#1E433A] focus:outline-none"
                    >
                      <option value="">Select ingredient / item</option>
                      {activeItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({unitLabels[item.unit_code] || item.unit_code})
                        </option>
                      ))}
                    </select>
                    <input
                      min="0.001"
                      step="0.001"
                      type="number"
                      placeholder="Qty used"
                      value={row.quantity_per_menu_item}
                      onChange={(event) => updateRecipeRow(index, 'quantity_per_menu_item', event.target.value)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-2xs focus:border-[#1E433A] focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Remove recipe ingredient"
                      onClick={() => removeRecipeRow(index)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 shadow-2xs hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {!recipeDraft.length && (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-500">
                    No recipe linked yet. Orders for this item will not deduct any raw inventory items.
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={addRecipeRow}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  + Add ingredient
                </button>
                <button
                  type="button"
                  onClick={saveRecipe}
                  disabled={saving || !selectedMenuItemId}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Save size={15} />
                  <span>Save recipe</span>
                </button>
              </div>
            </SectionCard>
          </div>
        )}

        {/* TAB 3: Supply & Operations */}
        {tab === 'operations' && (
          <InventoryOperations
            storeId={storeId}
            stores={context.stores}
            items={items}
            onInventoryChanged={refreshAll}
          />
        )}

        {/* TAB 4: Monthly Usage Report */}
        {tab === 'report' && (
          <div className="mt-6">
            <SectionCard className="p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">Monthly Usage Report</h2>
                    <InfoTooltip
                      title="Usage Reconciliation"
                      content="Opening stock + Received - Consumed in orders - Wastage +/- Corrections = Closing stock. Gives an exact operational audit trail."
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Reconciled movement summary for {selectedStore?.name || 'outlet'}.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    aria-label="Report month"
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs outline-none focus:border-[#1E433A]"
                  />
                  <button
                    type="button"
                    onClick={loadReport}
                    className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Generate report
                  </button>
                  <button
                    type="button"
                    onClick={exportReport}
                    disabled={!sortedReport.length}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm divide-y divide-gray-100">
                  <thead className="bg-[#FAFBFB] border-b border-gray-100 text-xs">
                    <tr>
                      <SortableHeader
                        label="Inventory item"
                        columnKey="name"
                        currentKey={reportSortKey}
                        direction={reportSortDirection}
                        onSort={handleReportSort}
                      />
                      <SortableHeader
                        label="Opening"
                        columnKey="opening"
                        currentKey={reportSortKey}
                        direction={reportSortDirection}
                        onSort={handleReportSort}
                      />
                      <SortableHeader
                        label="Received"
                        columnKey="purchased"
                        currentKey={reportSortKey}
                        direction={reportSortDirection}
                        onSort={handleReportSort}
                      />
                      <SortableHeader
                        label="Used in orders"
                        columnKey="consumed"
                        currentKey={reportSortKey}
                        direction={reportSortDirection}
                        onSort={handleReportSort}
                      />
                      <SortableHeader
                        label="Wastage"
                        columnKey="wasted"
                        currentKey={reportSortKey}
                        direction={reportSortDirection}
                        onSort={handleReportSort}
                      />
                      <SortableHeader
                        label="Corrections"
                        columnKey="adjusted"
                        currentKey={reportSortKey}
                        direction={reportSortDirection}
                        onSort={handleReportSort}
                      />
                      <SortableHeader
                        label="Closing stock"
                        columnKey="closing"
                        currentKey={reportSortKey}
                        direction={reportSortDirection}
                        onSort={handleReportSort}
                      />
                      {canViewCosts && (
                        <SortableHeader
                          label="Purchase cost"
                          columnKey="cost"
                          currentKey={reportSortKey}
                          direction={reportSortDirection}
                          onSort={handleReportSort}
                        />
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {sortedReport.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/75 transition-colors">
                        <td className="px-5 py-3.5 text-xs">
                          <p className="font-bold text-gray-900">{row.name}</p>
                          <p className="text-[11px] text-gray-500">{unitLabels[row.unit_code] || row.unit_code}</p>
                        </td>
                        <td className="px-5 py-3.5 text-xs font-medium text-gray-600">{formatQuantity(row.opening_stock)}</td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-emerald-700">+{formatQuantity(row.purchased)}</td>
                        <td className="px-5 py-3.5 text-xs font-medium text-gray-600">{formatQuantity(row.consumed)}</td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-amber-700">{formatQuantity(row.wasted)}</td>
                        <td className="px-5 py-3.5 text-xs font-medium text-gray-600">{formatQuantity(row.adjusted)}</td>
                        <td className="px-5 py-3.5 text-xs font-bold text-[#1E433A]">{formatQuantity(row.closing_stock)}</td>
                        {canViewCosts && <td className="px-5 py-3.5 text-xs font-semibold text-gray-800">RM {number(row.purchase_cost_rm).toFixed(2)}</td>}
                      </tr>
                    ))}
                    {!sortedReport.length && (
                      <tr>
                        <td colSpan={canViewCosts ? 8 : 7} className="px-5 py-12 text-center text-xs text-gray-500">
                          No report data found for {month}. Click “Generate report” above to query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* Full-Screen Backdrop Modal: Add Inventory Item & Add Stock */}
        {openPopup && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-9999 flex items-center justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="mx-auto my-auto w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-4 sm:p-5 bg-white/80 backdrop-blur-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">
                      {openPopup === 'item' ? 'Add Inventory Item' : 'Add Stock Movement'}
                    </h2>
                    <InfoTooltip
                      title={openPopup === 'item' ? 'Inventory Item' : 'Stock Movement'}
                      content={
                        openPopup === 'item'
                          ? 'Tracked raw ingredient, packaging material, or consumable store supply used in recipes and daily operations.'
                          : 'Record new stock received from suppliers, counted count adjustments, or wastage loss.'
                      }
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {openPopup === 'item'
                      ? 'Create a tracked raw ingredient or packaging material.'
                      : 'Record arriving supplies, wastage, or physical stock adjustments.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenPopup(null)}
                  className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form 1: Add Item */}
              {openPopup === 'item' && (
                <form onSubmit={createItem} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Item Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        placeholder="e.g. Fresh Milk, Arabica Coffee Beans"
                        value={newItem.name}
                        onChange={(event) => setNewItem({ ...newItem, name: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Item Code (Optional)
                      </label>
                      <input
                        placeholder="e.g. RAW-MLK-01"
                        value={newItem.code}
                        onChange={(event) => setNewItem({ ...newItem, code: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Barcode (Optional)
                      </label>
                      <input
                        placeholder="Scan or enter the item barcode"
                        value={newItem.barcode}
                        onChange={(event) => setNewItem({ ...newItem, barcode: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <label className="block text-xs font-semibold text-gray-700">Category</label>
                          <InfoTooltip
                            title="Item Category"
                            content="Ingredient is for food & drink materials (e.g. beans, milk). Packaging is for cups & lids. Operating supplies is for cleaning or general store items."
                          />
                        </div>
                        <select
                          value={newItem.category}
                          onChange={(event) => setNewItem({ ...newItem, category: event.target.value })}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-700 shadow-2xs outline-none focus:border-[#1E433A] cursor-pointer"
                        >
                          <option value="ingredient">Ingredient</option>
                          <option value="packaging">Packaging</option>
                          <option value="consumable">Operating supplies</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <label className="block text-xs font-semibold text-gray-700">Stock Unit</label>
                          <InfoTooltip
                            title="Stock Unit"
                            content="The base measurement unit used in recipe deductions. Pieces (pcs) for whole items, Grams (g) for solids, Millilitres (ml) for liquids."
                          />
                        </div>
                        <select
                          value={newItem.unit_code}
                          onChange={(event) => setNewItem({ ...newItem, unit_code: event.target.value })}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-700 shadow-2xs outline-none focus:border-[#1E433A] cursor-pointer"
                        >
                          <option value="piece">Pieces (pcs)</option>
                          <option value="gram">Grams (g)</option>
                          <option value="millilitre">Millilitres (ml)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Pinned Footer */}
                  <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 p-4 sm:p-5 bg-white">
                    <button
                      type="button"
                      onClick={() => setOpenPopup(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Save size={14} />
                      <span>{saving ? 'Saving...' : 'Add Item'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Form 2: Add Stock Movement */}
              {openPopup === 'movement' && (
                <form onSubmit={recordMovement} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-6">
                    <div>
                      {movement.movement_type === 'purchase' && (
                        <div className="mb-4">
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            Supplier <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={movement.supplier_id}
                            onChange={(event) => setMovement({ ...movement, supplier_id: event.target.value, inventory_item_id: '' })}
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A] cursor-pointer"
                          >
                            <option value="">Select supplier first</option>
                            {movementCatalog.suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.name} · {supplier.linked_item_count || 0} linked item(s)
                              </option>
                            ))}
                          </select>
                          <p className="mt-1.5 text-[11px] text-gray-500">
                            Only inventory items linked to this supplier can be received here.
                          </p>
                        </div>
                      )}
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Select Item <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={movement.inventory_item_id}
                        onChange={(event) => setMovement({ ...movement, inventory_item_id: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A] cursor-pointer"
                      >
                        <option value="">Select inventory item</option>
                        {movementItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({unitLabels[item.unit_code] || item.unit_code})
                          </option>
                        ))}
                      </select>
                      {movement.movement_type === 'purchase' && movement.supplier_id && !movementItems.length && (
                        <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                          This supplier has no linked active inventory items. Link the item in Supplier catalogue first.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Movement Type
                      </label>
                      <select
                        value={movement.movement_type}
                        onChange={(event) => setMovement({ ...movement, movement_type: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A] cursor-pointer"
                      >
                        <option value="purchase">Stock received from supplier</option>
                        <option value="waste">Wastage or damage loss</option>
                        <option value="adjustment">Correct physical count</option>
                      </select>
                    </div>

                    {movement.movement_type === 'adjustment' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Adjustment Direction
                        </label>
                        <select
                          value={movement.adjustment_direction || 'increase'}
                          onChange={(event) => setMovement({ ...movement, adjustment_direction: event.target.value })}
                          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs outline-none focus:border-[#1E433A] cursor-pointer"
                        >
                          <option value="increase">Increase counted stock</option>
                          <option value="decrease">Decrease counted stock</option>
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          min="0.001"
                          step="0.001"
                          type="number"
                          placeholder="e.g. 5.000"
                          value={movement.quantity}
                          onChange={(event) => setMovement({ ...movement, quantity: event.target.value })}
                          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                        />
                      </div>
                      {movement.movement_type === 'purchase' && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            Unit Cost (RM)
                          </label>
                          <input
                            min="0"
                            step="0.0001"
                            type="number"
                            placeholder="e.g. 12.50"
                            value={movement.unit_cost_rm}
                            onChange={(event) => setMovement({ ...movement, unit_cost_rm: event.target.value })}
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Reorder Alert Quantity (Optional)</label>
                        <InfoTooltip
                          title="Alert Threshold"
                          content="When available inventory drops to or below this amount, a low-stock alert is flagged on the dashboard."
                        />
                      </div>
                      <input
                        min="0"
                        step="0.001"
                        type="number"
                        placeholder="e.g. 10.000"
                        value={movement.reorder_level}
                        onChange={(event) => setMovement({ ...movement, reorder_level: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Notes or Supplier Reference
                      </label>
                      <input
                        placeholder="e.g. PO-88321 / Delivery invoice"
                        value={movement.note}
                        onChange={(event) => setMovement({ ...movement, note: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#1E433A]"
                      />
                    </div>
                  </div>

                  {/* Pinned Footer */}
                  <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 p-4 sm:p-5 bg-white">
                    <button
                      type="button"
                      onClick={() => setOpenPopup(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !storeId}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2E5E58] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Save size={14} />
                      <span>{saving ? 'Saving...' : 'Save Stock Movement'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
