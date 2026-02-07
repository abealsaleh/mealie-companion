# Mealie Companion

A lightweight companion web app for [Mealie](https://mealie.io/) that provides two features the default UI lacks:

1. **Quick Add to Meal Plan** - paste a URL or type a recipe name to instantly add it to your meal plan
2. **Shopping List** - OurGroceries-style shopping list with category grouping, autocomplete from Mealie's food database, and tap-to-check

## Architecture

Single-page app (HTML/CSS/JS, no build step) served by nginx:alpine. nginx proxies `/api/*` to Mealie to avoid CORS. Both containers share a Docker network.

## Setup

### Prerequisites

- Mealie running in Docker
- Docker Compose
- A Mealie user account (the app uses Mealie's login flow)

### Deploy

1. Clone this repo to your Docker host:

   ```bash
   git clone https://github.com/<your-user>/mealie-companion.git
   cd mealie-companion
   ```

2. Ensure your Mealie container is on a network called `mealie_default`. If your network has a different name, update `compose.yaml` accordingly.

3. If Mealie is not reachable at `mealie:9000` from within Docker, update the environment variables in `compose.yaml`:

   ```yaml
   environment:
     - MEALIE_HOST=your-mealie-hostname
     - MEALIE_PORT=9000
   ```

4. Start the container:

   ```bash
   docker compose up -d
   ```

5. Open `http://<your-host>:9944` in a browser.

6. Sign in with your Mealie username or email on first use.

## Features

### Authentication

Uses Mealie's native OAuth2 password login (`POST /api/auth/token`). Supports username or email. Session tokens auto-refresh every 20 minutes. With "Remember me" checked (default), the token is stored in `localStorage` so sessions persist across PWA restarts; unchecked uses `sessionStorage` for single-session use. No API keys to manage.

### Meal Plan

- **8-day rolling view**: shows today through 7 days ahead, with refresh button
- **Quick add**: tap the + button to open the add form; auto-detects URLs vs recipe names
- **Recipe search**: searches existing recipes with keyboard navigation (arrow keys + Enter)
- **URL import**: imports recipes from URLs via Mealie's scraper
- **Day-of-week date picker** (defaults to today, shows "Today", "Tomorrow", day names with dates) and **meal type selector** (defaults to dinner)
- **Delete entries**: remove meals directly from the plan view

### Shopping List

- **List selector**: switch between your Mealie shopping lists
- **Category grouping**: items grouped by label with collapsible sections and orange headers
- **Add items**: tap the + button to open the add form with autocomplete from Mealie's food database (`/api/foods`); keyboard navigation (arrow keys + Enter) supported
- **Food linking**: all items are created as food entries so names are stored in `food.name` and the `note` field stays available for actual notes; selecting an existing food links it via `foodId` so the food's label is auto-assigned for category grouping
- **New items**: uncategorized items automatically prompt for a category after adding
- **Quantity stepper**: tap +/− to adjust item quantity inline
- **Notes**: tap the note icon to add or edit a note on any item; icon highlights when a note exists
- **Searchable label picker**: tap a label badge to reassign categories; search/filter labels by name; create new categories inline. Changes propagate back to Mealie's food database
- **Tap to check/uncheck**: items move between active and checked sections
- **Clear checked**: deletes all checked items from the list
- **Pull to refresh**: on mobile, pull down to re-fetch

## Files

| File | Purpose |
|------|---------|
| `index.html` | App markup (HTML only) |
| `style.css` | All styles |
| `app.js` | All application logic |
| `manifest.json` | PWA manifest for home screen install |
| `sw.js` | Service worker for offline caching of static assets |
| `nginx.conf` | Reverse proxy config (envsubst template) |
| `compose.yaml` | Docker Compose deployment |

## API Endpoints Used

- `POST /api/auth/token` - login (OAuth2 password flow)
- `GET /api/auth/refresh` - refresh session token
- `GET/POST /api/recipes` - search and create recipes
- `POST /api/recipes/create/url` - import from URL
- `GET /api/households/mealplans` - fetch meal plan entries by date range
- `POST /api/households/mealplans` - add to meal plan
- `DELETE /api/households/mealplans/{id}` - remove meal plan entry
- `GET /api/households/shopping/lists` - list shopping lists
- `GET /api/households/shopping/lists/{id}` - get list items
- `POST /api/households/shopping/items` - add item (with `foodId` or `note`)
- `PUT /api/households/shopping/items/{id}` - check/uncheck
- `DELETE /api/households/shopping/items/{id}` - remove item
- `GET /api/foods?search=` - autocomplete food search
- `GET/PUT /api/foods/{id}` - read/update food (for label propagation)
- `GET/POST /api/groups/labels` - list and create category labels
