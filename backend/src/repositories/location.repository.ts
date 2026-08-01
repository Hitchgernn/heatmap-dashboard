/**
 * Repository abstraction over location storage.
 *
 * Services depend on this interface only, never on a concrete backend, so we
 * can swap the in-memory fallback for Hyperbase without touching the services.
 */

import type { LocationLog, LocationQuery } from "../types/location";
import type { GridCount } from "../services/aggregation.service";

export interface LocationRepository {
  /** Fetch raw location logs matching the query (time window + source). */
  getLocations(params: LocationQuery): Promise<LocationLog[]>;

  /** Insert a single location log. */
  insertLocation(location: LocationLog): Promise<void>;

  /** Insert many location logs in one call. */
  insertManyLocations(locations: LocationLog[]): Promise<void>;

  /**
   * Aggregate the query's points into per-cell grid counts server-side,
   * returning the same buckets `aggregateToGrid` would produce without shipping
   * raw rows. Optional: returns `null` when the backend can't do it (so the
   * caller falls back to getLocations + aggregateToGrid). Only implemented by
   * the Hyperbase driver, and only when SQL aggregation is enabled.
   */
  getAggregatedCells?(params: LocationQuery): Promise<GridCount[] | null>;
}
