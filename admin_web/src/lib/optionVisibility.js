export function normalizeOptionIds(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0))];
}

export function buildConditionalVisibilityOptions(groups, currentGroupId, selectedIds = []) {
  const currentId = Number(currentGroupId);
  const selected = new Set(normalizeOptionIds(selectedIds));

  return (Array.isArray(groups) ? groups : [])
    .filter((group) => Number(group?.id) !== currentId)
    .flatMap((group) => (Array.isArray(group?.options) ? group.options : []).flatMap((option) => {
      const id = Number(option?.id);
      if (!Number.isInteger(id) || id <= 0) return [];
      const isActive = group?.is_active !== false && option?.is_active !== false;
      if (!isActive && !selected.has(id)) return [];
      return [{
        id,
        groupName: group.name || 'Unnamed option group',
        optionName: option.name || 'Unnamed choice',
        isActive
      }];
    }))
    .sort((a, b) => `${a.groupName}\u0000${a.optionName}`.localeCompare(`${b.groupName}\u0000${b.optionName}`, undefined, { sensitivity: 'base' }));
}

export function resolveGroupActiveMenuItemIds(group, allMenuItemIds = [], allDrinkIds = []) {
  if (!group) return [];
  const activeMenuSet = new Set(normalizeOptionIds(allMenuItemIds));
  if (group.applies_to === 'all_items') {
    return [...activeMenuSet];
  }
  if (group.applies_to === 'all_drinks') {
    return normalizeOptionIds(allDrinkIds).filter((id) => activeMenuSet.has(id));
  }
  return normalizeOptionIds(group.menu_item_ids).filter((id) => activeMenuSet.has(id));
}

export function inferMenuItemIdsFromTriggerOptions(
  groups,
  triggerOptionIds = [],
  allMenuItemIds = [],
  allDrinkIds = [],
  explicitTriggerGroupIds = []
) {
  const targetOptionSet = new Set(normalizeOptionIds(triggerOptionIds));
  const targetGroupSet = new Set(normalizeOptionIds(explicitTriggerGroupIds));
  const inheritedItemIds = new Set();

  for (const group of Array.isArray(groups) ? groups : []) {
    const groupId = Number(group?.id);
    const hasMatchingOption = (Array.isArray(group?.options) ? group.options : []).some((option) =>
      targetOptionSet.has(Number(option?.id))
    );
    if (!hasMatchingOption && !targetGroupSet.has(groupId)) continue;
    for (const itemId of resolveGroupActiveMenuItemIds(group, allMenuItemIds, allDrinkIds)) {
      inheritedItemIds.add(itemId);
    }
  }

  return [...inheritedItemIds];
}

