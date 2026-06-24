/**
 * Repository abstraction over location storage.
 *
 * Services depend on this interface only, never on a concrete backend, so we
 * can swap the in-memory fallback for Hyperbase without touching the services.
 */

import type { LocationLog, LocationQuery } from "../types/location";

export interface LocationRepository {
  /** Fetch raw location logs matching the query (time window + source). */
  getLocations(params: LocationQuery): Promise<LocationLog[]>;

  /** Insert a single location log. */
  insertLocation(location: LocationLog): Promise<void>;

  /** Insert many location logs in one call. */
  insertManyLocations(locations: LocationLog[]): Promise<void>;
}
