/**
 * Core domain types for the Borobudur Aggregated Heatmap Dashboard backend.
 *
 * Privacy rule: `visitor_id` may be used internally (e.g. counting distinct
 * visitors) but must never appear in any frontend-facing response.
 */

export type LocationSource = "mobile_app" | "mock";

/** Raw location log as stored in Hyperbase (or the in-memory fallback). */
export interface LocationLog {
  id_data: string;
  timestamp: string; // ISO 8601, e.g. "2026-06-16T10:30:00Z"
  visitor_id: string; // internal only — never exposed to the frontend
  /**
   * Pseudonymous visitor identifier from Hyperbase, used internally for distinct
   * visitor counting. Internal only — never exposed to the frontend. Optional so
   * the in-memory/mock paths (which use `visitor_id`) stay unchanged.
   */
  visitor_key?: string;
  latitude: number;
  longitude: number;
  source: LocationSource;
}

export type TimeWindowPreset = "5m" | "15m" | "1h" | "today";
export type SourceFilter = LocationSource | "all";

/** Query parameters used when fetching location data from a repository. */
export interface LocationQuery {
  window?: TimeWindowPreset;
  from?: string; // ISO timestamp (overrides window when paired with `to`)
  to?: string; // ISO timestamp
  source?: SourceFilter;
}

export type DensityLevel = "low" | "medium" | "high";

/** Aggregated grid cell — internal representation before GeoJSON conversion. */
export interface AggregatedGridCell {
  grid_id: string;
  center_lat: number;
  center_lng: number;
  visitor_count: number; // number of valid points that fell into this grid cell
  weight: number; // visitor_count / max_visitor_count, range 0..1
  density_level: DensityLevel;
  time_window: string;
}

/** GeoJSON feature returned to the frontend. Coordinates are [lng, lat]. */
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
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface HeatmapFeatureCollection {
  type: "FeatureCollection";
  features: HeatmapFeature[];
}

/**
 * Hotspot detection result (DBSCAN). Produced by the ML module and read back
 * from a precomputed file for MVP. Contains aggregate cluster info only — no
 * visitor_id, no individual points.
 */
export interface Hotspot {
  cluster_id: string;
  center_lat: number;
  center_lng: number;
  total_points: number;
  label: string;
}
