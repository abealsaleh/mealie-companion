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

6. Sign in with your Mealie email and password on first use.

### Synology NAS

Deploy to `/volume1/docker/support/mealie-companion/`. Access via port 9944, or set up a reverse proxy in Synology's Control Panel for SSL.

## Features

### Authentication

Uses Mealie's native OAuth2 password login (`POST /api/auth/token`). Session tokens are stored in `sessionStorage` and auto-refresh every 20 minutes. No API keys to manage.

### Meal Plan Quick Add

- Auto-detects URLs vs recipe names
- Searches existing recipes to avoid duplicates
- Imports recipes from URLs via Mealie's scraper
- Date picker (defaults to today) and meal type selector (defaults to dinner)

### Shopping List

- **List selector**: switch between your Mealie shopping lists
- **Category grouping**: items grouped by label with collapsible sections
- **Autocomplete**: searches Mealie's food database (`/api/foods`) as you type; selecting a food links it via `foodId` so the food's label is auto-assigned for category grouping
- **New items**: items not in the food database are added as note-based items with optional manual category selection
- **Tap to check/uncheck**: items move between active and checked sections
- **Clear checked**: deletes all checked items from the list
- **Pull to refresh**: on mobile, pull down to re-fetch

## Files

| File | Purpose |
|------|---------|
| `index.html` | Complete app (HTML + CSS + JS) |
| `manifest.json` | PWA manifest for home screen install |
| `sw.js` | Service worker for offline caching of static assets |
| `nginx.conf` | Reverse proxy config (envsubst template) |
| `compose.yaml` | Docker Compose deployment |

## API Endpoints Used

- `POST /api/auth/token` - login (OAuth2 password flow)
- `GET /api/auth/refresh` - refresh session token
- `GET/POST /api/recipes` - search and create recipes
- `POST /api/recipes/create/url` - import from URL
- `POST /api/households/mealplans` - add to meal plan
- `GET /api/households/shopping/lists` - list shopping lists
- `GET /api/households/shopping/lists/{id}` - get list items
- `POST /api/households/shopping/items` - add item (with `foodId` or `note`)
- `PUT /api/households/shopping/items/{id}` - check/uncheck
- `DELETE /api/households/shopping/items/{id}` - remove item
- `GET /api/foods?search=` - autocomplete food search
- `GET /api/groups/labels` - category labels
