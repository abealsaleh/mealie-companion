import { test, expect } from '@playwright/test';
import { mockAuthenticatedApp } from './helpers.js';
import { RECIPE_DETAIL, SHOPPING_LISTS } from '../fixtures/data.js';

test.describe('Ingredients', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto('/');
    // Wait for meal plan to render
    await expect(page.locator('#mp-plan-content .mp-day')).toHaveCount(8);
  });

  test('opens ingredient modal from meal plan', async ({ page }) => {
    // Click on a recipe name to open ingredients
    await page.click(`[data-action="open-ingredients"][data-slug="${RECIPE_DETAIL.slug}"]`);

    await expect(page.locator('#ingredient-modal')).toHaveClass(/visible/);
    await expect(page.locator('#ingredient-modal-title')).toHaveText(RECIPE_DETAIL.name);

    // Wait for ingredients to load ("Add item" row is .ingredient-add-row, not .ingredient-item)
    await expect(page.locator('.ingredient-item')).toHaveCount(
      RECIPE_DETAIL.recipeIngredient.length
    );
  });

  test('toggle ingredient checkbox', async ({ page }) => {
    await page.click(`[data-action="open-ingredients"][data-slug="${RECIPE_DETAIL.slug}"]`);
    await expect(page.locator('.ingredient-item')).toHaveCount(
      RECIPE_DETAIL.recipeIngredient.length
    );

    // All non-title ingredients start checked — get initial count
    const btn = page.locator('#ingredient-add-btn');
    const initialText = await btn.textContent();
    const initialCount = parseInt(initialText.match(/\d+/)[0]);

    // Uncheck first ingredient
    const firstCb = page.locator('.ingredient-cb').first();
    await firstCb.uncheck();

    // Button count should decrease
    const updatedText = await btn.textContent();
    const updatedCount = parseInt(updatedText.match(/\d+/)[0]);
    expect(updatedCount).toBe(initialCount - 1);
  });

  test('add ingredients to shopping list', async ({ page }) => {
    let postCalls = 0;
    await page.route('**/api/households/shopping/items*', (route, request) => {
      if (request.method() === 'POST') {
        postCalls++;
        return route.fulfill({ json: { id: `new-${postCalls}` } });
      }
      route.fallback();
    });

    await page.click(`[data-action="open-ingredients"][data-slug="${RECIPE_DETAIL.slug}"]`);
    await expect(page.locator('.ingredient-item')).toHaveCount(
      RECIPE_DETAIL.recipeIngredient.length
    );

    // Click "Add X items to Shopping List"
    await page.click('#ingredient-add-btn');

    // If multiple shopping lists, a picker shows — select the first one
    if (SHOPPING_LISTS.length > 1) {
      await expect(page.locator('#list-picker-modal')).toHaveClass(/visible/);
      await page.click('[data-action="pick-list"]:first-child');
    }

    // Optimistic toast appears immediately before API calls finish
    await expect(page.locator('.toast')).toContainText(/Added \d+ ingredient/);

    // Background POSTs still fire
    await page.waitForTimeout(500);
    expect(postCalls).toBeGreaterThan(0);
  });

  test('non-buyable units default to quantity 1 in optimistic UI (issue #17)', async ({ page }) => {
    // Block refreshList API call so we can verify optimistic UI state
    let refreshBlocked = false;
    await page.route('**/api/households/shopping/lists/*', (route, request) => {
      if (request.method() === 'GET' && refreshBlocked) {
        // Hold the refresh call to freeze optimistic state
        return new Promise(() => {}); // Never resolve
      }
      route.fallback();
    });

    await page.route('**/api/households/shopping/items*', (route, request) => {
      if (request.method() === 'POST') {
        return route.fulfill({ json: { id: `new-${Date.now()}` } });
      }
      route.fallback();
    });

    // Switch to shopping tab first
    await page.click('nav button:has-text("Shopping")');
    await expect(page.locator('#shopping-content')).toBeVisible();

    // Go back to meal plan
    await page.click('nav button:has-text("Meal Plan")');
    await expect(page.locator('#mp-plan-content .mp-day')).toHaveCount(8);

    // Open ingredient modal
    await page.click(`[data-action="open-ingredients"][data-slug="${RECIPE_DETAIL.slug}"]`);
    await expect(page.locator('.ingredient-item')).toHaveCount(
      RECIPE_DETAIL.recipeIngredient.length
    );

    // Block refresh before adding ingredients
    refreshBlocked = true;

    // Click "Add X items to Shopping List"
    await page.click('#ingredient-add-btn');

    // If multiple shopping lists, a picker shows — select the first one
    if (SHOPPING_LISTS.length > 1) {
      await expect(page.locator('#list-picker-modal')).toHaveClass(/visible/);
      await page.click('[data-action="pick-list"]:first-child');
    }

    // Wait for optimistic items to appear
    await page.waitForTimeout(200);

    // Switch to shopping tab to see optimistic items
    await page.click('nav button:has-text("Shopping")');
    await page.waitForTimeout(100);

    // Find the Milk item (500g from fixture)
    // Optimistic UI should show quantity 1, NOT 500
    const milkItem = page.locator('.shop-item:has-text("Milk")').first();
    await expect(milkItem).toBeVisible();

    // Verify quantity is 1, not 500
    const qtyVal = milkItem.locator('.qty-val');
    const qtyText = await qtyVal.textContent();

    // Should be "1" (fixed) not "500" (bug)
    expect(qtyText).toBe('1');
    expect(qtyText).not.toBe('500');
  });
});
