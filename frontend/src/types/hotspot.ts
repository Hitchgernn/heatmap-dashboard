/**
 * Hotspot cluster type, mirrored from the backend DBSCAN result shape.
 * Aggregate cluster info only — no visitor_id, no individual points.
 */

export interface Hotspot {
  cluster_id: string;
  center_lat: number;
  center_lng: number;
  total_points: number;
  label: string;
}
