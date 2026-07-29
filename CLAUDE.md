# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Borobudur Aggregated Heatmap Dashboard — a web dashboard that visualizes visitor density at the Borobudur temple. Raw GPS logs (from a mobile app, stored in Hyperbase/ScyllaDB) are fetched by the backend, cleaned, aggregated into a grid, and served as GeoJSON. The frontend polls that GeoJSON and renders a Leaflet heatmap (OpenStreetMap tiles, no map token needed).

Status: the backend (`backend/`, all six data endpoints plus admin auth) and the frontend (`frontend/`, a monitoring dashboard with light/dark/system themes and English/Indonesian i18n) are built and build-verified. DBSCAN hotspot detection runs **live in the backend, in TypeScript** (`services/dbscan.service.ts` + `services/hotspot-detection.service.ts`); `ml/notebooks/dbscan_exploration.ipynb` (DBSCAN + folium maps, committed with outputs) is the parameter-exploration companion where the `eps`/`minSamples` defaults came from, not a runtime dependency. The Docker/Nginx deployment layer is built (`docker-compose.yml`, `docs/DEPLOYMENT.md`) and running on the campus server. See `docs/` for the full spec — `BLUEPRINT.md` is the project blueprint (Bahasa Indonesia), published with the rest of `docs/` at <https://hitchgernn.github.io/heatmap-dashboard/> via MkDocs Material (`mkdocs.yml`, `.github/workflows/docs.yml`) — `API.md` is the authoritative endpoint contract, and `HYPERBASE_SCHEMA.md` is authoritative for the Hyperbase data model (the `coordinate data` collection; it supersedes the older `location_logs` design in `HYPERBASE_INTEGRATION.md`). `DATA_FLOWS.md` has the mock-generator and auth sequence diagrams.

## Code intelligence

This repo uses a graphify knowledge graph at `graphify-out/` — **gitignored**, so a fresh clone has none until you run `graphify update .` (AST-only, no API cost). For codebase questions, run `graphify query "<question>"` first — it returns a scoped subgraph (code **and** docs, ~700 nodes) far smaller than grepping or reading `GRAPH_REPORT.md` wholesale; `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for one concept. After changing code, re-run `graphify update .` to keep it current. `graphify-out/obsidian/` is a human-navigable vault of the same graph for Obsidian's graph view — note it is **not** produced by `graphify update`; it came from a one-off script, so it is local-only and does not regenerate. A `.codegraph/` index also exists locally (gitignored, personal) — when present, `codegraph_explore` / `codegraph explore "<symbols>"` returns verbatim source plus callers for a symbol before editing.

## Commands

Backend (from `backend/`):

```bash
npm install        # install deps
npm run dev        # ts-node-dev, hot reload on http://localhost:3001
npm run build      # tsc -> dist/
npm start          # run built dist/index.js
npm run typecheck  # tsc --noEmit (run this to verify changes; build also does it)
npm test           # node --test with tsx (no test files exist yet)
```

Frontend (from `frontend/`):

```bash
npm install        # install deps
npm run dev        # vite dev server on http://localhost:5173
npm run build      # tsc --noEmit && vite build -> dist/
npm run preview    # serve the built bundle on http://localhost:4173
npm run typecheck  # tsc --noEmit
```

There is no lint step in either package. Verify changes with `npm run build` (or `typecheck`). No test runner is wired up for the frontend.

The memory repository auto-seeds ~97 clustered sample points on boot, so backend endpoints return data immediately without Hyperbase credentials. Seeded timestamps are anchored at boot and span the prior ~14 min, so they age out of the default 15m window once the server has run a while — regenerate with `POST /api/mock/generate` to repopulate. Running a single backend test once tests exist: `node --test --import tsx ./src/path/to/file.test.ts`.

The frontend map is Leaflet with standard OpenStreetMap tiles — no map token needed. The basemap is **theme-independent** (it does not change with light/dark) and deliberately matches `tiles="OpenStreetMap"` in the DBSCAN notebook so the dashboard and the notebook's folium maps look like the same place. Esri World Imagery satellite is opt-in via the in-map layer picker. `frontend/.env` only needs `VITE_API_BASE_URL` (gitignored; defaults to `http://localhost:3001`).

