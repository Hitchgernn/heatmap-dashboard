# Hyperbase Integration Guide

## Borobudur Aggregated Heatmap Dashboard

## 1. Purpose

This document defines how the Borobudur Heatmap Dashboard backend should
integrate with Hyperbase and its ScyllaDB storage backend.

The integration flow is:

```text
Mock Generator / Mobile Location Data
  -> Hyperbase REST API
  -> Hyperbase DAO Layer
  -> ScyllaDB
  -> Dashboard Backend
  -> Validation and Bounds Filtering
  -> Grid Aggregation
  -> GeoJSON API
  -> React / Leaflet Heatmap
```

The dashboard frontend must never access Hyperbase, ScyllaDB, or raw visitor
location records directly.

## 2. Current Repository Status

The workspace contains:

- `hyperbase-bas`: the Rust Backend-as-a-Service implementation.
- `hyperbase-ui`: the SvelteKit Hyperbase administration dashboard.
- `docs`: the Borobudur dashboard requirements and API contract.

The Borobudur Express backend implementation is not currently present in this
workspace. Its expected repository interface and behavior are described in
`ARCHITECTURE.md`, `API.md`, and `PRD.md`.

## 3. How Hyperbase Exposes ScyllaDB

The dashboard backend must not connect to ScyllaDB directly.

Hyperbase performs the following:

1. Reads ScyllaDB connection settings from its YAML configuration.
2. Initializes the ScyllaDB adapter.
3. Wraps the adapter in the shared `Db` enum.
4. Accepts record operations through the REST API.
5. Validates the project, collection, token, and collection rules.
6. Converts JSON fields into typed DAO values.
7. Dispatches the operation to the ScyllaDB adapter.
8. Returns a JSON response envelope.

The relevant backend layers are:

```text
api/rest
  -> dao
  -> db/scylladb
  -> ScyllaDB
```

### 3.1 Physical ScyllaDB Record Table

Each Hyperbase collection creates a physical ScyllaDB table:

```text
hyperbase.records_{collection_uuid_without_hyphens}
```

The physical table includes:

```text
_collection_id
_id
_created_by
_updated_at
<custom collection fields>
```

Its primary key is:

```text
PRIMARY KEY (_collection_id, _id)
```

Records use `_id` as a UUID v7 clustering key in descending order.

The dashboard backend should treat this table as an implementation detail and
only use the Hyperbase REST API.

### 3.2 ScyllaDB Query Constraint

Hyperbase find-many filters are translated to CQL. Filtered ScyllaDB reads use:

```text
ALLOW FILTERING
```

This is acceptable for an MVP with short time windows and bounded result sets,
but it is not a production-scale time-series design.

The repository must:

- always apply a time range,
- use bounded page sizes,
- paginate with `_id`,
- avoid loading the full collection,
- avoid relying on arbitrary ordering.

Before accepting large mobile traffic, verify the indexing behavior and
load-test the expected time-window queries.

## 4. Required Hyperbase Resources

Provision these resources through the Hyperbase UI or admin REST API:

1. One Hyperbase project for the dashboard.
2. One `location_logs` collection.
3. One dedicated backend service token.
4. One collection rule for that token.

The service token should only have access to the location collection.

Recommended collection rule:

```json
{
  "find_one": "none",
  "find_many": "all",
  "insert_one": true,
  "update_one": "none",
  "delete_one": "none"
}
```

For the initial server-to-server integration, configure the token with:

```text
allow_anonymous = true
```

In this context, anonymous means the token does not represent an individual
Hyperbase user. The token itself must remain private inside the dashboard
backend.

## 5. Location Collection Schema

Create a Hyperbase collection named `location_logs`.

Recommended collection request:

```json
{
  "name": "location_logs",
  "schema_fields": {
    "id_data": {
      "kind": "string",
      "required": true,
      "unique": false,
      "indexed": false,
      "auth_column": false,
      "hashed": false,
      "hidden": false
    },
    "timestamp": {
      "kind": "timestamp",
      "required": true,
      "unique": false,
      "indexed": true,
      "auth_column": false,
      "hashed": false,
      "hidden": false
    },
    "visitor_key": {
      "kind": "string",
      "required": true,
      "unique": false,
      "indexed": false,
      "auth_column": false,
      "hashed": false,
      "hidden": false
    },
    "latitude": {
      "kind": "double",
      "required": true,
      "unique": false,
      "indexed": false,
      "auth_column": false,
      "hashed": false,
      "hidden": false
    },
    "longitude": {
      "kind": "double",
      "required": true,
      "unique": false,
      "indexed": false,
      "auth_column": false,
      "hashed": false,
      "hidden": false
    },
    "source": {
      "kind": "string",
      "required": true,
      "unique": false,
      "indexed": true,
      "auth_column": false,
      "hashed": false,
      "hidden": false
    }
  },
  "opt_auth_column_id": false,
  "opt_ttl": null
}
```

