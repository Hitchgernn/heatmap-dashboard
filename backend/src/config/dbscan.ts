/**
 * DBSCAN hotspot-detection parameters.
 *
 * Defaults mirror the tuned values in ml/notebooks/dbscan_exploration.ipynb
 * (EPS_M / MIN_SAMPLES). Bounds clamp the query-tunable params so a caller can
 * observe clusters merge/split without letting `eps` blow up into one blob or
 * `min_samples` reject everything. Never hardcode these in the service.
 */

/** Neighbourhood radius in metres — two points closer than this are neighbours. */
export const DEFAULT_EPS_M = 8;
export const EPS_M_MIN = 2;
export const EPS_M_MAX = 200;

/** Minimum neighbours to seed a dense cluster; smaller groups become noise. */
export const DEFAULT_MIN_SAMPLES = 5;
export const MIN_SAMPLES_MIN = 2;
export const MIN_SAMPLES_MAX = 50;

/** Clamp a value into [min, max]; returns the fallback when not finite. */
export function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
