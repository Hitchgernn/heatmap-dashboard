import { useEffect } from "react";
import type { ReactNode } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import HeatLayer from "./HeatLayer";
import HotspotLayer from "./HotspotLayer";
import {
  BOROBUDUR_CENTER,
  DEFAULT_ZOOM,
  TILE_ATTRIBUTION_DARK,
  TILE_ATTRIBUTION_LIGHT,
  TILE_MAX_NATIVE_ZOOM_DARK,
  TILE_MAX_NATIVE_ZOOM_LIGHT,
  TILE_URL_DARK,
  TILE_URL_LIGHT,
} from "../lib/map";
import type { HeatPoint } from "../lib/map";
import type { Hotspot } from "../types/hotspot";
import { useTheme } from "../context/theme";
import { useLanguage } from "../context/language";

interface MapViewProps {
  heatPoints: HeatPoint[];
  showHeatmap: boolean;
  hotspots: Hotspot[];
  showHotspots: boolean;
  /** Absolutely-positioned overlays (controls, legend) drawn above the map. */
  children?: ReactNode;
}

/**
 * Keeps the Leaflet canvas in sync with its container size. The sidebar
 * collapse animates the container width over 300ms, so a one-shot
 * invalidateSize isn't enough — we observe the element and invalidate on every
 * resize tick (Leaflet no-ops when the size hasn't actually changed).
 */
function ResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

/**
 * Owns the Leaflet map. MapContainer creates the map exactly once; the heat and
 * hotspot layers update in place via the map context. No token required — uses
 * CARTO OpenStreetMap tiles (light/dark to match the theme). `children` render
 * as overlays on top of the map (each handles its own positioning).
 */
export default function MapView({
  heatPoints,
  showHeatmap,
  hotspots,
  showHotspots,
  children,
}: MapViewProps) {
  const { resolvedTheme } = useTheme();
  const { t } = useLanguage();
  const isEmpty = showHeatmap && heatPoints.length === 0;

  // Switching the tile URL on a mounted <TileLayer> doesn't always force a
  // refetch, so key it by theme to remount just the layer (map stays put).
  const isDark = resolvedTheme === "dark";
  const tileUrl = isDark ? TILE_URL_DARK : TILE_URL_LIGHT;
  const tileAttribution = isDark ? TILE_ATTRIBUTION_DARK : TILE_ATTRIBUTION_LIGHT;
  const maxNativeZoom = isDark ? TILE_MAX_NATIVE_ZOOM_DARK : TILE_MAX_NATIVE_ZOOM_LIGHT;

  return (
    <div className="relative h-full w-full bg-gray-100 dark:bg-gray-800">
      <MapContainer
        center={BOROBUDUR_CENTER}
        zoom={DEFAULT_ZOOM}
        maxZoom={20}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
        {/* Tiles only exist up to each basemap's native zoom; maxNativeZoom
            upscales them past that so deep zoom stays sharp basemap instead of
            turning solid gray. */}
        <TileLayer
          key={resolvedTheme}
          url={tileUrl}
          attribution={tileAttribution}
          maxZoom={20}
          maxNativeZoom={maxNativeZoom}
        />
        <ZoomControl position="bottomright" />
        <ResizeHandler />
        <HeatLayer points={heatPoints} visible={showHeatmap} />
        <HotspotLayer hotspots={hotspots} visible={showHotspots} />
      </MapContainer>

      {children}

      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="rounded-lg border border-gray-200 bg-white/95 px-4 py-3 text-center text-sm text-gray-600 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-300">
            <p className="font-display text-lg text-gray-800 dark:text-white">{t("map.emptyTitle")}</p>
            <p className="mt-0.5 text-gray-500 dark:text-gray-400">{t("map.emptyBody")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