### 5.1 Field Semantics

| Field         | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `id_data`     | External event ID generated by the mobile app or mock generator |
| `timestamp`   | Time when the location point was recorded                       |
| `visitor_key` | Pseudonymous visitor identifier for internal distinct counting  |
| `latitude`    | GPS latitude                                                    |
| `longitude`   | GPS longitude                                                   |
| `source`      | `mobile_app` or `mock`                                          |

Hyperbase automatically adds:

```text
_id
_created_by
_updated_at
```

Use `_id` as the repository pagination cursor.

### 5.2 Visitor Privacy

Prefer `visitor_key` over a raw `visitor_id`.

The mobile ingestion layer should derive a stable pseudonymous value before
storing it. The dashboard backend may use this value to count distinct visitors,
but it must never include the value in frontend responses.

Do not mark `visitor_key` as a Hyperbase hidden field when using a normal project
token, because token-based record responses omit hidden fields. Privacy must be
enforced by the project backend response types and GeoJSON transformation.

## 6. Environment Variables

### 6.1 Dashboard Backend

Recommended backend environment variables:

```env
PORT=3001
REPOSITORY_DRIVER=hyperbase

HYPERBASE_BASE_URL=http://localhost:8080
HYPERBASE_PROJECT_ID=<project-uuid>
HYPERBASE_LOCATION_COLLECTION_ID=<collection-uuid>
HYPERBASE_TOKEN_ID=<token-uuid>
HYPERBASE_TOKEN_SECRET=<token-secret>
HYPERBASE_PAGE_SIZE=500
HYPERBASE_TIMEOUT_MS=5000

GRID_SIZE=0.0001
BOROBUDUR_MIN_LAT=-7.615
BOROBUDUR_MAX_LAT=-7.600
BOROBUDUR_MIN_LNG=110.195
BOROBUDUR_MAX_LNG=110.215
```

Do not prefix backend secrets with `VITE_`. Vite-prefixed variables are exposed
to frontend builds.

### 6.2 Dashboard Frontend

The frontend only needs the project backend URL:

```env
VITE_API_BASE_URL=/api
```

The frontend must not receive:

```text
HYPERBASE_TOKEN_ID
HYPERBASE_TOKEN_SECRET
Hyperbase JWT
ScyllaDB credentials
```

### 6.3 Hyperbase BaaS

The Hyperbase binary reads:

```env
HB_CONFIG_PATH=/path/to/config.yml
```

The ScyllaDB host, port, username, password, replication factor, and prepared
statement cache size remain in Hyperbase's YAML configuration.

## 7. Hyperbase REST Endpoints

The project backend needs these Hyperbase endpoints:

| Method | Endpoint                                                                    | Purpose                         |
| ------ | --------------------------------------------------------------------------- | ------------------------------- |
| `GET`  | `/api/rest`                                                                 | Hyperbase health check          |
| `POST` | `/api/rest/auth/token-based`                                                | Exchange token secret for JWT   |
| `GET`  | `/api/rest/auth/token`                                                      | Validate or renew JWT           |
| `GET`  | `/api/rest/project/{projectId}/collection/{collectionId}`                  | Validate collection/schema      |
| `POST` | `/api/rest/project/{projectId}/collection/{collectionId}/record`           | Insert one location record      |
| `POST` | `/api/rest/project/{projectId}/collection/{collectionId}/records`          | Query location records          |

Project, collection, token, and collection-rule creation are provisioning
operations and should not be performed on every application startup.

## 8. Service Credential Flow

Dashboard user authentication is outside the MVP scope. Hyperbase service
authentication is still required because record endpoints require a Bearer JWT.

At backend startup:

```http
POST /api/rest/auth/token-based
Content-Type: application/json
```

```json
{
  "token_id": "<HYPERBASE_TOKEN_ID>",
  "token": "<HYPERBASE_TOKEN_SECRET>"
}
```

Expected response:

```json
{
  "data": {
    "token": "<jwt>"
  }
}
```

The dashboard backend should cache the JWT in memory and send:

```http
Authorization: Bearer <jwt>
```

for record operations.

Do not store the JWT in browser storage or return it through the dashboard API.

For local-only development, a pre-generated Bearer token may be loaded from an
environment variable. This is less reliable because the JWT expires and should
not be the final implementation.

## 9. Hyperbase Write Contract

### 9.1 Insert One Location

```http
POST /api/rest/project/{projectId}/collection/{collectionId}/record
Authorization: Bearer <jwt>
Content-Type: application/json
```

