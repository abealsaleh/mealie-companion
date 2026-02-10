import { test, expect } from '@playwright/test';
import { mockAuthenticatedApp, mockLoginEndpoint } from './helpers.js';
import { AUTH_TOKEN, LABELS, SHOPPING_LISTS, SHOPPING_LIST_DETAIL, MEAL_PLAN_ENTRIES } from '../fixtures/data.js';

test.describe('Login', () => {
  test('shows login screen when no token', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#setup')).toHaveClass(/active/);
  });

  test('logs in with valid credentials', async ({ page }) => {
    await mockLoginEndpoint(page);

    // After login, app will call init() which fetches these
    await page.route('**/api/groups/labels', (route) => route.fulfill({ json: LABELS }));
    await page.route('**/api/households/shopping/lists', (route) => route.fulfill({ json: { items: SHOPPING_LISTS } }));
    await page.route(`**/api/households/shopping/lists/${SHOPPING_LIST_DETAIL.id}`, (route) => route.fulfill({ json: SHOPPING_LIST_DETAIL }));
    await page.route('**/api/households/mealplans*', (route) => route.fulfill({ json: { items: MEAL_PLAN_ENTRIES } }));

    await page.goto('/');
    await page.fill('#login-email', 'test@example.com');
    await page.fill('#login-password', 'password123');
    await page.click('#login-btn');

    // Login screen should hide
    await expect(page.locator('#setup')).not.toHaveClass(/active/);
    // Meal plan should load
    await expect(page.locator('#mp-plan-content .mp-day')).toHaveCount(8);
  });

  test('shows error on failed login', async ({ page }) => {
    await page.route('**/api/auth/token', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid credentials' }),
      });
    });

    await page.goto('/');
    await page.fill('#login-email', 'wrong@example.com');
    await page.fill('#login-password', 'badpass');
    await page.click('#login-btn');

    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toContainText('Invalid credentials');
  });
});
