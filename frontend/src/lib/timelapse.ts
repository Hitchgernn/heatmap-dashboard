/**
 * Timelapse frame math: split a historical range into fixed-step frames.
 *
 * Pure helpers only — fetching and playback live in hooks/useTimelapse.ts.
 * The backend serves any absolute slice via from/to, so frames are plain
 * time arithmetic on unix-ms epochs.
 */

export type TimelapseStep = "5m" | "10m" | "15m" | "30m" | "1h";

export const STEPS: TimelapseStep[] = ["5m", "10m", "15m", "30m", "1h"];

export const STEP_MS: Record<TimelapseStep, number> = {
  "5m": 5 * 60_000,
  "10m": 10 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
};

/** Hard cap on slider frames (one full day at 5m). */
export const MAX_FRAMES = 288;

/** Mirror the backend's 90-day custom-range cap (parseQuery.ts). */
export const MAX_SPAN_MS = 90 * 24 * 60 * 60 * 1000;

/** Historical range to replay, unix ms. */
export interface TimelapseRange {
  fromMs: number;
  toMs: number;
}

export type TimelapseRangeError = "invalidRange" | "spanTooLong" | "tooManyFrames";

export function frameCount(range: TimelapseRange, step: TimelapseStep): number {
  return Math.ceil((range.toMs - range.fromMs) / STEP_MS[step]);
}

/** Validate a candidate range + step; null when ok. */
export function validateRange(
  range: TimelapseRange,
  step: TimelapseStep
): TimelapseRangeError | null {
  if (!Number.isFinite(range.fromMs) || !Number.isFinite(range.toMs) || range.fromMs >= range.toMs)
    return "invalidRange";
  if (range.toMs - range.fromMs > MAX_SPAN_MS) return "spanTooLong";
  if (frameCount(range, step) > MAX_FRAMES) return "tooManyFrames";
  return null;
}

/** Bounds of frame `index`: [from + i*step, min(from + (i+1)*step, to)). */
export function frameBounds(
  range: TimelapseRange,
  step: TimelapseStep,
  index: number
): TimelapseRange {
  const ms = STEP_MS[step];
  return {
    fromMs: range.fromMs + index * ms,
    toMs: Math.min(range.fromMs + (index + 1) * ms, range.toMs),
  };
}

/** Whole local day for a yyyy-mm-dd date-input value. */
export function dayRange(dateValue: string): TimelapseRange {
  const fromMs = new Date(`${dateValue}T00:00:00`).getTime(); // local midnight
  return { fromMs, toMs: fromMs + 24 * 60 * 60 * 1000 };
}

/** "10:05" local time for the slider label. */
export function formatTime(msEpoch: number): string {
  return new Date(msEpoch).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Local date string, shown when the range spans multiple days. */
export function formatDate(msEpoch: number, locale?: string): string {
  return new Date(msEpoch).toLocaleDateString(locale);
}