Request:

```json
{
  "id_data": "mock_001",
  "timestamp": "2026-06-16T10:30:00Z",
  "visitor_key": "pseudonymous_123",
  "latitude": -7.6079,
  "longitude": 110.2037,
  "source": "mock"
}
```

Response:

```json
{
  "data": {
    "_id": "0197...",
    "_created_by": "0197...",
    "_updated_at": "2026-06-16T10:30:01Z",
    "id_data": "mock_001",
    "timestamp": "2026-06-16T10:30:00Z",
    "visitor_key": "pseudonymous_123",
    "latitude": -7.6079,
    "longitude": 110.2037,
    "source": "mock"
  }
}
```

`timestamp` must be RFC 3339. Hyperbase maps it to its `timestamp` schema kind.

## 10. Hyperbase Read Contract

### 10.1 Query Location Records

```http
POST /api/rest/project/{projectId}/collection/{collectionId}/records
Authorization: Bearer <jwt>
Content-Type: application/json
```

Example request:

```json
{
  "fields": [
    "_id",
    "id_data",
    "timestamp",
    "visitor_key",
    "latitude",
    "longitude",
    "source"
  ],
  "filters": [
    {
      "op": "AND",
      "children": [
        {
          "field": "timestamp",
          "op": ">=",
          "value": "2026-06-16T10:15:00Z"
        },
        {
          "field": "timestamp",
          "op": "<",
          "value": "2026-06-16T10:30:00Z"
        },
        {
          "field": "source",
          "op": "=",
          "value": "mock"
        }
      ]
    }
  ],
  "limit": 500
}
```

When `source=all`, omit the source filter.

Expected response:

```json
{
  "pagination": {
    "count": 500,
    "total": 1200
  },
  "data": [
    {
      "_id": "0197...",
      "id_data": "mock_001",
      "timestamp": "2026-06-16T10:20:00Z",
      "visitor_key": "pseudonymous_123",
      "latitude": -7.6079,
      "longitude": 110.2037,
      "source": "mock"
    }
  ]
}
```

### 10.2 Pagination

For the next page, add this condition to the existing `AND` children:

```json
{
  "field": "_id",
  "op": "<",
  "value": "<last-record-id>"
}
```

Do not rely on a client-supplied `orders` array for ScyllaDB. The current Scylla
adapter does not apply arbitrary record ordering.

## 11. Existing Hyperbase UI SDK Methods

The Hyperbase UI contains a browser-oriented API wrapper with these relevant
methods:

```ts
hyperbase.getProject({ id })
project.getCollection({ id })
collection.insertOne({ object })
collection.findManyRecords({ fields, filters, groups, orders, limit })
```

This class must not be imported directly into the Express backend because it:

- uses `localStorage`,
- uses Svelte stores,
- assumes browser runtime behavior.

The Express backend should use either:

1. A small server-side `HyperbaseHttpClient`, or
2. A future framework-neutral Hyperbase SDK extracted from the existing wrapper.

## 12. `LocationRepository` Contract

The project service layer should depend on:

```ts
export interface LocationRepository {
  getLocations(params: LocationQuery): Promise<LocationLog[]>;
  insertLocation(location: LocationLog): Promise<void>;
  insertManyLocations(locations: LocationLog[]): Promise<void>;
}
```

For a clearer storage boundary, consider changing `getLocations` to accept an
already-resolved range:

```ts
export interface ResolvedLocationQuery {
  from: string;
  to: string;
  source: "mobile_app" | "mock" | "all";
}
```

Time-window presets should be resolved by a service or utility before calling
the repository.

## 13. `HyperbaseLocationRepository`

### 13.1 Responsibilities

`HyperbaseLocationRepository` should:

1. Read and validate Hyperbase environment variables.
2. Obtain and cache a service JWT.
3. Add the Bearer token to every record request.
4. Convert `LocationQuery` into Hyperbase filters.
5. Fetch all required pages with a bounded page size.
6. Validate Hyperbase response envelopes.
7. Map Hyperbase records into `LocationLog`.
8. Insert single mock or mobile location records.
9. Insert multiple locations with bounded concurrency.
10. Translate transport/API failures into repository-specific errors.

### 13.2 Suggested Internal Structure

```ts
class HyperbaseLocationRepository implements LocationRepository {
  constructor(
    private readonly client: HyperbaseHttpClient,
    private readonly projectId: string,
    private readonly collectionId: string,
    private readonly pageSize: number
  ) {}

  async getLocations(query: ResolvedLocationQuery): Promise<LocationLog[]> {
    // Build Hyperbase AND filters.
    // Request bounded pages.
    // Add _id cursor until the final page.
    // Validate and map records.
  }

  async insertLocation(location: LocationLog): Promise<void> {
    // Validate and POST one Hyperbase record.
  }

  async insertManyLocations(locations: LocationLog[]): Promise<void> {
    // Insert in chunks with bounded concurrency.
  }
}
```

