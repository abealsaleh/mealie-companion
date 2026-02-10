import { describe, it, expect, beforeEach } from 'vitest';
import { UNITS } from '../fixtures/data.js';
import { loadedIngredients, allUnits } from '../../js/signals.js';
import { updateSignalArray } from '../../js/utils.js';

beforeEach(() => {
  allUnits.value = UNITS;
  loadedIngredients.value = [
    { qty: null, name: '', ingNote: '', unitId: '', unitName: '', foodId: '', labelName: '', isTitle: false },
  ];
});

describe('updateSignalArray()', () => {
  it('updates a single field at the given index', () => {
    updateSignalArray(loadedIngredients, 0, { qty: 3 });
    expect(loadedIngredients.value[0].qty).toBe(3);
  });

  it('updates multiple fields at once', () => {
    updateSignalArray(loadedIngredients, 0, { qty: 2, name: 'Chicken' });
    expect(loadedIngredients.value[0].qty).toBe(2);
    expect(loadedIngredients.value[0].name).toBe('Chicken');
  });

  it('does not mutate the original array', () => {
    const original = loadedIngredients.value;
    updateSignalArray(loadedIngredients, 0, { qty: 1 });
    expect(loadedIngredients.value).not.toBe(original);
  });

  it('does not mutate the original item object', () => {
    const originalItem = loadedIngredients.value[0];
    updateSignalArray(loadedIngredients, 0, { qty: 1 });
    expect(loadedIngredients.value[0]).not.toBe(originalItem);
    expect(originalItem.qty).toBeNull();
  });

  it('preserves other items in the array', () => {
    loadedIngredients.value = [
      { qty: null, name: 'A', ingNote: '', unitId: '', unitName: '', foodId: '', labelName: '', isTitle: false },
      { qty: null, name: 'B', ingNote: '', unitId: '', unitName: '', foodId: '', labelName: '', isTitle: false },
    ];
    updateSignalArray(loadedIngredients, 1, { name: 'Updated B' });
    expect(loadedIngredients.value[0].name).toBe('A');
    expect(loadedIngredients.value[1].name).toBe('Updated B');
  });
});

describe('ingredient setters via updateSignalArray', () => {
  it('setQty: parses float value', () => {
    updateSignalArray(loadedIngredients, 0, { qty: parseFloat('2.5') });
    expect(loadedIngredients.value[0].qty).toBe(2.5);
  });

  it('setQty: null for empty input', () => {
    updateSignalArray(loadedIngredients, 0, { qty: 3 });
    updateSignalArray(loadedIngredients, 0, { qty: null });
    expect(loadedIngredients.value[0].qty).toBeNull();
  });

  it('setName: trims whitespace', () => {
    updateSignalArray(loadedIngredients, 0, { name: '  Chicken  '.trim() });
    expect(loadedIngredients.value[0].name).toBe('Chicken');
  });

  it('setNote: trims whitespace', () => {
    updateSignalArray(loadedIngredients, 0, { ingNote: '  diced  '.trim() });
    expect(loadedIngredients.value[0].ingNote).toBe('diced');
  });

  it('setUnit: sets unitId and looks up unitName', () => {
    const unitId = 'unit-3';
    const u = allUnits.value.find(u => u.id === unitId);
    updateSignalArray(loadedIngredients, 0, { unitId, unitName: u ? u.name : '' });
    expect(loadedIngredients.value[0].unitId).toBe('unit-3');
    expect(loadedIngredients.value[0].unitName).toBe('tablespoon');
  });

  it('setUnit: clears unitName for unknown unitId', () => {
    updateSignalArray(loadedIngredients, 0, { unitId: 'unit-1', unitName: 'pound' });
    const u = allUnits.value.find(u => u.id === '');
    updateSignalArray(loadedIngredients, 0, { unitId: '', unitName: u ? u.name : '' });
    expect(loadedIngredients.value[0].unitName).toBe('');
  });
});

describe('onIngEditName pattern (regression: spaces must not be stripped)', () => {
  it('preserves trailing spaces while typing', () => {
    updateSignalArray(loadedIngredients, 0, { foodId: '', labelName: '', name: 'chicken ' });
    expect(loadedIngredients.value[0].name).toBe('chicken ');
  });

  it('preserves interior spaces', () => {
    updateSignalArray(loadedIngredients, 0, { foodId: '', labelName: '', name: 'chicken breast' });
    expect(loadedIngredients.value[0].name).toBe('chicken breast');
  });

  it('clears foodId and labelName when editing name', () => {
    loadedIngredients.value = [
      { qty: null, name: 'old', ingNote: '', unitId: '', unitName: '', foodId: 'f1', labelName: 'Meat', isTitle: false },
    ];
    updateSignalArray(loadedIngredients, 0, { foodId: '', labelName: '', name: 'new' });
    expect(loadedIngredients.value[0].foodId).toBe('');
    expect(loadedIngredients.value[0].labelName).toBe('');
  });
});
