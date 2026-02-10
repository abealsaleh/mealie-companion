import { describe, it, expect } from 'vitest';
import { PLAN_DAYS, MEAL_ORDER, SHOPPING_UNITS, DAY_NAMES, MONTH_SHORT, SK } from '../../js/constants.js';
import { allLabels, labelMap } from '../../js/signals.js';

describe('state constants', () => {
  it('PLAN_DAYS is 8', () => {
    expect(PLAN_DAYS).toBe(8);
  });

  it('MEAL_ORDER has expected length and contents', () => {
    expect(MEAL_ORDER).toHaveLength(7);
    expect(MEAL_ORDER).toContain('breakfast');
    expect(MEAL_ORDER).toContain('lunch');
    expect(MEAL_ORDER).toContain('dinner');
    expect(MEAL_ORDER).toContain('side');
    expect(MEAL_ORDER).toContain('snack');
    expect(MEAL_ORDER).toContain('dessert');
    expect(MEAL_ORDER).toContain('drink');
  });

  it('SHOPPING_UNITS contains expected values', () => {
    expect(SHOPPING_UNITS.has('can')).toBe(true);
    expect(SHOPPING_UNITS.has('jar')).toBe(true);
    expect(SHOPPING_UNITS.has('bunch')).toBe(true);
    expect(SHOPPING_UNITS.has('kilogram')).toBe(false);
  });

  it('DAY_NAMES has 7 entries', () => {
    expect(DAY_NAMES).toHaveLength(7);
  });

  it('MONTH_SHORT has 12 entries', () => {
    expect(MONTH_SHORT).toHaveLength(12);
  });
});

describe('SK storage keys', () => {
  it('has all required keys', () => {
    expect(SK.TOKEN).toBe('mealie_access_token');
    expect(SK.ACTIVE_LIST).toBe('mealie_active_list');
    expect(SK.ACTIVE_TAB).toBe('mealie_active_tab');
    expect(SK.REMEMBER).toBe('mealie_remember');
  });

  it('all values are unique', () => {
    const values = Object.values(SK);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('labelMap computed signal', () => {
  it('builds a map from allLabels by id', () => {
    allLabels.value = [
      { id: 'l1', name: 'Produce' },
      { id: 'l2', name: 'Dairy' },
    ];
    expect(labelMap.value).toEqual({
      l1: { id: 'l1', name: 'Produce' },
      l2: { id: 'l2', name: 'Dairy' },
    });
  });

  it('returns empty object when allLabels is empty', () => {
    allLabels.value = [];
    expect(labelMap.value).toEqual({});
  });

  it('updates reactively when allLabels changes', () => {
    allLabels.value = [{ id: 'l1', name: 'Meat' }];
    expect(labelMap.value.l1.name).toBe('Meat');
    allLabels.value = [{ id: 'l1', name: 'Poultry' }];
    expect(labelMap.value.l1.name).toBe('Poultry');
  });
});
