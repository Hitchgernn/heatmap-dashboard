import type { Hotspot } from "../types/hotspot";
import { hotspotTier, maxPoints, TIER_META, type DensityTier } from "../lib/hotspots";
import { useLanguage } from "../context/language";

interface HotspotDetailCardProps {
  hotspot: Hotspot;
  /** All hotspots in the set — needed to derive a tier when the backend omits one. */
  hotspots: Hotspot[];
  onClose: () => void;
}

/**
 * Floating detail card for a selected cluster: area name, density tier, visitor
 * points, share of total, and approximate radius. Aggregate info only. Reuses
 * the density colors from lib/hotspots.ts so it agrees with the map + table.
 */
export default function HotspotDetailCard({ hotspot, hotspots, onClose }: HotspotDetailCardProps) {
  const { t } = useLanguage();
  const max = maxPoints(hotspots);
  const tier: DensityTier = (hotspot.density_level as DensityTier) ?? hotspotTier(hotspot.total_points, max);
  const meta = TIER_META[tier];
  const sharePct = hotspot.share !== undefined ? Math.round(hotspot.share * 100) : null;

  return (
    <div className="w-60 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-display text-lg leading-tight text-gray-900 dark:text-white">{hotspot.label}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <Row label={t("table.colDensity")}>
          <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium " + meta.badgeClass}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
            {t(meta.labelKey)}
          </span>
        </Row>
        <Row label={t("hotspot.points")}>
          <b className="font-mono tabular-nums">{hotspot.total_points.toLocaleString()}</b>
        </Row>
        {sharePct !== null && (
          <Row label={t("hotspot.share")}>
            <b className="font-mono tabular-nums">{sharePct}%</b>
          </Row>
        )}
        {hotspot.radius_m !== undefined && (
          <Row label={t("hotspot.radius")}>
            <b className="font-mono tabular-nums">{hotspot.radius_m.toLocaleString()} m</b>
          </Row>
        )}
        <Row label={t("hotspot.id")}>
          <b className="font-mono text-xs text-gray-500 dark:text-gray-400">#{hotspot.cluster_id}</b>
        </Row>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-gray-100">{children}</span>
    </div>
  );
}
