import { describe, it, expect } from 'vitest';
import { RECIPE_DETAIL, SHOPPING_LIST_DETAIL } from '../fixtures/data.js';
import { ingredientDisplayText, ingLinkBadge, partitionIngredientsForList, findMatchingItem, shoppingQty, mergeIntoItem } from '../../js/utils.js';

function makeIng(overrides = {}) {
  return { qty: null, unitName: '', name: '', ingNote: '', foodId: '', labelName: '', ...overrides };
}

describe('ingredientDisplayText()', () => {
  it('shows qty + unit + name', () => {
    const src = RECIPE_DETAIL.recipeIngredient[0];
    const ing = makeIng({ qty: src.quantity, unitName: src.unit.name, name: src.food.name });
    expect(ingredientDisplayText(ing)).toBe('2 pound Chicken Breast');
  });

  it('shows qty only (no unit)', () => {
    const ing = makeIng({ qty: 3, name: 'Eggs' });
    expect(ingredientDisplayText(ing)).toBe('3 Eggs');
  });

  it('handles fractional qty', () => {
    const src = RECIPE_DETAIL.recipeIngredient[1];
    const ing = makeIng({ qty: src.quantity, unitName: src.unit.name, name: src.food.name });
    expect(ingredientDisplayText(ing)).toBe('0.5 cup Olive Oil');
  });

  it('integer qty has no trailing .0', () => {
    const ing = makeIng({ qty: 2.0, name: 'Apples' });
    expect(ingredientDisplayText(ing)).toBe('2 Apples');
  });

  it('includes note in parens', () => {
    const src = RECIPE_DETAIL.recipeIngredient[0];
    const ing = makeIng({ qty: src.quantity, unitName: src.unit.name, name: src.food.name, ingNote: src.note });
    expect(ingredientDisplayText(ing)).toBe('2 pound Chicken Breast (boneless)');
  });

  it('shows name only', () => {
    const ing = makeIng({ name: 'Salt' });
    expect(ingredientDisplayText(ing)).toBe('Salt');
  });

  it('returns "(unnamed)" when no parts', () => {
    const ing = makeIng();
    expect(ingredientDisplayText(ing)).toBe('(unnamed)');
  });
});

describe('ingLinkBadge()', () => {
  it('shows label name when linked with label', () => {
    const ing = makeIng({ foodId: 'food-1', labelName: 'Meat' });
    const badge = ingLinkBadge(ing);
    expect(badge.text).toBe('Meat');
    expect(badge.linked).toBe(true);
  });

  it('shows "Linked" when linked without label', () => {
    const ing = makeIng({ foodId: 'food-1', labelName: '' });
    const badge = ingLinkBadge(ing);
    expect(badge.text).toBe('Linked');
    expect(badge.linked).toBe(true);
  });

  it('shows "Not linked" when not linked', () => {
    const ing = makeIng({ foodId: '', labelName: '' });
    const badge = ingLinkBadge(ing);
    expect(badge.text).toBe('Not linked');
    expect(badge.linked).toBe(false);
  });
});

