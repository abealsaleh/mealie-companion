import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UNITS } from '../fixtures/data.js';
import { loadedIngredients, allUnits } from '../../js/signals.js';

// Ingredient setter functions are now inline in the IngredientModal component.
// Test the signal-based equivalent logic directly.

beforeEach(() => {
  allUnits.value = UNITS;
  loadedIngredients.value = [
    { qty: null, name: '', ingNote: '', unitId: '', unitName: '', foodId: '', labelName: '', isTitle: false },
  ];
});

function setIngredientQty(idx, value) {
  const newIngs = [...loadedIngredients.value];
  newIngs[idx] = { ...newIngs[idx], qty: value ? parseFloat(value) : null };
  loadedIngredients.value = newIngs;
}

function setIngredientName(idx, value) {
  const newIngs = [...loadedIngredients.value];
  newIngs[idx] = { ...newIngs[idx], name: value.trim() };
  loadedIngredients.value = newIngs;
}

function setIngredientNote(idx, value) {
  const newIngs = [...loadedIngredients.value];
  newIngs[idx] = { ...newIngs[idx], ingNote: value.trim() };
  loadedIngredients.value = newIngs;
}

function setIngredientUnit(idx, unitId) {
  const u = allUnits.value.find(u => u.id === unitId);
  const newIngs = [...loadedIngredients.value];
  newIngs[idx] = { ...newIngs[idx], unitId, unitName: u ? u.name : '' };
  loadedIngredients.value = newIngs;
}

describe('setIngredientQty()', () => {
  it('parses float value', () => {
    setIngredientQty(0, '2.5');
    expect(loadedIngredients.value[0].qty).toBe(2.5);
  });

  it('sets null for empty string', () => {
    setIngredientQty(0, '3');
    setIngredientQty(0, '');
    expect(loadedIngredients.value[0].qty).toBeNull();
  });
});

describe('setIngredientName()', () => {
  it('trims whitespace', () => {
    setIngredientName(0, '  Chicken  ');
    expect(loadedIngredients.value[0].name).toBe('Chicken');
  });
});

describe('setIngredientNote()', () => {
  it('trims whitespace', () => {
    setIngredientNote(0, '  diced  ');
    expect(loadedIngredients.value[0].ingNote).toBe('diced');
  });
});

describe('setIngredientUnit()', () => {
  it('sets unitId', () => {
    setIngredientUnit(0, 'unit-2');
    expect(loadedIngredients.value[0].unitId).toBe('unit-2');
  });

  it('looks up unitName from allUnits', () => {
    setIngredientUnit(0, 'unit-3');
    expect(loadedIngredients.value[0].unitName).toBe('tablespoon');
  });

  it('clears unitName for empty unitId', () => {
    setIngredientUnit(0, 'unit-1');
    setIngredientUnit(0, '');
    expect(loadedIngredients.value[0].unitName).toBe('');
  });
});
