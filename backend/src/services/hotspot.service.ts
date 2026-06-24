/**
 * Hotspot service.
 *
 * For MVP the DBSCAN module runs out-of-band and writes its result to a JSON
 * file; this service just reads that file. Each entry is mapped through a
 * field whitelist, which keeps the response shape stable and strips anything
 * unexpected (e.g. an accidental visitor_id) from the ML output.
 */

import fs from "fs";
import path from "path";
import { env } from "../config/env";
import type { Hotspot } from "../types/location";

// Resolves to <project-root>/ml/output/hotspots.json from either src (dev) or
// dist (built) — both sit three levels below the services directory.
const DEFAULT_HOTSPOTS_PATH = path.resolve(__dirname, "../../../ml/output/hotspots.json");

export function getHotspotsPath(): string {
  return env.ml.hotspotsPath || DEFAULT_HOTSPOTS_PATH;
}

function toHotspot(raw: unknown): Hotspot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const center_lat = Number(r.center_lat);
  const center_lng = Number(r.center_lng);
  if (!Number.isFinite(center_lat) || !Number.isFinite(center_lng)) return null;

  const total_points = Number(r.total_points);
  return {
    cluster_id: typeof r.cluster_id === "string" ? r.cluster_id : "",
    center_lat,
    center_lng,
    total_points: Number.isFinite(total_points) ? total_points : 0,
    label: typeof r.label === "string" ? r.label : "",
  };
}

/**
 * Read and normalize hotspots from the precomputed file.
 * Returns [] when the file does not exist yet (ML not run). Throws on malformed
 * JSON so the caller can surface a real error.
 */
export function readHotspots(): Hotspot[] {
  const file = getHotspotsPath();

  if (!fs.existsSync(file)) {
    // eslint-disable-next-line no-console
    console.warn(`[hotspots] no file at ${file} — returning empty list (run ml/hotspot_detection.py)`);
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
  const list = Array.isArray(parsed) ? parsed : (parsed?.hotspots ?? []);
  if (!Array.isArray(list)) return [];

  return list.map(toHotspot).filter((h): h is Hotspot => h !== null);
}