describe('partitionIngredientsForList()', () => {
  it('puts item with matching foodId into toUpdate with correct existing ref', () => {
    const existing = SHOPPING_LIST_DETAIL.listItems;
    const items = [makeIng({ foodId: 'food-1', name: 'Chicken Breast' })];

    const { toCreate, toUpdate } = partitionIngredientsForList(items, existing);

    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0].existing.id).toBe('item-1');
    expect(toUpdate[0].existing.food.id).toBe('food-1');
    expect(toUpdate[0].ing).toBe(items[0]);
  });

  it('puts item with unmatched foodId into toCreate', () => {
    const existing = SHOPPING_LIST_DETAIL.listItems;
    const items = [makeIng({ foodId: 'food-999', name: 'Dragon Fruit' })];

    const { toCreate, toUpdate } = partitionIngredientsForList(items, existing);

    expect(toCreate).toHaveLength(1);
    expect(toCreate[0]).toBe(items[0]);
    expect(toUpdate).toHaveLength(0);
  });

  it('puts item with no foodId into toCreate regardless of list contents', () => {
    const existing = SHOPPING_LIST_DETAIL.listItems;
    const items = [makeIng({ foodId: '', name: 'Chicken Breast' })];

    const { toCreate, toUpdate } = partitionIngredientsForList(items, existing);

    expect(toCreate).toHaveLength(1);
    expect(toCreate[0]).toBe(items[0]);
    expect(toUpdate).toHaveLength(0);
  });

  it('correctly splits a mix of new and existing items', () => {
    const existing = [
      { id: 'e-1', food: { id: 'food-A', name: 'Apples' }, quantity: 3 },
      { id: 'e-2', food: { id: 'food-B', name: 'Bananas' }, quantity: 1 },
    ];
    const items = [
      makeIng({ foodId: 'food-A', name: 'Apples' }),
      makeIng({ foodId: 'food-C', name: 'Cherries' }),
      makeIng({ foodId: '', name: 'Salt' }),
      makeIng({ foodId: 'food-B', name: 'Bananas' }),
    ];

    const { toCreate, toUpdate } = partitionIngredientsForList(items, existing);

    expect(toCreate).toHaveLength(2);
    expect(toCreate[0].name).toBe('Cherries');
    expect(toCreate[1].name).toBe('Salt');
    expect(toUpdate).toHaveLength(2);
    expect(toUpdate[0].ing.name).toBe('Apples');
    expect(toUpdate[0].existing.id).toBe('e-1');
    expect(toUpdate[1].ing.name).toBe('Bananas');
    expect(toUpdate[1].existing.id).toBe('e-2');
  });

  it('prefers an unchecked item over a checked one with the same food (regression: issue #19)', () => {
    const existing = [
      { id: 'done', checked: true, food: { id: 'food-A' }, quantity: 1 },
      { id: 'active', checked: false, food: { id: 'food-A' }, quantity: 2 },
    ];
    const { toUpdate } = partitionIngredientsForList([makeIng({ foodId: 'food-A' })], existing);
    expect(toUpdate[0].existing.id).toBe('active');
  });

  it('matches a checked item when it is the only one for that food', () => {
    const existing = SHOPPING_LIST_DETAIL.listItems;
    const items = [makeIng({ foodId: 'food-2', name: 'Milk' })];

    const { toCreate, toUpdate } = partitionIngredientsForList(items, existing);

    expect(toCreate).toHaveLength(0);
    expect(toUpdate[0].existing.id).toBe('item-3');
  });
});

describe('findMatchingItem()', () => {
  it('returns null without a foodId or a match', () => {
    const existing = SHOPPING_LIST_DETAIL.listItems;
    expect(findMatchingItem(existing, '')).toBeNull();
    expect(findMatchingItem(existing, 'food-999')).toBeNull();
  });
});

describe('mergeIntoItem()', () => {
  it('unchecks a checked item and resets quantity to the requested amount (regression: issue #19)', () => {
    const checkedItem = SHOPPING_LIST_DETAIL.listItems.find(i => i.id === 'item-3');
    const merged = mergeIntoItem({ ...checkedItem, quantity: 4 }, 2);

    expect(merged.checked).toBe(false);
    expect(merged.quantity).toBe(2);
    expect(merged.updatedAt).not.toBe(checkedItem.updatedAt);
    expect(merged.id).toBe('item-3');
  });

  it('adds to the quantity of an unchecked item', () => {
    const item = SHOPPING_LIST_DETAIL.listItems.find(i => i.id === 'item-1');
    const merged = mergeIntoItem(item, 3);

    expect(merged.checked).toBe(false);
    expect(merged.quantity).toBe(item.quantity + 3);
  });
});

describe('shoppingQty()', () => {
  it('rounds up the amount for buyable units', () => {
    expect(shoppingQty(makeIng({ qty: 1.5, unitId: 'u', unitName: 'Can' }))).toBe(2);
  });

  it('defaults to 1 for measured units, missing units, or no amount', () => {
    expect(shoppingQty(makeIng({ qty: 500, unitId: 'u', unitName: 'gram' }))).toBe(1);
    expect(shoppingQty(makeIng({ qty: 3 }))).toBe(1);
    expect(shoppingQty(makeIng({ qty: 0, unitId: 'u', unitName: 'can' }))).toBe(1);
  });
});
