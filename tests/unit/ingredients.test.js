import { describe, it, expect } from 'vitest';
import { RECIPE_DETAIL } from '../fixtures/data.js';
import { ingredientDisplayText, ingLinkBadge } from '../../js/utils.js';

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
