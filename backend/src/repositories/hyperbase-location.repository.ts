/**
 * Hyperbase-backed LocationRepository.
 *
 * PLACEHOLDER: Hyperbase (BaaS over ScyllaDB) integration details are not yet
 * available. The shape is in place so we can fill in the REST/SDK calls later
 * without changing any service code. Until then this throws so misconfiguration
 * fails loudly rather than silently returning empty data.
 */

import type { LocationLog, LocationQuery } from "../types/location";
import type { LocationRepository } from "./location.repository";

/** Connection settings needed to talk to Hyperbase. */
export interface HyperbaseConfigShape {
  baseUrl: string;
  token: string;
  projectId: string;
  collectionId: string;
}

export class HyperbaseLocationRepository implements LocationRepository {
  constructor(private readonly config: HyperbaseConfigShape) {}

  async getLocations(_params: LocationQuery): Promise<LocationLog[]> {
    throw new Error(
      "HyperbaseLocationRepository.getLocations is not implemented yet. " +
        "Set REPOSITORY_DRIVER=memory for local development."
    );
  }

  async insertLocation(_location: LocationLog): Promise<void> {
    throw new Error("HyperbaseLocationRepository.insertLocation is not implemented yet.");
  }

  async insertManyLocations(_locations: LocationLog[]): Promise<void> {
    throw new Error("HyperbaseLocationRepository.insertManyLocations is not implemented yet.");
  }
}
