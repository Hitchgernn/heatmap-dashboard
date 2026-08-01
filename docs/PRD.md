# Original PRD

!!! warning "Archived"
    This is the brief the project started from. The system has since drifted from
    it in several places — the ML runs in TypeScript inside the backend rather
    than in Python, the map uses plain OpenStreetMap tiles rather than CARTO, and
    the mobile app records `client_id` rather than `visitor_id`.

    For what the system does today, read [BLUEPRINT.md](BLUEPRINT.md). For the
    binding endpoint contract, read [API.md](API.md). This page is kept as a
    record of the original requirements.

## 1. Project Summary

Build a web-based Borobudur Heatmap Dashboard for visualizing visitor density in the Borobudur temple area.

The existing mobile app records visitor location data such as latitude, longitude, timestamp, and visitor_id. The data is stored in Hyperbase, a Backend-as-a-Service that uses ScyllaDB.

This dashboard will fetch raw location data from Hyperbase through a backend service, clean and aggregate the data, transform it into GeoJSON, and display it as a colored heatmap on an interactive Leaflet map.

The system must not stream every raw GPS point to the frontend in real-time because that would be heavy and inefficient. Instead, use a near real-time aggregated heatmap approach.

Machine learning scope is limited to Hotspot Detection only, using DBSCAN clustering on historical latitude and longitude data.

## 2. Final Tech Stack

### Frontend

Use:

* React.js
* Vite
* TypeScript
* Tailwind CSS
* Leaflet (react-leaflet + leaflet.heat)

Do not use Next.js for this project.

Reason:

This dashboard is mainly a client-side geospatial visualization app. The main workload is Leaflet rendering, GeoJSON-driven heat layer updates, API polling, and UI interaction. Server-side rendering and SEO are not important for this use case. React + Vite is simpler, faster to develop, easier to deploy as static files, and flexible for multiple deployment options. Leaflet with CARTO OpenStreetMap tiles needs no map token.

### Backend

Use:

* Node.js
* Express.js
* TypeScript
* REST API
* Hyperbase integration
* Data cleansing
* Grid-based aggregation
* GeoJSON transformation

### Machine Learning

Use:

* Python
* Pandas
* Scikit-learn
* DBSCAN

ML is only for Hotspot Detection.

### Deployment

Use:

* Docker
* Docker Compose
* Nginx reverse proxy (for campus server deployment)
* Campus server accessed through SSH
* Optional: Vercel for frontend deployment

Deployment options:

1. Full deployment on campus server:

   * Frontend served via Nginx (static build)
   * Backend served via Docker container

2. Hybrid deployment:

   * Frontend deployed on Vercel
   * Backend deployed on campus server (or other server)
   * Frontend communicates with backend via public API endpoint

Final deployment choice can be decided later depending on infrastructure constraints.

## 3. Main Goals

The project must achieve the following:

1. Display an interactive Borobudur map using Leaflet.
2. Fetch raw location data from Hyperbase through the backend.
3. Clean and validate raw latitude and longitude data.
4. Filter invalid or out-of-bound coordinates.
5. Aggregate raw location data by grid or zone.
6. Return aggregated GeoJSON from the backend.
7. Display a colored heatmap layer on the frontend.
8. Provide time filters such as last 5 minutes, 15 minutes, 1 hour, today, and custom range.
9. Periodically refresh heatmap data using REST API polling.
10. Provide a mock data generator that inserts raw mock location data into Hyperbase.
11. Use the mock data generator to test the full flow from Hyperbase to backend to frontend.
12. Implement Hotspot Detection using DBSCAN as a separate ML module.
13. Never expose visitor_id or individual movement history to the public frontend.

## 4. Non-Goals

Do not implement:

1. Full real-time raw GPS streaming.
2. WebSocket streaming for every location update.
3. Deep learning.
4. Crowd density prediction.
5. Trajectory analysis.
6. Next-zone prediction.
7. Route recommendation.
8. Structural damage prediction.
9. Complex authentication.
10. Role-based access control.
11. 3D map visualization.
12. Production-scale monitoring stack.
13. Microservices architecture.

