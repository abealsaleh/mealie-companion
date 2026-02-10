import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SHOPPING_LIST_DETAIL } from '../fixtures/data.js';

let getItemDisplayName, getItem, state;

beforeEach(async () => {
  vi.resetModules();
  const stateModule = await import('../../js/state.js');
  state = stateModule.state;
  const mod = await import('../../js/shopping.js');
  getItemDisplayName = mod.getItemDisplayName;
  getItem = mod.getItem;
});

describe('getItemDisplayName()', () => {
  it('returns food name when present', () => {
    expect(getItemDisplayName(SHOPPING_LIST_DETAIL.listItems[0])).toBe('Chicken Breast');
  });

  it('returns note when no food', () => {
    expect(getItemDisplayName(SHOPPING_LIST_DETAIL.listItems[1])).toBe('organic only');
  });

  it('returns display when no food or note', () => {
    expect(getItemDisplayName({ food: null, note: '', display: 'Misc item' })).toBe('Misc item');
  });

  it('returns "(unnamed)" as fallback', () => {
    expect(getItemDisplayName({ food: null, note: '', display: '' })).toBe('(unnamed)');
  });

  it('food name takes precedence over note', () => {
    const item = { food: { name: 'Butter' }, note: 'unsalted', display: 'x' };
    expect(getItemDisplayName(item)).toBe('Butter');
  });
});

describe('getItem()', () => {
  it('finds item by id', () => {
    state.activeListItems = SHOPPING_LIST_DETAIL.listItems;
    const item = getItem('item-1');
    expect(item.food.name).toBe('Chicken Breast');
  });

  it('returns undefined for missing id', () => {
    state.activeListItems = SHOPPING_LIST_DETAIL.listItems;
    expect(getItem('no-such-id')).toBeUndefined();
  });
});
