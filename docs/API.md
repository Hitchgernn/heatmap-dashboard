# API Documentation

## 1. Overview

This is the binding contract for the backend API. Where this document and the
code disagree, that is a bug in one of them.

The backend sits between Hyperbase and the browser and does five things:

1. Reads raw location logs from the repository (Hyperbase, or the in-memory store).
2. Cleans them — drops invalid coordinates, invalid timestamps, and anything outside the Borobudur bounds.
3. Aggregates the survivors onto a fixed grid.
4. Converts the grid to GeoJSON.
5. Clusters the same cleaned points with DBSCAN for the hotspot endpoint.

The frontend never talks to Hyperbase. Every byte it displays comes through
these endpoints.

**Endpoints at a glance**

| Method | Path | Returns | Auth |
| --- | --- | --- | --- |
| `GET` | `/health` | Liveness check | Public |
| `GET` | `/api/heatmap/aggregate` | Raw GeoJSON | Session |
| `GET` | `/api/dashboard/summary` | Summary cards | Session |
| `GET` | `/api/hotspots` | DBSCAN clusters + scatter points | Session |
| `POST` | `/api/mock/location` | Inserts one mock point | Session |
| `POST` | `/api/mock/generate` | Inserts clustered mock data in bulk | Session |
| `POST` | `/api/auth/admin/signin` | Sets the session cookie | Public |
| `POST` | `/api/auth/admin/logout` | Clears the session cookie | Public |
| `GET` | `/api/auth/admin/me` | Current admin | Session |

## 2. Base URL

Local development — the backend listens on its own port:

```txt
http://localhost:3001
```

Behind nginx, the frontend and backend share one origin and the API lives under
`/api`, so the base URL is just a path:

```env
VITE_API_BASE_URL=/api
```

If you deploy the backend to a separate host, give the full URL instead. That
makes the request cross-origin, which means the session cookie needs
`SameSite=None` and HTTPS on both ends:

```env
VITE_API_BASE_URL=https://your-backend-domain.com/api
```

## 3. Global API Rules

### 3.1 Privacy Rules

Three things never appear in a response: `visitor_id`, any individual visitor's
route, and raw movement history.

The backend does use `visitor_id` internally, to count distinct visitors. It
never crosses the API boundary — the response types have no field for it, so
this holds by construction rather than by review.

### 3.2 GeoJSON Coordinate Rule

GeoJSON coordinates are `[longitude, latitude]`. Always that order, never
`[latitude, longitude]`.

Leaflet takes the opposite order, so the frontend converts at the boundary in
`frontend/src/lib/map.ts`. Do not reorder the GeoJSON to match Leaflet — flip it
on the way into the map instead. Getting this backwards puts every point in the
Indian Ocean and produces no error.

### 3.3 Standard Error Response

