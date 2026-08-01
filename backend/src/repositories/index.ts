/**
 * Repository factory / singleton.
 *
 * Chooses the concrete LocationRepository based on env.repositoryDriver and
 * seeds sample data when running the in-memory fallback for local development.
 *
 * When a separate Hyperbase MOCK collection is configured (env.mockCollectionEnabled
 * on the hyperbase driver), reads are wrapped in a RoutingLocationRepository so
 * that source=mock is served from the mock collection while source=mobile_app/all
 * stays on the real coordinate collection. Mock writes go through the dedicated
 * writable mock repository (getMockLocationRepository).
 */

import { env } from "../config/env";
import type { LocationLog, LocationQuery } from "../types/location";
import type { GridCount } from "../services/aggregation.service";
import type { LocationRepository } from "./location.repository";
import { MemoryLocationRepository } from "./memory-location.repository";
import { HyperbaseLocationRepository } from "./hyperbase-location.repository";

let instance: LocationRepository | null = null;
let mockInstance: HyperbaseLocationRepository | null = null;

/**
 * Read-time router: dispatches source=mock to the writable mock-collection repo
 * and everything else to the real coordinate collection. Inserts are not
 * supported here — mock writes use getMockLocationRepository() directly.
 */
class RoutingLocationRepository implements LocationRepository {
  constructor(
    private readonly real: LocationRepository,
    private readonly mock: LocationRepository
  ) {}

  getLocations(params: LocationQuery): Promise<LocationLog[]> {
    return (params.source === "mock" ? this.mock : this.real).getLocations(params);
  }

  getAggregatedCells(params: LocationQuery): Promise<GridCount[] | null> {
    const target = params.source === "mock" ? this.mock : this.real;
    return target.getAggregatedCells?.(params) ?? Promise.resolve(null);
  }

  insertLocation(): Promise<void> {
    return this.real.insertLocation({} as LocationLog); // delegates the unsupported-insert throw
  }

  insertManyLocations(): Promise<void> {
    return this.real.insertManyLocations([]);
  }
}

/**
 * The write-capable Hyperbase repository bound to the separate mock collection.
 * Returns null unless the hyperbase driver is active and a mock collection is
 * configured. Cached across calls.
 */
export function getMockLocationRepository(): HyperbaseLocationRepository | null {
  if (env.repositoryDriver !== "hyperbase" || !env.mockCollectionEnabled) return null;
  if (!mockInstance) {
    mockInstance = new HyperbaseLocationRepository({
      ...env.hyperbaseMock,
      writable: true,
      mockCollection: true,
    });
  }
  return mockInstance;
}

export function getLocationRepository(): LocationRepository {
  if (instance) return instance;

  if (env.repositoryDriver === "hyperbase") {
    const real = new HyperbaseLocationRepository(env.hyperbase);
    const mock = getMockLocationRepository();
    instance = mock ? new RoutingLocationRepository(real, mock) : real;
  } else {
    const memory = new MemoryLocationRepository();
    if (env.seedDevData) {
      const count = memory.seedSampleData();
      // eslint-disable-next-line no-console
      console.log(`[repository] memory driver seeded ${count} sample locations`);
    }
    instance = memory;
  }

  return instance;
}

/** For tests: reset the cached singletons. */
export function resetLocationRepository(): void {
  instance = null;
  mockInstance = null;
}