Commits follow Conventional Commits scoped to this project (`feat(frontend):`, `chore(repo):`, etc.); see git history for the established style.

### Gotcha: no Postgres = every login 500s

Admin auth needs Postgres running. With nothing on 5432, `POST /api/auth/admin/signin` returns 500 `"Authentication service unavailable"` (the catch-all in `routes/auth/admin.routes.ts`) — the message names auth, not the DB, so it reads like a frontend or credentials problem when it is neither. Check `ss -ltnp | grep :5432` first.

`docker compose up -d postgres` is the intended path, but fails with `permission denied ... /var/run/docker.sock` unless the user is in the `docker` group. Fallback with no Docker and no sudo — a user-owned cluster:

```bash
initdb -D ~/.local/pgdata -U borobudur --auth=trust
pg_ctl -D ~/.local/pgdata -l ~/.local/pgdata/server.log \
  -o "-c listen_addresses=127.0.0.1 -p 5432 -c unix_socket_directories=/home/$USER/.local/pgdata" start
createdb -h 127.0.0.1 -U borobudur borobudur_auth
cd backend && npm run db:init
```

The `unix_socket_directories` override is required: Postgres defaults to the root-owned `/var/run/postgresql` and dies with `could not create lock file ... Permission denied`. Those `initdb` values match the `env.database` defaults in `config/env.ts` exactly, so no `PG*`/`DATABASE_URL` entries are needed in `backend/.env`. The cluster does not survive a reboot (re-run `pg_ctl ... start`), but its data does. Finally, register an admin — `POST /api/auth/admin/signup` with the `ADMIN_REGISTRATION_SECRET` from `backend/.env`; without one, correct credentials still fail.

### Gotcha: stale dev server

The node process appears as `node-22` in `pgrep`, so `pkill -f "dist/index.js"` does NOT match it. If a new server fails to bind (`EADDRINUSE` on 3001/5173) the old code keeps answering — making new routes look like 404s. Find and kill the real PID: `ss -ltnp | grep :3001` then `kill <pid>`.

## Backend architecture

Layered Express + TypeScript. Dependencies point inward: `routes → services → repositories`, with `utils`, `config`, and `types` shared. Services never import a concrete repository — only the `LocationRepository` interface.

