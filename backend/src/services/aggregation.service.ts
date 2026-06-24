/**
 * Grid-based aggregation service.
 *
 * Takes raw location logs, cleans/validates/bounds-filters them, then buckets
 * the survivors into fixed-size grid cells and computes per-cell visitor counts,
 * normalized weights, and density labels.
 */

import { GRID_SIZE } from "../config/bounds";
import type { AggregatedGridCell, LocationLog } from "../types/location";
import { densityFromWeight } from "../utils/density";
import { cleanLocations } from "../utils/validateLocation";

/** Snap a coordinate component onto the grid. */
function snapToGrid(value: number): number {
  // Round to grid, then round again to kill floating-point drift in the key.
  const snapped = Math.round(value / GRID_SIZE) * GRID_SIZE;
  return Number(snapped.toFixed(6));
}

interface Bucket {
  center_lat: number;
  center_lng: number;
  count: number;
}

export interface AggregationResult {
  cells: AggregatedGridCell[];
  /** Number of valid points that contributed (post-cleaning). */
  validPointCount: number;
}

/**
 * Aggregate raw location logs into grid cells.
 *
 * @param locations Raw logs (may contain invalid/out-of-bound points).
 * @param timeWindowLabel Label stored on each cell (e.g. "15m").
 */
export function aggregateToGrid(
  locations: LocationLog[],
  timeWindowLabel: string
): AggregationResult {
  const valid = cleanLocations(locations);

  const buckets = new Map<string, Bucket>();
  for (const loc of valid) {
    const gridLat = snapToGrid(loc.latitude);
    const gridLng = snapToGrid(loc.longitude);
    const gridId = `grid_${gridLat}_${gridLng}`;

    const existing = buckets.get(gridId);
    if (existing) {
      existing.count++;
    } else {
      buckets.set(gridId, { center_lat: gridLat, center_lng: gridLng, count: 1 });
    }
  }

  const maxCount = Math.max(0, ...Array.from(buckets.values(), (b) => b.count));

  const cells: AggregatedGridCell[] = [];
  for (const [gridId, bucket] of buckets) {
    const weight = maxCount > 0 ? bucket.count / maxCount : 0;
    cells.push({
      grid_id: gridId,
      center_lat: bucket.center_lat,
      center_lng: bucket.center_lng,
      visitor_count: bucket.count,
      weight: Number(weight.toFixed(4)),
      density_level: densityFromWeight(weight),
      time_window: timeWindowLabel,
    });
  }

  return { cells, validPointCount: valid.length };
}
