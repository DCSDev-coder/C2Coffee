import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ImagePlus, Plus, Pencil, X, Save, Sparkles, Trash2 } from 'lucide-react';
import {
  createAdminOptionGroup,
  deleteAdminOptionGroup,
  loadAdminMenu,
  loadAdminOptionLibrary,
  updateAdminMenuNutrition,
  uploadAdminOptionImage,
  updateAdminOptionGroup
} from '../lib/adminApi';
import { useUnsavedChanges } from '../utils/UnsavedChangesContext';

const emptyGroup = () => ({
  name: '',
  applies_to: 'all_drinks',
  selection_type: 'single',
  min_select: 0,
  max_select: 1,
  is_required: false,
  sort_order: 0,
  is_active: true,
  menu_item_ids: [],
  options: [
    {
      name: '',
      image_url: null,
      color_hex: '#2D655D',
      gradient_end_hex: null,
      gradient_direction: 'diagonal',
      price_delta_rm: 0,
      token_price_delta: 0,
      calorie_delta_kcal: 0,
      is_active: true
    }
  ]
});

const isBeanGroup = (name) => /\bbeans?\b/i.test(name || '');
const emptyOption = () => ({
  name: '',
  image_url: null,
  color_hex: '#2D655D',
  gradient_end_hex: null,
  gradient_direction: 'diagonal',
  price_delta_rm: 0,
  token_price_delta: 0,
  calorie_delta_kcal: 0,
  is_active: true
});

const gradientDirectionToDeg = (dir) => {
  if (dir === 'horizontal') return '90deg';
  if (dir === 'vertical') return '180deg';
  return '135deg'; // diagonal (default)
};