This MVP should stay focused and build the working heatmap dashboard first.

## 5. System Architecture

### Production Flow

Mobile App
→ Hyperbase / ScyllaDB
→ Backend API
→ Aggregation Layer
→ GeoJSON API
→ Frontend Dashboard
→ Leaflet Heatmap

### Testing Flow

Mock Data Generator
→ Hyperbase / ScyllaDB
→ Backend API
→ Aggregation Layer
→ GeoJSON API
→ Frontend Dashboard
→ Leaflet Heatmap

### Important Rule

The frontend must never fetch data directly from Hyperbase.

All frontend data must come from the backend API.

## 6. Folder Structure

Use this simple folder structure:

```txt
borobudur-heatmap-dashboard/
├── frontend/
├── backend/
├── ml/
├── docs/
├── docker-compose.yml
├── README.md
└── .gitignore
```

### frontend/

Contains the React + Vite dashboard.

### backend/

Contains the Express API, Hyperbase integration, aggregation service, mock data generator, and GeoJSON transformation.

### ml/

Contains the DBSCAN Hotspot Detection script.

### docs/

Contains project documentation such as API docs, architecture notes, and this PRD.

## 7. Detailed Project Structure

```txt
borobudur-heatmap-dashboard/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapView.tsx
│   │   │   ├── DashboardCards.tsx
│   │   │   ├── TimeFilter.tsx
│   │   │   ├── LayerToggle.tsx
│   │   │   ├── HotspotLayer.tsx
│   │   │   └── LoadingState.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── map.ts
│   │   ├── types/
│   │   │   ├── heatmap.ts
│   │   │   └── hotspot.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── .env
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── heatmap.routes.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── mock.routes.ts
│   │   │   └── hotspot.routes.ts
│   │   ├── services/
│   │   │   ├── hyperbase.service.ts
│   │   │   ├── aggregation.service.ts
│   │   │   ├── geojson.service.ts
│   │   │   ├── mock-data.service.ts
│   │   │   └── hotspot.service.ts
│   │   ├── repositories/
│   │   │   ├── location.repository.ts
│   │   │   ├── hyperbase-location.repository.ts
│   │   │   └── memory-location.repository.ts
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   └── bounds.ts
│   │   ├── types/
│   │   │   └── location.ts
│   │   └── utils/
│   │       ├── validateLocation.ts
│   │       ├── timeWindow.ts
│   │       └── density.ts
│   ├── .env
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── ml/
│   ├── hotspot_detection.py
│   ├── requirements.txt
│   ├── sample_locations.json
│   └── output/
│       └── hotspots.json
│
├── docs/
│   ├── PRD.md
│   ├── API.md
│   └── ARCHITECTURE.md
│
├── docker-compose.yml
├── README.md
└── .gitignore
```

## 8. Data Model

### 8.1 Raw Location Data

Raw location data stored in Hyperbase should have this structure:

```json
{
  "id_data": "loc_001",
  "timestamp": "2026-06-16T10:30:00Z",
  "visitor_id": "visitor_123",
  "longitude": 110.2037,
  "latitude": -7.6079,
  "source": "mobile_app"
}
```

For mock testing data:

```json
{
  "id_data": "mock_001",
  "timestamp": "2026-06-16T10:30:00Z",
  "visitor_id": "mock_visitor_001",
  "longitude": 110.2037,
  "latitude": -7.6079,
  "source": "mock"
}
```

### 8.2 Aggregated Heatmap Data

The backend should aggregate raw data into this internal format:

```json
{
  "grid_id": "grid_001",
  "center_lat": -7.6079,
  "center_lng": 110.2037,
  "visitor_count": 120,
  "weight": 0.92,
  "density_level": "high",
  "time_window": "15m"
}
```

### 8.3 Aggregated GeoJSON Response

The frontend should receive heatmap data in this format:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "grid_id": "grid_001",
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

