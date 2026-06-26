/**
 * Leaflet map helpers: center/zoom, tile source, and the conversion from
 * backend GeoJSON ([lng, lat]) to leaflet.heat points ([lat, lng, intensity]).
 *
 * No Mapbox token needed — uses CARTO dark tiles (OpenStreetMap data).
 */

import type { LatLngTuple } from "leaflet";
import type { HeatmapFeatureCollection } from "../types/heatmap";

// Leaflet uses [latitude, longitude] (the opposite of GeoJSON).
export const BOROBUDUR_CENTER: LatLngTuple = [-7.6079, 110.2037];
// Start zoomed tightly on Candi Borobudur (the temple fills the view).
export const DEFAULT_ZOOM = 17;

// CARTO "positron" light basemap — OpenStreetMap data, no token required.
export const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** leaflet.heat point: [latitude, longitude, intensity]. */
export type HeatPoint = [number, number, number];

/**
 * Heat gradient, kept in sync with the density legend ramp.
 * Green (low) -> amber (medium) -> red (high). Keys are normalized stops (0..1).
 */
export const HEAT_GRADIENT: Record<number, string> = {
  0.2: "rgb(22,163,74)",
  0.4: "rgb(132,204,22)",
  0.6: "rgb(250,204,21)",
  0.8: "rgb(245,158,11)",
  1.0: "rgb(220,38,38)",
};

/** CSS gradient string for the density legend bar (low -> high). */
export const HEAT_GRADIENT_CSS =
  "linear-gradient(to right, rgb(22,163,74), rgb(132,204,22), rgb(250,204,21), rgb(245,158,11), rgb(220,38,38))";

/**
 * Convert backend GeoJSON features into leaflet.heat points.
 *
 * Backend GeoJSON coordinates are [longitude, latitude]; Leaflet wants
 * [latitude, longitude]. Do not mix these up.
 */
export function toHeatPoints(fc: HeatmapFeatureCollection | null): HeatPoint[] {
  if (!fc) return [];
  return fc.features.map((f) => {
    const [lng, lat] = f.geometry.coordinates; // GeoJSON: [lng, lat]
    return [lat, lng, f.properties.weight]; // Leaflet heat: [lat, lng, intensity]
  });
}