Every failed response uses this shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameter"
  }
}
```

Error codes emitted by the backend:

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | A request parameter or body field is malformed |
| `INVALID_TIME_WINDOW` | Unknown `window` preset, or `from`/`to` is out of order or spans more than 90 days |
| `INVALID_COORDINATE` | Latitude or longitude outside its valid range |
| `NOT_FOUND` | No route matches the path |
| `UNAUTHORIZED` | Missing, invalid, or expired session cookie |
| `FORBIDDEN` | Valid session, but the account lacks the required role |
| `AUTH_FAILED` | Sign-in rejected — wrong email or password |
| `SIGNUP_FAILED` | Admin registration rejected (for example, the email is taken) |
| `REGISTRATION_DISABLED` | `ADMIN_REGISTRATION_SECRET` is unset or did not match |
| `INTERNAL_SERVER_ERROR` | Unhandled failure |

### 3.4 Standard Success Response

For normal JSON responses that are not GeoJSON:

```json
{
  "success": true,
  "data": {}
}
```

For GeoJSON endpoints, return raw GeoJSON directly.

### 3.5 Authentication

Every route under `/api` requires an admin session. `GET /health` is the only
public endpoint.

The session is a signed JWT in a cookie named `borobudur_session` — `httpOnly`,
`SameSite=Strict`, `Secure` in production, 24 hours by default. Get one from
`POST /api/auth/admin/signin`:

```bash
curl -c cookies.txt -X POST http://localhost:3001/api/auth/admin/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}'
```

Then send it with every later request (`-b cookies.txt`). Browsers do this
automatically as long as the fetch uses `credentials: "include"`.

Without a valid cookie every `/api` route answers `401 Unauthorized`:

```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Authentication required" }
}
```

The curl examples below all omit `-b cookies.txt` for readability. Add it, or
they will return 401.

!!! note "Interactive docs"
    The backend also serves Swagger UI at `GET /api/docs` and the raw OpenAPI
    spec at `GET /api/docs.json`. Both are public, but "Try it out" only works
    once you hold a session cookie.

## 4. Health Check

### GET `/health`

Checks whether the backend server is running.

#### Request

```http
GET /health
```

#### Response

```json
{
  "status": "ok"
}
```

#### Status Codes

```txt
200 OK
```

---

## 5. Aggregated Heatmap API

### GET `/api/heatmap/aggregate`

Returns aggregated heatmap data in GeoJSON format.

The endpoint fetches raw location data from Hyperbase, applies time filtering, validates coordinates, filters points outside the Borobudur area, aggregates points by grid, and returns GeoJSON.

#### Request

```http
GET /api/heatmap/aggregate?window=15m&source=mock
```

#### Query Parameters

| Parameter | Type          | Required | Description                                                                      |
| --------- | ------------- | -------: | -------------------------------------------------------------------------------- |
| `window`  | string        |       No | Time window preset. Allowed values: `5m`, `15m`, `1h`, `today`, `3d`, `7d`, `30d`. Default: `15m`. |
| `from`    | ISO timestamp |       No | Custom start time.                                                               |
| `to`      | ISO timestamp |       No | Custom end time.                                                                 |
| `source`  | string        |       No | Data source filter. Allowed values: `mobile_app`, `mock`, `all`. Default: `all`. |

#### Rules

1. If `from` and `to` are provided, use custom date range. `from` must be earlier than `to` and the span must not exceed 90 days (`INVALID_TIME_WINDOW` otherwise).
2. If `from` and `to` are not provided, use `window`.
3. Validate all timestamps.
4. Validate latitude and longitude.
5. Filter points outside Borobudur bounds.
6. Aggregate valid points by grid.
7. Normalize `visitor_count` into `weight` between `0` and `1`.
8. Do not include `visitor_id` in the response.

#### Example Response

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "grid_id": "grid_-7.6079_110.2037",
        "visitor_count": 120,
        "weight": 0.92,
        "density_level": "high"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [110.2037, -7.6079]
      }
    }
  ]
}
```

#### Empty Response

If no valid data exists:

```json
{
  "type": "FeatureCollection",
  "features": []
}
```

#### Status Codes

```txt
200 OK
400 Bad Request
500 Internal Server Error
```

#### Example Curl

```bash
curl "http://localhost:3001/api/heatmap/aggregate?window=15m&source=mock"
```

---

## 6. Dashboard Summary API

### GET `/api/dashboard/summary`

Returns aggregate statistics for the dashboard cards.

#### Request

```http
GET /api/dashboard/summary?window=15m&source=mock
```

#### Query Parameters

| Parameter | Type          | Required | Description                                                                      |
| --------- | ------------- | -------: | -------------------------------------------------------------------------------- |
| `window`  | string        |       No | Time window preset. Allowed values: `5m`, `15m`, `1h`, `today`, `3d`, `7d`, `30d`. Default: `15m`. |
| `from`    | ISO timestamp |       No | Custom start time.                                                               |
| `to`      | ISO timestamp |       No | Custom end time.                                                                 |
| `source`  | string        |       No | Data source filter. Allowed values: `mobile_app`, `mock`, `all`. Default: `all`. |

#### Response

```json
{
  "success": true,
  "data": {
    "estimated_active_visitors": 245,
    "total_location_points": 3021,
    "most_crowded_area": "Main Stupa",
    "last_updated": "2026-06-16T10:30:00Z"
  }
}
```

#### Field Descriptions

| Field                       | Description                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `estimated_active_visitors` | Estimated number of active visitors based on distinct visitor count inside backend logic. |
| `total_location_points`     | Number of valid location points processed in the selected time window.                    |
| `most_crowded_area`         | Area or grid with the highest visitor count.                                              |
| `last_updated`              | Latest timestamp from processed data.                                                     |

#### Privacy Rule

The backend may count distinct `visitor_id` internally, but the response must not expose visitor IDs.

#### Status Codes

```txt
200 OK
400 Bad Request
500 Internal Server Error
```

#### Example Curl

```bash
curl "http://localhost:3001/api/dashboard/summary?window=15m&source=mock"
```

---

## 7. Insert Single Mock Location

### POST `/api/mock/location`

Inserts one raw mock location into Hyperbase.

This endpoint is for development and testing only.

#### Request

```http
POST /api/mock/location
Content-Type: application/json
```

#### Request Body

```json
{
  "visitor_id": "mock_visitor_001",
  "timestamp": "2026-06-16T10:30:00Z",
  "latitude": -7.6079,
  "longitude": 110.2037
}
```

