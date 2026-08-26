/**
 * Heatmap + dashboard types, mirrored from the backend response shapes.
 *
 * Privacy: there is intentionally no `visitor_id` field anywhere here. The
 * backend never sends it and the frontend must never display it.
 */

export type TimeWindowPreset = "5m" | "15m" | "1h" | "today" | "3d" | "7d" | "30d";

export type CustomTimeUnit = "hours" | "days";

/**
 * Selected time window. Three shapes:
 *  - `preset`  — a named backend preset (sent as `window=`).
 *  - `custom`  — "last N hours/days", sent as a fresh `from`/`to` pair on every
 *                fetch so the window rolls forward with polling.
 *  - `date`    — one exact calendar day, `yyyy-mm-dd` in the operator's local
 *                time. Absolute: it does not roll forward with polling.
 */
export type TimeWindow =
  | { kind: "preset"; value: TimeWindowPreset }
  | { kind: "custom"; amount: number; unit: CustomTimeUnit }
  | { kind: "date"; date: string };

export type DensityLevel = "low" | "medium" | "high";

/** One aggregated grid cell as a GeoJSON Point feature. Coordinates are [lng, lat]. */
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

/** Dashboard summary payload (the `data` field of the API envelope). */
export interface DashboardSummary {
  estimated_active_visitors: number;
  total_location_points: number;
  most_crowded_area: string;
  last_updated: string | null;
}
