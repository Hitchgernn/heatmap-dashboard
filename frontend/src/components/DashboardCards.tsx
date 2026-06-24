import type { DashboardSummary } from "../types/heatmap";

interface DashboardCardsProps {
  summary: DashboardSummary | null;
  loading: boolean;
}

interface CardProps {
  label: string;
  value: string;
  /** Show a skeleton bar instead of the value (first load only). */
  skeleton?: boolean;
  /** Use tabular figures so the number doesn't reflow on refresh. */
  tabular?: boolean;
}

function Card({ label, value, skeleton, tabular }: CardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      {skeleton ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-800" />
      ) : (
        <p
          className={
            "mt-1 truncate text-2xl font-semibold text-slate-100 " +
            (tabular ? "tabular-nums" : "")
          }
          title={value}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Summary cards: active visitors, total points, crowded area, last updated. */
export default function DashboardCards({ summary, loading }: DashboardCardsProps) {
  const firstLoad = loading && !summary;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        label="Active Visitors"
        value={summary ? String(summary.estimated_active_visitors) : "—"}
        skeleton={firstLoad}
        tabular
      />
      <Card
        label="Total Points"
        value={summary ? summary.total_location_points.toLocaleString() : "—"}
        skeleton={firstLoad}
        tabular
      />
      <Card
        label="Most Crowded Area"
        value={summary ? summary.most_crowded_area : "—"}
        skeleton={firstLoad}
      />
      <Card
        label="Last Updated"
        value={summary ? formatTimestamp(summary.last_updated) : "—"}
        skeleton={firstLoad}
        tabular
      />
    </div>
  );
}
