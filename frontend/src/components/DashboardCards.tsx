import type { DashboardSummary } from "../types/heatmap";

interface DashboardCardsProps {
  summary: DashboardSummary | null;
  loading: boolean;
}

interface CardProps {
  label: string;
  value: string;
}

function Card({ label, value }: CardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-800">{value}</p>
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
  const placeholder = loading && !summary ? "…" : "—";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        label="Active Visitors"
        value={summary ? String(summary.estimated_active_visitors) : placeholder}
      />
      <Card
        label="Total Points"
        value={summary ? String(summary.total_location_points) : placeholder}
      />
      <Card
        label="Most Crowded Area"
        value={summary ? summary.most_crowded_area : placeholder}
      />
      <Card
        label="Last Updated"
        value={summary ? formatTimestamp(summary.last_updated) : placeholder}
      />
    </div>
  );
}
