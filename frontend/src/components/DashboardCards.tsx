import type { DashboardSummary } from "../types/heatmap";
import { useLanguage } from "../context/language";

interface DashboardCardsProps {
  summary: DashboardSummary | null;
  loading: boolean;
  /** Number of hotspots currently loaded, for the "showing N areas" hint. */
  areaCount?: number;
}

interface CardProps {
  label: string;
  value: string;
  /** Left accent bar color. */
  accent: string;
  /** Secondary line under the value. */
  hint?: string;
  skeleton?: boolean;
  tabular?: boolean;
}

function Card({ label, value, accent, hint, skeleton, tabular }: CardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent }} aria-hidden="true" />
      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      {skeleton ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      ) : (
        <p
          className={
            "mt-1 truncate text-3xl text-gray-900 dark:text-white " +
            (tabular ? "font-mono font-semibold tabular-nums" : "font-display")
          }
          title={value}
        >
          {value}
        </p>
      )}
      {hint && !skeleton && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * Summary cards (top row of the Dashboard): active visitors, total points,
 * most crowded area. Uses the existing summary API data.
 */
export default function DashboardCards({ summary, loading, areaCount }: DashboardCardsProps) {
  const { t } = useLanguage();
  const firstLoad = loading && !summary;
  const areaHint =
    areaCount && areaCount > 0
      ? areaCount === 1
        ? t("cards.showingAreaOne", { count: areaCount })
        : t("cards.showingAreaMany", { count: areaCount })
      : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card
        label={t("cards.activeVisitors")}
        value={summary ? summary.estimated_active_visitors.toLocaleString() : "—"}
        accent="#16a34a"
        hint={areaHint}
        skeleton={firstLoad}
        tabular
      />
      <Card
        label={t("cards.totalPoints")}
        value={summary ? summary.total_location_points.toLocaleString() : "—"}
        accent="#111827"
        hint={t("cards.updatedLive")}
        skeleton={firstLoad}
        tabular
      />
      <Card
        label={t("cards.mostCrowded")}
        value={summary ? summary.most_crowded_area : "—"}
        accent="#dc2626"
        hint={t("cards.highDensity")}
        skeleton={firstLoad}
      />
    </div>
  );
}