**The request pipeline** (the core flow worth understanding):
1. A route validates query params (`utils/parseQuery.ts`) and calls `getLocationRepository()`. Time windows: presets `5m|15m|1h|today|3d|7d|30d` (`window=`), or a custom `from`/`to` ISO pair (must satisfy `from < to`, span ≤ 90 days → `INVALID_TIME_WINDOW` otherwise). **Every data route must use the shared `parseLocationQuery()` — never inline its own validation.** (The heatmap route once carried a stale copy-pasted `VALID_WINDOWS`; a subset array still satisfies `TimeWindowPreset[]`, so tsc can't catch the drift.)
2. The repository returns raw `LocationLog[]` filtered by time window + source.
3. `services/aggregation.service.ts` cleans them (`utils/validateLocation.ts`: coord/timestamp validity **and** Borobudur-bounds filtering — out-of-bounds points are dropped here), snaps survivors onto a fixed grid (`GRID_SIZE` in `config/bounds.ts`), counts per cell, normalizes to a `weight` (0–1), and labels density.
4. `services/geojson.service.ts` converts cells to a GeoJSON `FeatureCollection`.

**Repository pattern:** `repositories/index.ts` is a singleton factory selecting the driver from `REPOSITORY_DRIVER` env (`memory` default, or `hyperbase`). `MemoryLocationRepository` is the working in-process store; `HyperbaseLocationRepository` is implemented — it talks to the hosted Hyperbase BaaS over REST via `HyperbaseHttpClient` (token-based auth → cached Bearer JWT, `AbortController` timeout, one re-login retry on 401/403). It reads the mobile app's `coordinate data` collection (`_id`, `_updated_at`, `altitude_m`, `client_id`, `floor`, `latitude`, `longitude` — no custom `timestamp`, no `source` column; see `docs/HYPERBASE_SCHEMA.md`). Queries use `{fields, filters:[{op:"AND",children}], limit}` with time windows expressed as **UUIDv7 `_id` range bounds** (the UUIDv7 high bits encode unix-ms, so `_id >= bound(from)` / `_id < bound(to)`); pagination tightens the upper bound with the last `_id` seen instead of adding a second `<` restriction. The real coordinate driver is read-only: inserts throw, and `source=mock` queries short-circuit to `[]` (all rows map to `source: "mobile_app"`). Swapping drivers requires no service changes.

**Separate mock collection (optional):** set `HYPERBASE_MOCK_COLLECTION_ID` (with optional `HYPERBASE_MOCK_{BASE_URL,PROJECT_ID,TOKEN_ID,TOKEN_SECRET}` overrides, falling back to the location values) to write generated mock data to a Hyperbase collection distinct from the mobile app's. When set on the hyperbase driver: the mock endpoints are no longer rejected and write through a **second, write-capable** `HyperbaseLocationRepository` (`getMockLocationRepository()`, real POST inserts with bounded concurrency); `getLocationRepository()` returns a `RoutingLocationRepository` that serves `source=mock` reads from the mock collection (labeled `source: "mock"`) while `source=mobile_app`/`all` stay on the real collection. Caveat: Hyperbase sets `_id`/`_updated_at` at insert time, so mock rows are timestamped "now" (the generator's backdated timestamp is not persisted) — fine for spatial DBSCAN observation within the current window. Observe via `source=mock` on the API/Swagger/notebook, or the dashboard's **Mobile App / Mock** toggle (see Frontend architecture); the UI defaults to `source=mobile_app`.

**Hyperbase requires a `backend/.env`** (gitignored) with `REPOSITORY_DRIVER=hyperbase` plus `HYPERBASE_BASE_URL`, `HYPERBASE_PROJECT_ID`, `HYPERBASE_LOCATION_COLLECTION_ID`, `HYPERBASE_TOKEN_ID`, `HYPERBASE_TOKEN_SECRET`. **Location and auth are separate Hyperbase projects**: the admin auth collection has its own `HYPERBASE_AUTH_BASE_URL` / `HYPERBASE_AUTH_PROJECT_ID` / `HYPERBASE_AUTH_TOKEN_ID` / `HYPERBASE_AUTH_TOKEN_SECRET` (each falls back to its location counterpart when empty, so single-project setups need nothing extra; tokens are project-scoped, so a different auth project needs its own token). `env.hyperbase` = location project, `env.hyperbaseAuth` = auth project (`auth.service.ts` uses only the latter). `config/env.ts` calls `import "dotenv/config"` on its first line — without dotenv the file is never read and the driver silently falls back to `memory`. The Hyperbase schema field is `client_id`; the repository mirrors it into the internal `visitor_key`/`visitor_id` for distinct counting (all stay internal-only — see hard rules). A temporary `GET /api/debug/hyperbase` route (`routes/debug.routes.ts`, mounted in `index.ts`) verifies auth without exposing the JWT — **remove before production.**

**Config is centralized** — never hardcode geography. `config/bounds.ts` holds `BOROBUDUR_BOUNDS`, `BOROBUDUR_CENTER`, `GRID_SIZE`; `config/areas.ts` holds named-area clusters used by both the mock generator (realistic distribution) and the dashboard (`most_crowded_area` label). `config/env.ts` is the only place that reads `process.env`.