Important:

GeoJSON coordinate order must always be:

```txt
[longitude, latitude]
```

Never expose visitor_id in the frontend GeoJSON response.

## 9. Backend Requirements

### 9.1 Backend Responsibilities

The backend must:

1. Connect to Hyperbase.
2. Fetch raw location logs.
3. Validate latitude, longitude, and timestamp.
4. Filter invalid coordinates.
5. Filter points outside Borobudur bounds.
6. Apply time filtering.
7. Aggregate raw points into grid cells.
8. Convert aggregated result to GeoJSON.
9. Serve REST API endpoints.
10. Insert mock location data into Hyperbase.
11. Serve hotspot detection result.
12. Never expose visitor_id to frontend responses.

## 10. Backend API Endpoints

### 10.1 Health Check

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

### 10.2 Get Aggregated Heatmap

```http
GET /api/heatmap/aggregate?window=15m
```

Supported query parameters:

```txt
window=5m | 15m | 1h | today
from=ISO_TIMESTAMP
to=ISO_TIMESTAMP
source=mobile_app | mock | all
```

Example:

```http
GET /api/heatmap/aggregate?window=15m&source=mock
```

Response:

```json
{
  "type": "FeatureCollection",
  "features": []
}
```

Rules:

1. Fetch raw location data from Hyperbase.
2. Apply time filter.
3. Apply source filter.
4. Validate coordinates.
5. Filter points outside Borobudur bounds.
6. Aggregate points by grid.
7. Normalize visitor_count into weight between 0 and 1.
8. Return aggregated GeoJSON.

### 10.3 Get Dashboard Summary

```http
GET /api/dashboard/summary?window=15m
```

Response:

```json
{
  "estimated_active_visitors": 245,
  "total_location_points": 3021,
  "most_crowded_area": "Main Stupa",
  "last_updated": "2026-06-16T10:30:00Z"
}
```

Rules:

1. Count distinct visitor_id only inside backend if needed.
2. Do not expose visitor_id.
3. Return aggregate summary only.

### 10.4 Insert Single Mock Location

```http
POST /api/mock/location
```

Purpose:

Insert one raw mock location into Hyperbase.

Request:

```json
{
  "visitor_id": "mock_visitor_001",
  "timestamp": "2026-06-16T10:30:00Z",
  "latitude": -7.6079,
  "longitude": 110.2037
}
```

Backend must automatically add:

```json
{
  "source": "mock"
}
```

Response:

```json
{
  "success": true,
  "message": "Mock location inserted"
}
```

### 10.5 Bulk Generate Mock Data

```http
POST /api/mock/generate
```

Purpose:

Generate realistic mock visitor location data and insert it into Hyperbase.

Request:

```json
{
  "visitor_count": 100,
  "points_per_visitor": 10,
  "source": "mock"
}
```

Response:

```json
{
  "success": true,
  "inserted": 1000
}
```

Rules:

1. Generate raw location data around Borobudur.
2. Use realistic clusters.
3. Insert generated data into Hyperbase.
4. Mark all generated rows with source: "mock".
5. Do not generate fully random points across the entire map.

Suggested distribution:

```txt
Main Stupa: 45%
Entrance Area: 25%
East Stairs: 15%
West Area: 10%
Other Area: 5%
```

### 10.6 Get Hotspot Detection Result

```http
GET /api/hotspots?from=ISO_TIMESTAMP&to=ISO_TIMESTAMP&source=mock
```

Response:

```json
{
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
```

Implementation options:

1. Backend reads precomputed `ml/output/hotspots.json`.
2. Backend calls the Python DBSCAN script.
3. Backend returns the hotspot JSON response.

For MVP, reading a precomputed hotspot JSON is acceptable.

## 11. Aggregation Logic

Use grid-based aggregation for MVP.

### 11.1 Grid Aggregation

Define a grid size:

```ts
const GRID_SIZE = 0.0001;
```

Convert each coordinate into a grid cell:

