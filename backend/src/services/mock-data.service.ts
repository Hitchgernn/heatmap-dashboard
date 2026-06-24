/**
 * Mock data generation service.
 *
 * Produces realistic, clustered raw location logs around Borobudur for testing
 * the full pipeline. Every generated record is forced to source "mock".
 */

import { BOROBUDUR_BOUNDS } from "../config/bounds";
import { NAMED_AREAS } from "../config/areas";
import type { LocationLog } from "../types/location";

let idCounter = 0;

/** Generate a unique-ish id for a mock record. */
export function generateMockId(): string {
  idCounter += 1;
  return `mock_${Date.now().toString(36)}_${idCounter}`;
}

/** Cumulative-weight pick of a named area, or null for the "Other Area" bucket. */
function pickArea() {
  const r = Math.random();
  let cumulative = 0;
  for (const area of NAMED_AREAS) {
    cumulative += area.weight;
    if (r < cumulative) return area;
  }
  return null; // Other Area — scatter across bounds
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Gaussian-ish jitter via averaging two uniforms (cheap, no deps). */
function jitter(spread: number): number {
  return (Math.random() + Math.random() - 1) * spread;
}

interface GenerateOptions {
  visitorCount: number;
  pointsPerVisitor: number;
  now?: Date;
}

/**
 * Build a clustered batch of mock location logs.
 * Points are spread over the last hour so they fall inside typical windows.
 */
export function generateMockLocations(opts: GenerateOptions): LocationLog[] {
  const now = opts.now ?? new Date();
  const out: LocationLog[] = [];

  for (let v = 0; v < opts.visitorCount; v++) {
    const visitorId = `mock_visitor_${v + 1}`;
    for (let p = 0; p < opts.pointsPerVisitor; p++) {
      const area = pickArea();

      let lat: number;
      let lng: number;
      if (area) {
        lat = area.lat + jitter(area.spread);
        lng = area.lng + jitter(area.spread);
      } else {
        lat = randomBetween(BOROBUDUR_BOUNDS.minLat, BOROBUDUR_BOUNDS.maxLat);
        lng = randomBetween(BOROBUDUR_BOUNDS.minLng, BOROBUDUR_BOUNDS.maxLng);
      }

      // Timestamp within the last hour.
      const ageMs = Math.floor(Math.random() * 60 * 60 * 1000);
      out.push({
        id_data: generateMockId(),
        timestamp: new Date(now.getTime() - ageMs).toISOString(),
        visitor_id: visitorId,
        latitude: lat,
        longitude: lng,
        source: "mock",
      });
    }
  }

  return out;
}
