import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConditionalVisibilityOptions,
  inferMenuItemIdsFromTriggerOptions,
  normalizeOptionIds,
  resolveGroupActiveMenuItemIds
} from '../src/lib/optionVisibility.js';

test('builds visibility choices from every other option group', () => {
  const result = buildConditionalVisibilityOptions([
    { id: 10, name: 'Sweetness', options: [{ id: 1, name: 'Less sweet' }] },
    { id: 20, name: 'Temperature', options: [{ id: 2, name: 'Hot' }, { id: 3, name: 'Cold' }] }
  ], 10);

  assert.deepEqual(
    result.map(({ groupName, optionName }) => `${groupName}: ${optionName}`),
    ['Temperature: Cold', 'Temperature: Hot']
  );
});

test('preserves selected inactive choices and excludes unselected inactive choices', () => {
  const result = buildConditionalVisibilityOptions([
    { id: 10, name: 'Current', options: [] },
    { id: 20, name: 'Archived group', is_active: false, options: [
      { id: 2, name: 'Old choice', is_active: false },
      { id: 3, name: 'Unused old choice', is_active: false }
    ] }
  ], 10, [2]);

  assert.deepEqual(result, [{
    id: 2,
    groupName: 'Archived group',
    optionName: 'Old choice',
    isActive: false
  }]);
});

test('normalizes ids and excludes the current group', () => {
  assert.deepEqual(normalizeOptionIds(['4', 4, 'bad', 0, -2, 9.5]), [4]);
  const result = buildConditionalVisibilityOptions([
    { id: '10', name: 'Current', options: [{ id: '1', name: 'Own choice' }] },
    { id: '20', name: 'Other', options: [{ id: '2', name: 'Other choice' }] }
  ], '10');
  assert.deepEqual(result.map((item) => item.id), [2]);
});

test('infers active menu items from parent trigger option group when dependent group has 0 items', () => {
  const groups = [
    {
      id: 1,
      name: 'Choose of Water',
      applies_to: 'selected_items',
      menu_item_ids: [101, 102, 999],
      options: [
        { id: 11, name: 'Still Water' },
        { id: 12, name: 'Sparkling Water' }
      ]
    },
    {
      id: 2,
      name: 'Choice of Sparkling',
      applies_to: 'selected_items',
      menu_item_ids: [],
      options: [
        { id: 21, name: 'Ginger Ade' },
        { id: 22, name: 'Tonic Water' }
      ]
    }
  ];

  assert.deepEqual(
    resolveGroupActiveMenuItemIds(groups[0], [101, 102, 103], [101, 102]),
    [101, 102]
  );
  assert.deepEqual(
    inferMenuItemIdsFromTriggerOptions(groups, [11], [101, 102, 103], [101, 102]),
    [101, 102]
  );
});
