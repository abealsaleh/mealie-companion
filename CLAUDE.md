# Mealie Companion

## Testing Policy

Every change to this codebase must maintain or improve test coverage. Follow these rules:

### 1. New features require matching tests
- New utility functions in `js/utils.js`, `js/api.js`, etc. need unit tests.
- New user-facing behavior needs E2E tests in `tests/e2e/`.
- If a feature adds a pure function, test it directly. If it adds UI behavior, add an E2E test.

### 2. Keep tests DRY
- Use shared fixtures in `tests/fixtures/data.js` — never duplicate test data across files.
- Use `tests/unit/fetch-mock.js` helpers (`mockFetch`, `jsonResponse`) for API mocking.
- Use `tests/e2e/helpers.js` (`mockAuthenticatedApp`) for E2E setup.
- If multiple tests need the same setup, use `beforeEach`. Don't copy-paste setup blocks.
- Don't create local replicas of source functions in tests — import and test the real code.

### 3. Bug fixes require regression tests
- Every bug fix must include a unit test or E2E test that reproduces the bug.
- The test should fail without the fix and pass with it.
- Add a comment naming the regression, e.g. `(regression: spaces must not be stripped)`.

### Running tests
- Unit: `npm test`
- E2E: `docker compose -f compose.test.yaml up -d && npm run test:e2e`
- Both must pass before deploying.

## Architecture

- Single-page Preact app using htm tagged templates, no build step, browser-native ES modules.
- Components in `js/components/`, shared logic in `js/utils.js`, `js/hooks.js`, `js/api.js`.
- State managed with `@preact/signals` in `js/signals.js`, constants in `js/constants.js`.
- CSS in `style.css` — use shared selectors for common patterns, keep component-specific styles near their section.
