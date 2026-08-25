import { TIER_META } from "../lib/hotspots";
import { useLanguage } from "../context/language";

/**
 * Visitor-density legend (discrete High/Medium/Low swatches). Rendered as a
 * floating card over the map. Colors track the heat gradient + hotspot tiers.
 */
export default function DensityLegend() {
  const { t } = useLanguage();
  const rows = [
    { key: TIER_META.high.labelKey, color: TIER_META.high.color },
    { key: TIER_META.medium.labelKey, color: TIER_META.medium.color },
    { key: TIER_META.low.labelKey, color: TIER_META.low.color },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2.5 text-xs shadow-md backdrop-blur wall:px-5 wall:py-4 wall:text-base dark:border-gray-700 dark:bg-gray-900/95">
      <p className="mb-1.5 font-mono font-semibold uppercase tracking-wider text-gray-600 wall:mb-2.5 dark:text-gray-400">
        {t("legend.title")}
      </p>
      <ul className="space-y-1 wall:space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-gray-700 wall:gap-3 dark:text-gray-300">
            <span
              className="h-2.5 w-2.5 rounded-sm wall:h-4 wall:w-4"
              style={{ backgroundColor: r.color }}
              aria-hidden="true"
            />
            {t(r.key)}
          </li>
        ))}
      </ul>
    </div>
  );
}
