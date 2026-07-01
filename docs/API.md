# API Documentation

# Borobudur Aggregated Heatmap Dashboard

## 1. Overview

This document defines the backend API contract for the Borobudur Aggregated Heatmap Dashboard.

The frontend must not access Hyperbase directly. All data must be requested through the backend API.

Main backend responsibilities:

1. Fetch raw visitor location data from Hyperbase.
2. Validate and clean location data.
3. Filter points outside the Borobudur boundary.
4. Aggregate location data into grid-based heatmap data.
5. Transform aggregated data into GeoJSON.
6. Return privacy-safe responses to the frontend.
7. Insert mock location data into Hyperbase for testing.
8. Return hotspot detection results.

## 2. Base URL

### Local Development

```txt
http://localhost:3001
```

### Docker / Nginx Deployment

When deployed behind Nginx:

```txt
/api
```

Frontend should use:

```env
VITE_API_BASE_URL=/api
```

If backend is deployed separately:

```env
VITE_API_BASE_URL=https://your-backend-domain.com/api
```

## 3. Global API Rules

### 3.1 Privacy Rules

The API must never expose:

```txt
visitor_id
individual visitor route
raw individual movement history
```

The backend may use `visitor_id` internally for counting unique visitors, but it must not appear in frontend-facing responses.

### 3.2 GeoJSON Coordinate Rule

All GeoJSON coordinates must use:

```txt
[longitude, latitude]
```

Never use:

```txt
[latitude, longitude]
```

### 3.3 Standard Error Response

