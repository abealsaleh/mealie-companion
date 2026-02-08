// Shared application state (single mutable object — any module can read/write)
export const state = {
  accessToken: localStorage.getItem('mealie_access_token') || sessionStorage.getItem('mealie_access_token') || '',
  shoppingLists: [],
  activeListId: localStorage.getItem('mealie_active_list') || '',
  activeListItems: [],
  allLabels: [],
  labelMap: {},
  allUnits: [],
  loadedIngredients: [],
  ingredientChecked: [],
  ingredientEditing: -1,
  ingredientSlug: '',
  // Keyboard navigation indices
  acKbIndex: -1,
  mpKbIndex: -1,
  labelKbIndex: -1,
  listPickerKbIndex: -1,
  ingEditKbIndex: -1,
  // Shared list picker callback
  listPickerCallback: null,
};

// Constants
export const PLAN_DAYS = 8;
export const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'side', 'snack', 'dessert', 'drink'];
export const MEAL_ICONS = {
  breakfast: 'sunrise', lunch: 'sun', dinner: 'moon', side: 'salad',
  snack: 'cookie', dessert: 'cake-slice', drink: 'cup-soda',
};
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const SHOPPING_UNITS = new Set(['can', 'jar', 'bunch', 'head', 'pack', 'clove', 'sprig', 'bag']);
