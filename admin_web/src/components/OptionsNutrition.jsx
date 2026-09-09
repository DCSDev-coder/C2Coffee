import React, { useEffect, useState } from 'react';
import { ImagePlus, Plus, Pencil, X } from 'lucide-react';
import {
  createAdminOptionGroup,
  deleteAdminOptionGroup,
  loadAdminMenu,
  loadAdminOptionLibrary,
  updateAdminMenuNutrition,
  uploadAdminOptionImage,
  updateAdminOptionGroup
} from '../lib/adminApi';

const emptyGroup = () => ({
  name: '', applies_to: 'all_drinks', selection_type: 'single', min_select: 0,
  max_select: 1, is_required: false, sort_order: 0, is_active: true,
  menu_item_ids: [], options: [{ name: '', image_url: null, color_hex: '#2D655D', gradient_end_hex: null, price_delta_rm: 0, token_price_delta: 0, calorie_delta_kcal: 0, is_active: true }]
});

const isBeanGroup = (name) => /\bbeans?\b/i.test(name || '');
const emptyOption = () => ({ name: '', image_url: null, color_hex: '#2D655D', gradient_end_hex: null, price_delta_rm: 0, token_price_delta: 0, calorie_delta_kcal: 0, is_active: true });

export default function OptionsNutrition() {
  const [groups, setGroups] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [nutritionItems, setNutritionItems] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [nutritionDrafts, setNutritionDrafts] = useState({});

  const load = async () => {
    const [library, menu] = await Promise.all([loadAdminOptionLibrary(), loadAdminMenu()]);
    setGroups(library.groups || []);
    const menuItems = (menu.categories || []).flatMap((category) =>
      (category.items || []).map((item) => ({ ...item, category_name: category.name, product_kind_code: category.product_kind_code }))
    );
    const drinkItems = menuItems.filter((item) => item.product_kind_code === 'drink');
    setDrinks(drinkItems);
    setNutritionItems(menuItems);
    setNutritionDrafts(Object.fromEntries(menuItems.map((item) => [item.id, item.base_calories_kcal ?? 0])));
  };
  const saveBaseCalories = async (itemId) => {
    try {
      await updateAdminMenuNutrition(itemId, Number(nutritionDrafts[itemId] ?? 0));
      setMessage('Base calories saved.');
    } catch (error) { setMessage(error.message || 'Unable to save base calories.'); }
  };
  const removeGroup = async (group) => {
    if (!window.confirm(`Delete "${group.name}"? It will no longer be available for new customer orders.`)) return;
    try { await deleteAdminOptionGroup(group.id); setMessage('Option group deleted.'); await load(); }
    catch (error) { setMessage(error.message || 'Unable to delete option group.'); }
  };
  useEffect(() => { void load().catch((error) => setMessage(error.message || 'Unable to load option settings.')); }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setMessage('');
    try {
      const payload = {
        ...form,
        min_select: Number(form.min_select), max_select: Number(form.max_select), sort_order: Number(form.sort_order),
        options: form.options.map((option, index) => ({ ...option, sort_order: index, price_delta_rm: Number(option.price_delta_rm), token_price_delta: Number(option.token_price_delta), calorie_delta_kcal: Number(option.calorie_delta_kcal) }))
      };
      if (form.id) await updateAdminOptionGroup(form.id, payload); else await createAdminOptionGroup(payload);
      setForm(null); setMessage('Option group saved.'); await load();
    } catch (error) { setMessage(error.message || 'Unable to save option group.'); }
    finally { setSaving(false); }
  };

  const updateOption = (index, patch) => {
    const options = [...form.options];
    options[index] = { ...options[index], ...patch };
    setForm({ ...form, options });
  };

  const uploadChoiceImage = async (file, index) => {
    if (!file) return;
    setSaving(true);
    setMessage('Uploading bean image...');
    try {
      const uploaded = await uploadAdminOptionImage(file);
      updateOption(index, { image_url: uploaded.image_url });
      setMessage('Bean image uploaded. Save the option group to publish it.');
    } catch (error) {
      setMessage(error.message || 'Unable to upload the bean image.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="px-8 pb-8 pt-2 space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-bold text-gray-900">Options &amp; Nutrition</h1><p className="mt-1 text-sm text-gray-500">Create reusable drink options and set their price, token, and calorie effects.</p></div>
      <button onClick={() => setForm(emptyGroup())} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white hover:bg-[#2E5E58]"><Plus size={16} /> New option group</button>
    </div>
    {message && <div className="rounded-xl border border-[#B9D9D1] bg-[#F1FBF7] px-4 py-3 text-sm text-[#1F3A34]">{message}</div>}
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="divide-y divide-gray-100">{groups.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">No option groups yet. Start with Temperature, Milk, or Sweetness.</div> : groups.map((group) => <div key={group.id} className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-gray-900">{group.name}</h2><span className="rounded-full bg-[#E8F2EF] px-2 py-0.5 text-xs font-bold text-[#1F3A34]">{group.applies_to === 'all_drinks' ? 'All drinks' : `${group.menu_item_ids.length} selected drinks`}</span>{!group.is_active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">Disabled</span>}</div><p className="mt-1 text-xs text-gray-500">{group.is_required ? 'Required' : 'Optional'} · {group.selection_type === 'single' ? 'Choose one' : `Choose ${group.min_select}–${group.max_select}`}</p></div><div className="flex gap-2"><button onClick={() => setForm({ ...group, options: group.options.map((option) => ({ ...option })) })} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><Pencil size={14} /> Edit</button><button onClick={() => removeGroup(group)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">Delete</button></div></div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{group.options.map((option) => <div key={option.id} className="rounded-xl bg-gray-50 px-3 py-2 text-sm"><span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: option.gradient_end_hex ? `linear-gradient(135deg, ${option.color_hex || '#2D655D'}, ${option.gradient_end_hex})` : option.color_hex || '#2D655D' }} /><span className="font-semibold text-gray-900">{option.name}</span><span className="ml-2 text-xs text-gray-500">RM {Number(option.price_delta_rm).toFixed(2)} · {Number(option.token_price_delta) >= 0 ? '+' : ''}{option.token_price_delta} tokens · {Number(option.calorie_delta_kcal) >= 0 ? '+' : ''}{option.calorie_delta_kcal} kcal</span></div>)}</div>
      </div>)}</div>
    </div>
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-gray-900">Base calories by menu item</h2><p className="mt-1 text-sm text-gray-500">Enter the standard calories for drinks, food, and other menu items. Drink option adjustments are added separately.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{nutritionItems.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-xs text-gray-500">{item.category_name}</p></div><input type="number" min="0" value={nutritionDrafts[item.id] ?? 0} onChange={(event) => setNutritionDrafts({ ...nutritionDrafts, [item.id]: event.target.value })} className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" aria-label={`${item.name} base calories`} /><span className="text-xs text-gray-500">kcal</span><button type="button" onClick={() => saveBaseCalories(item.id)} className="text-xs font-bold text-[#1F3A34]">Save</button></div>)}</div></div>
    {form && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"><form onSubmit={save} className="mx-auto my-6 max-w-5xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-bold">{form.id ? 'Edit option group' : 'New option group'}</h2><p className="text-xs text-gray-500">Changes apply to new customer orders immediately after saving.</p></div><button type="button" onClick={() => setForm(null)} className="rounded-lg p-2 hover:bg-gray-100"><X size={18} /></button></div><div className="space-y-5 p-5">
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Group name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Choice of temperature" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label><label className="text-sm font-semibold">Apply group to<select value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value, menu_item_ids: e.target.value === 'all_drinks' ? [] : form.menu_item_ids })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"><option value="all_drinks">All drinks</option><option value="selected_items">Selected menu items</option></select></label></div>
      {form.applies_to === 'selected_items' && <fieldset><legend className="text-sm font-semibold">Select drink items</legend><div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">{drinks.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.menu_item_ids.includes(item.id)} onChange={(e) => setForm({ ...form, menu_item_ids: e.target.checked ? [...form.menu_item_ids, item.id] : form.menu_item_ids.filter((id) => id !== item.id) })} />{item.name}<span className="text-xs text-gray-400">{item.category_name}</span></label>)}</div></fieldset>}
      <div className="rounded-xl border border-[#D7E7E2] bg-[#F6FBF9] p-3 text-sm text-[#31584F]"><strong>Setup guide:</strong> use <em>Choose one</em> with minimum <strong>1</strong> and <strong>Required</strong> for Beans, Temperature, Milk, Sweetness, and Order Type. Set all adjustments to <strong>0</strong> when a choice does not change the price, tokens, or calories.</div>
      <div className="grid gap-4 sm:grid-cols-4"><label className="text-sm font-semibold">Selection<select value={form.selection_type} onChange={(e) => setForm({ ...form, selection_type: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"><option value="single">Choose one</option><option value="multi">Choose multiple</option></select></label><label className="text-sm font-semibold">Minimum<input type="number" min="0" value={form.min_select} onChange={(e) => setForm({ ...form, min_select: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label><label className="text-sm font-semibold">Maximum<input type="number" min="1" value={form.max_select} onChange={(e) => setForm({ ...form, max_select: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label><label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} /> Required</label></div>
      <div><div className="mb-2 flex items-center justify-between"><div><h3 className="font-bold">Customer choices</h3><p className="text-xs text-gray-500">Use a negative calorie value for less sugar or other reductions.</p></div><button type="button" onClick={() => setForm({ ...form, options: [...form.options, emptyOption()] })} className="text-sm font-bold text-[#1F3A34]"><Plus size={14} className="inline" /> Add choice</button></div><div className="space-y-3">{form.options.map((option, index) => <div key={index} className="rounded-xl border border-gray-200 p-3"><div className={`grid gap-3 ${isBeanGroup(form.name) ? 'lg:grid-cols-[120px_1.5fr_1fr_1fr_1fr_1fr_1fr_auto]' : 'lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_auto]'}`}>
        {isBeanGroup(form.name) && <div><span className="text-xs font-bold text-gray-700">Bean image</span><label className="mt-1 flex h-20 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100">{option.image_url ? <img src={option.image_url} alt={`${option.name || 'Bean'} preview`} className="h-full w-full object-cover" /> : <span className="text-center text-xs text-gray-500"><ImagePlus className="mx-auto mb-1" size={18} />Upload</span>}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => uploadChoiceImage(event.target.files?.[0], index)} /></label></div>}
        <label className="text-xs font-bold text-gray-700">Choice label<input required placeholder="e.g. Dato Blend" value={option.name} onChange={(e) => updateOption(index, { name: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label>
        <label className="text-xs font-bold text-gray-700">Card color<input type="color" value={option.color_hex || '#2D655D'} onChange={(e) => updateOption(index, { color_hex: e.target.value })} className="mt-1 block h-10 w-full cursor-pointer rounded-lg border border-gray-300 p-1" /></label>
        <label className="text-xs font-bold text-gray-700">Gradient end <span className="font-normal text-gray-400">(optional)</span><input type="color" value={option.gradient_end_hex || option.color_hex || '#2D655D'} onChange={(e) => updateOption(index, { gradient_end_hex: e.target.value })} className="mt-1 block h-10 w-full cursor-pointer rounded-lg border border-gray-300 p-1" /></label>
        <label className="text-xs font-bold text-gray-700">Extra price (RM)<input type="number" step="0.01" value={option.price_delta_rm} onChange={(e) => updateOption(index, { price_delta_rm: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label>
        <label className="text-xs font-bold text-gray-700">Extra tokens<input type="number" value={option.token_price_delta} onChange={(e) => updateOption(index, { token_price_delta: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label>
        <label className="text-xs font-bold text-gray-700">Calories (+/- kcal)<input type="number" value={option.calorie_delta_kcal} onChange={(e) => updateOption(index, { calorie_delta_kcal: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label>
        <button type="button" disabled={form.options.length === 1} onClick={() => setForm({ ...form, options: form.options.filter((_, optionIndex) => optionIndex !== index) })} className="self-end pb-2 text-sm font-bold text-red-600 disabled:opacity-30">Remove</button></div>
        {isBeanGroup(form.name) && <p className="mt-2 text-xs text-gray-500">Upload a square PNG, JPG, or WebP image. It appears bright when selected and dimmed when unselected in the mobile app.</p>}
      </div>)}</div></div>
    </div><div className="flex justify-end gap-3 border-t p-5"><button type="button" onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 text-sm font-bold">Cancel</button><button disabled={saving} className="rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save option group'}</button></div></form></div>}
  </div>;
}
