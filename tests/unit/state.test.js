import { describe, it, expect } from 'vitest';
import { PLAN_DAYS, MEAL_ORDER, SHOPPING_UNITS, DAY_NAMES, MONTH_SHORT } from '../../js/state.js';

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
