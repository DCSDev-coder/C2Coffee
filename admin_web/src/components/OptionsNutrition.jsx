import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, ImagePlus, Plus, Pencil, X, Save, Sparkles, Trash2 } from 'lucide-react';
import InfoTooltip from './InfoTooltip';
import {
  createAdminOptionGroup,
  deleteAdminOptionGroup,
  loadAdminMenu,
  loadAdminOptionLibrary,
  updateAdminMenuNutrition,
  uploadAdminOptionImage,
  updateAdminOptionGroup,
  updateAdminOptionGroupOrder
} from '../lib/adminApi';
import { useUnsavedChanges } from '../utils/UnsavedChangesContext';
import RecipeNutrition from './RecipeNutrition';
import { requestAdminConfirm } from '../lib/adminDialog';

const emptyGroup = () => ({
  name: '',
  applies_to: 'selected_items',
  selection_type: 'single',
  min_select: 1,
  max_select: 1,
  is_required: true,
  sort_order: 0,
  is_active: true,
  menu_item_ids: [],
  hidden_when_option_ids: [],
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
      is_active: true,
      is_default: true,
      excluded_menu_item_ids: []
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
  is_active: true,
  is_default: false,
  excluded_menu_item_ids: []
});

const gradientDirectionToDeg = (dir) => {
  if (dir === 'horizontal') return '90deg';
  if (dir === 'vertical') return '180deg';
  return '135deg'; // diagonal (default)
};

const formatTokenAdjustment = (value) => {
  const tokens = Number(value) || 0;
  if (tokens === 0) return 'No token change';
  return `${tokens > 0 ? '+' : ''}${tokens} ${Math.abs(tokens) === 1 ? 'token' : 'tokens'}`;
};

const tokenAdjustmentClass = (value) => {
  const tokens = Number(value) || 0;
  if (tokens > 0) return 'text-[#1F6B55]';
  if (tokens < 0) return 'text-[#B45309]';
  return 'text-gray-500';
};

