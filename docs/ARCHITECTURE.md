# Architecture

# Borobudur Aggregated Heatmap Dashboard

## 1. Overview

The system turns raw visitor GPS logs into a privacy-safe, aggregated heatmap.
Raw points are never streamed to the browser. Instead the backend periodically
serves pre-aggregated GeoJSON, and the frontend polls it on an interval.

```txt
Mobile App / Mock Generator
  → Hyperbase (ScyllaDB BaaS)
  → Backend API (Express)
      → Repository layer
      → Cleansing + bounds filtering
      → Grid aggregation
      → GeoJSON transformation
  → GeoJSON REST API
  → Frontend (React + Vite + Leaflet)
  → Leaflet heatmap layer
```

## 2. Components

### 2.1 Frontend (built)

React + Vite + TypeScript + Tailwind + Leaflet (`react-leaflet` + `leaflet.heat`),
plus Recharts for the dashboard charts. Client-side only; no SSR. Supports
light/dark/system themes and English/Indonesian i18n.

Tiles are tokenless raster. The basemap is **theme-independent** — standard
OpenStreetMap in both light and dark mode, deliberately matching
`tiles="OpenStreetMap"` in the DBSCAN notebook so the dashboard and the notebook's
folium maps look like the same place. Esri World Imagery satellite is opt-in via
the in-map layer picker, not tied to the theme.

Polls `GET /api/heatmap/aggregate` and `GET /api/dashboard/summary` every ~30s and
updates the existing Leaflet heat layer in place (no map re-creation).

### 2.2 Backend (this phase)

Express + TypeScript REST API. Layered:

```txt
routes/        HTTP layer — validation, status codes, error envelope
services/      Aggregation + GeoJSON transformation (pure, testable)
repositories/  Storage abstraction (memory fallback + Hyperbase REST)
utils/         Validation, time-window resolution, density labeling
config/        Bounds, grid size, env
types/         Shared domain types
```

### 2.3 Hotspot detection (built)

DBSCAN, scoped to hotspot detection only. It runs **live inside the backend**, in
TypeScript — `services/dbscan.service.ts` implements the clustering and
`services/hotspot-detection.service.ts` reduces each cluster to an aggregate
(centroid, point count, extent radius, nearest named area, density tier, share).
`GET /api/hotspots` clusters the current time window on request; `eps` (metres)
and `minSamples` are query parameters, clamped in `config/dbscan.ts`.

`ml/notebooks/dbscan_exploration.ipynb` (Python + Pandas + scikit-learn + folium)
is the parameter-exploration companion, not a production dependency — nothing at
runtime reads it, and the backend no longer reads `ml/output/hotspots.json`.

## 3. Data flow (backend)

1. Route receives a request and validates `window` / `source` / `from` / `to`.
2. `LocationRepository.getLocations()` returns raw logs for the time range.
3. `aggregateToGrid()` cleans the data:
   - validates latitude, longitude, timestamp,
   - drops points outside `BOROBUDUR_BOUNDS`,
   - snaps survivors onto a fixed grid (`GRID_SIZE`),
   - counts points per cell, normalizes to a `weight` (0..1), labels density.
4. `toFeatureCollection()` emits GeoJSON with `[longitude, latitude]` and no
   `visitor_id`.
5. Route returns raw GeoJSON (heatmap) or the standard success envelope (others).

## 4. Repository pattern

Services depend only on the `LocationRepository` interface:

```ts
getLocations(params): Promise<LocationLog[]>
insertLocation(location): Promise<void>
insertManyLocations(locations): Promise<void>
```

- `MemoryLocationRepository` — in-process store, seeds sample data, used until
  Hyperbase credentials exist. Selected with `REPOSITORY_DRIVER=memory`.
- `HyperbaseLocationRepository` — Hyperbase REST integration (server-side HTTP
  client, cached service JWT, bounded paginated reads, bounded-concurrency
  inserts). Selected with `REPOSITORY_DRIVER=hyperbase`.

Swapping drivers requires no service changes.

## 5. Privacy by construction

- `visitor_id` exists only on `LocationLog` (internal). The GeoJSON feature type
  has no field for it, so it cannot leak through the heatmap endpoint.
- Output is aggregated grid cells, never individual points or routes.

## 6. Deployment (built)

Docker Compose on the campus server (`jarkom1`), three containers: `frontend`
(nginx serving the static build and proxying `/api` to the backend), `backend`,
and `postgres` for admin auth. Everything is served from **one origin**, so the
session cookie stays `SameSite=Strict` and CORS never applies. All published
ports bind to loopback by default; only the frontend's is meant to be opened, and
a Cloudflare Tunnel provides the public hostname and certificate.

See `DEPLOYMENT.md` for the full topology, environment template, and verification
steps.
