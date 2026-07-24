import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Hotspot } from "../types/hotspot";
import { hotspotTier, maxPoints, TIER_META, type DensityTier } from "../lib/hotspots";
import { useLanguage } from "../context/language";
import { useTheme } from "../context/theme";

interface DensityDonutProps {
  hotspots: Hotspot[];
  loading: boolean;
}

const TIER_ORDER: DensityTier[] = ["high", "medium", "low"];

/**
 * Dashboard donut: how the total visitor points split across density tiers
 * (High / Medium / Low). A composition view that complements the per-area
 * magnitude bars beside it, using the same tier colors from lib/hotspots.ts.
 * Fed from the already-fetched hotspots — no extra request.
 */
export default function DensityDonut({ hotspots, loading }: DensityDonutProps) {
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const { data, total } = useMemo(() => {
    const max = maxPoints(hotspots);
    const sums: Record<DensityTier, number> = { high: 0, medium: 0, low: 0 };
    for (const h of hotspots) sums[hotspotTier(h.total_points, max)] += h.total_points;
    const total = sums.high + sums.medium + sums.low;
    const data = TIER_ORDER.map((tier) => ({
      tier,
      label: t(TIER_META[tier].labelKey),
      value: sums[tier],
      color: TIER_META[tier].color,
      pct: total > 0 ? Math.round((sums[tier] / total) * 100) : 0,
    })).filter((d) => d.value > 0);
    return { data, total };
  }, [hotspots, t]);

  const empty = !loading && total === 0;

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <header className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
        <h2 className="font-display text-lg text-gray-900 dark:text-white">{t("chart.densityTitle")}</h2>
      </header>

      <div className="px-5 py-4">
        {loading && hotspots.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">{t("table.loading")}</p>
        ) : empty ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">{t("table.empty")}</p>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={150}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="60%"
                  outerRadius="90%"
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {data.map((d) => (
                    <Cell key={d.tier} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: `1px solid ${dark ? "#374151" : "#e5e7eb"}`,
                    backgroundColor: dark ? "#111827" : "#ffffff",
                    color: dark ? "#f3f4f6" : "#111827",
                  }}
                  formatter={(value, name) => [Number(value).toLocaleString(), name]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend with tier color, label, and share. */}
            <ul className="flex-1 space-y-2 text-sm">
              {data.map((d) => (
                <li key={d.tier} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-700 dark:text-gray-300">{d.label}</span>
                  <span className="ml-auto font-mono tabular-nums text-gray-500 dark:text-gray-400">{d.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
