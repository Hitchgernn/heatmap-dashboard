/**
 * Mapbox helpers: map initialization, heatmap layer wiring, source updates,
 * and hotspot markers. Kept separate from React so the map is created once and
 * mutated in place — never recreated on every poll.
 */

import mapboxgl from "mapbox-gl";
import type { HeatmapFeatureCollection } from "../types/heatmap";
import type { Hotspot } from "../types/hotspot";

// Mapbox center order is [longitude, latitude].
export const BOROBUDUR_CENTER: [number, number] = [110.2037, -7.6079];
export const DEFAULT_ZOOM = 16;

export const HEATMAP_SOURCE_ID = "heatmap-source";
export const HEATMAP_LAYER_ID = "heatmap-layer";

const EMPTY_FC: HeatmapFeatureCollection = { type: "FeatureCollection", features: [] };

/** Set the access token once. Returns false when no token is configured. */
export function configureMapboxToken(): boolean {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return false;
  mapboxgl.accessToken = token;
  return true;
}

/** Create the map centered on Borobudur. */
export function createMap(container: HTMLElement): mapboxgl.Map {
  return new mapboxgl.Map({
    container,
    style: "mapbox://styles/mapbox/light-v11",
    center: BOROBUDUR_CENTER,
    zoom: DEFAULT_ZOOM,
  });
}

/**
 * Add the heatmap source + layer. Call once after the map's "load" event.
 * Weight drives intensity; density_level is reflected in the color ramp.
 */
export function addHeatmapLayer(map: mapboxgl.Map, data: HeatmapFeatureCollection): void {
  if (map.getSource(HEATMAP_SOURCE_ID)) return;

  map.addSource(HEATMAP_SOURCE_ID, { type: "geojson", data });

  map.addLayer({
    id: HEATMAP_LAYER_ID,
    type: "heatmap",
    source: HEATMAP_SOURCE_ID,
    paint: {
      // Per-point weight from the backend's normalized value.
      "heatmap-weight": ["get", "weight"],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 14, 1, 18, 3],
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0, "rgba(33,102,172,0)",
        0.2, "rgb(103,169,207)",
        0.4, "rgb(209,229,240)",
        0.6, "rgb(253,219,199)",
        0.8, "rgb(239,138,98)",
        1, "rgb(178,24,43)",
      ],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 14, 15, 18, 35],
      "heatmap-opacity": 0.85,
    },
  });
}

/** Replace the heatmap source data in place (no map/layer recreation). */
export function updateHeatmapData(map: mapboxgl.Map, data: HeatmapFeatureCollection): void {
  const source = map.getSource(HEATMAP_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (source) source.setData(data ?? EMPTY_FC);
}

/** Show/hide the heatmap layer without removing it. */
export function setHeatmapVisible(map: mapboxgl.Map, visible: boolean): void {
  if (!map.getLayer(HEATMAP_LAYER_ID)) return;
  map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", visible ? "visible" : "none");
}

/**
 * Render hotspot markers. Returns the created markers so the caller can remove
 * them on the next update or when toggled off.
 */
export function renderHotspotMarkers(map: mapboxgl.Map, hotspots: Hotspot[]): mapboxgl.Marker[] {
  return hotspots.map((h) => {
    const el = document.createElement("div");
    el.className =
      "rounded-full border-2 border-white shadow-md bg-red-600/80 cursor-pointer";
    // Scale marker by relative size (clamped) so big clusters read larger.
    const size = Math.max(16, Math.min(40, 16 + Math.log10(h.total_points + 1) * 10));
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;

    const popup = new mapboxgl.Popup({ offset: 12, closeButton: false }).setHTML(
      `<div style="font-size:12px">
         <strong>${escapeHtml(h.label)}</strong><br/>
         ${h.total_points} points
       </div>`
    );

    return new mapboxgl.Marker({ element: el })
      .setLngLat([h.center_lng, h.center_lat]) // [lng, lat]
      .setPopup(popup)
      .addTo(map);
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
