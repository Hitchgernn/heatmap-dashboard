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
      <div className="flex h-full items-center justify-center bg-slate-900 text-center text-sm text-slate-400">
        <div className="max-w-md p-6">
          <p className="text-base font-semibold text-slate-200">Mapbox token missing</p>
          <p className="mt-2 leading-relaxed">
            Set <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-300">VITE_MAPBOX_TOKEN</code> in{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sky-300">frontend/.env</code> and
            restart the dev server to render the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-slate-900">
      <div ref={containerRef} className="h-full w-full" />
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg border border-slate-700 bg-slate-900/90 px-4 py-3 text-center text-sm text-slate-300 shadow-xl backdrop-blur">
            <p className="font-medium text-slate-200">No visitor activity</p>
            <p className="mt-0.5 text-slate-400">Nothing recorded in this time window yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