All failed API responses should follow this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameter"
  }
}
```

Example error codes:

```txt
VALIDATION_ERROR
NOT_FOUND
HYPERBASE_ERROR
INTERNAL_SERVER_ERROR
INVALID_TIME_WINDOW
INVALID_COORDINATE
```

### 3.4 Standard Success Response

For normal JSON responses that are not GeoJSON:

```json
{
  "success": true,
  "data": {}
}
```

For GeoJSON endpoints, return raw GeoJSON directly.

## 4. Health Check

## GET `/health`

Checks whether the backend server is running.

### Request

```http
GET /health
```

### Response

```json
{
  "status": "ok"
}
```

### Status Codes

```txt
200 OK
```

---

## 5. Aggregated Heatmap API

## GET `/api/heatmap/aggregate`

Returns aggregated heatmap data in GeoJSON format.

The endpoint fetches raw location data from Hyperbase, applies time filtering, validates coordinates, filters points outside the Borobudur area, aggregates points by grid, and returns GeoJSON.

### Request

```http
GET /api/heatmap/aggregate?window=15m&source=mock
```

### Query Parameters

| Parameter | Type          | Required | Description                                                                      |
| --------- | ------------- | -------: | -------------------------------------------------------------------------------- |
| `window`  | string        |       No | Time window preset. Allowed values: `5m`, `15m`, `1h`, `today`. Default: `15m`.  |
| `from`    | ISO timestamp |       No | Custom start time.                                                               |
| `to`      | ISO timestamp |       No | Custom end time.                                                                 |
| `source`  | string        |       No | Data source filter. Allowed values: `mobile_app`, `mock`, `all`. Default: `all`. |

### Rules

1. If `from` and `to` are provided, use custom date range.
2. If `from` and `to` are not provided, use `window`.
3. Validate all timestamps.
4. Validate latitude and longitude.
5. Filter points outside Borobudur bounds.
6. Aggregate valid points by grid.
7. Normalize `visitor_count` into `weight` between `0` and `1`.
8. Do not include `visitor_id` in the response.

### Example Response

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

### Empty Response

If no valid data exists:

```json
{
  "type": "FeatureCollection",
  "features": []
}
```

### Status Codes

```txt
200 OK
400 Bad Request
500 Internal Server Error
```

### Example Curl

```bash
curl "http://localhost:3001/api/heatmap/aggregate?window=15m&source=mock"
```

---

## 6. Dashboard Summary API

## GET `/api/dashboard/summary`

Returns aggregate statistics for the dashboard cards.

### Request

```http
GET /api/dashboard/summary?window=15m&source=mock
```

### Query Parameters

| Parameter | Type          | Required | Description                                                                      |
| --------- | ------------- | -------: | -------------------------------------------------------------------------------- |
| `window`  | string        |       No | Time window preset. Allowed values: `5m`, `15m`, `1h`, `today`. Default: `15m`.  |
| `from`    | ISO timestamp |       No | Custom start time.                                                               |
| `to`      | ISO timestamp |       No | Custom end time.                                                                 |
| `source`  | string        |       No | Data source filter. Allowed values: `mobile_app`, `mock`, `all`. Default: `all`. |

### Response

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

### Field Descriptions

| Field                       | Description                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `estimated_active_visitors` | Estimated number of active visitors based on distinct visitor count inside backend logic. |
| `total_location_points`     | Number of valid location points processed in the selected time window.                    |
| `most_crowded_area`         | Area or grid with the highest visitor count.                                              |
| `last_updated`              | Latest timestamp from processed data.                                                     |

### Privacy Rule

The backend may count distinct `visitor_id` internally, but the response must not expose visitor IDs.

### Status Codes

```txt
200 OK
400 Bad Request
500 Internal Server Error
```

### Example Curl

```bash
curl "http://localhost:3001/api/dashboard/summary?window=15m&source=mock"
```

---

## 7. Insert Single Mock Location

## POST `/api/mock/location`

Inserts one raw mock location into Hyperbase.

This endpoint is for development and testing only.

### Request

```http
POST /api/mock/location
Content-Type: application/json
```

### Request Body

```json
{
  "visitor_id": "mock_visitor_001",
  "timestamp": "2026-06-16T10:30:00Z",
  "latitude": -7.6079,
  "longitude": 110.2037
}
```

### Backend Behavior

The backend must add:

```json
{
  "source": "mock"
}
```

The inserted Hyperbase record should look like:

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

### Response

```json
{
  "success": true,
  "message": "Mock location inserted"
}
```

### Validation Rules

1. `visitor_id` is required.
2. `timestamp` is required and must be a valid ISO timestamp.
3. `latitude` is required and must be a number.
4. `longitude` is required and must be a number.
5. Coordinate must be inside or near the Borobudur boundary.

### Status Codes

```txt
201 Created
400 Bad Request
500 Internal Server Error
```

### Example Curl

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

## POST `/api/mock/generate`

Generates realistic mock visitor location data and inserts it into Hyperbase.

This endpoint is used to test the full flow:

```txt
Mock Data Generator → Hyperbase → Backend Aggregation → GeoJSON API → Frontend Heatmap
```

### Request

```http
POST /api/mock/generate
Content-Type: application/json
```

### Request Body

```json
{
  "visitor_count": 100,
  "points_per_visitor": 10,
  "source": "mock"
}
```

### Field Descriptions

| Field                | Type   | Required | Description                                                                 |
| -------------------- | ------ | -------: | --------------------------------------------------------------------------- |
| `visitor_count`      | number |      Yes | Number of mock visitors to generate.                                        |
| `points_per_visitor` | number |      Yes | Number of location points per visitor.                                      |
| `source`             | string |       No | Source to tag generated records with. Allowed: `mock`, `mobile_app`. Default: `mock`. |

### Mock Distribution

Generated points should follow a realistic distribution:

```txt
Main Stupa: 45%
Entrance Area: 25%
East Stairs: 15%
West Area: 10%
Other Area: 5%
```

Do not generate fully random points across the entire map.

### Response

```json
{
  "success": true,
  "inserted": 1000,
  "source": "mock"
}
```

### Status Codes

```txt
201 Created
400 Bad Request
500 Internal Server Error
```

### Example Curl

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

## GET `/api/hotspots`

Returns hotspot detection results from the DBSCAN module.

For MVP, the backend may read precomputed hotspot results from:

```txt
ml/output/hotspots.json
```

Alternative implementation:

The backend may call:

```txt
ml/hotspot_detection.py
```

and return the generated output.

### Request

```http
GET /api/hotspots?from=2026-06-16T00:00:00Z&to=2026-06-16T23:59:59Z&source=mock
```

### Query Parameters

| Parameter | Type          | Required | Description                                                                      |
| --------- | ------------- | -------: | -------------------------------------------------------------------------------- |
| `from`    | ISO timestamp |       No | Start time for hotspot analysis.                                                 |
| `to`      | ISO timestamp |       No | End time for hotspot analysis.                                                   |
| `source`  | string        |       No | Data source filter. Allowed values: `mobile_app`, `mock`, `all`. Default: `all`. |

### Response

```json
{
  "success": true,
  "data": {
    "hotspots": [
      {
        "cluster_id": "hotspot_01",
        "center_lat": -7.6079,
        "center_lng": 110.2037,
        "total_points": 420,
        "label": "High Density Hotspot"
      }
    ]
  }
}
```

### Field Descriptions

| Field          | Description                      |
| -------------- | -------------------------------- |
| `cluster_id`   | Unique hotspot cluster ID.       |
| `center_lat`   | Latitude of hotspot center.      |
| `center_lng`   | Longitude of hotspot center.     |
| `total_points` | Total points inside the cluster. |
| `label`        | Human-readable density label.    |

### ML Scope Rules

This endpoint must only return hotspot detection results.

Do not implement:

```txt
crowd density prediction
deep learning
trajectory analysis
next-zone prediction
structural damage prediction
```

### Status Codes

```txt
200 OK
400 Bad Request
500 Internal Server Error
```

### Example Curl

```bash
curl "http://localhost:3001/api/hotspots?source=mock"
```

---

## 10. Optional Clear Mock Data API

## DELETE `/api/mock/clear`

Optional endpoint for development.

Deletes or ignores mock data from the repository layer.

Only implement if it is safe with Hyperbase permissions.

### Request

```http
DELETE /api/mock/clear
```

### Response

```json
{
  "success": true,
  "deleted": 1000
}
```

### Safety Rule

If real Hyperbase deletion is risky, do not physically delete rows. Instead, implement mock filtering through the `source` field or skip this endpoint entirely.

### Status Codes

```txt
200 OK
500 Internal Server Error
```

---

## 11. Internal Types

## 11.1 LocationLog

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

## 11.2 LocationQuery

```ts
export interface LocationQuery {
  window?: "5m" | "15m" | "1h" | "today";
  from?: string;
  to?: string;
  source?: "mobile_app" | "mock" | "all";
}
```

## 11.3 AggregatedGridCell

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

## 11.4 GeoJSONFeatureCollection

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

## 12. Validation Rules

### 12.1 Latitude

Valid range:

```txt
-90 <= latitude <= 90
```

### 12.2 Longitude

Valid range:

```txt
-180 <= longitude <= 180
```

### 12.3 Timestamp

Must be valid ISO timestamp.

Example:

```txt
2026-06-16T10:30:00Z
```

### 12.4 Source

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

### 12.5 Borobudur Bounds

Use placeholder bounds:

```ts
export const BOROBUDUR_BOUNDS = {
  minLat: -7.615,
  maxLat: -7.600,
  minLng: 110.195,
  maxLng: 110.215
};
```

Points outside this range should be ignored during aggregation.

## 13. Frontend API Usage

The frontend should use a centralized API client:

```txt
frontend/src/lib/api.ts
```

Required functions:

```ts
getAggregatedHeatmap(params)
getDashboardSummary(params)
getHotspots(params)
generateMockData(params)  // used by the Mock Generator admin page
```

Example:

```ts
const geojson = await getAggregatedHeatmap({
  window: "15m",
  source: "mock"
});
```

Frontend must read API base URL from:

```env
VITE_API_BASE_URL=/api
```

## 14. Polling Behavior

The frontend should poll:

```txt
GET /api/heatmap/aggregate?window=15m
GET /api/dashboard/summary?window=15m
```

Default interval:

```txt
30 seconds
```

Polling rules:

1. Do not recreate the Leaflet map on every poll.
2. Only update the existing heat layer using new data.
3. Show last updated timestamp.
4. Show loading state only on first load.
5. Show subtle refreshing state for later updates.
6. Handle API errors gracefully.

## 15. Acceptance Criteria

The API implementation is complete when:

1. `/health` returns status ok.
2. `/api/heatmap/aggregate` returns valid GeoJSON.
3. `/api/dashboard/summary` returns aggregate statistics.
4. `/api/mock/location` inserts one mock location.
5. `/api/mock/generate` inserts bulk mock data.
6. `/api/hotspots` returns hotspot results.
7. visitor_id never appears in frontend-facing heatmap response.
8. Invalid coordinates are filtered.
9. Out-of-bound points are filtered.
10. Time window filtering works.
11. Source filtering works.
12. GeoJSON uses `[longitude, latitude]`.
13. API errors follow the standard error format.
14. Frontend can consume all required API endpoints.

```
```
