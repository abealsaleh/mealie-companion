import { signal, computed } from './lib.js';
import { SK } from './constants.js';

export const accessToken = signal(
  localStorage.getItem(SK.TOKEN) || sessionStorage.getItem(SK.TOKEN) || ''
);
export const shoppingLists = signal([]);
export const activeListId = signal(localStorage.getItem(SK.ACTIVE_LIST) || '');
export const activeListItems = signal([]);
export const allLabels = signal([]);
export const labelMap = computed(() => {
  const map = {};
  allLabels.value.forEach(l => { map[l.id] = l; });
  return map;
});
export const allUnits = signal([]);
export const loadedIngredients = signal([]);
export const ingredientChecked = signal([]);
export const ingredientEditing = signal(-1);
export const ingredientSlug = signal('');
export const listPickerCallback = signal(null);
export const activeTab = signal(localStorage.getItem(SK.ACTIVE_TAB) || 'mealplan');
export const toastMessage = signal('');
export const toastVisible = signal(false);
