// Shared test fixtures — single source of truth for unit and E2E tests

export const AUTH_TOKEN = {
  access_token: 'test-token-abc123',
  token_type: 'bearer',
};

export const LABELS = [
  { id: 'label-1', name: 'Produce', groupId: 'g1' },
  { id: 'label-2', name: 'Dairy', groupId: 'g1' },
  { id: 'label-3', name: 'Meat', groupId: 'g1' },
];

export const SHOPPING_LISTS = [
  { id: 'list-1', name: 'Weekly Groceries' },
  { id: 'list-2', name: 'Party Supplies' },
];

export const SHOPPING_LIST_DETAIL = {
  id: 'list-1',
  name: 'Weekly Groceries',
  listItems: [
    {
      id: 'item-1',
      checked: false,
      quantity: 2,
      note: '',
      display: '',
      food: { id: 'food-1', name: 'Chicken Breast', label: { id: 'label-3', name: 'Meat' } },
      label: { id: 'label-3', name: 'Meat' },
      labelId: 'label-3',
    },
    {
      id: 'item-2',
      checked: false,
      quantity: 1,
      note: 'organic only',
      display: '',
      food: null,
      label: { id: 'label-1', name: 'Produce' },
      labelId: 'label-1',
    },
    {
      id: 'item-3',
      checked: true,
      quantity: 1,
      note: '',
      display: '',
      food: { id: 'food-2', name: 'Milk', label: { id: 'label-2', name: 'Dairy' } },
      label: { id: 'label-2', name: 'Dairy' },
      labelId: 'label-2',
      updateAt: '2025-01-15T10:00:00Z',
      updatedAt: '2025-01-15T10:00:00Z',
    },
  ],
};

export const MEAL_PLAN_ENTRIES = [
  {
    id: 101,
    date: new Date().toISOString().slice(0, 10),
    entryType: 'dinner',
    title: '',
    recipe: { id: 'recipe-1', name: 'Grilled Chicken', slug: 'grilled-chicken' },
    recipeId: 'recipe-1',
  },
  {
    id: 102,
    date: new Date().toISOString().slice(0, 10),
    entryType: 'lunch',
    title: '',
    recipe: { id: 'recipe-2', name: 'Caesar Salad', slug: 'caesar-salad' },
    recipeId: 'recipe-2',
  },
  {
    id: 103,
    date: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })(),
    entryType: 'breakfast',
    title: '',
    recipe: { id: 'recipe-3', name: 'Pancakes', slug: 'pancakes' },
    recipeId: 'recipe-3',
  },
];

export const RECIPE_DETAIL = {
  id: 'recipe-1',
  name: 'Grilled Chicken',
  slug: 'grilled-chicken',
  recipeIngredient: [
    {
      referenceId: 'ref-1',
      quantity: 2,
      unit: { id: 'unit-1', name: 'pound' },
      food: { id: 'food-1', name: 'Chicken Breast', label: { id: 'label-3', name: 'Meat' } },
      note: 'boneless',
      title: null,
    },
    {
      referenceId: 'ref-2',
      quantity: 0.5,
      unit: { id: 'unit-2', name: 'cup' },
      food: { id: 'food-3', name: 'Olive Oil', label: null },
      note: '',
      title: null,
    },
    {
      referenceId: 'ref-3',
      quantity: 0,
      unit: null,
      food: null,
      note: 'Salt and pepper to taste',
      title: null,
    },
  ],
};

export const RECIPE_SEARCH = {
  items: [
    { name: 'Grilled Chicken', slug: 'grilled-chicken' },
    { name: 'Chicken Parmesan', slug: 'chicken-parmesan' },
    { name: 'Chicken Tikka', slug: 'chicken-tikka' },
  ],
};

export const UNITS = [
  { id: 'unit-1', name: 'pound' },
  { id: 'unit-2', name: 'cup' },
  { id: 'unit-3', name: 'tablespoon' },
  { id: 'unit-4', name: 'teaspoon' },
  { id: 'unit-5', name: 'can' },
];

export const FOOD_SEARCH = {
  items: [
    { id: 'food-10', name: 'Tomato', label: { id: 'label-1', name: 'Produce' }, labelId: 'label-1' },
    { id: 'food-11', name: 'Tomato Paste', label: { id: 'label-1', name: 'Produce' }, labelId: 'label-1' },
    { id: 'food-12', name: 'Cherry Tomato', label: { id: 'label-1', name: 'Produce' }, labelId: 'label-1' },
    { id: 'food-13', name: 'Sun-dried Tomato', label: null, labelId: null },
  ],
};