```txt
grid_lat = round(latitude / GRID_SIZE) * GRID_SIZE
grid_lng = round(longitude / GRID_SIZE) * GRID_SIZE
grid_id = `${grid_lat}_${grid_lng}`
```

For each grid:

```txt
visitor_count = number of points in grid
weight = visitor_count / max_visitor_count
```

Density label:

```txt
low      if weight < 0.33
medium   if weight >= 0.33 and weight < 0.66
high     if weight >= 0.66
```

### 11.2 GeoJSON Conversion

Each aggregated grid cell becomes one GeoJSON Point feature.

Use:

```txt
coordinates: [center_lng, center_lat]
```

Not:

```txt
coordinates: [center_lat, center_lng]
```

Do not commit this classic coordinate mistake.

## 12. Borobudur Boundary Filter

Create a config file:

```txt
backend/src/config/bounds.ts
```

Use approximate placeholder bounds:

```ts
export const BOROBUDUR_BOUNDS = {
  minLat: -7.615,
  maxLat: -7.600,
  minLng: 110.195,
  maxLng: 110.215
};
```

Rules:

1. Ignore points outside this bounding box.
2. Keep the bounds easy to update later.
3. Do not hardcode bounds in multiple files.

## 13. Repository Pattern for Hyperbase

Because Hyperbase integration details may not be ready yet, use a repository interface.

Create:

```ts
export interface LocationRepository {
  getLocations(params: LocationQuery): Promise<LocationLog[]>;
  insertLocation(location: LocationLog): Promise<void>;
  insertManyLocations(locations: LocationLog[]): Promise<void>;
}
```

Implement:

```txt
HyperbaseLocationRepository
MemoryLocationRepository
```

Rules:

1. Use HyperbaseLocationRepository when Hyperbase credentials are available.
2. Use MemoryLocationRepository or file-based mock fallback during early development.
3. Keep backend services independent from the actual database implementation.

## 14. Frontend Requirements

### 14.1 Frontend Responsibilities

The frontend must:

1. Render the dashboard layout.
2. Render a Leaflet map centered on Borobudur.
3. Fetch aggregated GeoJSON from the backend.
4. Display a colored heatmap layer.
5. Provide time filter controls.
6. Display summary cards.
7. Display last updated timestamp.
8. Poll the backend periodically.
9. Show loading and error states.
10. Never display visitor_id.

### 14.2 Main Page

Create one main dashboard page for MVP.

The page should include:

1. Header
2. Dashboard summary cards
3. Time filter
4. Layer toggle
5. Leaflet map
6. Heatmap layer
7. Hotspot layer toggle
8. Last updated timestamp

Suggested layout:

```txt
-------------------------------------------------
| Borobudur Heatmap Dashboard                   |
-------------------------------------------------
| Active Visitors | Crowded Area | Last Updated |
-------------------------------------------------
| Filter: 5m | 15m | 1h | Today | Custom        |
-------------------------------------------------
| Leaflet Map + Aggregated Heatmap              |
-------------------------------------------------
```

### 14.3 Map Requirements

The Leaflet map must:

1. Center on Borobudur.
2. Use aggregated GeoJSON from the backend.
3. Add a heatmap layer.
4. Update layer data when the API refreshes.
5. Avoid reinitializing the whole map on every refresh.
6. Keep heatmap color visible.
7. Keep the rest of the UI simple and layout-focused.

### 14.4 Polling

Use REST API polling.

Default:

```txt
Refresh every 30 seconds
```

Admin Mode:

```txt
30 seconds to 1 minute
```

Visitor Mode:

```txt
1 to 5 minutes
```

For MVP, implement only one refresh interval:

```txt
30 seconds
```

### 14.5 Frontend API Calls

Frontend should call:

```txt
GET /api/heatmap/aggregate?window=15m
GET /api/dashboard/summary?window=15m
GET /api/hotspots?source=mock
```

Note:

If frontend is deployed on Vercel, ensure the backend API base URL is configurable via environment