**Hotspots** (`GET /api/hotspots`) run DBSCAN **live** over the current window's logs — same `cleanLocations()` pipeline as the heatmap, then `dbscan()` (haversine metres) and a reduction to aggregate clusters (centroid, count, extent radius, nearest named area, tier, share). `eps` and `minSamples` are query params, clamped in `config/dbscan.ts` (`eps` 2–200, default 8; `minSamples` 2–50, default 5). Scatter points are capped at 4000 and carry position + tier only — no `visitor_id`, no timestamp, **no ordering**, so they can't be reassembled into a trajectory.

**API docs (Swagger)** — Swagger UI at `GET /api/docs`, raw spec at `GET /api/docs.json`. Both are mounted in `index.ts` **before** the `requireAuth`-gated routers, so the docs themselves are public while every endpoint they document is not; "Try it out" only works once you hold a session cookie. `config/swagger.ts` builds the OpenAPI 3.0.3 spec with `swagger-jsdoc`: reusable component schemas + the `cookieAuth` security scheme live there, while per-endpoint detail lives in `@openapi` JSDoc blocks above each route handler. Two consequences worth knowing:

- The `apis:` glob covers **both** `routes/**/*.ts` and `routes/**/*.js` relative to `__dirname`, because the annotations are read from source comments at runtime — dev reads the `.ts`, production reads the compiled `.js` (tsc keeps comments by default; stripping them would silently empty the docs).
- Enum values in the annotations (windows, sources) are hand-mirrored from `utils/parseQuery.ts`. Nothing type-checks that mirror — if you add a time-window preset, update both. `docs/API.md` remains the authoritative contract.

## Frontend architecture

React 18 + Vite 6 + TypeScript + Tailwind v4 + Leaflet (`leaflet` + `react-leaflet` v4 + `leaflet.heat`) + Recharts (dashboard charts). Client-side only. `App.tsx` owns page/data state and fetching; components are presentational. Two React contexts wrap the app in `main.tsx`: `ThemeProvider` and `LanguageProvider`.

