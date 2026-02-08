import { state } from './state.js';
import { setApiCallbacks } from './api.js';
import { tryRefreshToken, logout, doLogin, hideSetup, showSetup, setAuthCallbacks } from './auth.js';
import { toast, switchTab, restoreActiveTab, toggleAddPanel, closeAddPanel, closeListPicker, pickList, initIcons, makeKeyboardNav } from './ui.js';
import { populateDatePicker, loadMealPlan, submitMealPlan, selectRecipe, deleteMealEntry, addRecipeToShoppingList, onMpInput } from './mealplan.js';
import { loadLabels, loadShoppingLists, populateCategoryOverride, selectList, refreshList, onAddItemInput, addItemFromInput, addItemDirect, selectFoodItem, toggleItem, adjustQty, openNoteModal, closeNoteModal, saveNote, clearCheckedItems, openLabelModal, closeLabelModal, setItemLabel, filterLabelModal, setupPullToRefresh } from './shopping.js';
import { openIngredientModal, closeIngredientModal, toggleIngredient, openIngredientEdit, closeIngredientEdit, setIngredientQty, setIngredientName, setIngredientNote, setIngredientUnit, onIngEditName, selectIngEditFood, createIngEditFood, removeIngredient, addIngredientRow, renderIngredientList } from './ingredients.js';

// Wire callbacks to break circular dependencies
setApiCallbacks({
  tryRefresh: tryRefreshToken,
  onUnauthorized: () => { logout(); toast('Session expired - please sign in again'); },
});

setAuthCallbacks({
  onLoginSuccess: init,
});

// Expose functions to window for inline onclick handlers in HTML
Object.assign(window, {
  // auth
  doLogin, logout, hideSetup,
  // ui
  switchTab, toggleAddPanel, closeAddPanel, closeListPicker, pickList,
  // mealplan
  loadMealPlan, submitMealPlan, selectRecipe, deleteMealEntry, addRecipeToShoppingList,
  // shopping
  selectList, refreshList, onAddItemInput, addItemFromInput, addItemDirect, selectFoodItem,
  toggleItem, adjustQty, openNoteModal, closeNoteModal, saveNote, clearCheckedItems,
  openLabelModal, closeLabelModal, setItemLabel, filterLabelModal,
  // ingredients
  openIngredientModal, closeIngredientModal, toggleIngredient, openIngredientEdit,
  closeIngredientEdit, setIngredientQty, setIngredientName, setIngredientNote,
  setIngredientUnit, onIngEditName, selectIngEditFood, createIngEditFood,
  removeIngredient, addIngredientRow, renderIngredientList,
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

// DRY #3/#4: keyboard navigation using shared factory
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

  // Close autocomplete on outside tap
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.add-modal-body')) {
      document.getElementById('autocomplete-dropdown').classList.remove('visible');
    }
    if (!e.target.closest('.ing-edit-name-wrap')) {
      document.querySelectorAll('.ing-edit-ac.visible').forEach(el => el.classList.remove('visible'));
    }
  });
});

// Initialize icons after DOM + Lucide loaded
document.addEventListener('DOMContentLoaded', () => setTimeout(initIcons, 50));

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
