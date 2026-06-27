import { TIER_META } from "../lib/hotspots";

/**
 * Visitor-density legend (discrete High/Medium/Low swatches). Rendered as a
 * floating card over the map. Colors track the heat gradient + hotspot tiers.
 */
export default function DensityLegend() {
  const rows: { label: string; color: string }[] = [
    { label: "High", color: TIER_META.high.color },
    { label: "Medium", color: TIER_META.medium.color },
    { label: "Low", color: TIER_META.low.color },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2.5 text-xs shadow-md backdrop-blur">
      <p className="mb-1.5 font-mono font-semibold uppercase tracking-wider text-gray-500">
        Visitor Density
      </p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-gray-700">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: r.color }}
              aria-hidden="true"
            />
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
