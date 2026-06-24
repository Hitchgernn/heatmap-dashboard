import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { HeatmapFeatureCollection } from "../types/heatmap";
import {
  addHeatmapLayer,
  configureMapboxToken,
  createMap,
  setHeatmapVisible,
  updateHeatmapData,
} from "../lib/mapbox";

interface MapViewProps {
  heatmap: HeatmapFeatureCollection | null;
  showHeatmap: boolean;
  onMapReady: (map: MapboxMap) => void;
}

/**
 * Owns the Mapbox instance. The map is created exactly once; subsequent prop
 * changes update the existing source/layer in place rather than recreating it.
 */
export default function MapView({ heatmap, showHeatmap, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const hasToken = useRef(configureMapboxToken());

  // Create the map once on mount.
  useEffect(() => {
    if (!containerRef.current || !hasToken.current || mapRef.current) return;

    const map = createMap(containerRef.current);
    mapRef.current = map;

    map.on("load", () => {
      addHeatmapLayer(map, heatmap ?? { type: "FeatureCollection", features: [] });
      setHeatmapVisible(map, showHeatmap);
      setLoaded(true);
      onMapReady(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Intentionally run once — later updates flow through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push new GeoJSON into the existing source whenever it changes.
  useEffect(() => {
    if (mapRef.current && loaded && heatmap) {
      updateHeatmapData(mapRef.current, heatmap);
    }
  }, [heatmap, loaded]);

  // Toggle heatmap visibility.
  useEffect(() => {
    if (mapRef.current && loaded) {
      setHeatmapVisible(mapRef.current, showHeatmap);
    }
  }, [showHeatmap, loaded]);

  const isEmpty = loaded && (!heatmap || heatmap.features.length === 0);

  if (!hasToken.current) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-center text-sm text-slate-600">
        <div className="max-w-md p-6">
          <p className="font-medium text-slate-800">Mapbox token missing</p>
          <p className="mt-1">
            Set <code className="rounded bg-slate-200 px-1">VITE_MAPBOX_TOKEN</code> in{" "}
            <code className="rounded bg-slate-200 px-1">frontend/.env</code> and restart the dev
            server to render the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-md bg-white/90 px-4 py-2 text-sm text-slate-600 shadow">
            No visitor data in this time window.
          </div>
        </div>
      )}
    </div>
  );
}
