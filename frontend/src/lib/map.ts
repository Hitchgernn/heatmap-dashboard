/**
 * Leaflet map helpers: center/zoom, tile source, and the conversion from
 * backend GeoJSON ([lng, lat]) to leaflet.heat points ([lat, lng, intensity]).
 *
 * No map token needed — uses CARTO tiles (OpenStreetMap data) by default;
 * Esri World Imagery (satellite) is available as an opt-in basemap.
 */

import type { LatLngTuple } from "leaflet";
import type { HeatmapFeatureCollection } from "../types/heatmap";

// Leaflet uses [latitude, longitude] (the opposite of GeoJSON).
export const BOROBUDUR_CENTER: LatLngTuple = [-7.607898742482102, 110.20385897610012];
// Start zoomed tightly on Candi Borobudur (the temple fills the view).
export const DEFAULT_ZOOM = 19;

// ---------------------------------------------------------------------------
// Basemap definitions — all tokenless.
// ---------------------------------------------------------------------------

/** The two user-selectable basemaps. */
export type BasemapId = "carto" | "satellite";

// CARTO Voyager — bright street map; great for light mode.
export const TILE_URL_CARTO_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
// CARTO Dark Matter — dark street map; consistent style with Voyager, good dark backdrop.
export const TILE_URL_CARTO_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
// Esri World Imagery — satellite; opt-in only, no subdomains, y/x order.
export const TILE_URL_SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const TILE_ATTRIBUTION_CARTO =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
export const TILE_ATTRIBUTION_SATELLITE =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics';

/** Highest zoom each basemap serves real tiles for (Leaflet upscales beyond it). */
export const TILE_MAX_NATIVE_ZOOM_CARTO = 20;
export const TILE_MAX_NATIVE_ZOOM_SATELLITE = 19;

// ---------------------------------------------------------------------------
// Legacy exports — kept for back-compat; prefer the explicit named constants.
// ---------------------------------------------------------------------------
/** @deprecated use TILE_URL_CARTO_LIGHT */
export const TILE_URL_LIGHT = TILE_URL_CARTO_LIGHT;
/** @deprecated use TILE_URL_SATELLITE */
export const TILE_URL_DARK = TILE_URL_SATELLITE;
/** @deprecated use TILE_URL_CARTO_LIGHT */
export const TILE_URL = TILE_URL_CARTO_LIGHT;
/** @deprecated use TILE_ATTRIBUTION_CARTO */
export const TILE_ATTRIBUTION_LIGHT = TILE_ATTRIBUTION_CARTO;
/** @deprecated use TILE_ATTRIBUTION_SATELLITE */
export const TILE_ATTRIBUTION_DARK = TILE_ATTRIBUTION_SATELLITE;
/** @deprecated use TILE_ATTRIBUTION_CARTO */
export const TILE_ATTRIBUTION = TILE_ATTRIBUTION_CARTO;
/** @deprecated use TILE_MAX_NATIVE_ZOOM_CARTO */
export const TILE_MAX_NATIVE_ZOOM_LIGHT = TILE_MAX_NATIVE_ZOOM_CARTO;
/** @deprecated use TILE_MAX_NATIVE_ZOOM_SATELLITE */
export const TILE_MAX_NATIVE_ZOOM_DARK = TILE_MAX_NATIVE_ZOOM_SATELLITE;

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
