# Tests

Mealie Companion has two test layers:

- **Unit tests** (Vitest) — fast, no browser, test pure functions in isolation
- **E2E tests** (Playwright) — real browser against the app served by nginx, all API calls mocked via `page.route()`

## Prerequisites

```bash
npm install
npx playwright install chromium
```

## Unit tests

```bash
npm test            # single run
npm run test:watch  # watch mode
```

Unit tests live in `tests/unit/` and import source modules from `js/` directly. A setup file (`tests/unit/setup.js`) stubs `localStorage`, `sessionStorage`, and `lucide` so modules that read them at load time work in Node.

### What's covered

| Test file | Module(s) | What it tests |
|-----------|-----------|---------------|
| `state.test.js` | `js/constants.js`, `js/signals.js` | Constants (`PLAN_DAYS`, `MEAL_ORDER`, `SHOPPING_UNITS`, `DAY_NAMES`, `MONTH_SHORT`), `SK` storage keys, `labelMap` computed signal |
| `ui.test.js` | `js/utils.js` | `esc()` HTML escaping, `isUrl()` detection, `generateUUID()` format and uniqueness |
| `api.test.js` | `js/api.js` | `api()` fetch wrapper (auth headers, JSON body, error throwing), `searchAndSortFoods()` sorting, `findOrCreateFood()` match/create/error paths |
| `mealplan.test.js` | `js/utils.js` | `formatDateParam()` date formatting, `getPlanRange()` range calculation, `getRangeLabel()` label formatting |
| `shopping.test.js` | `js/utils.js` | `getItemDisplayName()` fallback chain, `getItem()` lookup |
| `ingredients.test.js` | `js/utils.js` | `ingredientDisplayText()` display string assembly, `ingLinkBadge()` badge state |
| `ingredients-setters.test.js` | `js/utils.js`, `js/signals.js` | `updateSignalArray()` immutability and field updates, ingredient setter patterns (qty, name, note, unit), `onIngEditName` space-preservation regression |

## E2E tests

E2E tests require the app to be served on `http://localhost:9944`. Use the standalone test compose file (no Mealie backend needed — all API calls are intercepted by Playwright):

```bash
docker compose -f compose.test.yaml up -d
npm run test:e2e
docker compose -f compose.test.yaml down
```

E2E tests live in `tests/e2e/`. A shared helper (`tests/e2e/helpers.js`) provides `mockAuthenticatedApp(page)` which injects a token into localStorage and routes all API endpoints to return fixture data. No real Mealie instance is needed.

### What's covered

| Test file | What it tests |
|-----------|---------------|
| `login.spec.js` | Login screen visibility, successful login flow, error display on bad credentials |
| `mealplan.spec.js` | Meal plan rendering by day, recipe search and selection, entry deletion |
| `shopping.spec.js` | List rendering with category groups, check/uncheck toggle, quantity adjustment, add via autocomplete, clear checked items |
| `ingredients.spec.js` | Opening ingredient modal from meal plan, toggling checkboxes (button count updates), adding ingredients to shopping list via list picker |

## Shared fixtures

Both unit and E2E tests import data from `tests/fixtures/data.js`. This single source of truth contains mock auth tokens, labels, shopping lists, meal plan entries, recipes, units, and food search results. Updating a fixture updates it everywhere.

## Fetch mocking (unit tests)

`tests/unit/fetch-mock.js` provides two helpers for unit tests that need to mock `fetch`:

- `mockFetch(handler)` — replaces `globalThis.fetch` with a `vi.fn()` that delegates to `handler(url, opts)`
- `jsonResponse(data, status)` — returns a Response-like object for the handler to return

## Directory layout

```
tests/
  fixtures/
    data.js              # shared test data
  unit/
    setup.js             # global stubs (localStorage, sessionStorage, lucide)
    fetch-mock.js        # fetch mocking helpers
    state.test.js
    ui.test.js
    api.test.js
    mealplan.test.js
    shopping.test.js
    ingredients.test.js
    ingredients-setters.test.js
  e2e/
    helpers.js           # mockAuthenticatedApp, mockLoginEndpoint
    login.spec.js
    mealplan.spec.js
    shopping.spec.js
    ingredients.spec.js
```
