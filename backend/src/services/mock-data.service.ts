/**
 * Mock data generation service.
 *
 * Produces realistic, clustered raw location logs around Borobudur for testing
 * the full pipeline. Every generated record is forced to source "mock".
 *
 * Points are drawn from NAMED_AREAS only — never scattered across the raw
 * bounds — so mock data lands on the actual on-site spots.
 */

import { NAMED_AREAS, type NamedArea } from "../config/areas";
import type { LocationLog, LocationSource } from "../types/location";

let idCounter = 0;

/** Generate a unique-ish id for a mock record. */
export function generateMockId(): string {
  idCounter += 1;
  return `mock_${Date.now().toString(36)}_${idCounter}`;
}

/**
 * Cumulative-weight pick of a named area. Weights sum to 1, but float rounding
 * can leave `r` past the last boundary — fall back to the last area rather than
 * letting a point escape the defined spots.
 */
function pickArea(): NamedArea {
  const r = Math.random();
  let cumulative = 0;
  for (const area of NAMED_AREAS) {
    cumulative += area.weight;
    if (r < cumulative) return area;
  }
  return NAMED_AREAS[NAMED_AREAS.length - 1];
}

/** Gaussian-ish jitter via averaging two uniforms (cheap, no deps). */
function jitter(spread: number): number {
  return (Math.random() + Math.random() - 1) * spread;
}

interface GenerateOptions {
  visitorCount: number;
  pointsPerVisitor: number;
  /** Source to tag generated records with (defaults to "mock"). */
  source?: LocationSource;
  now?: Date;
}

/**
 * Build a clustered batch of mock location logs.
 * Points are spread over the last hour so they fall inside typical windows.
 */
export function generateMockLocations(opts: GenerateOptions): LocationLog[] {
  const now = opts.now ?? new Date();
  const source: LocationSource = opts.source ?? "mock";
  const out: LocationLog[] = [];

  for (let v = 0; v < opts.visitorCount; v++) {
    const visitorId = `mock_visitor_${v + 1}`;
    for (let p = 0; p < opts.pointsPerVisitor; p++) {
      const area = pickArea();
      const lat = area.lat + jitter(area.spread);
      const lng = area.lng + jitter(area.spreadLng ?? area.spread);

      // Timestamp within the last hour.
      const ageMs = Math.floor(Math.random() * 60 * 60 * 1000);
      out.push({
        id_data: generateMockId(),
        timestamp: new Date(now.getTime() - ageMs).toISOString(),
        visitor_id: visitorId,
        latitude: lat,
        longitude: lng,
        source,
      });
    }
  }

  return out;
}
