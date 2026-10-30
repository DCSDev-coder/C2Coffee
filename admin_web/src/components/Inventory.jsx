import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive, AlertTriangle, Boxes, Download, Link2, PackagePlus, RefreshCw,
  RotateCcw, Save, ShoppingCart, Trash2, Warehouse
} from 'lucide-react';

import { adminRequest } from '../lib/adminApi';
import { requestAdminConfirm } from '../lib/adminDialog';
import { showAdminError, showAdminSuccess } from '../lib/adminToast';
import { exportToCSV } from '../utils/exportToCSV';

const unitLabels = { piece: 'pcs', gram: 'g', millilitre: 'ml' };
const emptyItem = { name: '', code: '', category: 'ingredient', unit_code: 'piece' };
const currentMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit' });
const number = (value) => Number(value || 0);
const formatQuantity = (value) => number(value).toLocaleString('en-MY', { maximumFractionDigits: 3 });

function SectionCard({ children, className = '' }) {
  return <section className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
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
  const [movement, setMovement] = useState({ inventory_item_id: '', movement_type: 'purchase', quantity: '', unit_cost_rm: '', reorder_level: '', note: '' });
  const [itemStatusFilter, setItemStatusFilter] = useState('active');
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [recipeDraft, setRecipeDraft] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeCategory, setRecipeCategory] = useState('all');

  const selectedStore = context.stores.find((store) => String(store.id) === String(storeId));
  const activeItems = useMemo(() => items.filter((item) => Boolean(item.is_active)), [items]);
  const visibleItems = useMemo(() => items.filter((item) => itemStatusFilter === 'all' || (itemStatusFilter === 'active' ? Boolean(item.is_active) : !item.is_active)), [items, itemStatusFilter]);
  const lowStockCount = useMemo(() => items.filter((item) => number(item.reorder_level) > 0 && number(item.available_quantity) <= number(item.reorder_level)).length, [items]);
  const stockValue = useMemo(() => items.reduce((sum, item) => sum + number(item.on_hand_quantity) * number(item.average_unit_cost_rm), 0), [items]);
  const linkedMenuCount = useMemo(() => context.menu_items.filter((item) => number(item.recipe_component_count) > 0).length, [context.menu_items]);
  const recipeCategories = useMemo(() => [...new Set(context.menu_items.map((item) => item.category_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [context.menu_items]);
  const filteredMenuItems = useMemo(() => {
    const query = recipeSearch.trim().toLowerCase();
    return context.menu_items.filter((item) => {
      const matchesSearch = !query || `${item.name} ${item.code || ''} ${item.category_name || ''}`.toLowerCase().includes(query);
      const matchesCategory = recipeCategory === 'all' || item.category_name === recipeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [context.menu_items, recipeCategory, recipeSearch]);

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
    event.preventDefault(); setSaving(true);
    try {
      await adminRequest('/v1/admin/inventory/items', { method: 'POST', body: JSON.stringify(newItem) });
      setNewItem(emptyItem); await Promise.all([loadStock(), loadContext()]); showAdminSuccess('Inventory item created. Add stock before linking it to live menu items.');
    } catch (error) { showAdminError(error.message || 'Inventory item could not be created.'); }
    finally { setSaving(false); }
  };

  const recordMovement = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      await adminRequest('/v1/admin/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({
          ...movement,
          store_id: Number(storeId),
          inventory_item_id: Number(movement.inventory_item_id),
          quantity: Number(movement.quantity),
          unit_cost_rm: movement.movement_type === 'purchase' ? Number(movement.unit_cost_rm || 0) : undefined,
          reorder_level: movement.reorder_level === '' ? undefined : Number(movement.reorder_level),
          adjustment_direction: movement.movement_type === 'adjustment' ? (movement.adjustment_direction || 'increase') : undefined
        })
      });
      setMovement({ inventory_item_id: '', movement_type: 'purchase', quantity: '', unit_cost_rm: '', reorder_level: '', note: '' });
      await Promise.all([loadStock(), loadReport()]); showAdminSuccess('Stock movement recorded.');
    } catch (error) { showAdminError(error.message || 'Stock movement could not be recorded.'); }
    finally { setSaving(false); }
  };

  const toggleItemActive = async (item) => {
    const nextActive = !item.is_active;
    const action = nextActive ? 'restore' : 'archive';
    const confirmed = await requestAdminConfirm({
      title: `${nextActive ? 'Restore' : 'Archive'} inventory item?`,
      message: `“${item.name}” ${nextActive ? 'will be available for stock movements and recipes again.' : 'will be hidden from new stock movements and recipes. Historical movements will be preserved.'}`,
      confirmLabel: nextActive ? 'Restore' : 'Archive',
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
    } catch (error) { showAdminError(error.message || `Inventory item could not be ${action}d.`); }
    finally { setSaving(false); }
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
    } catch (error) { showAdminError(error.message || 'This item cannot be deleted because it has related data.'); }
    finally { setSaving(false); }
  };

  const addRecipeRow = () => setRecipeDraft((current) => [...current, { inventory_item_id: '', quantity_per_menu_item: '' }]);
  const updateRecipeRow = (index, key, value) => setRecipeDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const removeRecipeRow = (index) => setRecipeDraft((current) => current.filter((_, rowIndex) => rowIndex !== index));

  const saveRecipe = async () => {
    if (!selectedMenuItemId) return;
    if (recipeDraft.some((row) => !row.inventory_item_id || number(row.quantity_per_menu_item) <= 0)) {
      showAdminError('Choose an inventory item and enter a positive quantity for every recipe component.'); return;
    }
    setSaving(true);
    try {
      await adminRequest(`/v1/admin/inventory/recipes/${selectedMenuItemId}`, {
        method: 'PUT',
        body: JSON.stringify({ components: recipeDraft.map((row) => ({ inventory_item_id: Number(row.inventory_item_id), quantity_per_menu_item: Number(row.quantity_per_menu_item) })) })
      });
      await Promise.all([loadRecipes(), loadContext(), loadStock()]); showAdminSuccess('Menu inventory recipe saved.');
    } catch (error) { showAdminError(error.message || 'Recipe could not be saved.'); }
    finally { setSaving(false); }
  };

  const exportReport = () => exportToCSV([
    ['Item', 'Category', 'Unit', 'Opening', 'Purchased', 'Consumed', 'Waste', 'Adjustments', 'Refund reversals', 'Closing stock', 'Purchase cost (RM)'],
    ...report.map((row) => [row.name, row.category, unitLabels[row.unit_code] || row.unit_code, row.opening_stock, row.purchased, row.consumed, row.wasted, row.adjusted, row.refund_reversed, row.closing_stock, row.purchase_cost_rm])
  ], `inventory-${selectedStore?.code || 'outlet'}-${month}.csv`);

  if (loading && !context.stores.length) return <div className="flex min-h-[420px] items-center justify-center text-sm font-semibold text-[#2E5E58]">Loading inventory...</div>;

  return <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 lg:p-8">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2E5E58]">Stock control</p><h1 className="mt-1 text-3xl font-bold text-gray-900">Inventory</h1><p className="mt-2 text-sm text-gray-500">Track purchases, connect ingredients and packaging to menu recipes, and reconcile monthly usage.</p></div>
        <div className="flex gap-2"><select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold">{context.stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.status !== 'active' ? ' (Archived)' : ''}</option>)}</select><button onClick={refreshAll} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
      </div>

      {!context.stores.length && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Create an outlet before configuring inventory.</div>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Active items', activeItems.length, Boxes], ['Available stock value', `RM ${stockValue.toFixed(2)}`, Warehouse], ['Low stock', lowStockCount, AlertTriangle], ['Menu recipes linked', `${linkedMenuCount}/${context.menu_items.length}`, Link2]].map(([label, value, Icon]) => <SectionCard key={label}><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold text-gray-900">{value}</p></div><div className="rounded-xl bg-[#E8F1EF] p-3 text-[#2E5E58]"><Icon size={22} /></div></div></SectionCard>)}
      </div>

      <div className="mt-6 flex gap-2 border-b border-gray-200">
        {[['stock', 'Stock & purchases'], ['recipes', 'Menu recipes'], ['report', 'Monthly report']].map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === value ? 'border-[#2E5E58] text-[#1F3A34]' : 'border-transparent text-gray-500'}`}>{label}</button>)}
      </div>

      {tab === 'stock' && <div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
        <SectionCard className="overflow-hidden p-0"><div className="border-b border-gray-100 p-5"><h2 className="text-lg font-bold text-gray-900">Current stock at {selectedStore?.name || 'outlet'}</h2><p className="mt-1 text-sm text-gray-500">Available stock excludes quantities held for active orders. Archive removes an item from new setup while preserving its history.</p><div className="mt-3"><select aria-label="Filter inventory items" value={itemStatusFilter} onChange={(event) => setItemStatusFilter(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold"><option value="active">Active items</option><option value="archived">Archived items</option><option value="all">All items</option></select></div></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Item</th><th className="px-4 py-3">On hand</th><th className="px-4 py-3">Reserved</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Linked recipes</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-gray-100">{visibleItems.map((item) => { const low = number(item.reorder_level) > 0 && number(item.available_quantity) <= number(item.reorder_level); return <tr key={item.id} className={!item.is_active ? 'opacity-55' : ''}><td className="px-5 py-4"><p className="font-bold text-gray-900">{item.name}</p><p className="text-xs text-gray-500">{item.category} · {unitLabels[item.unit_code] || item.unit_code}{!item.is_active && ' · Archived'}</p></td><td className="px-4 py-4">{formatQuantity(item.on_hand_quantity)}</td><td className="px-4 py-4">{formatQuantity(item.reserved_quantity)}</td><td className={`px-4 py-4 font-bold ${low ? 'text-amber-700' : 'text-[#2E5E58]'}`}>{formatQuantity(item.available_quantity)} {low && <span className="ml-1 text-xs">Low</span>}</td><td className="px-4 py-4">{item.linked_menu_item_count}</td><td className="px-4 py-4"><button type="button" onClick={() => toggleItemActive(item)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50" title={item.is_active ? 'Archive item' : 'Restore item'}>{item.is_active ? <Archive size={14} /> : <RotateCcw size={14} />}{item.is_active ? 'Archive' : 'Restore'}</button><button type="button" onClick={() => deleteItem(item)} disabled={saving} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50" title="Delete if no related data"><Trash2 size={14} />Delete</button></td></tr>; })}{!visibleItems.length && <tr><td colSpan="6" className="px-5 py-10 text-center text-gray-500">No inventory items yet. Create the first item on the right.</td></tr>}</tbody></table></div></SectionCard>
        <div className="space-y-5"><SectionCard><h2 className="flex items-center gap-2 text-lg font-bold"><PackagePlus size={19} /> New inventory item</h2><form onSubmit={createItem} className="mt-4 space-y-3"><input required placeholder="Item name, e.g. Fresh milk" value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2" /><input placeholder="Internal code (optional)" value={newItem.code} onChange={(event) => setNewItem({ ...newItem, code: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2" /><div className="grid grid-cols-2 gap-3"><select value={newItem.category} onChange={(event) => setNewItem({ ...newItem, category: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2"><option value="ingredient">Ingredient</option><option value="packaging">Packaging</option><option value="consumable">Consumable</option><option value="other">Other</option></select><select value={newItem.unit_code} onChange={(event) => setNewItem({ ...newItem, unit_code: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2"><option value="piece">Pieces</option><option value="gram">Grams</option><option value="millilitre">Millilitres</option></select></div><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} /> Create item</button></form></SectionCard>
        <SectionCard><h2 className="flex items-center gap-2 text-lg font-bold"><ShoppingCart size={19} /> Record stock movement</h2><form onSubmit={recordMovement} className="mt-4 space-y-3"><select required value={movement.inventory_item_id} onChange={(event) => setMovement({ ...movement, inventory_item_id: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2"><option value="">Choose item</option>{activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({unitLabels[item.unit_code]})</option>)}</select><select value={movement.movement_type} onChange={(event) => setMovement({ ...movement, movement_type: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2"><option value="purchase">Purchase / restock</option><option value="waste">Wastage</option><option value="adjustment">Stock adjustment</option></select>{movement.movement_type === 'adjustment' && <select value={movement.adjustment_direction || 'increase'} onChange={(event) => setMovement({ ...movement, adjustment_direction: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2"><option value="increase">Increase balance</option><option value="decrease">Decrease balance</option></select>}<div className="grid grid-cols-2 gap-3"><input required min="0.001" step="0.001" type="number" placeholder="Quantity" value={movement.quantity} onChange={(event) => setMovement({ ...movement, quantity: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2" />{movement.movement_type === 'purchase' && <input min="0" step="0.0001" type="number" placeholder="Cost per unit RM" value={movement.unit_cost_rm} onChange={(event) => setMovement({ ...movement, unit_cost_rm: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2" />}</div><input min="0" step="0.001" type="number" placeholder="Low-stock alert level (optional)" value={movement.reorder_level} onChange={(event) => setMovement({ ...movement, reorder_level: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2" /><input placeholder="Note or supplier reference" value={movement.note} onChange={(event) => setMovement({ ...movement, note: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2" /><button disabled={saving || !storeId} className="inline-flex items-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} /> Record movement</button></form></SectionCard></div>
      </div>}

      {tab === 'recipes' && <div className="mt-6 grid gap-5 lg:grid-cols-[.75fr_1.25fr]"><SectionCard><h2 className="text-lg font-bold">Choose menu item</h2><input className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Search menu items..." value={recipeSearch} onChange={(event) => setRecipeSearch(event.target.value)} /><select className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2" value={recipeCategory} onChange={(event) => setRecipeCategory(event.target.value)}><option value="all">All categories</option>{recipeCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select><div className="mt-3 max-h-[520px] space-y-1 overflow-y-auto">{filteredMenuItems.map((item) => <button key={item.id} onClick={() => setSelectedMenuItemId(String(item.id))} className={`w-full rounded-lg px-3 py-3 text-left ${String(item.id) === String(selectedMenuItemId) ? 'bg-[#1F3A34] text-white' : 'hover:bg-gray-50'}`}><p className="font-bold">{item.name}</p><p className={`text-xs ${String(item.id) === String(selectedMenuItemId) ? 'text-white/70' : 'text-gray-500'}`}>{item.category_name} · {item.recipe_component_count || 0} component(s)</p></button>)}{!filteredMenuItems.length && <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No menu items match this search or category.</div>}</div></SectionCard><SectionCard><h2 className="text-lg font-bold">Recipe for {context.menu_items.find((item) => String(item.id) === String(selectedMenuItemId))?.name || 'menu item'}</h2><p className="mt-1 text-sm text-gray-500">Enter the quantity consumed when one unit of this menu item is collected.</p><div className="mt-5 space-y-3">{recipeDraft.map((row, index) => <div key={`${index}-${row.inventory_item_id}`} className="grid grid-cols-[1fr_150px_42px] gap-3"><select value={row.inventory_item_id} onChange={(event) => updateRecipeRow(index, 'inventory_item_id', event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2"><option value="">Choose inventory item</option>{activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({unitLabels[item.unit_code]})</option>)}</select><input min="0.001" step="0.001" type="number" placeholder="Quantity" value={row.quantity_per_menu_item} onChange={(event) => updateRecipeRow(index, 'quantity_per_menu_item', event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2" /><button aria-label="Remove component" onClick={() => removeRecipeRow(index)} className="rounded-lg border border-red-200 text-red-600 hover:bg-red-50"><Trash2 size={17} className="mx-auto" /></button></div>)}{!recipeDraft.length && <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No inventory recipe is linked. Orders for this item will not deduct stock.</div>}</div><div className="mt-5 flex gap-3"><button onClick={addRecipeRow} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">Add component</button><button onClick={saveRecipe} disabled={saving || !selectedMenuItemId} className="inline-flex items-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} /> Save recipe</button></div></SectionCard></div>}

      {tab === 'report' && <div className="mt-6"><SectionCard className="overflow-hidden p-0"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-5"><div><h2 className="text-lg font-bold">Monthly inventory report</h2><p className="mt-1 text-sm text-gray-500">Movement summary for {selectedStore?.name || 'the selected outlet'} in Kuala Lumpur time.</p></div><div className="flex gap-2"><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /><button onClick={loadReport} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold">Generate</button><button onClick={exportReport} disabled={!report.length} className="inline-flex items-center gap-2 rounded-lg bg-[#1F3A34] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Download size={16} /> Export CSV</button></div></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Item</th><th className="px-3 py-3">Opening</th><th className="px-3 py-3">Purchased</th><th className="px-3 py-3">Consumed</th><th className="px-3 py-3">Waste</th><th className="px-3 py-3">Adjustments</th><th className="px-3 py-3">Closing</th><th className="px-3 py-3">Purchase cost</th></tr></thead><tbody className="divide-y divide-gray-100">{report.map((row) => <tr key={row.id}><td className="px-5 py-4"><p className="font-bold">{row.name}</p><p className="text-xs text-gray-500">{unitLabels[row.unit_code]}</p></td><td className="px-3 py-4">{formatQuantity(row.opening_stock)}</td><td className="px-3 py-4 text-emerald-700">+{formatQuantity(row.purchased)}</td><td className="px-3 py-4">{formatQuantity(row.consumed)}</td><td className="px-3 py-4 text-amber-700">{formatQuantity(row.wasted)}</td><td className="px-3 py-4">{formatQuantity(row.adjusted)}</td><td className="px-3 py-4 font-bold">{formatQuantity(row.closing_stock)}</td><td className="px-3 py-4">RM {number(row.purchase_cost_rm).toFixed(2)}</td></tr>)}</tbody></table></div></SectionCard></div>}
    </div>
  </div>;
}
