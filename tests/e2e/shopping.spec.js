import { test, expect } from '@playwright/test';
import { mockAuthenticatedApp } from './helpers.js';
import { SHOPPING_LIST_DETAIL, FOOD_SEARCH } from '../fixtures/data.js';

test.describe('Shopping List', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto('/');
    // Switch to shopping tab
    await page.click('nav button:has-text("Shopping")');
    // Wait for list to render
    await expect(page.locator('#shopping-content .shop-item')).toHaveCount(
      SHOPPING_LIST_DETAIL.listItems.length
    );
  });

  test('loads and displays shopping list items', async ({ page }) => {
    // Unchecked items should be in category groups
    await expect(page.locator('.category-group')).toHaveCount(2); // Meat + Produce
    // Checked section should exist
    await expect(page.locator('.checked-section')).toBeVisible();
    // Specific items
    await expect(page.locator('.item-text', { hasText: 'Chicken Breast' })).toBeVisible();
    await expect(page.locator('.item-text', { hasText: 'organic only' })).toBeVisible();
  });

  test('check/uncheck item', async ({ page }) => {
    let putBody = null;
    await page.route('**/api/households/shopping/items/*', (route, request) => {
      if (request.method() === 'PUT') {
        putBody = request.postDataJSON();
        return route.fulfill({ json: {} });
      }
      route.fallback();
    });

    // Click to check an unchecked item
    await page.click(`[data-action="toggle-item"][data-item-id="item-1"]`);

    expect(putBody).not.toBeNull();
    expect(putBody.checked).toBe(true);
  });

  test('adjust quantity', async ({ page }) => {
    let putBody = null;
    await page.route('**/api/households/shopping/items/*', (route, request) => {
      if (request.method() === 'PUT') {
        putBody = request.postDataJSON();
        return route.fulfill({ json: {} });
      }
      route.fallback();
    });

    // Click + button for item-1 (qty starts at 2)
    await page.click(`[data-action="adjust-qty"][data-item-id="item-1"][data-delta="1"]`);

    expect(putBody).not.toBeNull();
    expect(putBody.quantity).toBe(3);
  });

  test('add item via autocomplete', async ({ page }) => {
    let postBody = null;
    await page.route('**/api/households/shopping/items*', (route, request) => {
      if (request.method() === 'POST') {
        postBody = request.postDataJSON();
        return route.fulfill({ json: { id: 'new-item' } });
      }
      route.fallback();
    });

    // Open add panel
    await page.click('#shop-fab');
    await page.fill('#add-item-input', 'tomato');

    // Wait for autocomplete
    await expect(page.locator('#autocomplete-dropdown')).toHaveClass(/visible/);

    // Select first food item
    const firstItem = page.locator('[data-action="select-food"]').first();
    const foodId = await firstItem.getAttribute('data-food-id');
    await firstItem.click();

    expect(postBody).not.toBeNull();
    expect(postBody.foodId).toBe(foodId);
  });

  test('clear checked items', async ({ page }) => {
    const deletedIds = [];
    await page.route('**/api/households/shopping/items/*', (route, request) => {
      if (request.method() === 'DELETE') {
        const url = request.url();
        const id = url.split('/').pop();
        deletedIds.push(id);
        return route.fulfill({ status: 200, json: {} });
      }
      route.fallback();
    });

    await page.click('[data-action="clear-checked"]');

    // Should have deleted the checked item
    expect(deletedIds).toContain('item-3');
  });
});
