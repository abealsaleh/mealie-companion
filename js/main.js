import { state } from './state.js';
import { setApiCallbacks } from './api.js';
import { tryRefreshToken, logout, doLogin, hideSetup, showSetup, setAuthCallbacks } from './auth.js';
import { toast, switchTab, restoreActiveTab, toggleAddPanel, closeAddPanel, closeListPicker, pickList, initIcons, makeKeyboardNav } from './ui.js';
import { populateDatePicker, loadMealPlan, submitMealPlan, selectRecipe, deleteMealEntry, addRecipeToShoppingList, onMpInput } from './mealplan.js';
import { loadLabels, loadShoppingLists, populateCategoryOverride, selectList, refreshList, onAddItemInput, addItemFromInput, addItemDirect, selectFoodItem, toggleItem, adjustQty, openNoteModal, closeNoteModal, saveNote, clearCheckedItems, openLabelModal, closeLabelModal, setItemLabel, filterLabelModal, setupPullToRefresh } from './shopping.js';
import { openIngredientModal, closeIngredientModal, toggleIngredient, openIngredientEdit, closeIngredientEdit, setIngredientQty, setIngredientName, setIngredientNote, setIngredientUnit, onIngEditName, selectIngEditFood, createIngEditFood, removeIngredient, addIngredientRow } from './ingredients.js';

// Wire callbacks to break circular dependencies
setApiCallbacks({
  tryRefresh: tryRefreshToken,
  onUnauthorized: () => { logout(); toast('Session expired - please sign in again'); },
});

setAuthCallbacks({
  onLoginSuccess: init,
});

// Expose functions to window for static onclick handlers in index.html only
Object.assign(window, {
  doLogin, logout, hideSetup,
  switchTab, toggleAddPanel, closeAddPanel, closeListPicker,
  loadMealPlan, submitMealPlan,
  selectList, refreshList, onAddItemInput, addItemFromInput,
  closeNoteModal, saveNote, closeLabelModal, filterLabelModal,
  closeIngredientModal,
});

// --- Delegated event handling for dynamically rendered elements ---

const clickActions = {
  // mealplan
  'open-ingredients': (el) => openIngredientModal(el.dataset.slug, el.dataset.name, el.dataset.recipeId),
  'add-to-list': (el) => addRecipeToShoppingList(el.dataset.recipeId, el.dataset.name),
  'delete-entry': (el) => deleteMealEntry(Number(el.dataset.entryId)),
  'select-recipe': (el) => selectRecipe(el.dataset.slug, el.dataset.name),
  // shopping
  'toggle-item': (el) => toggleItem(el.dataset.itemId, el.dataset.checked === 'true'),
  'adjust-qty': (el) => adjustQty(el.dataset.itemId, Number(el.dataset.delta)),
  'open-note': (el) => openNoteModal(el.dataset.itemId),
  'open-label': (el) => openLabelModal(el.dataset.itemId),
  'clear-checked': () => clearCheckedItems(),
  'select-food': (el) => selectFoodItem({ id: el.dataset.foodId, name: el.dataset.foodName, labelId: el.dataset.foodLabelId || '' }),
  'add-direct': () => addItemDirect(),
  'set-label': (el) => setItemLabel(el.dataset.labelId || null),
  'collapse-toggle': (el) => el.classList.toggle('collapsed'),
  // ingredients
  'open-ingredient-edit': (el) => openIngredientEdit(Number(el.dataset.idx)),
  'close-ingredient-edit': () => closeIngredientEdit(),
  'remove-ingredient': (el) => removeIngredient(Number(el.dataset.idx)),
  'add-ingredient-row': () => addIngredientRow(),
  'select-ing-food': (el) => selectIngEditFood(Number(el.dataset.idx), el.dataset.foodId, el.dataset.foodName, el.dataset.labelName),
  'create-ing-food': (el) => createIngEditFood(Number(el.dataset.idx), el.dataset.name),
  // ui
  'pick-list': (el) => pickList(el.dataset.listId, el.dataset.listName),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) {
    const handler = clickActions[el.dataset.action];
    if (handler) handler(el);
  }
  // Close autocomplete on outside tap
  if (!e.target.closest('.add-modal-body') && !e.target.closest('[data-action="select-food"]') && !e.target.closest('[data-action="add-direct"]')) {
    document.getElementById('autocomplete-dropdown').classList.remove('visible');
  }
  if (!e.target.closest('.ing-edit-name-wrap') && !e.target.closest('[data-action="select-ing-food"]') && !e.target.closest('[data-action="create-ing-food"]')) {
    document.querySelectorAll('.ing-edit-ac.visible').forEach(el => el.classList.remove('visible'));
  }
});

