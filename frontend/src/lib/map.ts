/**
 * Leaflet map helpers: center/zoom, tile source, and the conversion from
 * backend GeoJSON ([lng, lat]) to leaflet.heat points ([lat, lng, intensity]).
 *
 * No Mapbox token needed — uses CARTO tiles (OpenStreetMap data).
 */

import type { LatLngTuple } from "leaflet";
import type { HeatmapFeatureCollection } from "../types/heatmap";

// Leaflet uses [latitude, longitude] (the opposite of GeoJSON).
export const BOROBUDUR_CENTER: LatLngTuple = [-7.607898742482102, 110.20385897610012];
// Start zoomed tightly on Candi Borobudur (the temple fills the view).
export const DEFAULT_ZOOM = 19;

// Basemaps — both tokenless. Light theme uses CARTO "Voyager": a bright,
// detailed basemap where the temple and paths read clearly. For dark mode,
// CARTO "Dark Matter" renders roads and terrain almost invisibly, so we use
// Esri World Imagery (satellite) instead — a dark-balanced backdrop where
// Borobudur, the roads, and the surrounding terrain are all clearly visible,
// and the warm heat gradient still reads on top. The active source is picked
// by resolved theme in MapView. Note Esri uses {z}/{y}/{x} order, no {s}/{r}.
export const TILE_URL_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
export const TILE_URL_DARK = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
/** @deprecated kept for back-compat; prefer the explicit light/dark URLs. */
export const TILE_URL = TILE_URL_LIGHT;

export const TILE_ATTRIBUTION_LIGHT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
export const TILE_ATTRIBUTION_DARK =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics';
/** @deprecated kept for back-compat; prefer the explicit light/dark attributions. */
export const TILE_ATTRIBUTION = TILE_ATTRIBUTION_LIGHT;

/** Highest zoom each basemap serves real tiles for (Leaflet upscales beyond it). */
export const TILE_MAX_NATIVE_ZOOM_LIGHT = 20;
export const TILE_MAX_NATIVE_ZOOM_DARK = 19;

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
