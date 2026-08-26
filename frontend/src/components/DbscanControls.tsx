import { useState } from "react";
import { useLanguage } from "../context/language";

export interface DbscanParams {
  /** Neighbourhood radius in metres. */
  eps: number;
  /** Minimum neighbours to seed a cluster. */
  minSamples: number;
}

interface DbscanControlsProps {
  value: DbscanParams;
  onChange: (next: DbscanParams) => void;
}

// Match the backend clamp bounds (config/dbscan.ts).
const EPS_MIN = 2;
const EPS_MAX = 200;
const MP_MIN = 2;
const MP_MAX = 50;

/**
 * Glass card of DBSCAN tuning sliders (Hotspots page). Adjusting eps /
 * min_samples refetches clusters from the backend, so the user can watch them
 * merge and split — the "observe how clustering works" control.
 *
 * Collapsed to a single bar by default: it sits directly under the time filter,
 * and an always-open panel is what the date picker has to open over.
 */
export default function DbscanControls({ value, onChange }: DbscanControlsProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const header = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      className="tap flex w-full items-center justify-between gap-2 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
    >
      <span className="inline-flex items-center gap-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-gray-500 dark:text-gray-400">
          <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
        </svg>
        <span className="font-display text-base text-gray-900 wall:text-xl dark:text-white">
          {t("dbscan.title")}
        </span>
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={"shrink-0 text-gray-500 transition-transform dark:text-gray-400 " + (open ? "rotate-180" : "")}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );

  if (!open) {
    return (
      <div className="w-fit max-w-[calc(100vw-5rem)] rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
        {header}
      </div>
    );
  }

  return (
    <div className="w-[min(14rem,calc(100vw-5rem))] rounded-lg border border-gray-200 bg-white/95 p-3 shadow-md backdrop-blur wall:w-72 wall:p-4 dark:border-gray-700 dark:bg-gray-900/95">
      <div className="mb-2">{header}</div>

      <div className="mb-3">
        <label className="mb-1 flex items-baseline justify-between text-xs text-gray-600 wall:text-base dark:text-gray-300">
          <span>
            {t("dbscan.eps")} <span className="font-mono text-gray-500 dark:text-gray-400">eps</span>
          </span>
          <b className="font-mono tabular-nums text-gray-900 dark:text-gray-100">{value.eps} m</b>
        </label>
        <input
          type="range"
          min={EPS_MIN}
          max={EPS_MAX}
          step={1}
          value={value.eps}
          onChange={(e) => onChange({ ...value, eps: Number(e.target.value) })}
          aria-label={t("dbscan.eps")}
          className="w-full accent-gray-900 dark:accent-white"
        />
      </div>

      <div>
        <label className="mb-1 flex items-baseline justify-between text-xs text-gray-600 wall:text-base dark:text-gray-300">
          <span>
            {t("dbscan.minSamples")}{" "}
            <span className="font-mono text-gray-500 dark:text-gray-400">min_samples</span>
          </span>
          <b className="font-mono tabular-nums text-gray-900 dark:text-gray-100">{value.minSamples}</b>
        </label>
        <input
          type="range"
          min={MP_MIN}
          max={MP_MAX}
          step={1}
          value={value.minSamples}
          onChange={(e) => onChange({ ...value, minSamples: Number(e.target.value) })}
          aria-label={t("dbscan.minSamples")}
          className="w-full accent-gray-900 dark:accent-white"
        />
      </div>
    </div>
  );
}
