import React, { useEffect, useState } from 'react';
import { Check, ChevronRight, Save, X } from 'lucide-react';
import {
  applyAdminOptionNutritionToDrinks,
  loadAdminRecipeNutrition,
  saveAdminOptionNutritionOverrides,
  updateAdminMenuNutrition
} from '../lib/adminApi';

export default function RecipeNutrition({ drinks, groups }) {
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [baseCalories, setBaseCalories] = useState(0);
  const [optionCalories, setOptionCalories] = useState({});
  const [savedNutrition, setSavedNutrition] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedDrink = drinks.find((drink) => drink.id === selectedItemId);
  const applicableGroups = groups.filter((group) => group.applies_to === 'all_drinks' || group.menu_item_ids?.includes(selectedItemId));

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
          const applicable = group.applies_to === 'all_drinks' || group.menu_item_ids?.includes(drink.id);
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

  const closeEditor = () => {
    if (saving) return;
    if (hasUnsavedChanges && !window.confirm('Close without saving? Your nutrition changes for this drink will be discarded.')) return;
    setSelectedItemId(null);
    setMessage('');
  };

  const selectDrink = (drinkId) => {
    if (selectedItemId === drinkId) {
      closeEditor();
      return;
    }
    if (hasUnsavedChanges && !window.confirm('Switch drinks without saving? Your nutrition changes for this drink will be discarded.')) return;
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
    if (!window.confirm(`Apply ${optionCalories[option.id] ?? 0} kcal for ${option.name} to every applicable drink? This changes only ${option.name}; every other option and base calorie stays unchanged.`)) return;
    setSaving(true); setMessage('');
    try {
      const result = await applyAdminOptionNutritionToDrinks(option.id, Math.round(Number(optionCalories[option.id]) || 0));
      setMessage(`${option.name} was applied to ${result.applied_to_drinks} applicable drinks. Other option values were unchanged.`);
    } catch (error) { setMessage(error.message || 'Unable to apply option calories to drinks.'); } finally { setSaving(false); }
  };

  const nutritionEditor = selectedDrink ? (
    <div className="col-span-full rounded-xl border border-[#B9D9D1] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2E5E58]">Editing drink</p>
          <h3 className="text-lg font-bold text-gray-900">{selectedDrink.name}</h3>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm font-bold text-gray-800">
            Base calories
            <input type="number" min="0" value={baseCalories} onChange={(event) => setBaseCalories(event.target.value)} className="ml-2 w-24 rounded-lg border border-gray-300 px-2 py-2 text-right text-sm" /> kcal
          </label>
          <button type="button" onClick={closeEditor} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <X size={16} /> Close
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-5">
        {applicableGroups.map((group) => (
          <div key={group.id}>
            <div>
              <h4 className="text-sm font-bold text-gray-900">{group.name}</h4>
              <p className="text-xs text-gray-500">This value belongs to {selectedDrink.name} only. Apply all copies this option to applicable drinks.</p>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {group.options.filter((option) => option.is_active).map((option) => (
                <div key={option.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                  <span className="min-w-0 flex-1 text-sm font-semibold text-gray-800">{option.name}</span>
                  <input type="number" value={optionCalories[option.id] ?? 0} onChange={(event) => setOptionCalories({ ...optionCalories, [option.id]: event.target.value })} className="w-20 rounded border border-gray-300 px-2 py-1.5 text-right text-sm" aria-label={`${option.name} calories`} />
                  <span className="text-xs text-gray-500">kcal</span>
                  <button type="button" disabled={saving} onClick={() => applyOptionToAll(option)} className="rounded border border-[#2E5E58] px-2 py-1.5 text-xs font-bold text-[#1F3A34] hover:bg-[#F1FBF7] disabled:opacity-50">Apply all</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
        <button type="button" disabled={saving} onClick={saveDrink} className="inline-flex items-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:opacity-60">
          <Save size={16} /> {saving ? 'Saving...' : `Save ${selectedDrink.name}`}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <section className="rounded-2xl border border-[#B9D9D1] bg-[#F7FCFA] p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-bold text-gray-900">Drink Nutrition</h2>
        <p className="mt-1 text-sm text-gray-600">Choose a drink from the menu, then enter its own base and option calories. Use Apply all beside any option to copy only that option's value to every applicable drink.</p>
      </div>
      {message && <p className="mb-4 rounded-lg border border-[#B9D9D1] bg-white px-3 py-2 text-sm text-[#1F3A34]">{message}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {drinks.map((drink) => (
          <React.Fragment key={drink.id}>
            <button type="button" onClick={() => selectDrink(drink.id)} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selectedItemId === drink.id ? 'border-[#2E5E58] bg-white ring-2 ring-[#2E5E58]/20' : 'border-gray-200 bg-white hover:border-[#7EAAA2]'}`}>
              <span><span className="block text-sm font-bold text-gray-900">{drink.name}</span><span className="mt-0.5 block text-xs text-gray-500">Base: {drink.base_calories_kcal ?? 0} kcal</span></span>
              {selectedItemId === drink.id ? <Check size={18} className="text-[#2E5E58]" /> : <ChevronRight size={18} className="text-gray-400" />}
            </button>
            {selectedItemId === drink.id && nutritionEditor}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
