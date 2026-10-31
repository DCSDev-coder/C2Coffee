import React, { useEffect, useState } from 'react';
import { ChevronRight, Save, X } from 'lucide-react';
import InfoTooltip from './InfoTooltip';
import {
  applyAdminOptionNutritionToDrinks,
  loadAdminRecipeNutrition,
  saveAdminOptionNutritionOverrides,
  updateAdminMenuNutrition
} from '../lib/adminApi';
import { requestAdminConfirm } from '../lib/adminDialog';

export default function RecipeNutrition({ drinks, groups }) {
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [baseCalories, setBaseCalories] = useState(0);
  const [optionCalories, setOptionCalories] = useState({});
  const [savedNutrition, setSavedNutrition] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedDrink = drinks.find((drink) => drink.id === selectedItemId);
  const applicableGroups = groups.filter((group) => group.applies_to === 'all_drinks' || group.applies_to === 'all_items' || group.menu_item_ids?.includes(selectedItemId));

  useEffect(() => {
    const drink = drinks.find((item) => item.id === selectedItemId);
    if (!drink) return;
    setBaseCalories(drink.base_calories_kcal ?? 0);
    setMessage('');
    setSavedNutrition(null);
    void loadAdminRecipeNutrition(drink.id)
      .then((response) => {
        const overrides = Object.fromEntries((response.option_overrides || []).map((override) => [override.option_id, Number(override.calorie_delta_kcal)]));
        const values = {};
        for (const group of groups) {
          const applicable = group.applies_to === 'all_drinks' || group.applies_to === 'all_items' || group.menu_item_ids?.includes(drink.id);
          if (!applicable) continue;
          for (const option of group.options || []) values[option.id] = overrides[option.id] ?? Number(option.calorie_delta_kcal || 0);
        }
        setOptionCalories(values);
        setSavedNutrition({
          baseCalories: Number(drink.base_calories_kcal ?? 0),
          optionCalories: values
        });
      })
      .catch((error) => setMessage(error.message || 'Unable to load nutrition for this drink.'));
  }, [selectedItemId, drinks, groups]);

  const hasUnsavedChanges = selectedDrink && savedNutrition && (
    Math.round(Number(baseCalories) || 0) !== savedNutrition.baseCalories ||
    JSON.stringify(Object.entries(optionCalories).map(([id, value]) => [id, Math.round(Number(value) || 0)]).sort()) !==
      JSON.stringify(Object.entries(savedNutrition.optionCalories).map(([id, value]) => [id, Math.round(Number(value) || 0)]).sort())
  );

  const closeEditor = async () => {
    if (saving) return;
    if (hasUnsavedChanges && !await requestAdminConfirm({ title: 'Discard nutrition changes?', message: 'Your unsaved nutrition changes for this drink will be lost.', confirmLabel: 'Discard', tone: 'danger' })) return;
    setSelectedItemId(null);
    setMessage('');
  };

  const selectDrink = async (drinkId) => {
    if (selectedItemId === drinkId) {
      await closeEditor();
      return;
    }
    if (hasUnsavedChanges && !await requestAdminConfirm({ title: 'Switch drinks?', message: 'Your unsaved nutrition changes for the current drink will be lost.', confirmLabel: 'Switch', tone: 'danger' })) return;
    setSelectedItemId(drinkId);
  };

  const saveDrink = async () => {
    if (!selectedDrink) return;
    setSaving(true); setMessage('');
    try {
      await Promise.all([
        updateAdminMenuNutrition(selectedDrink.id, Math.max(0, Math.round(Number(baseCalories) || 0))),
        saveAdminOptionNutritionOverrides(selectedDrink.id, Object.entries(optionCalories).map(([option_id, calorie_delta_kcal]) => ({ option_id: Number(option_id), calorie_delta_kcal: Math.round(Number(calorie_delta_kcal) || 0) })))
      ]);
      setSavedNutrition({
        baseCalories: Math.max(0, Math.round(Number(baseCalories) || 0)),
        optionCalories: Object.fromEntries(
          Object.entries(optionCalories).map(([optionId, calories]) => [optionId, Math.round(Number(calories) || 0)])
        )
      });
      setMessage(`${selectedDrink.name} nutrition saved. Every displayed option now has its own value for this drink.`);
    } catch (error) { setMessage(error.message || 'Unable to save drink nutrition.'); } finally { setSaving(false); }
  };

  const applyOptionToAll = async (option) => {
    if (!await requestAdminConfirm({ title: 'Apply nutrition value?', message: `Apply ${optionCalories[option.id] ?? 0} kcal for ${option.name} to every applicable drink? Other options and base calories remain unchanged.`, confirmLabel: 'Apply' })) return;
    setSaving(true); setMessage('');
    try {
      const result = await applyAdminOptionNutritionToDrinks(option.id, Math.round(Number(optionCalories[option.id]) || 0));
      setMessage(`${option.name} was applied to ${result.applied_to_drinks} applicable drinks. Other option values were unchanged.`);
    } catch (error) { setMessage(error.message || 'Unable to apply option calories to drinks.'); } finally { setSaving(false); }
  };

  const nutritionEditor = selectedDrink ? (
    <div className="col-span-full rounded-2xl border border-[#B9D9D1] bg-white p-5 shadow-xs">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2E5E58]">Editing Drink Recipe</span>
          <h3 className="text-lg font-bold text-gray-900">{selectedDrink.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center text-xs font-bold text-gray-700">
            <span>Base calories:</span>
            <input
              type="number"
              min="0"
              value={baseCalories}
              onChange={(event) => setBaseCalories(event.target.value)}
              className="ml-2 w-20 rounded-xl border border-gray-200 px-2.5 py-1.5 text-right text-xs font-bold text-gray-900 bg-white shadow-2xs outline-none focus:border-[#2E5E58]"
            />
            <span className="ml-1 text-gray-400 font-normal">kcal</span>
          </label>
          <button
            type="button"
            onClick={closeEditor}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={14} /> Close
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {applicableGroups.map((group) => (
          <div key={group.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{group.name}</h4>
              <InfoTooltip
                content={`Adjust calorie delta specifically for ${selectedDrink.name}. Click 'Apply All' to bulk propagate this value across other drinks.`}
                title={group.name}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.options.filter((option) => option.is_active).map((option) => (
                <div key={option.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-2xs">
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-800">{option.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      value={optionCalories[option.id] ?? 0}
                      onChange={(event) => setOptionCalories({ ...optionCalories, [option.id]: event.target.value })}
                      className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-right text-xs font-bold text-gray-900 outline-none focus:border-[#2E5E58]"
                      aria-label={`${option.name} calories`}
                    />
                    <span className="text-[10px] text-gray-400 font-medium">kcal</span>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => applyOptionToAll(option)}
                    className="rounded-lg border border-[#2E5E58]/30 px-2 py-1 text-[10px] font-bold text-[#1E433A] hover:bg-[#F1FBF7] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Apply All
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
        <button
          type="button"
          disabled={saving}
          onClick={saveDrink}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1E433A] px-5 py-2 text-xs font-bold text-white hover:bg-[#16342D] shadow-xs transition-all cursor-pointer disabled:opacity-60"
        >
          <Save size={14} /> {saving ? 'Saving...' : `Save ${selectedDrink.name}`}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <section className="rounded-2xl border border-[#B9D9D1] bg-[#F7FCFA] p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-900">Drink Nutrition Recipes</h2>
          <InfoTooltip
            content="Select a drink to configure its base calories and customize modifier calorie deltas (milk, syrups, beans). Use 'Apply All' to sync a modifier's calorie value across all drinks."
            title="Drink Nutrition"
          />
        </div>
        <span className="text-xs font-semibold text-gray-500">
          {drinks.length} {drinks.length === 1 ? 'drink' : 'drinks'}
        </span>
      </div>
      {message && <p className="mb-4 rounded-xl border border-[#B9D9D1] bg-white px-3 py-2 text-xs font-medium text-[#1F3A34] shadow-2xs">{message}</p>}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {drinks.map((drink) => (
          <React.Fragment key={drink.id}>
            <button
              type="button"
              onClick={() => selectDrink(drink.id)}
              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all cursor-pointer ${
                selectedItemId === drink.id
                  ? 'border-[#2E5E58] bg-white ring-2 ring-[#2E5E58]/20 shadow-xs'
                  : 'border-gray-200 bg-white hover:border-[#7EAAA2] shadow-2xs'
              }`}
            >
              <div className="min-w-0 pr-2">
                <p className="truncate text-xs font-bold text-gray-900">{drink.name}</p>
                <p className="text-[10px] text-gray-400 font-medium">{drink.base_calories_kcal ?? 0} kcal base</p>
              </div>
              <ChevronRight size={14} className={`shrink-0 transition-transform ${selectedItemId === drink.id ? 'rotate-90 text-[#2E5E58]' : 'text-gray-400'}`} />
            </button>
            {selectedItemId === drink.id && nutritionEditor}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
