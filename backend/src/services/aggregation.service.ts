/**
 * Grid-based aggregation service.
 *
 * Takes raw location logs, cleans/validates/bounds-filters them, then buckets
 * the survivors into fixed-size grid cells and computes per-cell visitor counts,
 * normalized weights, and density labels.
 *
 * The count → cell step (`cellsFromCounts`) is shared: the Node path buckets
 * raw points here, while the server-side SQL aggregation path
 * (HyperbaseLocationRepository.getAggregatedCells) produces the same per-cell
 * counts in the database and feeds them through the identical normalization, so
 * both paths yield byte-identical cells.
 */

import { GRID_SIZE } from "../config/bounds";
import type { AggregatedGridCell, LocationLog } from "../types/location";
import { densityFromWeight } from "../utils/density";
import { cleanLocations } from "../utils/validateLocation";

/**
 * Per-cell visitor count keyed by integer grid indices, where
 * `gy = round(latitude / GRID_SIZE)` and `gx = round(longitude / GRID_SIZE)`.
 * The SQL `GROUP BY ROUND(lat/GRID), ROUND(lng/GRID)` produces exactly this.
 */
export interface GridCount {
  gy: number;
  gx: number;
  count: number;
}

/** Integer grid index for a coordinate component (matches SQL `ROUND(v/GRID)`). */
function gridIndex(value: number): number {
  return Math.round(value / GRID_SIZE);
}

/** Cell center from a grid index. Kept identical to the pre-refactor snap. */
function gridCenter(index: number): number {
  // Round after multiplying back to kill floating-point drift in the key.
  return Number((index * GRID_SIZE).toFixed(6));
}

export interface AggregationResult {
  cells: AggregatedGridCell[];
  /** Number of valid points that contributed (post-cleaning). */
  validPointCount: number;
}

/**
 * Turn per-cell counts into normalized `AggregatedGridCell[]`: compute the
 * busiest cell, normalize each count to a 0..1 weight, label density, and derive
 * the cell center + grid id. Shared by the Node and SQL aggregation paths.
 */
export function cellsFromCounts(
  counts: GridCount[],
  timeWindowLabel: string
): AggregatedGridCell[] {
  const maxCount = Math.max(0, ...counts.map((c) => c.count));

  return counts.map(({ gy, gx, count }) => {
    const center_lat = gridCenter(gy);
    const center_lng = gridCenter(gx);
    const weight = maxCount > 0 ? count / maxCount : 0;
    return {
      grid_id: `grid_${center_lat}_${center_lng}`,
      center_lat,
      center_lng,
      visitor_count: count,
      weight: Number(weight.toFixed(4)),
      density_level: densityFromWeight(weight),
      time_window: timeWindowLabel,
    };
  });
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

  const buckets = new Map<string, GridCount>();
  for (const loc of valid) {
    const gy = gridIndex(loc.latitude);
    const gx = gridIndex(loc.longitude);
    const key = `${gy}_${gx}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
    } else {
      buckets.set(key, { gy, gx, count: 1 });
    }
  }

  const cells = cellsFromCounts(Array.from(buckets.values()), timeWindowLabel);
  return { cells, validPointCount: valid.length };
}
