import { MapContainer, TileLayer } from "react-leaflet";
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
}

/**
 * Owns the Leaflet map. MapContainer creates the map exactly once; the heat and
 * hotspot layers update in place via the map context. No token required — uses
 * CARTO dark OpenStreetMap tiles.
 */
export default function MapView({
  heatPoints,
  showHeatmap,
  hotspots,
  showHotspots,
}: MapViewProps) {
  const isEmpty = showHeatmap && heatPoints.length === 0;

  return (
    <div className="relative h-full w-full bg-slate-900">
      <MapContainer
        center={BOROBUDUR_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <HeatLayer points={heatPoints} visible={showHeatmap} />
        <HotspotLayer hotspots={hotspots} visible={showHotspots} />
      </MapContainer>

      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="rounded-lg border border-slate-700 bg-slate-900/90 px-4 py-3 text-center text-sm text-slate-300 shadow-xl backdrop-blur">
            <p className="font-medium text-slate-200">No visitor activity</p>
            <p className="mt-0.5 text-slate-400">Nothing recorded in this time window yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
