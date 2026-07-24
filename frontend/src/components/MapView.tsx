import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import HeatLayer from "./HeatLayer";
import HotspotLayer from "./HotspotLayer";
import {
  BOROBUDUR_CENTER,
  DEFAULT_ZOOM,
  TILE_ATTRIBUTION_OSM,
  TILE_ATTRIBUTION_SATELLITE,
  TILE_MAX_NATIVE_ZOOM_OSM,
  TILE_MAX_NATIVE_ZOOM_SATELLITE,
  TILE_URL_OSM,
  TILE_URL_SATELLITE,
} from "../lib/map";
import type { BasemapId, HeatPoint } from "../lib/map";
import type { Hotspot } from "../types/hotspot";

interface MapViewProps {
  heatPoints: HeatPoint[];
  showHeatmap: boolean;
  hotspots: Hotspot[];
  showHotspots: boolean;
  /** Selected cluster id (highlighted on the map), or null. */
  selectedHotspotId?: string | null;
  /** Called when a cluster marker is clicked. */
  onSelectHotspot?: (id: string) => void;
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

/** Satellite icon — a simple grid-of-squares SVG (no external dep). */
function SatelliteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="7" height="7" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="11" y="2" width="7" height="7" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="2" y="11" width="7" height="7" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="11" y="11" width="7" height="7" rx="1" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

/** Street map icon — horizontal lines like a road map. */
function StreetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="4" width="16" height="2" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor" opacity="0.65" />
      <rect x="2" y="14" width="10" height="2" rx="1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

interface LayerPickerProps {
  basemap: BasemapId;
  onChange: (b: BasemapId) => void;
}

/**
 * Compact floating layer-switcher rendered on top of the map. Two options:
 * OpenStreetMap (default) and Satellite. Styled as a glass card consistent with
 * the dashboard's dark/light design system.
 */
function LayerPicker({ basemap, onChange }: LayerPickerProps) {
  const [open, setOpen] = useState(false);

  const options: { id: BasemapId; label: string; icon: ReactNode }[] = [
    {
      id: "osm",
      label: "Map",
      icon: <StreetIcon className="h-4 w-4" />,
    },
    {
      id: "satellite",
      label: "Satellite",
      icon: <SatelliteIcon className="h-4 w-4" />,
    },
  ];

  const active = options.find((o) => o.id === basemap)!;

  return (
    <div className="absolute bottom-[7.5rem] left-3 z-[1000] select-none">
      {/* Expanded panel */}
      {open && (
        <div
          className="
            mb-1 overflow-hidden rounded-lg border border-white/20 bg-white/90 shadow-xl
            backdrop-blur-md
            dark:border-gray-700/60 dark:bg-gray-900/90
          "
          style={{ minWidth: "110px" }}
        >
          {options.map((opt) => {
            const isActive = opt.id === basemap;
            return (
              <button
                key={opt.id}
                id={`layer-picker-${opt.id}`}
                aria-label={`Switch to ${opt.label} basemap`}
                aria-pressed={isActive}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`
                  flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium
                  transition-colors duration-150
                  ${
                    isActive
                      ? "bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60"
                  }
                `}
              >
                <span
                  className={`
                    flex-shrink-0 rounded p-0.5
                    ${isActive ? "text-blue-500 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}
                  `}
                >
                  {opt.icon}
                </span>
                {opt.label}
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500 dark:bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Toggle button — shows current basemap icon */}
      <button
        id="layer-picker-toggle"
        aria-label={`Map layers — current: ${active.label}. Click to switch.`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`
          flex h-8 w-8 items-center justify-center rounded-lg border shadow-md
          transition-all duration-150 active:scale-95
          ${
            open
              ? "border-blue-400/60 bg-blue-50 text-blue-600 dark:border-blue-500/50 dark:bg-blue-900/40 dark:text-blue-400"
              : "border-white/30 bg-white/90 text-gray-600 hover:bg-white dark:border-gray-700/60 dark:bg-gray-900/90 dark:text-gray-300 dark:hover:bg-gray-800"
          }
          backdrop-blur-md
        `}
      >
        {active.icon}
      </button>
    </div>
  );
}

/**
 * Owns the Leaflet map. MapContainer creates the map exactly once; the heat
 * and hotspot layers update in place via the map context. No token required —
 * uses standard OpenStreetMap tiles by default (the same basemap the DBSCAN
 * notebook uses, and identical in light and dark mode so theme switching does
 * not change the map's appearance). Satellite is available via the in-map layer
 * picker. `children` render as overlays on top.
 */
export default function MapView({
  heatPoints,
  showHeatmap,
  hotspots,
  showHotspots,
  selectedHotspotId,
  onSelectHotspot,
  children,
}: MapViewProps) {
  // Basemap state — default is OpenStreetMap; satellite is opt-in.
  // OSM is always used regardless of light/dark theme so the map appearance
  // stays identical when toggling the dashboard theme.
  const [basemap, setBasemap] = useState<BasemapId>("osm");

  // Resolve tile config from the selected basemap only (theme-independent).
  const tileConfig = basemap === "satellite"
    ? {
        url: TILE_URL_SATELLITE,
        attribution: TILE_ATTRIBUTION_SATELLITE,
        maxNativeZoom: TILE_MAX_NATIVE_ZOOM_SATELLITE,
        key: "satellite",
      }
    : {
        url: TILE_URL_OSM,
        attribution: TILE_ATTRIBUTION_OSM,
        maxNativeZoom: TILE_MAX_NATIVE_ZOOM_OSM,
        key: "osm",
      };

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
            upscales them past that so deep zoom stays sharp instead of
            turning solid gray. Key forces remount on basemap/theme switch. */}
        <TileLayer
          key={tileConfig.key}
          url={tileConfig.url}
          attribution={tileConfig.attribution}
          maxZoom={20}
          maxNativeZoom={tileConfig.maxNativeZoom}
        />
        <ZoomControl position="bottomright" />
        <ResizeHandler />
        <HeatLayer points={heatPoints} visible={showHeatmap} />
        <HotspotLayer
          hotspots={hotspots}
          visible={showHotspots}
          selectedId={selectedHotspotId}
          onSelect={onSelectHotspot}
        />
      </MapContainer>

      {/* Layer picker — rendered outside MapContainer so it stays in React
          DOM without Leaflet ownership, but absolutely positioned over the map. */}
      <LayerPicker basemap={basemap} onChange={setBasemap} />

      {children}
    </div>
  );
}
