/**
 * Maps a normalized weight (0..1) to a density label.
 *
 *   low      weight < 0.33
 *   medium   0.33 <= weight < 0.66
 *   high     weight >= 0.66
 */

import type { DensityLevel } from "../types/location";

export function densityFromWeight(weight: number): DensityLevel {
  if (weight >= 0.66) return "high";
  if (weight >= 0.33) return "medium";
  return "low";
}
