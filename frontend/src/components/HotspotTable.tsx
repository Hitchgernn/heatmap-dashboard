import { useMemo, useState } from "react";
import type { Hotspot } from "../types/hotspot";
import { hotspotTier, maxPoints, TIER_META } from "../lib/hotspots";

interface HotspotTableProps {
  hotspots: Hotspot[];
  loading: boolean;
}

type Filter = "all" | "high";

/**
 * Bottom panel of the Dashboard: a hotspot summary table built from the
 * existing /api/hotspots data. Columns: Area/Hotspot, Density Level, Visitor
 * Points, Status. No action buttons (no dispatch/alerts) per the spec.
 */
export default function HotspotTable({ hotspots, loading }: HotspotTableProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const max = useMemo(() => maxPoints(hotspots), [hotspots]);

  const rows = useMemo(() => {
    const ranked = [...hotspots]
      .map((h) => ({ h, tier: hotspotTier(h.total_points, max) }))
      .sort((a, b) => b.h.total_points - a.h.total_points);
    return filter === "high" ? ranked.filter((r) => r.tier === "high") : ranked;
  }, [hotspots, max, filter]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-gray-900">Hotspot Summary</h2>
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(["all", "high"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={
                "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
                (filter === f ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900")
              }
            >
              {f === "all" ? "All Areas" : "High Density"}
            </button>
          ))}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-2.5">Area / Hotspot</th>
              <th className="px-5 py-2.5">Density Level</th>
              <th className="px-5 py-2.5 text-right">Visitor Points</th>
              <th className="px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && hotspots.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                  Loading hotspots…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                  No hotspots detected in this view.
                </td>
              </tr>
            ) : (
              rows.map(({ h, tier }) => {
                const meta = TIER_META[tier];
                return (
                  <tr key={h.cluster_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{h.label}</p>
                      <p className="text-xs text-gray-400">ID: #{h.cluster_id}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                      {h.total_points.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + meta.badgeClass}>
                        {meta.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
