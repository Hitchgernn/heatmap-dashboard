/**
 * Hotspot cluster type, mirrored from the backend DBSCAN result shape.
 * Aggregate cluster info only — no visitor_id, no individual points.
 */

/**
 * A clustered scatter point: position + density tier only (null = noise). No
 * visitor_id, no timestamp — a snapshot scatter, not movement history.
 */
export interface ClusterPoint {
  lat: number;
  lng: number;
  tier: "low" | "medium" | "high" | null;
}

export interface Hotspot {
  cluster_id: string;
  center_lat: number;
  center_lng: number;
  total_points: number;
  label: string;
  /** Density tier from the backend (relative to the busiest cluster). Optional
   *  for back-compat; the frontend also derives a tier via lib/hotspots.ts. */
  density_level?: "low" | "medium" | "high";
  /** Cluster extent radius in metres (for the map extent circle). */
  radius_m?: number;
  /** Fraction (0..1) of clustered points in this cluster. */
  share?: number;
}
