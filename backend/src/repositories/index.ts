/**
 * Repository factory / singleton.
 *
 * Chooses the concrete LocationRepository based on env.repositoryDriver and
 * seeds sample data when running the in-memory fallback for local development.
 */

import { env } from "../config/env";
import type { LocationRepository } from "./location.repository";
import { MemoryLocationRepository } from "./memory-location.repository";
import { HyperbaseLocationRepository } from "./hyperbase-location.repository";

let instance: LocationRepository | null = null;

export function getLocationRepository(): LocationRepository {
  if (instance) return instance;

  if (env.repositoryDriver === "hyperbase") {
    instance = new HyperbaseLocationRepository(env.hyperbase);
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

/** For tests: reset the cached singleton. */
export function resetLocationRepository(): void {
  instance = null;
}
