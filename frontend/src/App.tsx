import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import DashboardView from "./components/DashboardView";
import HeatmapView from "./components/HeatmapView";
import HotspotsView from "./components/HotspotsView";
import ShowSidebarButton from "./components/ShowSidebarButton";
import { getAggregatedHeatmap, getDashboardSummary, getHotspots } from "./lib/api";
import { toHeatPoints } from "./lib/map";
import type { DashboardSummary, HeatmapFeatureCollection, TimeWindow } from "./types/heatmap";
import type { Hotspot } from "./types/hotspot";
import type { Page } from "./types/nav";

const POLL_INTERVAL_MS = 30_000;

const PAGE_TITLE: Record<Page, string> = {
  dashboard: "Dashboard",
  heatmap: "Heatmap",
  hotspots: "Hotspots",
  visitor: "Visitor View",
  settings: "Settings",
};

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("15m");
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Dashboard layer toggles (full-map pages force their own layer state).
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);

  const [heatmap, setHeatmap] = useState<HeatmapFeatureCollection | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hotspotsLoading, setHotspotsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert backend GeoJSON ([lng, lat]) to leaflet.heat points ([lat, lng, intensity]).
  const heatPoints = useMemo(() => toHeatPoints(heatmap), [heatmap]);

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

  // Hotspots are used by every page (markers + dashboard table), so fetch them
  // on mount and refresh on the same poll cadence.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadHotspots() {
      try {
        const hs = await getHotspots({}, controller.signal);
        if (!cancelled) setHotspots(hs);
      } catch {
        /* hotspots are optional — ignore errors silently */
      } finally {
        if (!cancelled) setHotspotsLoading(false);
      }
    }

    loadHotspots();
    const id = setInterval(loadHotspots, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  const status: "live" | "refreshing" | "error" = error
    ? "error"
    : refreshing && !firstLoad
      ? "refreshing"
      : "live";

  // Sidebar can be collapsed only on the full-map pages.
  const collapsible = page === "heatmap" || page === "hotspots";
  const showSidebar = page === "dashboard" ? true : sidebarVisible;

  return (
    <div className="flex h-full bg-gray-50 text-gray-800">
      <Sidebar
        active={page}
        onNavigate={(p) => setPage(p)}
        visible={showSidebar}
        onCollapse={collapsible ? () => setSidebarVisible(false) : undefined}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopHeader title={PAGE_TITLE[page]} status={status} />

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-6 py-2 text-sm text-red-700"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            <span>
              {error}. Retrying every {POLL_INTERVAL_MS / 1000}s.
            </span>
          </div>
        )}

        <main className="relative flex min-h-0 flex-1 flex-col overflow-auto">
          {collapsible && !showSidebar && (
            <ShowSidebarButton onClick={() => setSidebarVisible(true)} />
          )}

          {page === "dashboard" && (
            <DashboardView
              timeWindow={timeWindow}
              onTimeChange={setTimeWindow}
              heatPoints={heatPoints}
              showHeatmap={showHeatmap}
              showHotspots={showHotspots}
              onToggleHeatmap={setShowHeatmap}
              onToggleHotspots={setShowHotspots}
              hotspots={hotspots}
              summary={summary}
              loading={refreshing}
              hotspotsLoading={hotspotsLoading}
            />
          )}

          {page === "heatmap" && (
            <HeatmapView
              timeWindow={timeWindow}
              onTimeChange={setTimeWindow}
              heatPoints={heatPoints}
              hotspots={hotspots}
              sidebarCollapsed={!showSidebar}
            />
          )}

          {page === "hotspots" && (
            <HotspotsView
              timeWindow={timeWindow}
              onTimeChange={setTimeWindow}
              hotspots={hotspots}
              sidebarCollapsed={!showSidebar}
            />
          )}
        </main>
      </div>
    </div>
  );
}
