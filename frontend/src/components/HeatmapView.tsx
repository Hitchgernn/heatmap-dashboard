import { useState } from "react";
import MapView from "./MapView";
import TimeFilter from "./TimeFilter";
import DensityLegend from "./DensityLegend";
import ActiveIndicator from "./ActiveIndicator";
import TimelapseSetup from "./TimelapseSetup";
import TimelapseBar from "./TimelapseBar";
import { useTimelapse, type TimelapseConfig } from "../hooks/useTimelapse";
import { formatDate, formatTime } from "../lib/timelapse";
import { useLanguage } from "../context/language";
import type { HeatPoint } from "../lib/map";
import type { TimeWindow } from "../types/heatmap";

interface HeatmapViewProps {
  timeWindow: TimeWindow;
  onTimeChange: (w: TimeWindow) => void;
  heatPoints: HeatPoint[];
  /** Selected data source (mobile_app | mock) — threaded into timelapse frames. */
  source: string;
  /** Sidebar is collapsed — shift top-left controls clear of the show button. */
  sidebarCollapsed: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Same pill styling as TimeFilter's segmented control.
const PILL_BASE =
  "tap shrink-0 rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 wall:px-4 wall:py-2 wall:text-base ";
const PILL_ACTIVE = "bg-gray-900 text-white dark:bg-white dark:text-gray-900";
const PILL_IDLE =
  "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white";

/**
 * Full-map heatmap page with two modes:
 *  - Live: the polled heatmap from App.tsx plus the TimeFilter (existing
 *    behavior).
 *  - Timelapse: replay a historical date/range in fixed steps. Frame data is
 *    fetched per-slice by useTimelapse; the live heatPoints prop is ignored
 *    while active (App's polling itself keeps running for other pages).
 * No hotspot markers here — those live on the Dashboard and Hotspots pages.
 */
export default function HeatmapView({
  timeWindow,
  onTimeChange,
  heatPoints,
  source,
  sidebarCollapsed,
}: HeatmapViewProps) {
  const { t, lang } = useLanguage();
  const [mode, setMode] = useState<"live" | "timelapse">("live");
  const [config, setConfig] = useState<TimelapseConfig | null>(null);
  const timelapseActive = mode === "timelapse";
  const tl = useTimelapse(timelapseActive ? config : null, source);

  const displayPoints = timelapseActive ? tl.points : heatPoints;
  const multiDay = config !== null && config.range.toMs - config.range.fromMs > DAY_MS;

  return (
    <div className="relative flex-1">
      <MapView heatPoints={displayPoints} showHeatmap hotspots={[]} showHotspots={false}>
        <div
          className={
            // z above the other z-[600] map overlays: they are later siblings, so
            // otherwise they paint over the open date picker.
            "absolute top-3 z-[650] flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2 sm:max-w-[calc(100%-13rem)] " +
            (sidebarCollapsed ? "left-14" : "left-3")
          }
        >
          {/* "Live" / "Timelapse" are product-style names — English in both locales. */}
          <div
            role="group"
            aria-label="Map mode"
            className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <button
              type="button"
              onClick={() => setMode("live")}
              aria-pressed={!timelapseActive}
              className={PILL_BASE + (!timelapseActive ? PILL_ACTIVE : PILL_IDLE)}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => setMode("timelapse")}
              aria-pressed={timelapseActive}
              className={PILL_BASE + (timelapseActive ? PILL_ACTIVE : PILL_IDLE)}
            >
              Timelapse
            </button>
          </div>

          {timelapseActive ? (
            <TimelapseSetup onStart={setConfig} />
          ) : (
            <TimeFilter value={timeWindow} onChange={onTimeChange} />
          )}
        </div>

        {!timelapseActive && (
          <div className="absolute right-3 top-3 z-[600]">
            <ActiveIndicator label={t("active.heatmap")} />
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-[600]">
          <DensityLegend />
        </div>

        {/* Processing overlay: signals the frame slice is being fetched + aggregated. */}
        {timelapseActive && tl.loading && !tl.error && (
          <div className="absolute left-1/2 top-3 z-[600] -translate-x-1/2">
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 animate-spin text-gray-500 dark:text-gray-400" aria-hidden="true">
                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
                <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {t("tl.processing")}
            </div>
          </div>
        )}

        {timelapseActive && config && tl.bounds && (
          <div className="absolute bottom-3 left-1/2 z-[600] w-[min(560px,calc(100%-1.5rem))] -translate-x-1/2 sm:w-[min(560px,calc(100%-180px))]">
            <TimelapseBar
              playing={tl.playing}
              onTogglePlay={tl.togglePlay}
              frameIndex={tl.frameIndex}
              totalFrames={tl.totalFrames}
              onSeek={tl.seek}
              timeLabel={`${formatTime(tl.bounds.fromMs)} – ${formatTime(tl.bounds.toMs)}`}
              dateLabel={multiDay ? formatDate(tl.bounds.fromMs, lang === "id" ? "id-ID" : "en-GB") : null}
              loading={tl.loading}
              error={tl.error}
            />
          </div>
        )}
      </MapView>
    </div>
  );
}