export default function OptionsNutrition() {
  const [groups, setGroups] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [nutritionItems, setNutritionItems] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isSavingNutrition, setIsSavingNutrition] = useState(false);
  const [message, setMessage] = useState('');
  const [nutritionDrafts, setNutritionDrafts] = useState({});
  const [initialNutrition, setInitialNutrition] = useState({});
  const [loading, setLoading] = useState(true);

  const { registerUnsavedHandler } = useUnsavedChanges();

  const load = async () => {
    setLoading(true);
    try {
      const [library, menu] = await Promise.all([loadAdminOptionLibrary(), loadAdminMenu()]);
      setGroups(library.groups || []);
      const menuItems = (menu.categories || [])
        .flatMap((category) =>
          (category.items || [])
            .filter((item) => item.is_active)
            .map((item) => ({
              ...item,
              category_name: category.name,
              product_kind_code: category.product_kind_code
            }))
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
      const drinkItems = menuItems.filter((item) => item.product_kind_code === 'drink');
      setDrinks(drinkItems);
      setNutritionItems(menuItems);
      const drafts = Object.fromEntries(
        menuItems.map((item) => [item.id, item.base_calories_kcal ?? 0])
      );
      setNutritionDrafts(drafts);
      setInitialNutrition(drafts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load().catch((error) => setMessage(error.message || 'Unable to load option settings.'));
  }, []);

  const changedItemIds = useMemo(() => {
    return Object.keys(nutritionDrafts).filter((id) => {
      const current = Number(nutritionDrafts[id] ?? 0);
      const initial = Number(initialNutrition[id] ?? 0);
      return current !== initial;
    });
  }, [nutritionDrafts, initialNutrition]);

  const hasUnsavedNutrition = changedItemIds.length > 0;

  const saveAllBaseCalories = useCallback(async () => {
    if (changedItemIds.length === 0) {
      setMessage('No calorie changes to save.');
      return true;
    }
    setIsSavingNutrition(true);
    setMessage('');
    try {
      await Promise.all(
        changedItemIds.map((id) => {
          const itemId = Number(id);
          const raw = nutritionDrafts[id];
          const calories = Math.max(0, Math.min(5000, Math.round(Number(raw) || 0)));
          return updateAdminMenuNutrition(itemId, calories);
        })
      );
      setInitialNutrition({ ...nutritionDrafts });
      setMessage(`Successfully saved base calories for ${changedItemIds.length} menu item${changedItemIds.length > 1 ? 's' : ''}.`);
      return true;
    } catch (error) {
      setMessage(error.message || 'Unable to save base calories.');
      return false;
    } finally {
      setIsSavingNutrition(false);
    }
  }, [changedItemIds, nutritionDrafts]);

  const resetNutritionChanges = () => {
    setNutritionDrafts({ ...initialNutrition });
    setMessage('Calorie edits reverted.');
  };

  const saveOptionGroup = useCallback(async (formData = form) => {
    if (!formData) return true;
    if (!formData.name?.trim()) {
      throw new Error('Please enter a name for the option group.');
    }
    if (!formData.options || formData.options.length === 0) {
      throw new Error('Please add at least one choice to the option group.');
    }
    for (const opt of formData.options) {
      if (!opt.name?.trim()) {
        throw new Error('Every customer choice must have a label.');
      }
    }

    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...formData,
        min_select: Number(formData.min_select),
        max_select: Number(formData.max_select),
        sort_order: Number(formData.sort_order),
        options: formData.options.map((option, index) => ({
          ...option,
          sort_order: index,
          gradient_direction: option.gradient_direction || 'diagonal',
          price_delta_rm: Number(option.price_delta_rm),
          token_price_delta: Number(option.token_price_delta),
          calorie_delta_kcal: Number(option.calorie_delta_kcal)
        }))
      };
      if (formData.id) {
        await updateAdminOptionGroup(formData.id, payload);
      } else {
        await createAdminOptionGroup(payload);
      }
      setForm(null);
      setMessage('Option group saved.');
      await load();
      return true;
    } catch (error) {
      const errMsg = error.message || 'Unable to save option group.';
      setMessage(errMsg);
      throw new Error(errMsg);
    } finally {
      setSaving(false);
    }
  }, [form]);

  // Register unsaved changes guard for page navigation
  useEffect(() => {
    if (!hasUnsavedNutrition && !form) return;

    return registerUnsavedHandler({
      hasUnsavedChanges: () => hasUnsavedNutrition || Boolean(form),
      onSave: async () => {
        if (form) {
          await saveOptionGroup(form);
        }
        if (hasUnsavedNutrition) {
          return saveAllBaseCalories();
        }
        return true;
      },
      onDiscard: () => {
        setNutritionDrafts({ ...initialNutrition });
        setForm(null);
      }
    });
  }, [hasUnsavedNutrition, form, registerUnsavedHandler, saveAllBaseCalories, saveOptionGroup, initialNutrition]);

  const removeGroup = async (group) => {
    if (!window.confirm(`Delete "${group.name}"? It will no longer be available for new customer orders.`)) return;
    try {
      await deleteAdminOptionGroup(group.id);
      setMessage('Option group deleted.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Unable to delete option group.');
    }
  };

  const handleGroupFormSubmit = async (event) => {
    event.preventDefault();
    try {
      await saveOptionGroup(form);
    } catch {
      // message is set in saveOptionGroup
    }
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

  return (
    <div className="relative px-6 lg:px-8 pb-24 pt-4 space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Options &amp; Nutrition</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create reusable drink options and set standard base calories for all menu items.
          </p>
        </div>
        <button
          onClick={() => setForm(emptyGroup())}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus size={16} /> New option group
        </button>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-[#B9D9D1] bg-[#F1FBF7] px-4 py-3 text-sm text-[#1F3A34] animate-in fade-in duration-200">
          <Sparkles size={16} className="text-[#2E5E58] shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Option Groups Section */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50/70 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Option Groups</h2>
            <p className="text-xs text-gray-500">Choice modifiers for beans, milk, temperature, and syrups.</p>
          </div>
          <span className="rounded-full bg-[#E8F2EF] px-2.5 py-1 text-xs font-bold text-[#1F3A34]">
            {groups.length} {groups.length === 1 ? 'group' : 'groups'}
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {groups.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No option groups yet. Start with Temperature, Milk, or Sweetness.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-gray-900">{group.name}</h2>
                      <span className="rounded-full bg-[#E8F2EF] px-2 py-0.5 text-xs font-bold text-[#1F3A34]">
                        {group.applies_to === 'all_drinks'
                          ? 'All drinks'
                          : `${group.menu_item_ids.length} selected drinks`}
                      </span>
                      {!group.is_active && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {group.is_required ? 'Required' : 'Optional'} ·{' '}
                      {group.selection_type === 'single'
                        ? 'Choose one'
                        : `Choose ${group.min_select}–${group.max_select}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setForm({
                          ...group,
                          options: group.options.map((option) => ({ ...option }))
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => removeGroup(group)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {group.options.map((option) => (
                    <div
                      key={option.id}
                      className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-sm flex items-center justify-between"
                    >
                      <div className="flex items-center min-w-0 mr-2">
                        <span
                          className="mr-2 inline-block h-3 w-3 rounded-full shrink-0"
                          style={{
                            background: option.gradient_end_hex
                              ? `linear-gradient(${gradientDirectionToDeg(option.gradient_direction)}, ${option.color_hex || '#2D655D'}, ${option.gradient_end_hex})`
                              : option.color_hex || '#2D655D'
                          }}
                        />
                        <span className="font-semibold text-gray-900 truncate">{option.name}</span>
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        RM {Number(option.price_delta_rm).toFixed(2)} · {Number(option.calorie_delta_kcal) >= 0 ? '+' : ''}
                        {option.calorie_delta_kcal} kcal
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Base Calories Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Base calories by menu item</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Enter the standard calories for drinks, food, and other menu items. Drink option adjustments are added separately.
            </p>
          </div>
          {hasUnsavedNutrition && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200 shrink-0 self-start sm:self-auto">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              {changedItemIds.length} item{changedItemIds.length > 1 ? 's' : ''} modified
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">Loading menu nutrition...</div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {nutritionItems.map((item) => {
              const currentVal = nutritionDrafts[item.id] ?? 0;
              const initialVal = initialNutrition[item.id] ?? 0;
              const isModified = String(currentVal) !== String(initialVal);

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 transition-all ${
                    isModified
                      ? 'border-[#2E5E58] bg-[#F1FBF7] shadow-sm ring-1 ring-[#2E5E58]/30'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                      {isModified && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#2E5E58] shrink-0" title="Modified" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{item.category_name}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="5000"
                      value={currentVal}
                      onChange={(event) =>
                        setNutritionDrafts({
                          ...nutritionDrafts,
                          [item.id]: event.target.value
                        })
                      }
                      className={`w-20 rounded-lg border px-2.5 py-1.5 text-sm font-semibold text-right outline-none transition-colors ${
                        isModified
                          ? 'border-[#2E5E58] bg-white text-[#1F3A34] focus:ring-2 focus:ring-[#2E5E58]/20'
                          : 'border-gray-300 bg-gray-50/50 text-gray-800 focus:border-[#2E5E58] focus:bg-white'
                      }`}
                      aria-label={`${item.name} base calories`}
                    />
                    <span className="text-xs font-medium text-gray-500 w-7">kcal</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            {hasUnsavedNutrition ? (
              <span className="font-semibold text-amber-700">
                You have {changedItemIds.length} unsaved calorie change{changedItemIds.length > 1 ? 's' : ''}.
              </span>
            ) : (
              <span>All base calories are currently up to date.</span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Sticky Save Bar on unsaved changes */}
      {hasUnsavedNutrition && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1F3A34] text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 sm:gap-6 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-sm font-bold">
              {changedItemIds.length} unsaved {changedItemIds.length === 1 ? 'change' : 'changes'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetNutritionChanges}
              disabled={isSavingNutrition}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={saveAllBaseCalories}
              disabled={isSavingNutrition}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#1F3A34] shadow transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Save size={14} />
              {isSavingNutrition ? 'Saving...' : 'Save Now'}
            </button>
          </div>
        </div>
      )}

      {/* Option Group Modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-xs p-3 sm:p-4">
          <form onSubmit={handleGroupFormSubmit} className="mx-auto my-auto w-full max-w-5xl max-h-[calc(100vh-2rem)] flex flex-col rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b p-4 sm:p-5 bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {form.id ? 'Edit option group' : 'New option group'}
                </h2>
                <p className="text-xs text-gray-500">Changes apply to new customer orders immediately after saving.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-5 p-4 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">
                  Group name
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Choice of temperature"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3.5 py-2 font-normal text-sm outline-none focus:border-[#2E5E58]"
                  />
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Apply group to
                  <select
                    value={form.applies_to}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        applies_to: e.target.value,
                        menu_item_ids: e.target.value === 'all_drinks' ? [] : form.menu_item_ids
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3.5 py-2 font-normal text-sm outline-none focus:border-[#2E5E58] bg-white"
                  >
                    <option value="all_drinks">All drinks</option>
                    <option value="selected_items">Selected menu items</option>
                  </select>
                </label>
              </div>
              {form.applies_to === 'selected_items' && (
                <fieldset>
                  <legend className="text-sm font-semibold text-gray-700">Select drink items</legend>
                  <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
                    {drinks.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.menu_item_ids.includes(item.id)}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              menu_item_ids: e.target.checked
                                ? [...form.menu_item_ids, item.id]
                                : form.menu_item_ids.filter((id) => id !== item.id)
                            })
                          }
                        />
                        <span className="font-medium text-gray-800">{item.name}</span>
                        <span className="text-xs text-gray-400">{item.category_name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="rounded-xl border border-[#D7E7E2] bg-[#F6FBF9] p-3.5 text-sm text-[#31584F]">
                <strong>Setup guide:</strong> use <em>Choose one</em> with minimum <strong>1</strong> and <strong>Required</strong> for Beans, Temperature, Milk, Sweetness, and Order Type. Set all adjustments to <strong>0</strong> when a choice does not change the price, tokens, or calories.
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <label className="text-sm font-semibold text-gray-700">
                  Selection
                  <select
                    value={form.selection_type}
                    onChange={(e) => setForm({ ...form, selection_type: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-normal text-sm bg-white outline-none focus:border-[#2E5E58]"
                  >
                    <option value="single">Choose one</option>
                    <option value="multi">Choose multiple</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Minimum
                  <input
                    type="number"
                    min="0"
                    value={form.min_select}
                    onChange={(e) => setForm({ ...form, min_select: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-normal text-sm outline-none focus:border-[#2E5E58]"
                  />
                </label>
                <label className="text-sm font-semibold text-gray-700">
                  Maximum
                  <input
                    type="number"
                    min="1"
                    value={form.max_select}
                    onChange={(e) => setForm({ ...form, max_select: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-normal text-sm outline-none focus:border-[#2E5E58]"
                  />
                </label>
                <label className="mt-6 flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_required}
                    onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
                    className="h-4 w-4 rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                  />
                  Required
                </label>
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">Customer choices</h3>
                    <p className="text-xs text-gray-500">Use a negative calorie value for less sugar or other reductions.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, options: [...form.options, emptyOption()] })}
                    className="inline-flex items-center gap-1 text-sm font-bold text-[#1F3A34] hover:text-[#2E5E58]"
                  >
                    <Plus size={15} /> Add choice
                  </button>
                </div>
                <div className="space-y-3">
                  {form.options.map((option, index) => (
                    <div key={index} className="rounded-2xl border border-gray-200 p-4 bg-gray-50/40 space-y-3">
                      {/* Row 1: Visual Identity */}
                      <div
                        className={`grid gap-3 items-end ${
                          isBeanGroup(form.name)
                            ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-[100px_2fr_1fr_1fr_1fr]'
                            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr]'
                        }`}
                      >
                        {isBeanGroup(form.name) && (
                          <div>
                            <span className="text-xs font-bold text-gray-700">Bean image</span>
                            <label className="mt-1 flex h-10 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white hover:bg-gray-50 transition-colors">
                              {option.image_url ? (
                                <img
                                  src={option.image_url}
                                  alt={`${option.name || 'Bean'} preview`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <ImagePlus size={14} />
                                  <span>Upload</span>
                                </span>
                              )}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="sr-only"
                                onChange={(event) => uploadChoiceImage(event.target.files?.[0], index)}
                              />
                            </label>
                          </div>
                        )}
                        <label className="text-xs font-bold text-gray-700">
                          Choice label
                          <input
                            required
                            placeholder="e.g. Dato Blend"
                            value={option.name}
                            onChange={(e) => updateOption(index, { name: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-normal bg-white outline-none focus:border-[#2E5E58]"
                          />
                        </label>
                        <label className="text-xs font-bold text-gray-700">
                          Card color
                          <input
                            type="color"
                            value={option.color_hex || '#2D655D'}
                            onChange={(e) => updateOption(index, { color_hex: e.target.value })}
                            className="mt-1 block h-10 w-full cursor-pointer rounded-xl border border-gray-300 p-1 bg-white"
                          />
                        </label>
                        <label className="text-xs font-bold text-gray-700">
                          Gradient end <span className="font-normal text-gray-400">(optional)</span>
                          <input
                            type="color"
                            value={option.gradient_end_hex || option.color_hex || '#2D655D'}
                            onChange={(e) => updateOption(index, { gradient_end_hex: e.target.value })}
                            className="mt-1 block h-10 w-full cursor-pointer rounded-xl border border-gray-300 p-1 bg-white"
                          />
                        </label>
                        <label className="text-xs font-bold text-gray-700">
                          Gradient direction
                          <select
                            value={option.gradient_direction || 'diagonal'}
                            onChange={(e) => updateOption(index, { gradient_direction: e.target.value })}
                            disabled={!option.gradient_end_hex}
                            title={!option.gradient_end_hex ? 'Set a gradient end colour first' : undefined}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-normal text-sm bg-white outline-none focus:border-[#2E5E58] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <option value="diagonal">↗ Diagonal</option>
                            <option value="horizontal">→ Horizontal</option>
                            <option value="vertical">↓ Vertical</option>
                          </select>
                        </label>
                      </div>

                      {/* Row 2: Price, Tokens, Calories, Actions */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end pt-1 border-t border-gray-200/60">
                        <label className="text-xs font-bold text-gray-700">
                          Extra price (RM)
                          <input
                            type="number"
                            step="0.01"
                            value={option.price_delta_rm}
                            onChange={(e) => updateOption(index, { price_delta_rm: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-normal bg-white outline-none focus:border-[#2E5E58]"
                          />
                        </label>
                        <label className="text-xs font-bold text-gray-700">
                          Extra tokens
                          <input
                            type="number"
                            value={option.token_price_delta}
                            onChange={(e) => updateOption(index, { token_price_delta: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-normal bg-white outline-none focus:border-[#2E5E58]"
                          />
                        </label>
                        <label className="text-xs font-bold text-gray-700">
                          Calories (+/- kcal)
                          <input
                            type="number"
                            value={option.calorie_delta_kcal}
                            onChange={(e) => updateOption(index, { calorie_delta_kcal: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-normal bg-white outline-none focus:border-[#2E5E58]"
                          />
                        </label>
                        <div className="flex items-center justify-end pb-1">
                          <button
                            type="button"
                            disabled={form.options.length === 1}
                            onClick={() =>
                              setForm({
                                ...form,
                                options: form.options.filter((_, optionIndex) => optionIndex !== index)
                              })
                            }
                            className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-30 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={15} />
                            Remove
                          </button>
                        </div>
                      </div>
                      {isBeanGroup(form.name) && (
                        <p className="mt-2 text-xs text-gray-500">
                          Upload a square PNG, JPG, or WebP image. It appears bright when selected and dimmed when unselected in the mobile app.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-3 border-t p-4 sm:p-5 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="rounded-xl bg-[#1F3A34] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:opacity-60 shadow-sm transition-all"
              >
                {saving ? 'Saving...' : 'Save option group'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
