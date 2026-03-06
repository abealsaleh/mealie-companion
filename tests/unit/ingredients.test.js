import { describe, it, expect } from 'vitest';
import { RECIPE_DETAIL, SHOPPING_LIST_DETAIL } from '../fixtures/data.js';
import { ingredientDisplayText, ingLinkBadge, partitionIngredientsForList } from '../../js/utils.js';

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
});
