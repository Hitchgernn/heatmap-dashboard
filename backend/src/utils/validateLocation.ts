/**
 * Validation and cleansing utilities for raw location data.
 */

import { BOROBUDUR_BOUNDS } from "../config/bounds";
import type { LocationLog } from "../types/location";

export function isValidLatitude(lat: unknown): lat is number {
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: unknown): lng is number {
  return typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function isValidTimestamp(ts: unknown): ts is string {
  if (typeof ts !== "string" || ts.length === 0) return false;
  const time = Date.parse(ts);
  return Number.isFinite(time);
}

/** True when a coordinate falls inside the Borobudur bounding box. */
export function isWithinBorobudurBounds(lat: number, lng: number): boolean {
  return (
    lat >= BOROBUDUR_BOUNDS.minLat &&
    lat <= BOROBUDUR_BOUNDS.maxLat &&
    lng >= BOROBUDUR_BOUNDS.minLng &&
    lng <= BOROBUDUR_BOUNDS.maxLng
  );
}

/**
 * A location is valid for aggregation when its coordinates and timestamp are
 * well-formed AND it sits inside the Borobudur bounds. Out-of-bound points are
 * intentionally treated as invalid here so they are dropped from the heatmap.
 */
export function isValidLocation(loc: Partial<LocationLog>): loc is LocationLog {
  return (
    isValidLatitude(loc.latitude) &&
    isValidLongitude(loc.longitude) &&
    isValidTimestamp(loc.timestamp) &&
    isWithinBorobudurBounds(loc.latitude as number, loc.longitude as number)
  );
}

/** Keep only the locations that pass validation and bounds filtering. */
export function cleanLocations(locations: LocationLog[]): LocationLog[] {
  return locations.filter((loc) => isValidLocation(loc));
}