#### Backend Behavior

`source` is always forced to `"mock"` — you cannot pass another value here.
`id_data` is generated if you omit it. The stored record:

```json
{
  "id_data": "mock_generated_id",
  "timestamp": "2026-06-16T10:30:00Z",
  "visitor_id": "mock_visitor_001",
  "latitude": -7.6079,
  "longitude": 110.2037,
  "source": "mock"
}
```

#### Response

```json
{
  "success": true,
  "message": "Mock location inserted"
}
```

Note this response has no `data` envelope.

#### Validation Rules

| Field | Rule | Error code on failure |
|---|---|---|
| `visitor_id` | Required, non-empty string | `VALIDATION_ERROR` |
| `timestamp` | Required, valid ISO 8601 | `VALIDATION_ERROR` |
| `latitude` | Required number in `-90..90` | `INVALID_COORDINATE` |
| `longitude` | Required number in `-180..180` | `INVALID_COORDINATE` |

Coordinates outside the Borobudur bounds are accepted here — they are dropped
later, during aggregation, so they never reach the heatmap.

#### Status Codes

```txt
201 Created
400 Bad Request
500 Internal Server Error
```

#### Example Curl

```bash
curl -X POST "http://localhost:3001/api/mock/location" \
  -H "Content-Type: application/json" \
  -d '{
    "visitor_id": "mock_visitor_001",
    "timestamp": "2026-06-16T10:30:00Z",
    "latitude": -7.6079,
    "longitude": 110.2037
  }'
```

---

## 8. Bulk Generate Mock Data

### POST `/api/mock/generate`

Generates realistic mock visitor location data and inserts it into Hyperbase.

This endpoint is used to test the full flow:

```txt
Mock Data Generator → Hyperbase → Backend Aggregation → GeoJSON API → Frontend Heatmap
```

#### Request

```http
POST /api/mock/generate
Content-Type: application/json
```

#### Request Body

```json
{
  "visitor_count": 100,
  "points_per_visitor": 10,
  "source": "mock"
}
```

#### Field Descriptions

| Field                | Type   | Required | Description                                                                 |
| -------------------- | ------ | -------: | --------------------------------------------------------------------------- |
| `visitor_count`      | number |      Yes | Number of mock visitors to generate.                                        |
| `points_per_visitor` | number |      Yes | Number of location points per visitor.                                      |
| `source`             | string |       No | Source to tag generated records with. Allowed: `mock`, `mobile_app`. Default: `mock`. |

#### Mock Distribution

Points are clustered around named areas rather than scattered randomly, so the
generated heatmap looks like a real crowd. Weights live in
`backend/src/config/areas.ts`:

| Area | Share | Jitter radius |
| --- | ---: | ---: |
| Main Stupa | 45% | 0.0006° |
| Entrance Area | 25% | 0.0006° |
| East Stairs | 15% | 0.0005° |
| West Area | 10% | 0.0005° |
| Other Area | 5% | spread across the whole bounds |

"Other Area" is whatever probability mass the named areas leave over.

#### Response

```json
{
  "success": true,
  "inserted": 1000,
  "source": "mock"
}
```

#### Status Codes

```txt
201 Created
400 Bad Request
500 Internal Server Error
```

#### Example Curl

```bash
curl -X POST "http://localhost:3001/api/mock/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "visitor_count": 100,
    "points_per_visitor": 10
  }'
```

---

## 9. Hotspot Detection API

### GET `/api/hotspots`

Runs DBSCAN over the selected time window and returns the clusters it found.

The clustering happens **live, on every request, inside the backend** —
`services/dbscan.service.ts` (haversine distance in metres) and
`services/hotspot-detection.service.ts`. Nothing is precomputed and no Python
runs at request time. The points go through the same cleaning and bounds
filtering as the heatmap before clustering.

`ml/notebooks/dbscan_exploration.ipynb` is where the default `eps` and
`minSamples` came from. It is a companion notebook, not a runtime dependency.

#### Request

```http
GET /api/hotspots?window=15m&source=mock&eps=8&minSamples=5
```

#### Query Parameters

| Parameter | Type | Required | Description |
| --- | --- | ---: | --- |
| `window` | string | No | Time window preset: `5m`, `15m`, `1h`, `today`, `3d`, `7d`, `30d`. Default: `15m`. |
| `from` | ISO timestamp | No | Custom start time. |
| `to` | ISO timestamp | No | Custom end time. |
| `source` | string | No | `mobile_app`, `mock`, or `all`. Default: `all`. |
| `eps` | number | No | Neighbourhood radius in metres. Default `8`, clamped to `2..200`. |
| `minSamples` | integer | No | Minimum neighbours needed to seed a cluster. Default `5`, clamped to `2..50`. |

