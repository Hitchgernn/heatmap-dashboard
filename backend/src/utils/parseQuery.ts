/**
 * Shared parsing/validation for the location query params used by the heatmap
 * and dashboard endpoints (window / source / from / to). Keeps that logic in
 * one place instead of duplicating it across routes.
 */

import type { LocationQuery, SourceFilter, TimeWindowPreset } from "../types/location";
import { isValidTimestamp } from "./validateLocation";

const VALID_WINDOWS: TimeWindowPreset[] = ["5m", "15m", "1h", "today"];
const VALID_SOURCES: SourceFilter[] = ["mobile_app", "mock", "all"];

export type ParseResult =
  | { ok: true; value: LocationQuery }
  | { ok: false; code: string; message: string };

export function parseLocationQuery(query: Record<string, unknown>): ParseResult {
  const { window, source, from, to } = query;
  const hasCustomRange = typeof from === "string" && typeof to === "string";

  if (
    !hasCustomRange &&
    window !== undefined &&
    !VALID_WINDOWS.includes(window as TimeWindowPreset)
  ) {
    return {
      ok: false,
      code: "INVALID_TIME_WINDOW",
      message: `window must be one of: ${VALID_WINDOWS.join(", ")}`,
    };
  }

  if (source !== undefined && !VALID_SOURCES.includes(source as SourceFilter)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: `source must be one of: ${VALID_SOURCES.join(", ")}`,
    };
  }

  if (hasCustomRange && (!isValidTimestamp(from) || !isValidTimestamp(to))) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "from and to must be valid ISO timestamps",
    };
  }

  const value: LocationQuery = {
    window: (window as TimeWindowPreset) ?? "15m",
    source: (source as SourceFilter) ?? "all",
    ...(hasCustomRange ? { from: from as string, to: to as string } : {}),
  };

  return { ok: true, value };
}
