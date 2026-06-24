import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import MapView from "./components/MapView";
import DashboardCards from "./components/DashboardCards";
import TimeFilter from "./components/TimeFilter";
import LayerToggle from "./components/LayerToggle";
import HotspotLayer from "./components/HotspotLayer";
import LoadingState from "./components/LoadingState";
import { getAggregatedHeatmap, getDashboardSummary, getHotspots } from "./lib/api";
import type { DashboardSummary, HeatmapFeatureCollection, TimeWindow } from "./types/heatmap";
import type { Hotspot } from "./types/hotspot";

const POLL_INTERVAL_MS = 30_000;

export default function App() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("15m");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showHotspots, setShowHotspots] = useState(false);

  const [heatmap, setHeatmap] = useState<HeatmapFeatureCollection | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [map, setMap] = useState<MapboxMap | null>(null);
  const onMapReady = useCallback((m: MapboxMap) => setMap(m), []);

  // Poll heatmap + summary together. Recreated when the time window changes.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      if (!cancelled) setRefreshing(true);
      try {
        const [hm, sm] = await Promise.all([
          getAggregatedHeatmap({ window: timeWindow }, controller.signal),
          getDashboardSummary({ window: timeWindow }, controller.signal),
        ]);
        if (cancelled) return;
        setHeatmap(hm);
        setSummary(sm);
        setError(null);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (!cancelled) {
          setFirstLoad(false);
          setRefreshing(false);
        }
      }
    }

    setFirstLoad(true);
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [timeWindow]);

  // Fetch hotspots only when the layer is enabled.
  useEffect(() => {
    if (!showHotspots) return;
    let cancelled = false;
    const controller = new AbortController();

    getHotspots({}, controller.signal)
      .then((hs) => {
        if (!cancelled) setHotspots(hs);
      })
      .catch(() => {
        /* hotspots are optional — ignore errors silently */
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [showHotspots]);

  const lastUpdatedRef = useRef<string | null>(null);
  if (summary?.last_updated) lastUpdatedRef.current = summary.last_updated;

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800">Borobudur Heatmap Dashboard</h1>
          {!firstLoad && refreshing && <LoadingState mode="refreshing" />}
        </div>
      </header>

      {/* Controls + cards */}
      <div className="space-y-3 px-6 py-4">
        {firstLoad ? (
          <LoadingState mode="loading" />
        ) : (
          <DashboardCards summary={summary} loading={refreshing} />
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error} — retrying every {POLL_INTERVAL_MS / 1000}s.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <TimeFilter value={timeWindow} onChange={setTimeWindow} />
          <LayerToggle
            showHeatmap={showHeatmap}
            showHotspots={showHotspots}
            onToggleHeatmap={setShowHeatmap}
            onToggleHotspots={setShowHotspots}
          />
        </div>
      </div>

      {/* Map */}
      <main className="relative flex-1 px-6 pb-6">
        <div className="h-full w-full overflow-hidden rounded-lg border border-slate-200 shadow-sm">
          <MapView heatmap={heatmap} showHeatmap={showHeatmap} onMapReady={onMapReady} />
          <HotspotLayer map={map} hotspots={hotspots} visible={showHotspots} />
        </div>
      </main>
    </div>
  );
}
