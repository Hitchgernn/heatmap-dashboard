/**
 * API client for the Borobudur backend.
 *
 * Two response styles from the backend:
 *  - /api/heatmap/aggregate returns raw GeoJSON (no envelope).
 *  - everything else uses { success, data } / { success, error }.
 */

import type { HeatmapFeatureCollection, DashboardSummary, TimeWindow } from "../types/heatmap";
import type { Hotspot } from "../types/hotspot";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export interface HeatmapParams {
  window: TimeWindow;
  source?: string;
}

/**
 * Convert the selected TimeWindow into query params. Presets map to `window=`;
 * custom "last N hours/days" windows compute a fresh from/to pair at call time
 * so every poll re-anchors the range to now (the window rolls forward, same as
 * presets).
 */
function windowParams(window: TimeWindow): Record<string, string | undefined> {
  if (window.kind === "preset") return { window: window.value };
  const unitMs = window.unit === "hours" ? 3_600_000 : 86_400_000;
  const to = new Date();
  const from = new Date(to.getTime() - window.amount * unitMs);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Envelope returned by non-GeoJSON endpoints. */
interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function buildUrl(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, credentials: "include" });
  if (!res.ok) {
    // Try to surface the backend's standard error message.
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as ApiEnvelope<unknown>;
      if (body?.error?.message) detail = body.error.message;
    } catch {
      /* non-JSON error body — keep the status */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

async function fetchData<T>(url: string, signal?: AbortSignal): Promise<T> {
  const body = await fetchJson<ApiEnvelope<T>>(url, signal);
  if (!body.success || body.data === undefined) {
    throw new Error(body.error?.message ?? "Request failed");
  }
  return body.data;
}

export function getAggregatedHeatmap(
  params: HeatmapParams,
  signal?: AbortSignal
): Promise<HeatmapFeatureCollection> {
  const url = buildUrl("/api/heatmap/aggregate", {
    ...windowParams(params.window),
    source: params.source ?? "all",
  });
  // Heatmap endpoint returns raw GeoJSON, not the envelope.
  return fetchJson<HeatmapFeatureCollection>(url, signal);
}

export function getDashboardSummary(
  params: HeatmapParams,
  signal?: AbortSignal
): Promise<DashboardSummary> {
  const url = buildUrl("/api/dashboard/summary", {
    ...windowParams(params.window),
    source: params.source ?? "all",
  });
  return fetchData<DashboardSummary>(url, signal);
}

export function getHotspots(
  params: { source?: string } = {},
  signal?: AbortSignal
): Promise<Hotspot[]> {
  const url = buildUrl("/api/hotspots", { source: params.source ?? "all" });
  return fetchData<{ hotspots: Hotspot[] }>(url, signal).then((d) => d.hotspots);
}

export interface GenerateMockParams {
  visitorCount: number;
  pointsPerVisitor: number;
  source: string;
}

export interface GenerateMockResult {
  inserted: number;
  source: string;
}

/**
 * Generate + insert a clustered batch of mock visitor data via the backend.
 * POST /api/mock/generate returns a bare { success, inserted, source } object
 * (not the { success, data } envelope), so this reads those fields directly.
 */
export async function generateMockData(
  params: GenerateMockParams,
  signal?: AbortSignal
): Promise<GenerateMockResult> {
  const res = await fetch(`${BASE_URL}/api/mock/generate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitor_count: params.visitorCount,
      points_per_visitor: params.pointsPerVisitor,
      source: params.source,
    }),
    signal,
  });

  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; inserted?: number; source?: string; error?: { message?: string } }
    | null;

  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return { inserted: body.inserted ?? 0, source: body.source ?? params.source };
}
