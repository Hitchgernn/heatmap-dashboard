# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Borobudur Aggregated Heatmap Dashboard — a web dashboard that visualizes visitor density at the Borobudur temple. Raw GPS logs (from a mobile app, stored in Hyperbase/ScyllaDB) are fetched by the backend, cleaned, aggregated into a grid, and served as GeoJSON. The frontend polls that GeoJSON and renders a Mapbox heatmap.

Status: the backend is built and all six endpoints work. `frontend/` and the Python ML script do not exist yet. See `docs/` (PRD.md, API.md, ARCHITECTURE.md) for the full spec — API.md is the authoritative endpoint contract.

## Commands

All backend commands run from `backend/`:

```bash
npm install        # install deps
npm run dev        # ts-node-dev, hot reload on http://localhost:3001
npm run build      # tsc -> dist/
npm start          # run built dist/index.js
npm run typecheck  # tsc --noEmit (run this to verify changes; build also does it)
npm test           # node --test with tsx (no test files exist yet)
```

There is no lint step configured. Verify changes with `npm run build` or `npm run typecheck`.

The memory repository auto-seeds ~97 clustered sample points on boot, so endpoints return data immediately without Hyperbase credentials. Generate more via `POST /api/mock/generate`.

Running a single test once tests exist: `node --test --import tsx ./src/path/to/file.test.ts`.

### Gotcha: stale dev server

The node process appears as `node-22` in `pgrep`, so `pkill -f "dist/index.js"` does NOT match it. If a new server fails to bind (`EADDRINUSE` on 3001) the old code keeps answering — making new routes look like 404s. Find and kill the real PID: `ss -ltnp | grep :3001` then `kill <pid>`.

## Architecture

Layered Express + TypeScript backend. Dependencies point inward: `routes → services → repositories`, with `utils`, `config`, and `types` shared. Services never import a concrete repository — only the `LocationRepository` interface.

**The request pipeline** (the core flow worth understanding):
1. A route validates query params (`utils/parseQuery.ts`) and calls `getLocationRepository()`.
2. The repository returns raw `LocationLog[]` filtered by time window + source.
3. `services/aggregation.service.ts` cleans them (`utils/validateLocation.ts`: coord/timestamp validity **and** Borobudur-bounds filtering — out-of-bounds points are dropped here), snaps survivors onto a fixed grid (`GRID_SIZE` in `config/bounds.ts`), counts per cell, normalizes to a `weight` (0–1), and labels density.
4. `services/geojson.service.ts` converts cells to a GeoJSON `FeatureCollection`.

**Repository pattern:** `repositories/index.ts` is a singleton factory selecting the driver from `REPOSITORY_DRIVER` env (`memory` default, or `hyperbase`). `MemoryLocationRepository` is the working in-process store; `HyperbaseLocationRepository` is a placeholder that throws until the Hyperbase/ScyllaDB integration is wired. Swapping drivers requires no service changes.

**Config is centralized** — never hardcode geography. `config/bounds.ts` holds `BOROBUDUR_BOUNDS`, `BOROBUDUR_CENTER`, `GRID_SIZE`; `config/areas.ts` holds named-area clusters used by both the mock generator (realistic distribution) and the dashboard (`most_crowded_area` label). `config/env.ts` is the only place that reads `process.env`.

**Hotspots** (`GET /api/hotspots`) read a precomputed `ml/output/hotspots.json` (DBSCAN runs out-of-band; the Python script isn't built yet). Path overridable via `ML_HOTSPOTS_PATH`.

## Response conventions

- GeoJSON endpoints (`/api/heatmap/aggregate`) return raw GeoJSON, no envelope.
- All other endpoints use `{ success: true, data }` or `{ success: false, error: { code, message } }` (`utils/httpResponse.ts`). Error codes: `VALIDATION_ERROR`, `INVALID_TIME_WINDOW`, `INVALID_COORDINATE`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`.

## Hard rules (non-negotiable)

- **GeoJSON coordinates are `[longitude, latitude]`** — never `[lat, lng]`. This is the classic bug; the whole map breaks silently if reversed.
- **Never expose `visitor_id`** in any frontend-facing response. It may be used internally (e.g. distinct-visitor counts). The `HeatmapFeature`/response types have no field for it, keeping this true by construction — don't add one.
- **Serve aggregated data only** — no raw point streaming, no individual routes/movement history. Updates are REST polling, not WebSockets.
- **Frontend never touches Hyperbase** — all data flows through the backend REST API.
- **Do not use Next.js** for the frontend (React + Vite + TS + Tailwind + Mapbox GL JS). It is a client-side geospatial dashboard; no SSR/SEO needed.
- **ML scope is DBSCAN hotspot detection only** — no deep learning, crowd prediction, trajectory analysis, next-zone prediction, or route recommendation.
- Keep the MVP simple and modular; reuse the existing aggregation/validation/time-window/density utilities rather than duplicating them.