// Delegated input/change for ingredient editor
document.addEventListener('input', (e) => {
  if (e.target.dataset.onInput === 'ing-edit-name') {
    onIngEditName(Number(e.target.dataset.idx), e.target.value);
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  const action = t.dataset.onChange;
  if (!action) return;
  const idx = Number(t.dataset.idx);
  switch (action) {
    case 'ing-toggle': toggleIngredient(idx); break;
    case 'ing-qty': setIngredientQty(idx, t.value); break;
    case 'ing-unit': setIngredientUnit(idx, t.value); break;
    case 'ing-name': setIngredientName(idx, t.value); break;
    case 'ing-note': setIngredientNote(idx, t.value); break;
  }
});

async function init() {
  hideSetup();
  restoreActiveTab();
  try {
    await Promise.all([loadLabels(), loadShoppingLists(), loadMealPlan()]);
    populateCategoryOverride();
  } catch (err) {
    console.error('Init error:', err);
    if (!err.message?.includes('401')) {
      toast('Connection error');
    }
  }
}

// Keyboard navigation + setup
document.addEventListener('DOMContentLoaded', () => {
  if (state.accessToken) {
    init();
  } else {
    showSetup();
  }
  populateDatePicker();
  setupPullToRefresh();

  document.getElementById('add-item-input').addEventListener('keydown', makeKeyboardNav({
    getDropdown: () => document.getElementById('autocomplete-dropdown'),
    isVisible: d => d.classList.contains('visible'),
    getIndex: () => state.acKbIndex,
    setIndex: n => { state.acKbIndex = n; },
    hideDropdown: () => { document.getElementById('autocomplete-dropdown').classList.remove('visible'); },
    onFallbackEnter: addItemFromInput,
  }));

  document.getElementById('mp-input').addEventListener('input', onMpInput);
  document.getElementById('mp-input').addEventListener('keydown', makeKeyboardNav({
    getDropdown: () => document.getElementById('mp-search-results'),
    isVisible: d => d.style.display === 'block',
    getIndex: () => state.mpKbIndex,
    setIndex: n => { state.mpKbIndex = n; },
    hideDropdown: () => { document.getElementById('mp-search-results').style.display = 'none'; },
    onFallbackEnter: submitMealPlan,
  }));

  document.getElementById('label-search-input').addEventListener('keydown', makeKeyboardNav({
    getDropdown: () => document.getElementById('label-modal-list'),
    isVisible: () => document.getElementById('label-modal').classList.contains('visible'),
    getIndex: () => state.labelKbIndex,
    setIndex: n => { state.labelKbIndex = n; },
    hideDropdown: () => closeLabelModal(),
    itemSelector: '.label-modal-item:not([style*="display: none"])',
  }));

  document.getElementById('list-picker-modal').addEventListener('keydown', makeKeyboardNav({
    getDropdown: () => document.getElementById('list-picker-options'),
    isVisible: () => document.getElementById('list-picker-modal').classList.contains('visible'),
    getIndex: () => state.listPickerKbIndex,
    setIndex: n => { state.listPickerKbIndex = n; },
    hideDropdown: () => closeListPicker(),
    itemSelector: '.label-modal-item',
  }));
});

// Initialize icons after DOM + Lucide loaded
document.addEventListener('DOMContentLoaded', () => setTimeout(initIcons, 50));

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
