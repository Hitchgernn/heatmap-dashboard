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
 */
export default function DbscanControls({ value, onChange }: DbscanControlsProps) {
  const { t } = useLanguage();

  return (
    <div className="w-56 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
      <h3 className="mb-2 font-display text-base text-gray-900 dark:text-white">{t("dbscan.title")}</h3>

      <div className="mb-3">
        <label className="mb-1 flex items-baseline justify-between text-xs text-gray-600 dark:text-gray-300">
          <span>
            {t("dbscan.eps")} <span className="font-mono text-gray-400 dark:text-gray-500">eps</span>
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
        <label className="mb-1 flex items-baseline justify-between text-xs text-gray-600 dark:text-gray-300">
          <span>
            {t("dbscan.minSamples")}{" "}
            <span className="font-mono text-gray-400 dark:text-gray-500">min_samples</span>
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
