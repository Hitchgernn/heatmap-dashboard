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
  → Frontend (React + Vite + Mapbox)
  → Mapbox heatmap layer
```

## 2. Components

### 2.1 Frontend (planned)

React + Vite + TypeScript + Tailwind + Mapbox GL JS. Client-side only; no SSR.
Polls `GET /api/heatmap/aggregate` and `GET /api/dashboard/summary` every ~30s
and updates the existing Mapbox GeoJSON source in place (no map re-creation).

### 2.2 Backend (this phase)

Express + TypeScript REST API. Layered:

```txt
routes/        HTTP layer — validation, status codes, error envelope
services/      Aggregation + GeoJSON transformation (pure, testable)
repositories/  Storage abstraction (memory fallback + Hyperbase placeholder)
utils/         Validation, time-window resolution, density labeling
config/        Bounds, grid size, env
types/         Shared domain types
```

### 2.3 ML (planned)

Python + Pandas + Scikit-learn DBSCAN for hotspot detection only. Runs
out-of-band; the backend reads precomputed `ml/output/hotspots.json` for the
`/api/hotspots` endpoint.

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
- `HyperbaseLocationRepository` — placeholder; throws until implemented.
  Selected with `REPOSITORY_DRIVER=hyperbase`.

Swapping drivers requires no service changes.

## 5. Privacy by construction

- `visitor_id` exists only on `LocationLog` (internal). The GeoJSON feature type
  has no field for it, so it cannot leak through the heatmap endpoint.
- Output is aggregated grid cells, never individual points or routes.

## 6. Deployment (planned)

Docker + Docker Compose with an Nginx reverse proxy on the campus server.
Frontend builds to static files served by Nginx; backend runs as a container.
Nginx routes `/api` to the backend and serves the SPA for everything else.
