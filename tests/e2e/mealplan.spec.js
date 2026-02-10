import { test, expect } from '@playwright/test';
import { mockAuthenticatedApp } from './helpers.js';
import { MEAL_PLAN_ENTRIES, RECIPE_SEARCH } from '../fixtures/data.js';

test.describe('Meal Plan', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto('/');
    // Wait for meal plan to render
    await expect(page.locator('#mp-plan-content .mp-day')).toHaveCount(8);
  });

  test('displays meal plan entries grouped by day', async ({ page }) => {
    // Today should have 2 entries (dinner + lunch from fixtures)
    const todayEntries = MEAL_PLAN_ENTRIES.filter(e => e.date === new Date().toISOString().slice(0, 10));
    expect(todayEntries).toHaveLength(2);

    // Check entries are rendered
    await expect(page.locator('.mp-entry-name', { hasText: 'Grilled Chicken' })).toBeVisible();
    await expect(page.locator('.mp-entry-name', { hasText: 'Caesar Salad' })).toBeVisible();
    await expect(page.locator('.mp-entry-name', { hasText: 'Pancakes' })).toBeVisible();
  });

  test('add recipe via search', async ({ page }) => {
    // Open add panel
    await page.click('#mp-fab');
    await expect(page.locator('#mp-add-modal')).toHaveClass(/visible/);

    // Type in search
    await page.fill('#mp-input', 'chicken');

    // Wait for search results
    await expect(page.locator('#mp-search-results')).toBeVisible();
    await expect(page.locator('#mp-search-results .item')).toHaveCount(RECIPE_SEARCH.items.length);

    // Select first result
    await page.click('#mp-search-results .item:first-child');

    // Input should be populated with the recipe name
    await expect(page.locator('#mp-input')).toHaveValue('Grilled Chicken');
  });

  test('delete meal plan entry', async ({ page }) => {
    let deleteUrl = null;
    await page.route('**/api/households/mealplans/*', (route, request) => {
      if (request.method() === 'DELETE') {
        deleteUrl = request.url();
        return route.fulfill({ status: 200, json: {} });
      }
      route.fallback();
    });

    // Click delete on first entry
    const deleteBtn = page.locator(`[data-action="delete-entry"][data-entry-id="${MEAL_PLAN_ENTRIES[0].id}"]`);
    await deleteBtn.click();

    // Verify DELETE was called with correct entry ID
    expect(deleteUrl).toContain(`/mealplans/${MEAL_PLAN_ENTRIES[0].id}`);
  });
});