export default function OptionsNutrition() {
  const [groups, setGroups] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [nutritionItems, setNutritionItems] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isSavingNutrition, setIsSavingNutrition] = useState(false);
  const [message, setMessage] = useState('');
  const [nutritionDrafts, setNutritionDrafts] = useState({});
  const [initialNutrition, setInitialNutrition] = useState({});
  const [loading, setLoading] = useState(true);
  const [draggedGroupId, setDraggedGroupId] = useState(null);

  const { registerUnsavedHandler } = useUnsavedChanges();

  const load = async () => {
    setLoading(true);
    try {
      const [library, menu] = await Promise.all([loadAdminOptionLibrary(), loadAdminMenu()]);
      setGroups(library.groups || []);
      const menuItems = (menu.categories || [])
        .filter((category) => category.is_active)
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
      setMenuItems(menuItems);
      setNutritionItems(menuItems.filter((item) => item.product_kind_code !== 'drink'));
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

  const allDrinkIds = useMemo(() => drinks.map((drink) => drink.id), [drinks]);
  const allMenuItemIds = useMemo(() => menuItems.map((item) => item.id), [menuItems]);

  const openNewGroup = () => {
    setForm({ ...emptyGroup(), applies_to: 'all_items', menu_item_ids: [...allMenuItemIds] });
  };

  const openExistingGroup = (group) => {
    const selectedIds = group.applies_to === 'all_items'
      ? allMenuItemIds
      : group.applies_to === 'all_drinks'
        ? allDrinkIds
        : (group.menu_item_ids || []);
    const options = (group.options || []).map((option) => ({
      ...option,
      is_default: Boolean(option.is_default)
    }));
    setForm({
      ...group,
      applies_to: 'selected_items',
      selection_type: 'single',
      min_select: 1,
      max_select: 1,
      is_required: true,
      menu_item_ids: [...selectedIds],
      options
    });
  };

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

    const selectedItemIds = [...new Set((formData.menu_item_ids || []).map(Number))]
      .filter((itemId) => allMenuItemIds.includes(itemId));
    if (selectedItemIds.length === 0) {
      throw new Error('Keep at least one menu item selected for this option group.');
    }

    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...formData,
        applies_to: selectedItemIds.length === allMenuItemIds.length
          ? 'all_items'
          : selectedItemIds.length === allDrinkIds.length && selectedItemIds.every((itemId) => allDrinkIds.includes(itemId))
            ? 'all_drinks'
            : 'selected_items',
        menu_item_ids: selectedItemIds.length === allMenuItemIds.length || (selectedItemIds.length === allDrinkIds.length && selectedItemIds.every((itemId) => allDrinkIds.includes(itemId)))
          ? []
          : selectedItemIds,
        selection_type: 'single',
        min_select: 1,
        max_select: 1,
        is_required: true,
        sort_order: Number(formData.sort_order),
        options: formData.options.map((option, index) => ({
          ...option,
          sort_order: index,
          gradient_direction: option.gradient_direction || 'diagonal',
          price_delta_rm: Number(option.price_delta_rm),
          token_price_delta: Number(option.token_price_delta),
          calorie_delta_kcal: Number(option.calorie_delta_kcal),
          excluded_menu_item_ids: (option.excluded_menu_item_ids || [])
            .filter((itemId) => selectedItemIds.includes(Number(itemId)))
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
  }, [allDrinkIds, allMenuItemIds, form]);

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
    if (!await requestAdminConfirm({ title: 'Delete option group?', message: `“${group.name}” will no longer be available for new customer orders.`, confirmLabel: 'Delete', tone: 'danger' })) return;
    try {
      await deleteAdminOptionGroup(group.id);
      setMessage('Option group deleted.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Unable to delete option group.');
    }
  };

  const reorderGroups = async (targetId) => {
    if (draggedGroupId == null || draggedGroupId === targetId) return;
    const currentIndex = groups.findIndex((group) => group.id === draggedGroupId);
    const targetIndex = groups.findIndex((group) => group.id === targetId);
    if (currentIndex < 0 || targetIndex < 0) return;

    const nextGroups = [...groups];
    const [moved] = nextGroups.splice(currentIndex, 1);
    nextGroups.splice(targetIndex, 0, moved);
    setGroups(nextGroups);
    setDraggedGroupId(null);
    setMessage('Saving option group order...');
    try {
      await updateAdminOptionGroupOrder(nextGroups.map((group) => group.id));
      setMessage('Option group order saved for customer and counter apps.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Unable to save option group order.');
      await load();
    }
  };

  const handleGroupFormSubmit = async (event) => {
    event.preventDefault();
    try {
      await saveOptionGroup(form);
    } catch (error) {
      setMessage(error.message || 'Unable to save option group.');
    }
  };

  const updateOption = (index, patch) => {
    const options = [...form.options];
    options[index] = { ...options[index], ...patch };
    setForm({ ...form, options });
  };

  const setOptionDefault = (index) => {
    const options = form.options.map((option, optionIndex) => ({
      ...option,
      is_default: optionIndex === index
    }));
    setForm({ ...form, options });
  };

  const setChoiceAvailability = (optionIndex, menuItemId, isAvailable) => {
    const option = form.options[optionIndex];
    if (!isAvailable && option.is_default) {
      setMessage('The default choice must stay available for every selected item in this group.');
      return;
    }
    if (!isAvailable) {
      const availableChoiceCount = form.options.filter((choice) =>
        choice.is_active && !(choice.excluded_menu_item_ids || []).includes(menuItemId)
      ).length;
      if (availableChoiceCount <= 1) {
        setMessage('Keep at least one customer choice available for every selected item.');
        return;
      }
    }
    const excluded = option.excluded_menu_item_ids || [];
    updateOption(optionIndex, {
      excluded_menu_item_ids: isAvailable
        ? excluded.filter((itemId) => itemId !== menuItemId)
        : [...new Set([...excluded, menuItemId])]
    });
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Options &amp; Nutrition</h1>
            <InfoTooltip
              content="Configure reusable option modifiers (choice of milk, sweetness, beans, temperature) and assign them to menu items. Manage transparent calorie standards across all products."
              title="Options & Nutrition"
            />
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Reusable product modifiers, customer choices, and nutritional calorie standards.
          </p>
        </div>
        <button
          onClick={openNewGroup}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E433A] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#16342D] shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus size={15} /> New Option Group
        </button>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-[#B9D9D1] bg-[#F1FBF7] px-4 py-3 text-xs font-medium text-[#1F3A34] animate-in fade-in duration-200 shadow-2xs">
          <Sparkles size={15} className="text-[#2E5E58] shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Option Groups Section */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">Option Groups</h2>
            <InfoTooltip
              content="Customer choice modifiers for beans, milk, temperature, and syrups. Drag to reorder display priority in the mobile app."
              title="Option Groups"
            />
          </div>
          <span className="rounded-full bg-[#E8F3F0] px-3 py-1 text-xs font-bold text-[#1E433A]">
            {groups.length} {groups.length === 1 ? 'group' : 'groups'}
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {groups.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              No option groups configured yet. Click "New Option Group" to create one.
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className="p-5"
                draggable
                onDragStart={() => setDraggedGroupId(group.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void reorderGroups(group.id)}
                onDragEnd={() => setDraggedGroupId(null)}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cursor-grab text-gray-400 hover:text-gray-600 transition-colors" title="Drag to reorder" aria-label={`Drag ${group.name} to reorder`}>
                        <GripVertical size={18} />
                      </span>
                      <h3 className="font-bold text-gray-900 text-sm">{group.name}</h3>
                      <span className="rounded-full bg-[#E8F3F0] px-2.5 py-0.5 text-[11px] font-bold text-[#1E433A]">
                        {group.applies_to === 'all_items'
                          ? 'All menu items'
                          : group.applies_to === 'all_drinks'
                            ? 'All drinks'
                            : `${group.menu_item_ids.length} selected items`}
                      </span>
                      {!group.is_active && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Single-choice modifier per item
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openExistingGroup(group)}
                      className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      onClick={() => removeGroup(group)}
                      className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 shadow-2xs transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {group.options.map((option) => (
                    <div
                      key={option.id}
                      className="rounded-xl bg-gray-50/70 border border-gray-100 px-3 py-2 text-sm flex items-center justify-between"
                    >
                      <div className="flex items-center min-w-0 mr-2">
                        <span
                          className="mr-2 inline-block h-3 w-3 rounded-full shrink-0 shadow-2xs"
                          style={{
                            background: option.gradient_end_hex
                              ? `linear-gradient(${gradientDirectionToDeg(option.gradient_direction)}, ${option.color_hex || '#2D655D'}, ${option.gradient_end_hex})`
                              : option.color_hex || '#2D655D'
                          }}
                        />
                        <span className="font-semibold text-gray-900 text-xs truncate">{option.name}</span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px]">
                        <span className="text-gray-500 font-medium">RM {Number(option.price_delta_rm).toFixed(2)}</span>
                        <span className={`font-semibold ${tokenAdjustmentClass(option.token_price_delta)}`}>
                          {formatTokenAdjustment(option.token_price_delta)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <RecipeNutrition drinks={drinks} groups={groups} />

      {/* Base Calories Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">Base Calories (Food &amp; Merchandise)</h2>
              <InfoTooltip
                content="Standard calorie values for food, pastries, and merchandise. Drink nutrition is managed dynamically above with modifier options."
                title="Base Calories"
              />
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Calorie counts displayed on customer product detail cards.
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
      {form && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center overflow-y-auto bg-slate-900/35 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
          <form onSubmit={handleGroupFormSubmit} className="mx-auto my-auto w-full max-w-5xl max-h-[calc(100vh-2rem)] flex flex-col rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-4 sm:p-5 bg-white/80 backdrop-blur-xs">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">
                    {form.id ? 'Edit Option Group' : 'New Option Group'}
                  </h2>
                  <InfoTooltip
                    content="Option groups let customers personalize items at checkout (e.g. choose milk, syrup, or coffee beans). Changes apply to all new orders immediately."
                    title="Option Group"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Configure modifier choices, pricing deltas, and item bindings.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-5 p-4 sm:p-6">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-xs font-bold text-gray-700">Group Name</label>
                  <InfoTooltip content="The title shown to customers on the app customization sheet (e.g. 'Milk Choice', 'Sugar Level')." title="Group Name" />
                </div>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Choice of Milk"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm outline-none focus:border-[#2E5E58] bg-white shadow-2xs"
                />
              </div>

              <fieldset>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <legend className="text-xs font-bold text-gray-700 uppercase tracking-wider">Applicable Menu Items</legend>
                    <InfoTooltip
                      content="Select which menu items should display this option group. Untick items that should not offer this modifier."
                      title="Item Availability"
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {form.menu_item_ids.length} of {menuItems.length} selected
                  </span>
                </div>
                <div className="grid max-h-40 gap-2 overflow-y-auto rounded-2xl border border-gray-200 p-3 sm:grid-cols-2 bg-gray-50/40">
                  {menuItems.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-xs p-1 rounded-lg hover:bg-white transition-colors cursor-pointer">
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
                        className="rounded border-gray-300 text-[#1E433A] accent-[#1E433A]"
                      />
                      <span className="font-semibold text-gray-800 truncate">{item.name}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">({item.category_name})</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {form.id && (
                <fieldset className="rounded-2xl border border-[#D7E7E2] bg-[#F6FBF9] p-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <legend className="text-xs font-bold text-[#2E5E58] uppercase tracking-wider">Conditional Visibility</legend>
                    <InfoTooltip
                      content="Optional dependency rules. E.g., hide the 'Ice Level' group when the customer selects 'Temperature: Hot' or 'Hotter'."
                      title="Conditional Display"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 max-h-36 overflow-y-auto">
                    {groups.filter((group) => group.id !== form.id).flatMap((group) => (group.options || []).filter((option) => option.is_active).map((option) => (
                      <label key={option.id} className="flex items-center gap-2 rounded-xl border border-[#D7E7E2] bg-white px-3 py-2 text-xs text-slate-700 hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs">
                        <input
                          type="checkbox"
                          checked={(form.hidden_when_option_ids || []).includes(option.id)}
                          onChange={(event) => {
                            const current = form.hidden_when_option_ids || [];
                            setForm({
                              ...form,
                              hidden_when_option_ids: event.target.checked
                                ? [...current, option.id]
                                : current.filter((id) => id !== option.id)
                            });
                          }}
                          className="rounded border-gray-300 text-[#1E433A] accent-[#1E433A]"
                        />
                        <span className="font-semibold">{group.name}:</span>
                        <span>{option.name}</span>
                      </label>
                    )))}
                  </div>
                </fieldset>
              )}

              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Customer Choices</h3>
                    <InfoTooltip
                      content="Individual modifier choices (e.g. Oat Milk, Skim Milk). Extra RM or Token deltas apply when selected by the customer. A default choice will be pre-selected."
                      title="Customer Choices"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, options: [...form.options, emptyOption()] })}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#1E433A] hover:text-[#16342D] cursor-pointer"
                  >
                    <Plus size={14} /> Add Choice
                  </button>
                </div>
                <div className="space-y-3">
                  {form.options.map((option, index) => (
                    <div key={index} className="rounded-2xl border border-gray-200 p-4 bg-white space-y-3.5 shadow-2xs hover:border-gray-300 transition-colors">
                      {/* Row 1: Label, Extra Price, Token Adjustment, and Delete */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-5">
                          <label className="block text-xs font-bold text-gray-700 mb-1">Choice Label</label>
                          <input
                            required
                            placeholder="e.g. Oat Milk"
                            value={option.name}
                            onChange={(e) => updateOption(index, { name: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm bg-white outline-none focus:border-[#2E5E58] shadow-2xs"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <div className="flex items-center gap-1 mb-1">
                            <label className="text-xs font-bold text-gray-700">Extra Price (RM)</label>
                            <InfoTooltip
                              content="Additional cash price when selecting this choice. Set to 0 if included in base item price."
                              title="Extra Price"
                            />
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            value={option.price_delta_rm}
                            onChange={(e) => updateOption(index, { price_delta_rm: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm bg-white outline-none focus:border-[#2E5E58] shadow-2xs"
                            placeholder="0.00"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <div className="flex items-center gap-1 mb-1">
                            <label className="text-xs font-bold text-gray-700">Token Adjustment</label>
                            <InfoTooltip
                              content="Adjusts the required loyalty tokens for this choice. Set to 0 for no change. Use negative numbers (e.g. -10) to deduct or discount tokens."
                              title="Token Adjustment"
                            />
                          </div>
                          <input
                            type="number"
                            min="-999"
                            max="999"
                            value={option.token_price_delta}
                            onChange={(e) => updateOption(index, { token_price_delta: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm bg-white outline-none focus:border-[#2E5E58] shadow-2xs"
                            placeholder="0"
                          />
                        </div>

                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            disabled={form.options.length === 1}
                            onClick={() => {
                              const options = form.options.filter((_, optionIndex) => optionIndex !== index);
                              setForm({ ...form, options });
                            }}
                            title="Remove Choice"
                            className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-25 transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Visual Styling & Default Choice Selection */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap items-center gap-3">
                          {isBeanGroup(form.name) && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-gray-700">Bean Image</span>
                                <InfoTooltip content="Square PNG, JPG, or WebP. Appears illuminated when chosen in the customer app." title="Bean Image" />
                              </div>
                              <label className="flex h-8 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white hover:bg-gray-50 shadow-2xs">
                                {option.image_url ? (
                                  <img
                                    src={option.image_url}
                                    alt={`${option.name || 'Bean'} preview`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                                    <ImagePlus size={12} />
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

                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-700">Card Color:</span>
                            <input
                              type="color"
                              value={option.color_hex || '#2D655D'}
                              onChange={(e) => updateOption(index, { color_hex: e.target.value })}
                              className="h-8 w-9 cursor-pointer rounded-lg border border-gray-200 p-0.5 bg-white shadow-2xs"
                              title="Card Color"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-700">Gradient End:</span>
                            <input
                              type="color"
                              value={option.gradient_end_hex || option.color_hex || '#2D655D'}
                              onChange={(e) => updateOption(index, { gradient_end_hex: e.target.value })}
                              className="h-8 w-9 cursor-pointer rounded-lg border border-gray-200 p-0.5 bg-white shadow-2xs"
                              title="Gradient End (Optional)"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-700">Direction:</span>
                            <select
                              value={option.gradient_direction || 'diagonal'}
                              onChange={(e) => updateOption(index, { gradient_direction: e.target.value })}
                              disabled={!option.gradient_end_hex}
                              title={!option.gradient_end_hex ? 'Set a gradient end colour first' : undefined}
                              className="rounded-lg border border-gray-200 px-2 py-1 text-xs bg-white outline-none focus:border-[#2E5E58] shadow-2xs font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <option value="diagonal">↗ Diagonal</option>
                              <option value="horizontal">→ Horizontal</option>
                              <option value="vertical">↓ Vertical</option>
                            </select>
                          </div>
                        </div>

                        {/* Default Choice Toggle */}
                        <div className="flex items-center gap-2">
                          <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            option.is_default
                              ? 'bg-[#E8F3F0] border-[#2E5E58] text-[#1E433A] shadow-2xs'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}>
                            <input
                              type="radio"
                              name="default-customer-choice"
                              checked={option.is_default === true}
                              onChange={() => setOptionDefault(index)}
                              className="sr-only"
                            />
                            <span className={`h-2 w-2 rounded-full ${option.is_default ? 'bg-[#1E433A]' : 'bg-gray-300'}`} />
                            <span>{option.is_default ? 'Default Choice' : 'Set Default'}</span>
                          </label>

                          {option.is_default && (
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, options: form.options.map((entry) => ({ ...entry, is_default: false })) })}
                              className="text-[11px] font-medium text-gray-400 hover:text-gray-600 underline cursor-pointer"
                            >
                              No default
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Availability Accordion */}
                      <details className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs">
                        <summary className="cursor-pointer font-semibold text-gray-600 hover:text-gray-900 flex items-center justify-between">
                          <span>Available for {form.menu_item_ids.filter((itemId) => !(option.excluded_menu_item_ids || []).includes(itemId)).length} of {form.menu_item_ids.length} selected items</span>
                          <span className="text-[10px] text-gray-400 font-normal">Click to restrict items</span>
                        </summary>
                        <div className="mt-2.5 pt-2 border-t border-gray-200/60 grid max-h-32 gap-1.5 overflow-y-auto sm:grid-cols-2">
                          {menuItems.filter((item) => form.menu_item_ids.includes(item.id)).map((item) => (
                            <label key={item.id} className="flex items-center gap-2 text-xs text-gray-700 p-1 hover:bg-white rounded transition-colors cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!(option.excluded_menu_item_ids || []).includes(item.id)}
                                disabled={option.is_default === true}
                                onChange={(event) => setChoiceAvailability(index, item.id, event.target.checked)}
                                className="rounded text-[#1E433A] accent-[#1E433A]"
                              />
                              <span className="truncate">{item.name}</span>
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-3 border-t p-4 sm:p-5 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="rounded-xl bg-[#1E433A] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#16342D] disabled:opacity-60 shadow-xs transition-all cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Option Group'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
