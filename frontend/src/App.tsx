import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import type { DataSource } from "./components/TopHeader";
import DashboardView from "./components/DashboardView";
import HeatmapView from "./components/HeatmapView";
import HotspotsView from "./components/HotspotsView";
import MockGeneratorView from "./components/MockGeneratorView";
import SettingsView from "./components/SettingsView";
import Modal from "./components/Modal";
import ShowSidebarButton from "./components/ShowSidebarButton";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginPage from "./components/LoginPage";
import { useLanguage } from "./context/language";
import { useAuth } from "./context/auth";
import { getAggregatedHeatmap, getDashboardSummary, getHotspots } from "./lib/api";
import { toHeatPoints } from "./lib/map";
import type { DashboardSummary, HeatmapFeatureCollection, TimeWindow } from "./types/heatmap";
import type { ClusterPoint, Hotspot } from "./types/hotspot";
import type { Page } from "./types/nav";

const POLL_INTERVAL_MS = 30_000;

// Page titles are proper section names — intentionally untranslated (see i18n.ts).
const PAGE_TITLE: Record<Page, string> = {
  dashboard: "Dashboard",
  heatmap: "Heatmap",
  hotspots: "Hotspots",
  mock: "Mock Generator",
  visitor: "Visitor View",
  settings: "Settings",
};

// Persist the active page so a refresh restores where you were. Settings is a
// modal (not a page) and visitor isn't wired, so only these four are stored.
const PAGE_STORAGE_KEY = "borobudur.page";
const PERSISTED_PAGES: Page[] = ["dashboard", "heatmap", "hotspots", "mock"];

function readStoredPage(): Page {
  if (typeof localStorage === "undefined") return "dashboard";
  const stored = localStorage.getItem(PAGE_STORAGE_KEY) as Page | null;
  return stored && PERSISTED_PAGES.includes(stored) ? stored : "dashboard";
}

// Persist the chosen data source so a refresh keeps it (e.g. Mock stays Mock).
// Cleared on logout so a fresh login starts from the Mobile App default.
const SOURCE_STORAGE_KEY = "borobudur.source";

function readStoredSource(): DataSource {
  if (typeof localStorage === "undefined") return "mobile_app";
  const stored = localStorage.getItem(SOURCE_STORAGE_KEY);
  return stored === "mock" || stored === "mobile_app" ? stored : "mobile_app";
}

/**
 * Top-level App component — handles the auth gate. When authenticated,
 * renders the Dashboard shell; otherwise shows the login page.
 */
export default function App() {
  const { status: authStatus, signout } = useAuth();

  if (authStatus === "loading") {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading…</span>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return <LoginPage />;
  }

  return <DashboardShell onLogout={signout} />;
}

/**
 * The authenticated dashboard shell — all hooks live here so they're never
 * called conditionally (React rules-of-hooks).
 */