- **The map is created exactly once.** `MapView.tsx` renders a react-leaflet `<MapContainer>` (created once) + `<TileLayer>`, with `HeatLayer` and `HotspotLayer` as children that get the map via react-leaflet context. The `<TileLayer>` is keyed by the selected basemap id (`"osm"` / `"satellite"`) so switching basemaps remounts just the layer (the map stays put) — it is **not** keyed by theme, since the basemap no longer changes with light/dark. A `ResizeHandler` child calls `invalidateSize` on container resize (sidebar collapse animates width). `LayerPicker` (the floating basemap switcher) lives in `MapView.tsx` but renders *outside* `<MapContainer>`, absolutely positioned, so Leaflet never owns it.
- **`HeatLayer.tsx`** wraps `leaflet.heat`: creates one `L.heatLayer` and calls `setLatLngs` to update points in place; toggles visibility by add/remove from the map (never recreated on poll).
- **`HotspotLayer.tsx`** renders declarative `<CircleMarker>` children (one per hotspot), returning `null` when hidden.
- **`lib/map.ts`** holds center/zoom, the `BasemapId` union plus per-basemap tile URL + attribution + `maxNativeZoom` (OSM tops out at z19, satellite at z19; the map's `maxZoom` is 20, so Leaflet upscales past that instead of going gray), the heat gradient, and `toHeatPoints()` — the GeoJSON→heat conversion.
- **Polling:** `App.tsx` polls heatmap + summary together every 30s (`POLL_INTERVAL_MS`); changing the time window tears down and restarts the interval. First load shows a prominent loader, later polls a subtle status pill.
- **Time window is a discriminated union** (`types/heatmap.ts`): `{ kind: "preset", value }` or `{ kind: "custom", amount, unit: "hours" | "days" }`. `TimeFilter.tsx` renders the preset pills plus a Custom popover (capped at the backend's 90-day limit). `lib/api.ts` `windowParams()` maps presets to `window=` and computes a **fresh `from`/`to` pair on every fetch** for custom windows so the range rolls forward with polling.
- **Heatmap page has Live/Timelapse modes** (`HeatmapView.tsx`): Timelapse replays a chosen date or from/to range in fixed steps (5m–1h). Each frame is one absolute slice fetched via `lib/api.ts` `getHeatmapSlice(from, to)` (same raw-GeoJSON endpoint); `hooks/useTimelapse.ts` caches frames by index as promises (no double-fetch, failed fetches self-evict for retry), prefetches 3 ahead, and auto-plays at 800ms/frame. Frame math + validation (288-frame cap, 90-day span mirror) in `lib/timelapse.ts`; UI in `TimelapseSetup.tsx`/`TimelapseBar.tsx`. While a frame is in flight, `tl.loading` drives a spinner + `t("tl.processing")` in **two** places — inline in `TimelapseBar.tsx` and as a top-center pill overlaying the map in `HeatmapView.tsx` — so the aggregation is visible without looking at the scrubber. The Heatmap page renders **no hotspot markers** — those live on Dashboard/Hotspots pages only.

  `TimelapseSetup.tsx` gotcha: native `datetime-local` inputs have a ~220px min-content width and will **not** shrink inside a flex row, so they must stay stacked under their labels at `w-full` (with `min-w-0` on the shared input class). Putting them beside a label in a `justify-between` row overflows the panel.
- **Data-source toggle (Mobile App / Mock):** a global segmented control in `TopHeader.tsx` (shown on Dashboard/Heatmap/Hotspots) drives a `source: "mobile_app" | "mock"` state in `App.tsx`, threaded into every data fetch — heatmap, summary, hotspots, **and** the timelapse slice (`getHeatmapSlice`/`useTimelapse` take a `source` arg; changing it resets the frame cache). Switching source re-runs the loaders (reusing the first-load spinner as the switch indicator). The choice persists to `localStorage` (`borobudur.source`) so a refresh keeps it, and is cleared on logout so a fresh login starts from the **Mobile App** default. Driver caveat: on the memory driver Mobile App is empty (seeded data is `source:"mock"`); on hyperbase Mock is empty unless `HYPERBASE_MOCK_COLLECTION_ID` is set — the toggle is correct either way, data presence is a backend matter.
- **Dashboard charts (`DashboardView.tsx`):** two Recharts charts sit above the hotspot table, both fed from the already-fetched `hotspots[]` (no extra request) and colored via `lib/hotspots.ts` `TIER_META`/`hotspotTier` so they agree with the map markers — `HotspotBarChart.tsx` (horizontal bars, visitor points per area; custom single-line Y-axis tick to avoid label wrap) and `DensityDonut.tsx` (share of points across High/Medium/Low tiers). Layout: the map column is capped (`minmax(0,720px)`) and the right column is `1fr`, so on sidebar collapse the **map holds its size while the right column extends** to fill the freed width; the two charts are side-by-side (`xl:grid-cols-2`, stacking below xl) with the table full-width beneath.
- **`lib/api.ts` handles two response styles:** the heatmap endpoint returns raw GeoJSON; summary/hotspots use the `{ success, data }` envelope; `POST /api/mock/generate` returns a bare `{ success, inserted, source }` (no envelope). Reads `VITE_API_BASE_URL` (default `http://localhost:3001`; behind Nginx, `/api`). The client functions still **default** `source=all` when unset, but `App.tsx` passes the toggle's value (default `mobile_app`); `getHeatmapSlice` also honors it. Never default a UI fetch to `mock` — it short-circuits to empty on the hyperbase driver.

**Typography — three fonts, three roles** (wired as Tailwind v4 theme vars in `index.css`): **Instrument Serif** (`font-display`) for the wordmark, page/panel headings, and prominent named values; **DM Sans** for everything you'd read as a sentence — it is the document default, so most elements need **no** font class; **Fira Code** (`font-mono`) for all numbers, metrics, IDs, status-pill text, and tiny uppercase eyebrow labels. Rule of thumb: a number or status → mono; a prominent heading or name → display; otherwise no class.

**Theme system (`context/theme.tsx`):** light / dark / system, persisted to `localStorage` (`borobudur.theme`), applied via Tailwind class-based dark mode — toggles `.dark` on `<html>`, tracks the OS preference live via `matchMedia` in system mode. `index.css` enables it with `@custom-variant dark (&:where(.dark, .dark *))`. An inline script in `index.html` applies the stored theme (and language) before React mounts to avoid a flash. Components carry `dark:` variants throughout.

**i18n (`context/language.tsx` + `lib/i18n.ts`):** English (`en`) / Indonesian (`id`), persisted to `localStorage` (`borobudur.lang`). `useLanguage()` exposes `t(key, vars?)`. `en` is the source of truth (its keys define `TranslationKey`; `id` must cover the same keys — type-enforced). **Section/product names stay English in both locales** (Dashboard, Heatmap, Hotspots, Borobudur, Settings, Mock Generator) — they read as proper nouns and sound off when localized, so they live as literals in components, not in the dictionary.

**Pages & navigation:** `Sidebar.tsx` switches between `dashboard` / `heatmap` / `hotspots` / `mock` views (page content is keyed by page in `App.tsx` to replay a `page-enter` transition). The active page persists to `localStorage` (`borobudur.page`) so a refresh restores it. **Settings is a modal, not a page** — opened from a gear button beside the profile at the sidebar bottom, rendered via `Modal.tsx` (centered, blurred backdrop, Escape/backdrop-click to close). `SettingsView.tsx` has Appearance + Language pickers and a Logout button, wired through `App.tsx` to `signout` from the auth context (clears the persisted page, then calls `POST /api/auth/admin/logout`).

### Frontend gotchas

- **Leaflet uses `[latitude, longitude]`; backend GeoJSON is `[longitude, latitude]`.** Convert when crossing the boundary: `lib/map.ts` `toHeatPoints()` maps GeoJSON features to `[lat, lng, weight]`; hotspot `CircleMarker` centers use `[center_lat, center_lng]`. Do not mix these up.
- The Google Fonts `@import` must be the **first line** of `src/index.css`, before the Tailwind import, or the build warns and fonts may not load.
- Build is `tsc --noEmit && vite build` — a single tsconfig, not project references (the `tsc -b` / `tsconfig.node.json` setup was removed because it conflicted with `noEmit`). `*.tsbuildinfo` is gitignored.

## Response conventions

- GeoJSON endpoints (`/api/heatmap/aggregate`) return raw GeoJSON, no envelope.
- All other endpoints use `{ success: true, data }` or `{ success: false, error: { code, message } }` (`utils/httpResponse.ts`). Error codes: `VALIDATION_ERROR`, `INVALID_TIME_WINDOW`, `INVALID_COORDINATE`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`.

## Authentication

Admin-only auth backed by **self-hosted PostgreSQL** (location logs stay in Hyperbase; only auth moved to Postgres). `docs/HYPERBASE_AUTH_INTEGRATION.md` is the historical Hyperbase-proxy spec — superseded, kept for reference.

**Database**: an `admins` table (`id` uuid, `email` unique, `password_hash`, `role`, `created_at`) in Postgres. `db/schema.sql` is the DDL; `db/pool.ts` is the shared `pg.Pool` (reads `DATABASE_URL` or discrete `PG*`); `db/init.ts` applies the schema idempotently (`npm run db:init`). `docker-compose.yml` provides the Postgres service (auto-applies the schema on first init via `/docker-entrypoint-initdb.d`).

**Backend auth stack** (`backend/src/`):
- `config/env.ts` — env vars: `DATABASE_URL` (or `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`), `JWT_SECRET`, `JWT_EXPIRES_IN` (default 24h), `ADMIN_REGISTRATION_SECRET`, `COOKIE_SECRET`, `COOKIE_MAX_AGE_MS`. (The legacy `HYPERBASE_AUTH_*` vars remain in env for now but are unused by auth.)
- `services/auth.service.ts` — Postgres-backed, **same exported surface** as before: `signinAdmin` (bcrypt-compare → sign our own JWT), `signupAdmin` (bcrypt-hash → INSERT, 409 on duplicate email), `validateSession` (`jwt.verify` → reload admin row → enforce `role === "admin"`). Uses `bcryptjs` + `jsonwebtoken`; no Hyperbase calls.
- `middleware/auth.middleware.ts` — `requireAuth` (reads JWT from `borobudur_session` httpOnly cookie, validates via `validateSession`, attaches `req.user`), `requireRole` (checks `req.user.role`). Unchanged in shape by the Postgres swap.
- `routes/auth/index.ts` — aggregator mounted at `/api/auth`. Currently only admin; designed for future `/api/auth/visitor/*`.
- `routes/auth/admin.routes.ts` — `POST /signin`, `POST /signup` (gated by `ADMIN_REGISTRATION_SECRET`), `POST /logout`, `GET /me`.

All data routes (`/api/heatmap`, `/api/dashboard`, `/api/mock`, `/api/hotspots`, `/api/debug`) are protected by `requireAuth`.

**Frontend auth** (`frontend/src/`):
- `lib/auth.ts` — API client for `/api/auth/admin/*` endpoints (all use `credentials: "include"`).
- `context/auth.tsx` — `AuthProvider`/`useAuth`: checks session on mount via `GET /me`, exposes `signin`/`signout`/`status`/`user`/`error`.
- `components/LoginPage.tsx` — split-panel login page matching the dashboard design system.
- `App.tsx` — auth gate: loading spinner → login page → `DashboardShell`. All hooks live in `DashboardShell` (not conditionally).
- `lib/api.ts` — all data fetches include `credentials: "include"` for cookie transport.

**Cookie**: `borobudur_session`, httpOnly, secure (in production), SameSite=strict, 24h default. The cookie carries our own signed JWT (was a Hyperbase-issued JWT before the Postgres migration).

**Migration note**: the old Hyperbase auth used Argon2id hashes that can't be extracted, so existing admin(s) must re-register via `POST /api/auth/admin/signup` (gated by `ADMIN_REGISTRATION_SECRET`) against the new Postgres store.

## Hard rules (non-negotiable)

- **GeoJSON coordinates are `[longitude, latitude]`** — never `[lat, lng]`. This is the classic bug; the whole map breaks silently if reversed. Note Leaflet is the opposite — it takes `[lat, lng]` — so convert at the boundary (see `lib/map.ts`), never reorder the GeoJSON itself.
- **Never expose `visitor_id`** in any frontend-facing response. It may be used internally (e.g. distinct-visitor counts). The `HeatmapFeature`/response types have no field for it, keeping this true by construction — don't add one.
- **Serve aggregated data only** — no raw point streaming, no individual routes/movement history. Updates are REST polling, not WebSockets.
- **Frontend never touches Hyperbase** — all data flows through the backend REST API.
- **Do not use Next.js** for the frontend (React + Vite + TS + Tailwind + Leaflet). It is a client-side geospatial dashboard; no SSR/SEO needed.
- **ML scope is DBSCAN hotspot detection only** — no deep learning, crowd prediction, trajectory analysis, next-zone prediction, or route recommendation.
- Keep the MVP simple and modular; reuse the existing aggregation/validation/time-window/density utilities rather than duplicating them.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