Out-of-range `eps` and `minSamples` are clamped rather than rejected, so these
two never produce a 400.

#### Response

```json
{
  "success": true,
  "data": {
    "hotspots": [
      {
        "cluster_id": "cluster_0",
        "center_lat": -7.6079123,
        "center_lng": 110.2037456,
        "total_points": 420,
        "label": "Main Stupa",
        "density_level": "high",
        "radius_m": 14,
        "share": 0.3812
      }
    ],
    "points": [
      { "lat": -7.6079, "lng": 110.2037, "tier": "high" },
      { "lat": -7.6081, "lng": 110.2035, "tier": null }
    ]
  }
}
```

#### Field Descriptions

`hotspots[]` — one entry per cluster, sorted largest first:

| Field | Description |
| --- | --- |
| `cluster_id` | Positional id, `cluster_0` is the biggest |
| `center_lat` / `center_lng` | Cluster centroid |
| `total_points` | Points inside the cluster |
| `label` | Nearest named area from `config/areas.ts` |
| `density_level` | `high` / `medium` / `low`, relative to the biggest cluster |
| `radius_m` | Furthest member from the centroid, in metres |
| `share` | Fraction of all clustered points in this cluster, `0..1` |

`points[]` — the scatter overlay. Position and density tier only, capped at
4000 and downsampled beyond that. `tier` is `null` for noise points that
DBSCAN did not assign to any cluster.

#### ML Scope Rules

This endpoint returns hotspot detection only. Crowd prediction, deep learning,
trajectory analysis, next-zone prediction, and structural damage prediction are
all out of scope by design.

`points[]` carries no `visitor_id`, no timestamp, and **no ordering** — it
cannot be reassembled into anyone's path.

#### Status Codes

```txt
200 OK
400 Bad Request
500 Internal Server Error
```

#### Example Curl

```bash
curl "http://localhost:3001/api/hotspots?source=mock"
```

---

## 10. Internal Types

### 10.1 LocationLog

```ts
export type LocationSource = "mobile_app" | "mock";

export interface LocationLog {
  id_data: string;
  timestamp: string;
  visitor_id: string; // internal only — never exposed to the frontend
  visitor_key?: string; // pseudonymous Hyperbase id, internal only; optional (mock/memory paths use visitor_id)
  latitude: number;
  longitude: number;
  source: LocationSource;
}
```

### 10.2 LocationQuery

```ts
export type TimeWindowPreset = "5m" | "15m" | "1h" | "today" | "3d" | "7d" | "30d";
export type SourceFilter = LocationSource | "all";

export interface LocationQuery {
  window?: TimeWindowPreset;
  from?: string; // ISO timestamp (overrides window when paired with `to`)
  to?: string; // ISO timestamp
  source?: SourceFilter;
}
```

### 10.3 AggregatedGridCell

```ts
export type DensityLevel = "low" | "medium" | "high";

export interface AggregatedGridCell {
  grid_id: string;
  center_lat: number;
  center_lng: number;
  visitor_count: number;
  weight: number;
  density_level: DensityLevel;
  time_window: string;
}
```

### 10.4 GeoJSONFeatureCollection

```ts
export interface HeatmapFeatureCollection {
  type: "FeatureCollection";
  features: HeatmapFeature[];
}

export interface HeatmapFeature {
  type: "Feature";
  properties: {
    grid_id: string;
    visitor_count: number;
    weight: number;
    density_level: DensityLevel;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}
```

## 11. Validation Rules

### 11.1 Latitude

Valid range:

```txt
-90 <= latitude <= 90
```

### 11.2 Longitude

Valid range:

```txt
-180 <= longitude <= 180
```

### 11.3 Timestamp

Must be valid ISO timestamp.

Example:

```txt
2026-06-16T10:30:00Z
```

### 11.4 Source

Allowed values:

```txt
mobile_app
mock
all
```

For inserted mock data, backend must force:

```txt
source = mock
```

### 11.5 Borobudur Bounds

Defined once in `backend/src/config/bounds.ts` — never hardcoded anywhere else:

```ts
export const BOROBUDUR_BOUNDS = {
  minLat: -7.615,
  maxLat: -7.6,
  minLng: 110.195,
  maxLng: 110.215,
} as const;
```

Points outside this box are dropped during cleaning, before aggregation. The
same file holds `BOROBUDUR_CENTER` (derived from the bounds) and `GRID_SIZE`
(`0.0001` degrees, roughly 11 metres at this latitude).

