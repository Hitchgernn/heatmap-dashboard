/**
 * In-memory LocationRepository implementation.
 *
 * Lets the backend run end-to-end before Hyperbase credentials are available.
 * Data lives only for the lifetime of the process.
 */

import { BOROBUDUR_CENTER } from "../config/bounds";
import type { LocationLog, LocationQuery } from "../types/location";
import { resolveTimeRange, isWithinRange } from "../utils/timeWindow";
import type { LocationRepository } from "./location.repository";

export class MemoryLocationRepository implements LocationRepository {
  private logs: LocationLog[] = [];

  async getLocations(params: LocationQuery): Promise<LocationLog[]> {
    const range = resolveTimeRange(params);
    const source = params.source ?? "all";

    return this.logs.filter((log) => {
      if (source !== "all" && log.source !== source) return false;
      return isWithinRange(log.timestamp, range);
    });
  }

  async insertLocation(location: LocationLog): Promise<void> {
    this.logs.push(location);
  }

  async insertManyLocations(locations: LocationLog[]): Promise<void> {
    this.logs.push(...locations);
  }

  /** Current number of stored logs (useful for tests / debugging). */
  size(): number {
    return this.logs.length;
  }

  /**
   * Seed a small clustered sample around the Borobudur center so the heatmap
   * endpoint returns visible data during local development.
   */
  seedSampleData(now: Date = new Date()): number {
    const clusters = [
      { lat: BOROBUDUR_CENTER.lat, lng: BOROBUDUR_CENTER.lng, points: 60 }, // dense core
      { lat: BOROBUDUR_CENTER.lat + 0.0008, lng: BOROBUDUR_CENTER.lng - 0.001, points: 25 },
      { lat: BOROBUDUR_CENTER.lat - 0.0012, lng: BOROBUDUR_CENTER.lng + 0.0009, points: 12 },
    ];

    const seeded: LocationLog[] = [];
    let counter = 0;
    // Deterministic jitter (no Math.random) so seeded data is reproducible.
    for (const cluster of clusters) {
      for (let i = 0; i < cluster.points; i++) {
        const jLat = ((i % 7) - 3) * 0.00005;
        const jLng = (((i * 3) % 7) - 3) * 0.00005;
        seeded.push({
          id_data: `seed_${counter}`,
          timestamp: new Date(now.getTime() - (counter % 14) * 60 * 1000).toISOString(),
          visitor_id: `seed_visitor_${counter % 40}`,
          latitude: cluster.lat + jLat,
          longitude: cluster.lng + jLng,
          source: "mock",
        });
        counter++;
      }
    }

    this.logs.push(...seeded);
    return seeded.length;
  }
}
