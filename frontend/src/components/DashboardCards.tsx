import type { DashboardSummary } from "../types/heatmap";

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
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent }} aria-hidden="true" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      {skeleton ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-gray-100" />
      ) : (
        <p
          className={"mt-1 truncate text-3xl font-bold text-gray-900 " + (tabular ? "tabular-nums" : "")}
          title={value}
        >
          {value}
        </p>
      )}
      {hint && !skeleton && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/**
 * Summary cards (stacked, right column of the Dashboard): active visitors,
 * total points, most crowded area. Uses the existing summary API data.
 */
export default function DashboardCards({ summary, loading, areaCount }: DashboardCardsProps) {
  const firstLoad = loading && !summary;
  const areaHint =
    areaCount && areaCount > 0 ? `Showing ${areaCount} ${areaCount === 1 ? "area" : "areas"}` : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
      <Card
        label="Estimated Active Visitors"
        value={summary ? summary.estimated_active_visitors.toLocaleString() : "—"}
        accent="#16a34a"
        hint={areaHint}
        skeleton={firstLoad}
        tabular
      />
      <Card
        label="Total Location Points"
        value={summary ? summary.total_location_points.toLocaleString() : "—"}
        accent="#111827"
        hint="Updated live"
        skeleton={firstLoad}
        tabular
      />
      <Card
        label="Most Crowded Area"
        value={summary ? summary.most_crowded_area : "—"}
        accent="#dc2626"
        hint="High density"
        skeleton={firstLoad}
      />
    </div>
  );
}
