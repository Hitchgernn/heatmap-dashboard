import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import type { DataSource } from "./components/TopHeader";
import LoadingState from "./components/LoadingState";
import SettingsView from "./components/SettingsView";

/**
 * The four page views are code-split. Leaflet, leaflet.heat, react-leaflet and
 * Recharts are reachable only through them, so an admin sitting on the login
 * screen no longer downloads a map engine and a charting library to type a
 * password. The boot splash and the shell chrome cover the fetch.
 */
const DashboardView = lazy(() => import("./components/DashboardView"));
const HeatmapView = lazy(() => import("./components/HeatmapView"));
const HotspotsView = lazy(() => import("./components/HotspotsView"));
const MockGeneratorView = lazy(() => import("./components/MockGeneratorView"));
import Modal from "./components/Modal";
import ShowSidebarButton from "./components/ShowSidebarButton";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginPage from "./components/LoginPage";
import { useLanguage } from "./context/language";
import { useAuth } from "./context/auth";
import { getAggregatedHeatmap, getDashboardSummary, getHotspots } from "./lib/api";
import { toHeatPoints } from "./lib/map";
import { dismissBootSplash } from "./lib/splash";
import { applyDisplayMode, pinnedPage } from "./lib/display";
import { BELOW_LG, useMediaQuery } from "./hooks/useMediaQuery";
import { isSessionError } from "./lib/errors";
import type { DashboardSummary, HeatmapFeatureCollection, TimeWindow } from "./types/heatmap";
import type { ClusterPoint, Hotspot } from "./types/hotspot";
import type { Page } from "./types/nav";

const POLL_INTERVAL_MS = 30_000;

// A single failed poll is usually an upstream blip that the next one clears, and
// the map keeps showing the previous data either way — so hold the red banner
// until two in a row fail. With nothing on screen yet there is nothing to hold
// back, so the first failure still speaks up.
const ERROR_AFTER_FAILURES = 2;

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
  // A `?page=` pin (used by wall-display bookmarks) beats whatever page the
  // last operator left behind in this browser.
  const pinned = pinnedPage();
  if (pinned) return pinned;
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

// Product labels — English in both locales, matching the header toggle.
const SOURCE_LABEL: Record<DataSource, string> = {
  mobile_app: "Mobile App",
  mock: "Mock",
};

/**
 * Top-level App component — handles the auth gate. When authenticated,
 * renders the Dashboard shell; otherwise shows the login page.
 */
export default function App() {
  const { status: authStatus, signout, expireSession } = useAuth();
  const resolved = authStatus !== "loading";

  // Puts the `wall` class on <html> so the `wall:` variant applies. The mode is
  // fixed for the life of the tab, so this runs once.
  useEffect(() => {
    applyDisplayMode();
  }, []);

  // The boot splash from index.html is still covering the viewport until this
  // fires — it spans both the bundle-parse gap and the session check.
  useEffect(() => {
    if (resolved) dismissBootSplash();
  }, [resolved]);

  // Render nothing behind the splash rather than a second, redundant spinner.
  if (!resolved) return null;

  return (
    // Fades up as the splash fades out, so the handoff isn't a hard cut.
    <div className="page-enter h-full">
      {authStatus === "unauthenticated" ? (
        <LoginPage />
      ) : (
        <DashboardShell onLogout={signout} onSessionExpired={expireSession} />
      )}
    </div>
  );
}

/**
 * The authenticated dashboard shell — all hooks live here so they're never
 * called conditionally (React rules-of-hooks).
 */