function DashboardShell({ onLogout }: { onLogout: () => Promise<void> }) {
  const { t } = useLanguage();
  const [page, setPage] = useState<Page>(readStoredPage);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>({ kind: "preset", value: "15m" });
  const [source, setSource] = useState<DataSource>(readStoredSource);
  // DBSCAN tuning (Hotspots page sliders). Defaults mirror the backend.
  const [dbscanParams, setDbscanParams] = useState({ eps: 8, minSamples: 5 });
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Dashboard layer toggles (full-map pages force their own layer state).
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);

  const [heatmap, setHeatmap] = useState<HeatmapFeatureCollection | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [clusterPoints, setClusterPoints] = useState<ClusterPoint[]>([]);

  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hotspotsLoading, setHotspotsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert backend GeoJSON ([lng, lat]) to leaflet.heat points ([lat, lng, intensity]).
  const heatPoints = useMemo(() => toHeatPoints(heatmap), [heatmap]);

  // Persist the active page so a browser refresh restores it.
  useEffect(() => {
    if (PERSISTED_PAGES.includes(page)) localStorage.setItem(PAGE_STORAGE_KEY, page);
  }, [page]);

  // Persist the data source so a refresh keeps Mock selected.
  useEffect(() => {
    localStorage.setItem(SOURCE_STORAGE_KEY, source);
  }, [source]);

  // Poll heatmap + summary together. Recreated when the time window changes.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      if (!cancelled) setRefreshing(true);
      try {
        const [hm, sm] = await Promise.all([
          getAggregatedHeatmap({ window: timeWindow, source }, controller.signal),
          getDashboardSummary({ window: timeWindow, source }, controller.signal),
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
  }, [timeWindow, source]);

  // Hotspots are used by every page (markers + dashboard table), so fetch them
  // on mount and refresh on the same poll cadence.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadHotspots() {
      try {
        const result = await getHotspots(
          {
            source,
            window: timeWindow,
            eps: dbscanParams.eps,
            minSamples: dbscanParams.minSamples,
          },
          controller.signal
        );
        if (!cancelled) {
          setHotspots(result.hotspots);
          setClusterPoints(result.points);
        }
      } catch {
        /* hotspots are optional — ignore errors silently */
      } finally {
        if (!cancelled) setHotspotsLoading(false);
      }
    }

    setHotspotsLoading(true);
    loadHotspots();
    const id = setInterval(loadHotspots, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [source, timeWindow, dbscanParams]);

  const status: "live" | "refreshing" | "error" = error
    ? "error"
    : refreshing && !firstLoad
      ? "refreshing"
      : "live";

  // Sidebar can be collapsed on every functional page.
  const collapsible = page === "dashboard" || page === "heatmap" || page === "hotspots" || page === "mock";
  const showSidebar = sidebarVisible;

  // Search shows on the Dashboard and both map pages.
  const showSearch = page === "dashboard" || page === "heatmap" || page === "hotspots";

  return (
    <div className="flex h-full bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-200">
      <Sidebar
        active={page}
        onNavigate={(p) => setPage(p)}
        visible={showSidebar}
        onCollapse={collapsible ? () => setSidebarVisible(false) : undefined}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopHeader
          title={PAGE_TITLE[page]}
          status={status}
          showSearch={showSearch}
          showSource={showSearch}
          source={source}
          onSourceChange={setSource}
        />

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-6 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            <span>{t("error.retrying", { error, seconds: POLL_INTERVAL_MS / 1000 })}</span>
          </div>
        )}

        <main className="relative flex min-h-0 flex-1 flex-col overflow-auto">
          {collapsible && !showSidebar && (
            <ShowSidebarButton onClick={() => setSidebarVisible(true)} />
          )}

          {/* Keyed by page so React remounts on navigation, replaying the
              page-enter animation for a smooth transition between views. */}
          <div key={page} className="page-enter flex min-h-0 flex-1 flex-col">
           <ErrorBoundary>
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
                aggregatingLabel={firstLoad ? t("tl.processing") : null}
                sidebarCollapsed={!showSidebar}
              />
            )}

            {page === "heatmap" && (
              <HeatmapView
                timeWindow={timeWindow}
                onTimeChange={setTimeWindow}
                heatPoints={heatPoints}
                source={source}
                sidebarCollapsed={!showSidebar}
              />
            )}

            {page === "hotspots" && (
              <HotspotsView
                timeWindow={timeWindow}
                onTimeChange={setTimeWindow}
                hotspots={hotspots}
                clusterPoints={clusterPoints}
                dbscanParams={dbscanParams}
                onDbscanChange={setDbscanParams}
                aggregatingLabel={hotspotsLoading ? t("tl.processing") : null}
                sidebarCollapsed={!showSidebar}
              />
            )}

            {page === "mock" && <MockGeneratorView />}
           </ErrorBoundary>
          </div>
        </main>
      </div>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title={PAGE_TITLE.settings}>
        <SettingsView
          onClose={() => setSettingsOpen(false)}
          onLogout={async () => {
            localStorage.removeItem(PAGE_STORAGE_KEY);
            localStorage.removeItem(SOURCE_STORAGE_KEY);
            await onLogout();
          }}
        />
      </Modal>
    </div>
  );
}
