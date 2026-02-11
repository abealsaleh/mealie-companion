import { signal, computed } from './lib.js';
import { SK } from './constants.js';

// Migrate ACTIVE_LIST and ACTIVE_TAB from raw strings to JSON strings.
// cachedSignal uses JSON.parse, but these keys were previously stored as plain values.
[SK.ACTIVE_LIST, SK.ACTIVE_TAB].forEach(key => {
  const raw = localStorage.getItem(key);
  if (raw != null && !raw.startsWith('"')) {
    localStorage.setItem(key, JSON.stringify(raw));
  }
});

function cachedSignal(key, fallback) {
  let initial = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) initial = JSON.parse(raw);
  } catch {}
  const sig = signal(initial);
  let first = true;
  sig.subscribe(value => {
    if (first) { first = false; return; }
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  });
  return sig;
}

export const accessToken = signal(
  localStorage.getItem(SK.TOKEN) || sessionStorage.getItem(SK.TOKEN) || ''
);
export const shoppingLists = cachedSignal(SK.CACHE_LISTS, []);
export const activeListId = cachedSignal(SK.ACTIVE_LIST, '');
export const activeListItems = cachedSignal(SK.CACHE_LIST_ITEMS, []);
export const listAddPending = signal(false);
export const allLabels = cachedSignal(SK.CACHE_LABELS, []);
export const labelMap = computed(() => {
  const map = {};
  allLabels.value.forEach(l => { map[l.id] = l; });
  return map;
});
export const allUnits = cachedSignal(SK.CACHE_UNITS, []);
export const loadedIngredients = signal([]);
export const ingredientChecked = signal([]);
export const ingredientEditing = signal(-1);
export const ingredientSlug = signal('');
export const listPickerCallback = signal(null);
export const activeTab = cachedSignal(SK.ACTIVE_TAB, 'mealplan');
export const mealPlanEntries = cachedSignal(SK.CACHE_MEAL_PLAN, null);
export const toastMessage = signal('');
export const toastVisible = signal(false);