function DashboardShell({
  onLogout,
  onSessionExpired,
}: {
  onLogout: () => Promise<void>;
  onSessionExpired: () => void;
}) {
  const { t } = useLanguage();
  const [page, setPage] = useState<Page>(readStoredPage);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>({ kind: "preset", value: "15m" });
  const [source, setSource] = useState<DataSource>(readStoredSource);
  // DBSCAN tuning (Hotspots page sliders). Defaults mirror the backend.
  const [dbscanParams, setDbscanParams] = useState({ eps: 8, minSamples: 5 });

  // Below `lg` the rail can't push content aside without starving the map, so
  // it becomes an overlay drawer that starts closed. Above `lg` it is the
  // familiar pushing rail, open by default.
  const drawerNav = useMediaQuery(BELOW_LG);
  const [sidebarVisible, setSidebarVisible] = useState(() => !drawerNav);

  // Crossing the breakpoint re-establishes that default in the new mode —
  // otherwise rotating a tablet to portrait leaves a rail covering the map.
  useEffect(() => {
    setSidebarVisible(!drawerNav);
  }, [drawerNav]);

  // Escape closes the drawer, matching the Settings modal.
  useEffect(() => {
    if (!drawerNav || !sidebarVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarVisible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerNav, sidebarVisible]);

  // Dashboard layer toggles (full-map pages force their own layer state).
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);

  const [heatmap, setHeatmap] = useState<HeatmapFeatureCollection | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [clusterPoints, setClusterPoints] = useState<ClusterPoint[]>([]);

  // The browser knows it is offline before any fetch times out; saying so beats
  // "Failed to fetch" and stops the operator hunting a backend fault.
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Consecutive failed polls, and whether a poll has ever succeeded for the
  // current window/source. Refs, not state: the poll closure reads them and they
  // must never retrigger it.
  const failuresRef = useRef(0);
  const hasDataRef = useRef(false);

  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hotspotsLoading, setHotspotsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Switching data source refetches heatmap, summary and hotspots. Until they
  // land the map still shows the previous source, so say what is happening
  // instead of letting stale points read as the new source's data.
  const [switchingSource, setSwitchingSource] = useState(false);
  const lastSourceRef = useRef(source);
  useEffect(() => {
    if (lastSourceRef.current === source) return;
    lastSourceRef.current = source;
    setSwitchingSource(true);
  }, [source]);
  // Both loaders flip their flags in the same commit as the one above, so this
  // never clears before the refetch it is announcing has started.
  useEffect(() => {
    if (switchingSource && !firstLoad && !hotspotsLoading) setSwitchingSource(false);
  }, [switchingSource, firstLoad, hotspotsLoading]);

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
        failuresRef.current = 0;
        hasDataRef.current = true;
        setError(null);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        // An expired cookie can never recover by retrying — hand back to login.
        if (isSessionError(err)) {
          onSessionExpired();
          return;
        }
        failuresRef.current += 1;
        if (!hasDataRef.current || failuresRef.current >= ERROR_AFTER_FAILURES) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setFirstLoad(false);
          setRefreshing(false);
        }
      }
    }

    // A new window/source is a fresh screen: no data yet, no failures behind us.
    failuresRef.current = 0;
    hasDataRef.current = false;
    setFirstLoad(true);
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [timeWindow, source, onSessionExpired]);

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
      } catch (err) {
        // Hotspots are optional, so ordinary failures stay silent — but an
        // expired session is not an optional failure.
        if (!cancelled && isSessionError(err)) {
          onSessionExpired();
          return;
        }
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
  }, [source, timeWindow, dbscanParams, onSessionExpired]);

  const status: "live" | "refreshing" | "error" = !online || error
    ? "error"
    : refreshing && !firstLoad
      ? "refreshing"
      : "live";

  // Sidebar can be collapsed on every functional page.
  const collapsible = page === "dashboard" || page === "heatmap" || page === "hotspots" || page === "mock";
  const showSidebar = sidebarVisible;

  // Map overlays step right only to clear the floating show-sidebar button,
  // which exists on desk layouts alone.
  const mapControlsShifted = !showSidebar && !drawerNav;

  // Search shows on the Dashboard and both map pages.
  const showSearch = page === "dashboard" || page === "heatmap" || page === "hotspots";

  return (
    <div
      className="relative flex h-full bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-200"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* First tab stop: jumps the five nav items. Visible only on focus. */}
      <a
        href="#main-content"
        className="sr-only left-3 top-3 z-[1000] rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute dark:bg-white dark:text-gray-900"
      >
        {t("a11y.skipToContent")}
      </a>

      <Sidebar
        active={page}
        onNavigate={(p) => {
          setPage(p);
          // A drawer covers what you just navigated to — close it behind you.
          if (drawerNav) setSidebarVisible(false);
        }}
        visible={showSidebar}
        overlay={drawerNav}
        onCollapse={collapsible ? () => setSidebarVisible(false) : undefined}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Drawer scrim — only in overlay mode, so the pushing rail is unaffected. */}
      {drawerNav && showSidebar && (
        <div
          className="modal-backdrop fixed inset-0 z-[850] bg-gray-900/40 dark:bg-black/60"
          onClick={() => setSidebarVisible(false)}
          aria-hidden="true"
        />
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopHeader
          title={PAGE_TITLE[page]}
          status={status}
          showSearch={showSearch}
          showSource={showSearch}
          source={source}
          onSourceChange={setSource}
          // Stays mounted while the drawer is open — it is the element focus
          // returns to on close, and a detached node cannot receive focus.
          onOpenNav={drawerNav ? () => setSidebarVisible(true) : undefined}
        />

        {!online ? (
          <div
            role="status"
            className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:px-6 wall:text-base dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
            <span>{t("error.offline")}</span>
          </div>
        ) : (
          error && (
            <div
              role="alert"
              className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 sm:px-6 wall:text-base dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />
              <span>{t("error.retrying", { error, seconds: POLL_INTERVAL_MS / 1000 })}</span>
            </div>
          )
        )}

        <main id="main-content" tabIndex={-1} className="relative flex min-h-0 flex-1 flex-col overflow-auto outline-none">
          {/* Desk only — in drawer mode the opener lives in the header instead,
              where it can't overlap the content it reveals. */}
          {collapsible && !showSidebar && !drawerNav && (
            <ShowSidebarButton onClick={() => setSidebarVisible(true)} />
          )}

          {/* Same top-center pill the timelapse uses while aggregating — one
              visual language for "the backend is working on it". */}
          {switchingSource && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-[700] -translate-x-1/2">
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 animate-spin text-gray-500 dark:text-gray-400" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
                  <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {t("source.switching", { source: SOURCE_LABEL[source] })}
              </div>
            </div>
          )}

          {/* Keyed by page so React remounts on navigation, replaying the
              page-enter animation for a smooth transition between views. */}
          <div key={page} className="page-enter flex min-h-0 flex-1 flex-col">
           <ErrorBoundary>
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center p-6">
                  <LoadingState mode="loading" />
                </div>
              }
            >
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
                sidebarCollapsed={mapControlsShifted}
              />
            )}

            {page === "heatmap" && (
              <HeatmapView
                timeWindow={timeWindow}
                onTimeChange={setTimeWindow}
                heatPoints={heatPoints}
                source={source}
                sidebarCollapsed={mapControlsShifted}
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
                sidebarCollapsed={mapControlsShifted}
              />
            )}

            {page === "mock" && <MockGeneratorView />}
            </Suspense>
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
