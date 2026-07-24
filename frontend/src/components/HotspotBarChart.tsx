import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Hotspot } from "../types/hotspot";
import { hotspotTier, maxPoints, TIER_META } from "../lib/hotspots";
import { useLanguage } from "../context/language";
import { useTheme } from "../context/theme";

interface HotspotBarChartProps {
  hotspots: Hotspot[];
  loading: boolean;
}

/** Cap the number of bars so labels stay legible in the fixed-width panel. */
const MAX_BARS = 8;

/** Truncate long area labels so the vertical axis stays readable. */
function truncate(label: string, max = 22): string {
  return label.length > max ? label.slice(0, max - 1) + "…" : label;
}

/**
 * Dashboard bar chart: visitor points per area, colored by density tier
 * (reuses lib/hotspots.ts so bars agree with the map markers and the table
 * below). Fed from the already-fetched hotspots — no extra request. Sits above
 * the hotspot summary table in the Dashboard's right column.
 */
export default function HotspotBarChart({ hotspots, loading }: HotspotBarChartProps) {
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const max = useMemo(() => maxPoints(hotspots), [hotspots]);
  const data = useMemo(
    () =>
      [...hotspots]
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, MAX_BARS)
        .map((h) => ({
          label: h.label,
          points: h.total_points,
          color: TIER_META[hotspotTier(h.total_points, max)].color,
        })),
    [hotspots, max]
  );

  const axisColor = dark ? "#9ca3af" : "#6b7280"; // gray-400 / gray-500
  const empty = !loading && data.length === 0;

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <header className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
        <h2 className="font-display text-lg text-gray-900 dark:text-white">{t("chart.title")}</h2>
      </header>

      <div className="px-2 py-3">
        {loading && hotspots.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            {t("table.loading")}
          </p>
        ) : empty ? (
          <p className="px-3 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            {t("table.empty")}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(data.length * 44, 130)}>
            <BarChart
              layout="vertical"
              data={data}
              barCategoryGap="28%"
              margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: axisColor }}
                stroke={axisColor}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fontSize: 11, fill: axisColor }}
                tickFormatter={(value: string) => truncate(value)}
                stroke={axisColor}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: `1px solid ${dark ? "#374151" : "#e5e7eb"}`,
                  backgroundColor: dark ? "#111827" : "#ffffff",
                  color: dark ? "#f3f4f6" : "#111827",
                }}
                formatter={(value) => [Number(value).toLocaleString(), t("table.colPoints")]}
              />
              <Bar dataKey="points" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.label} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
