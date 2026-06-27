/**
 * Dashboard summary service.
 *
 * Computes aggregate-only statistics for the dashboard cards. Reuses the
 * existing cleansing and aggregation logic so bounds/validation behavior stays
 * identical to the heatmap endpoint. visitor_id is used internally only.
 */

import { nearestAreaName } from "../config/areas";
import type { LocationLog } from "../types/location";
import { aggregateToGrid } from "./aggregation.service";
import { cleanLocations } from "../utils/validateLocation";

export interface DashboardSummary {
  estimated_active_visitors: number;
  total_location_points: number;
  most_crowded_area: string;
  last_updated: string | null;
}

export function buildDashboardSummary(
  locations: LocationLog[],
  timeWindowLabel: string
): DashboardSummary {
  const valid = cleanLocations(locations);

  // Distinct visitors — counted internally, never returned. Prefer the
  // pseudonymous visitor_key (Hyperbase) and fall back to visitor_id (memory/mock).
  const distinctVisitors = new Set(valid.map((loc) => loc.visitor_key ?? loc.visitor_id));

  // Latest timestamp among valid points.
  let lastUpdated: string | null = null;
  let lastUpdatedMs = -Infinity;
  for (const loc of valid) {
    const t = Date.parse(loc.timestamp);
    if (t > lastUpdatedMs) {
      lastUpdatedMs = t;
      lastUpdated = loc.timestamp;
    }
  }

  // Densest grid cell → readable area label.
  const { cells } = aggregateToGrid(valid, timeWindowLabel);
  let mostCrowdedArea = "N/A";
  if (cells.length > 0) {
    const densest = cells.reduce((max, c) => (c.visitor_count > max.visitor_count ? c : max));
    mostCrowdedArea = nearestAreaName(densest.center_lat, densest.center_lng);
  }

  return {
    estimated_active_visitors: distinctVisitors.size,
    total_location_points: valid.length,
    most_crowded_area: mostCrowdedArea,
    last_updated: lastUpdated,
  };
}
