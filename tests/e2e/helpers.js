import {
  AUTH_TOKEN, LABELS, SHOPPING_LISTS, SHOPPING_LIST_DETAIL,
  MEAL_PLAN_ENTRIES, RECIPE_DETAIL, RECIPE_SEARCH, UNITS, FOOD_SEARCH,
} from '../fixtures/data.js';

/**
 * Set up a fully mocked authenticated app — token in localStorage,
 * all standard API routes intercepted with fixture data.
 */
export async function mockAuthenticatedApp(page) {
  // Inject token before page loads
  await page.addInitScript((token) => {
    localStorage.setItem('mealie_access_token', token);
  }, AUTH_TOKEN.access_token);

  // Mock all API routes
  await page.route('**/api/groups/labels', (route) => {
    route.fulfill({ json: LABELS });
  });

  await page.route('**/api/households/shopping/lists', (route, request) => {
    if (request.url().includes('/lists/list-')) {
      // Individual list — handled by more specific route below
      return route.fallback();
    }
    route.fulfill({ json: { items: SHOPPING_LISTS } });
  });

  await page.route(`**/api/households/shopping/lists/${SHOPPING_LIST_DETAIL.id}`, (route) => {
    route.fulfill({ json: SHOPPING_LIST_DETAIL });
  });

  await page.route('**/api/households/mealplans*', (route, request) => {
    if (request.method() === 'DELETE') {
      return route.fulfill({ status: 200, json: {} });
    }
    if (request.method() === 'POST') {
      return route.fulfill({ json: { id: 999 } });
    }
    route.fulfill({ json: { items: MEAL_PLAN_ENTRIES } });
  });

  await page.route('**/api/recipes?*', (route) => {
    route.fulfill({ json: RECIPE_SEARCH });
  });

  await page.route(`**/api/recipes/${RECIPE_DETAIL.slug}`, (route) => {
    route.fulfill({ json: RECIPE_DETAIL });
  });

  await page.route('**/api/units', (route) => {
    route.fulfill({ json: UNITS });
  });

  await page.route('**/api/foods*', (route, request) => {
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      return route.fulfill({ json: { id: 'food-new', name: body.name, labelId: body.labelId || null } });
    }
    route.fulfill({ json: FOOD_SEARCH });
  });

  await page.route('**/api/households/shopping/items*', (route, request) => {
    if (request.method() === 'POST') {
      return route.fulfill({ json: { id: 'new-item' } });
    }
    if (request.method() === 'PUT') {
      return route.fulfill({ json: {} });
    }
    if (request.method() === 'DELETE') {
      return route.fulfill({ status: 200, json: {} });
    }
    route.fulfill({ json: {} });
  });

  await page.route('**/api/auth/refresh', (route) => {
    route.fulfill({ json: AUTH_TOKEN });
  });
}

/**
 * Mock only the login endpoint (for unauthenticated tests).
 */
export async function mockLoginEndpoint(page) {
  await page.route('**/api/auth/token', (route, request) => {
    route.fulfill({ json: AUTH_TOKEN });
  });
}
