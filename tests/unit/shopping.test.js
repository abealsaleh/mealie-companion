import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SHOPPING_LIST_DETAIL } from '../fixtures/data.js';
import { getItemDisplayName, getItem } from '../../js/utils.js';

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
    const item = getItem('item-1', SHOPPING_LIST_DETAIL.listItems);
    expect(item.food.name).toBe('Chicken Breast');
  });

  it('returns undefined for missing id', () => {
    expect(getItem('no-such-id', SHOPPING_LIST_DETAIL.listItems)).toBeUndefined();
  });
});
