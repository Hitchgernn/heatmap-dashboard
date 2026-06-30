/**
 * Shared hotspot density helpers. Hotspots carry only `total_points` (no
 * density_level), so we derive a tier relative to the busiest cluster in the
 * current set. Used by both the map markers and the dashboard table so they
 * always agree on color and label.
 */

import type { Hotspot } from "../types/hotspot";
import type { TranslationKey } from "./i18n";

export type DensityTier = "high" | "medium" | "low";

export interface TierMeta {
  /** i18n key for the density label (High / Medium / Low). */
  labelKey: TranslationKey;
  /** i18n key for the status badge text (Crowded / Moderate / Normal). */
  statusKey: TranslationKey;
  /** Marker / dot fill color. */
  color: string;
  /** Tailwind classes for the status badge (light + dark). */
  badgeClass: string;
}

export const TIER_META: Record<DensityTier, TierMeta> = {
  high: {
    labelKey: "density.high",
    statusKey: "status.crowded",
    color: "#dc2626",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  },
  medium: {
    labelKey: "density.medium",
    statusKey: "status.moderate",
    color: "#f59e0b",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  low: {
    labelKey: "density.low",
    statusKey: "status.normal",
    color: "#16a34a",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
};

/** Tier a hotspot relative to the largest cluster in the set. */
export function hotspotTier(points: number, max: number): DensityTier {
  if (max <= 0) return "low";
  const ratio = points / max;
  if (ratio >= 0.66) return "high";
  if (ratio >= 0.33) return "medium";
  return "low";
}

/** Max `total_points` across a set (0 when empty). */
export function maxPoints(hotspots: Hotspot[]): number {
  return hotspots.reduce((m, h) => Math.max(m, h.total_points), 0);
}
