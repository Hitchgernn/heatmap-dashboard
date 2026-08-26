/**
 * Named areas within Borobudur.
 *
 * Used by two things:
 *  - the mock generator, which draws every point from these areas only, and
 *  - the dashboard summary, to give `most_crowded_area` a readable label.
 *
 * Coordinates are the surveyed on-site positions. "Temple Grounds" is the
 * temple structure itself, so it carries a footprint-sized spread; the rest are
 * small spots and stay tight. Centers sit comfortably inside BOROBUDUR_BOUNDS
 * so jittered points stay valid.
 */

export interface NamedArea {
  name: string;
  lat: number;
  lng: number;
  /** Fraction of generated points that should land in this area. */
  weight: number;
  /** Jitter radius in degrees applied around the center when generating. */
  spread: number;
  /**
   * Longitude jitter, when the area is wider than it is tall (a walkway rather
   * than a spot). Falls back to `spread`, i.e. a circular-ish blob.
   */
  spreadLng?: number;
}

/**
 * Weighted areas. Weights sum to 1 — the mock generator never scatters points
 * across the raw bounds, so anything outside these areas is real data only.
 *
 * 0.0001 deg ~= 11 m here, so spread 0.00045 ~= +/-50 m (the temple footprint)
 * and 0.00012 ~= +/-13 m (a single spot). South Walkway is the one elongated
 * area: narrow north-south, wide east-west.
 */
export const NAMED_AREAS: NamedArea[] = [
  { name: "Temple Grounds", lat: -7.6078864585185055, lng: 110.20387777762937, weight: 0.36, spread: 0.00045 },
  { name: "West Terrace", lat: -7.607954164345888, lng: 110.20288465661754, weight: 0.16, spread: 0.00012 },
  { name: "East Terrace", lat: -7.6083503804259545, lng: 110.20449100592475, weight: 0.16, spread: 0.00012 },
  { name: "South Courtyard", lat: -7.608719455389016, lng: 110.20382327634375, weight: 0.16, spread: 0.00012 },
  { name: "South Walkway", lat: -7.6088821663956585, lng: 110.20406353579153, weight: 0.16, spread: 0.00008, spreadLng: 0.0003 },
];

export const OTHER_AREA_NAME = "Other Area";

/** Returns the named area closest to the given coordinate. */
export function nearestAreaName(lat: number, lng: number): string {
  let bestName = OTHER_AREA_NAME;
  let bestDist = Infinity;
  for (const area of NAMED_AREAS) {
    const dLat = area.lat - lat;
    const dLng = area.lng - lng;
    const dist = dLat * dLat + dLng * dLng; // squared euclidean is enough for ranking
    if (dist < bestDist) {
      bestDist = dist;
      bestName = area.name;
    }
  }
  return bestName;
}
