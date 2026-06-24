/**
 * Geographic bounds and grid configuration for Borobudur.
 *
 * Keep these values in one place — do not hardcode bounds elsewhere.
 * Update with more precise coordinates once they are confirmed.
 */

export const BOROBUDUR_BOUNDS = {
  minLat: -7.615,
  maxLat: -7.6,
  minLng: 110.195,
  maxLng: 110.215,
} as const;

/** Map center used by the frontend (kept here so it stays consistent). */
export const BOROBUDUR_CENTER = {
  lat: (BOROBUDUR_BOUNDS.minLat + BOROBUDUR_BOUNDS.maxLat) / 2,
  lng: (BOROBUDUR_BOUNDS.minLng + BOROBUDUR_BOUNDS.maxLng) / 2,
} as const;

/**
 * Grid cell size in degrees, used for grid-based aggregation.
 * 0.0001 deg ~= 11 meters at this latitude.
 */
export const GRID_SIZE = 0.0001;
