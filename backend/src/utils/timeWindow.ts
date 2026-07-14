/**
 * Resolves a LocationQuery into an absolute [from, to] time range.
 *
 * Rules:
 *  - If both `from` and `to` are provided, use that custom range.
 *  - Otherwise resolve the `window` preset relative to now (default 15m).
 */

import type { LocationQuery, TimeWindowPreset } from "../types/location";

export interface TimeRange {
  from: Date;
  to: Date;
  /** Human-readable label describing the resolved window. */
  label: string;
}

const PRESET_MS: Record<TimeWindowPreset, number> = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  today: 24 * 60 * 60 * 1000, // handled specially below
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function resolveTimeRange(query: LocationQuery, now: Date = new Date()): TimeRange {
  if (query.from && query.to) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    return { from, to, label: `${query.from}..${query.to}` };
  }

  const preset: TimeWindowPreset = query.window ?? "15m";

  if (preset === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from, to: now, label: "today" };
  }

  const from = new Date(now.getTime() - PRESET_MS[preset]);
  return { from, to: now, label: preset };
}

/** Returns true when the timestamp falls within [range.from, range.to]. */
export function isWithinRange(timestamp: string, range: TimeRange): boolean {
  const t = Date.parse(timestamp);
  if (!Number.isFinite(t)) return false;
  return t >= range.from.getTime() && t <= range.to.getTime();
}
