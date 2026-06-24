import { useEffect, useRef } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { Hotspot } from "../types/hotspot";
import { renderHotspotMarkers } from "../lib/mapbox";

interface HotspotLayerProps {
  map: MapboxMap | null;
  hotspots: Hotspot[];
  visible: boolean;
}

/**
 * Renders hotspot markers onto an existing map. This component draws nothing
 * itself (returns null) — it manages Mapbox markers as a side effect so they
 * can be added/removed without recreating the map.
 */
export default function HotspotLayer({ map, hotspots, visible }: HotspotLayerProps) {
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clear previous markers before (re)rendering.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (visible && hotspots.length > 0) {
      markersRef.current = renderHotspotMarkers(map, hotspots);
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, hotspots, visible]);

  return null;
}