### 13.3 Mapping Hyperbase Records

Map:

```text
record._id        -> internal cursor
record.id_data    -> LocationLog.id_data
record.timestamp  -> LocationLog.timestamp
record.visitor_key -> internal visitor key
record.latitude   -> LocationLog.latitude
record.longitude  -> LocationLog.longitude
record.source     -> LocationLog.source
```

Reject records with:

- missing fields,
- invalid timestamp,
- non-finite coordinates,
- unsupported source values.

The bounds filter may run after repository mapping so invalid/out-of-area points
can be counted for diagnostics without leaking them to the frontend.

### 13.4 Bulk Insert

Hyperbase currently exposes a single-record insert endpoint, not a native bulk
insert endpoint.

`insertManyLocations` should therefore:

- split records into chunks,
- limit concurrency, for example 10 to 25 requests,
- retry only transient failures,
- report the inserted and failed counts,
- never use unbounded `Promise.all`.

For larger ingestion volumes, add a dedicated Hyperbase batch endpoint or use a
queue rather than issuing one HTTP request per point.

## 14. Aggregation Flow

The heatmap route should execute:

```text
resolve time window
  -> repository.getLocations()
  -> validate timestamp and coordinates
  -> filter Borobudur bounds
  -> group by rounded latitude/longitude grid
  -> count visitors or points
  -> normalize weights
  -> label density
  -> convert to GeoJSON
  -> return frontend-safe response
```

### 14.1 Counting Semantics

The current documents use `visitor_count` for both point count and unique
visitor count.

Choose one explicit definition:

- Recommended: count unique `visitor_key` values per grid.
- Alternative: count location points and rename the field to `point_count`.

The dashboard summary should count distinct `visitor_key` values for
`estimated_active_visitors`.

### 14.2 Grid Aggregation

```ts
const gridLat = Math.round(latitude / GRID_SIZE) * GRID_SIZE;
const gridLng = Math.round(longitude / GRID_SIZE) * GRID_SIZE;
const gridId = `${gridLat}_${gridLng}`;
```

Normalize:

```text
weight = grid visitor count / maximum grid visitor count
```

Density:

```text
low     weight < 0.33
medium  0.33 <= weight < 0.66
high    weight >= 0.66
```

## 15. GeoJSON API Contract

The backend returns raw GeoJSON:

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

GeoJSON coordinate order must always be:

```text
[longitude, latitude]
```

Never return:

```text
visitor_key
visitor_id
raw individual routes
raw movement history
```

## 16. Dashboard Backend Endpoints

The Express backend should expose:

| Method   | Endpoint                       | Purpose                          |
| -------- | ------------------------------ | -------------------------------- |
| `GET`    | `/health`                      | Backend health check             |
| `GET`    | `/api/heatmap/aggregate`       | Aggregated GeoJSON heatmap       |
| `GET`    | `/api/dashboard/summary`       | Aggregate summary cards          |
| `POST`   | `/api/mock/location`           | Insert one mock location         |
| `POST`   | `/api/mock/generate`           | Generate and insert mock data    |
| `GET`    | `/api/hotspots`                | Read hotspot detection results   |
| `DELETE` | `/api/mock/clear`              | Optional mock cleanup            |

The frontend should poll:

```text
GET /api/heatmap/aggregate?window=15m
GET /api/dashboard/summary?window=15m
```

at approximately 30-second intervals.

## 17. Safest Implementation Order

1. Provision the Hyperbase project and collection.
2. Provision a dedicated service token and minimal collection rule.
3. Verify one insert request with curl.
4. Verify one bounded time-range query with curl.
5. Implement a server-side Hyperbase HTTP client.
6. Implement `HyperbaseLocationRepository`.
7. Run the same repository contract tests against memory and Hyperbase drivers.
8. Connect the mock data endpoints to the repository.
9. Connect aggregation and summary services.
10. Return privacy-safe GeoJSON.
11. Connect frontend polling.
12. Load-test short windows before increasing ingestion volume.

## 18. Important Safety Notes

- Never put Hyperbase secrets in frontend environment variables.
- Never expose raw visitor identifiers in GeoJSON.
- Never connect the dashboard frontend directly to Hyperbase.
- Never connect the Express backend directly to ScyllaDB unless Hyperbase is
  intentionally bypassed.
- Keep queries bounded by time and page size.
- Do not use unbounded concurrent inserts.
- Verify ScyllaDB index creation before relying on indexed schema flags.
- Keep the memory repository available for deterministic tests.

