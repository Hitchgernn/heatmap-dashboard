import type { ReactNode } from "react";
import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import HeatLayer from "./HeatLayer";
import HotspotLayer from "./HotspotLayer";
import { BOROBUDUR_CENTER, DEFAULT_ZOOM, TILE_ATTRIBUTION, TILE_URL } from "../lib/map";
import type { HeatPoint } from "../lib/map";
import type { Hotspot } from "../types/hotspot";

interface MapViewProps {
  heatPoints: HeatPoint[];
  showHeatmap: boolean;
  hotspots: Hotspot[];
  showHotspots: boolean;
  /** Absolutely-positioned overlays (controls, legend) drawn above the map. */
  children?: ReactNode;
}

/**
 * Owns the Leaflet map. MapContainer creates the map exactly once; the heat and
 * hotspot layers update in place via the map context. No token required — uses
 * CARTO light OpenStreetMap tiles. `children` render as overlays on top of the
 * map (each is responsible for its own positioning + pointer-events).
 */
export default function MapView({
  heatPoints,
  showHeatmap,
  hotspots,
  showHotspots,
  children,
}: MapViewProps) {
  const isEmpty = showHeatmap && heatPoints.length === 0;

  return (
    <div className="relative h-full w-full bg-gray-100">
      <MapContainer
        center={BOROBUDUR_CENTER}
        zoom={DEFAULT_ZOOM}
        maxZoom={20}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
        {/* CARTO tiles only exist up to z20; maxNativeZoom upscales them past
            that so z21–22 stays sharp basemap instead of turning solid gray. */}
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          maxZoom={20}
          maxNativeZoom={20}
        />
        <ZoomControl position="bottomright" />
        <HeatLayer points={heatPoints} visible={showHeatmap} />
        <HotspotLayer hotspots={hotspots} visible={showHotspots} />
      </MapContainer>

      {children}

      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="rounded-lg border border-gray-200 bg-white/95 px-4 py-3 text-center text-sm text-gray-600 shadow-lg backdrop-blur">
            <p className="font-medium text-gray-800">No visitor activity</p>
            <p className="mt-0.5 text-gray-500">Nothing recorded in this time window yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
