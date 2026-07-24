/**
 * Live hotspot detection.
 *
 * Cleans + bounds-filters the window's location logs (same pipeline as the
 * heatmap), runs DBSCAN, and reduces each cluster to an aggregate Hotspot —
 * centroid, point count, extent radius, named area, and a density tier relative
 * to the busiest cluster. Aggregate only: no visitor_id ever leaves here.
 */

import { nearestAreaName } from "../config/areas";
import type { DensityLevel, Hotspot, LocationLog } from "../types/location";
import { cleanLocations } from "../utils/validateLocation";
import { haversineMeters } from "../utils/geo";
import { dbscan, NOISE } from "./dbscan.service";

export interface DetectParams {
  epsM: number;
  minSamples: number;
}

/**
 * A clustered point for the scatter view. Position + density tier only — no
 * visitor_id, no timestamp, no ordering (not a trajectory). `tier` is null for
 * noise points. Coordinates are plain lat/lng.
 */
export interface ClusterPoint {
  lat: number;
  lng: number;
  tier: DensityLevel | null;
}

export interface DetectionResult {
  hotspots: Hotspot[];
  points: ClusterPoint[];
}

/** Cap on scatter points returned, to bound payload size on busy windows. */
const MAX_POINTS = 4000;

/** Tier a cluster relative to the biggest one (same thresholds as the frontend). */
function densityFromRatio(ratio: number): DensityLevel {
  if (ratio >= 0.66) return "high";
  if (ratio >= 0.33) return "medium";
  return "low";
}

export function detectHotspots(
  locations: LocationLog[],
  { epsM, minSamples }: DetectParams
): DetectionResult {
  const valid = cleanLocations(locations);
  const labels = dbscan(valid, epsM, minSamples);

  // Group member points by cluster label (skip noise).
  const groups = new Map<number, LocationLog[]>();
  labels.forEach((label, i) => {
    if (label === NOISE) return;
    const bucket = groups.get(label);
    if (bucket) bucket.push(valid[i]);
    else groups.set(label, [valid[i]]);
  });

  const totalClustered = Array.from(groups.values()).reduce((s, m) => s + m.length, 0);

  // Tier per raw dbscan label (for coloring the scatter points).
  const maxLabelCount = Math.max(0, ...Array.from(groups.values(), (m) => m.length));
  const tierByLabel = new Map<number, DensityLevel>();
  for (const [label, members] of groups) {
    tierByLabel.set(label, densityFromRatio(maxLabelCount > 0 ? members.length / maxLabelCount : 0));
  }

  // Scatter points: position + tier only (null tier = noise), capped + downsampled.
  const stride = Math.max(1, Math.ceil(valid.length / MAX_POINTS));
  const points: ClusterPoint[] = [];
  for (let i = 0; i < valid.length; i += stride) {
    const label = labels[i];
    points.push({
      lat: valid[i].latitude,
      lng: valid[i].longitude,
      tier: label === NOISE ? null : tierByLabel.get(label) ?? null,
    });
  }

  // Reduce each cluster to aggregates.
  const clusters = Array.from(groups.values()).map((members) => {
    const count = members.length;
    const centerLat = members.reduce((s, m) => s + m.latitude, 0) / count;
    const centerLng = members.reduce((s, m) => s + m.longitude, 0) / count;
    const radiusM = members.reduce(
      (max, m) => Math.max(max, haversineMeters(centerLat, centerLng, m.latitude, m.longitude)),
      0
    );
    return { count, centerLat, centerLng, radiusM };
  });

  // Rank by size; tier relative to the busiest cluster.
  clusters.sort((a, b) => b.count - a.count);
  const maxCount = clusters.length > 0 ? clusters[0].count : 0;

  const hotspots = clusters.map((c, i): Hotspot => {
    const label = nearestAreaName(c.centerLat, c.centerLng);
    return {
      cluster_id: `cluster_${i}`,
      center_lat: Number(c.centerLat.toFixed(7)),
      center_lng: Number(c.centerLng.toFixed(7)),
      total_points: c.count,
      label,
      density_level: densityFromRatio(maxCount > 0 ? c.count / maxCount : 0),
      radius_m: Math.round(c.radiusM),
      share: totalClustered > 0 ? Number((c.count / totalClustered).toFixed(4)) : 0,
    };
  });

  return { hotspots, points };
}
