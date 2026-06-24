import { useCallback, useEffect, useState } from "react";
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

/** Connection status pill in the header. */
function StatusPill({ state }: { state: "live" | "refreshing" | "error" }) {
  const config = {
    live: { dot: "bg-emerald-400", text: "Live", tone: "text-emerald-300" },
    refreshing: { dot: "bg-sky-400 animate-pulse", text: "Refreshing", tone: "text-sky-300" },
    error: { dot: "bg-red-400", text: "Disconnected", tone: "text-red-300" },
  }[state];

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-medium">
      <span className={"h-2 w-2 rounded-full " + config.dot} />
      <span className={config.tone}>{config.text}</span>
    </span>
  );
}

/** Heatmap density legend overlay (anchored bottom-left of the map). */
function HeatmapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-slate-700 bg-slate-900/85 px-3 py-2.5 text-xs text-slate-300 shadow-xl backdrop-blur">
      <p className="mb-1.5 font-medium uppercase tracking-wider text-slate-400">Visitor density</p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500">Low</span>
        <span
          className="h-2 w-28 rounded-full"
          style={{
            background:
              "linear-gradient(to right, rgb(103,169,207), rgb(209,229,240), rgb(253,219,199), rgb(239,138,98), rgb(178,24,43))",
          }}
        />
        <span className="text-[10px] text-slate-500">High</span>
      </div>
    </div>
  );
}

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

  const status: "live" | "refreshing" | "error" = error
    ? "error"
    : refreshing && !firstLoad
      ? "refreshing"
      : "live";

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/40 px-4 py-3.5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
              {/* Lucide "activity" glyph — monitoring identity, not decoration */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            <div>
              <h1 className="text-base font-semibold leading-tight text-slate-100">
                Borobudur Heatmap Dashboard
              </h1>
              <p className="text-xs text-slate-500">Visitor density monitoring</p>
            </div>
          </div>
          {!firstLoad && <StatusPill state={status} />}
        </div>
      </header>

      {/* Controls + cards */}
      <div className="space-y-3 px-4 py-4 sm:px-6">
        <DashboardCards summary={summary} loading={refreshing} />

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-red-300"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
            <span>
              {error}. Retrying every {POLL_INTERVAL_MS / 1000}s.
            </span>
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
          {firstLoad && <LoadingState mode="loading" />}
        </div>
      </div>

      {/* Map */}
      <main className="relative flex-1 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-800 shadow-xl">
          <MapView heatmap={heatmap} showHeatmap={showHeatmap} onMapReady={onMapReady} />
          <HotspotLayer map={map} hotspots={hotspots} visible={showHotspots} />
          {showHeatmap && <HeatmapLegend />}
        </div>
      </main>
    </div>
  );
}
