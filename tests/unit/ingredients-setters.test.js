import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UNITS } from '../fixtures/data.js';

let setIngredientQty, setIngredientName, setIngredientNote, setIngredientUnit, state;

beforeEach(async () => {
  vi.resetModules();
  const stateModule = await import('../../js/state.js');
  state = stateModule.state;
  state.allUnits = UNITS;
  state.loadedIngredients = [
    { qty: null, name: '', ingNote: '', unitId: '', unitName: '', foodId: '', labelName: '', isTitle: false },
  ];
  const mod = await import('../../js/ingredients.js');
  setIngredientQty = mod.setIngredientQty;
  setIngredientName = mod.setIngredientName;
  setIngredientNote = mod.setIngredientNote;
  setIngredientUnit = mod.setIngredientUnit;
});

describe('setIngredientQty()', () => {
  it('parses float value', () => {
    setIngredientQty(0, '2.5');
    expect(state.loadedIngredients[0].qty).toBe(2.5);
  });

  it('sets null for empty string', () => {
    setIngredientQty(0, '3');
    setIngredientQty(0, '');
    expect(state.loadedIngredients[0].qty).toBeNull();
  });
});

describe('setIngredientName()', () => {
  it('trims whitespace', () => {
    setIngredientName(0, '  Chicken  ');
    expect(state.loadedIngredients[0].name).toBe('Chicken');
  });
});

describe('setIngredientNote()', () => {
  it('trims whitespace', () => {
    setIngredientNote(0, '  diced  ');
    expect(state.loadedIngredients[0].ingNote).toBe('diced');
  });
});

describe('setIngredientUnit()', () => {
  it('sets unitId', () => {
    setIngredientUnit(0, 'unit-2');
    expect(state.loadedIngredients[0].unitId).toBe('unit-2');
  });

  it('looks up unitName from state.allUnits', () => {
    setIngredientUnit(0, 'unit-3');
    expect(state.loadedIngredients[0].unitName).toBe('tablespoon');
  });

  it('clears unitName for empty unitId', () => {
    setIngredientUnit(0, 'unit-1');
    setIngredientUnit(0, '');
    expect(state.loadedIngredients[0].unitName).toBe('');
  });
});
