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
  /** Sidebar is collapsed — shift top-left controls clear of the show button. */
  sidebarCollapsed: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Same pill styling as TimeFilter's segmented control.
const PILL_BASE =
  "rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ";
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
  sidebarCollapsed,
}: HeatmapViewProps) {
  const { t, lang } = useLanguage();
  const [mode, setMode] = useState<"live" | "timelapse">("live");
  const [config, setConfig] = useState<TimelapseConfig | null>(null);
  const timelapseActive = mode === "timelapse";
  const tl = useTimelapse(timelapseActive ? config : null);

  const displayPoints = timelapseActive ? tl.points : heatPoints;
  const multiDay = config !== null && config.range.toMs - config.range.fromMs > DAY_MS;

  return (
    <div className="relative flex-1">
      <MapView heatPoints={displayPoints} showHeatmap hotspots={[]} showHotspots={false}>
        <div
          className={
            "absolute top-3 z-[600] flex flex-col items-start gap-2 " +
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

        {timelapseActive && config && tl.bounds && (
          <div className="absolute bottom-3 left-1/2 z-[600] w-[min(560px,calc(100%-180px))] -translate-x-1/2">
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
