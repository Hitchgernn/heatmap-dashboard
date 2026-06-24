/**
 * Named areas within Borobudur.
 *
 * Used by two things:
 *  - the mock generator, to produce realistic clustered data, and
 *  - the dashboard summary, to give `most_crowded_area` a readable label.
 *
 * Centers sit comfortably inside BOROBUDUR_BOUNDS so jittered points stay valid.
 */

export interface NamedArea {
  name: string;
  lat: number;
  lng: number;
  /** Fraction of generated points that should land in this area. */
  weight: number;
  /** Jitter radius in degrees applied around the center when generating. */
  spread: number;
}

/**
 * Weighted areas. The remaining probability mass (1 - sum of weights) is the
 * "Other Area" bucket: points scattered uniformly across the bounds.
 */
export const NAMED_AREAS: NamedArea[] = [
  { name: "Main Stupa", lat: -7.6079, lng: 110.2037, weight: 0.45, spread: 0.0006 },
  { name: "Entrance Area", lat: -7.6095, lng: 110.205, weight: 0.25, spread: 0.0006 },
  { name: "East Stairs", lat: -7.6079, lng: 110.2055, weight: 0.15, spread: 0.0005 },
  { name: "West Area", lat: -7.6079, lng: 110.202, weight: 0.1, spread: 0.0005 },
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
