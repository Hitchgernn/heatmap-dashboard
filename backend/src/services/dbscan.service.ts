/**
 * DBSCAN clustering (ported from ml/notebooks/dbscan_exploration.ipynb).
 *
 * Density-based spatial clustering with the haversine metric, so `epsM` is a
 * real ground distance in metres. No training, no dependency — the same
 * region-query expansion scikit-learn's DBSCAN performs. Returns one integer
 * label per input point: -1 = noise, 0..n = cluster id.
 */

import { haversineMeters } from "../utils/geo";

export interface ClusterPoint {
  latitude: number;
  longitude: number;
}

export const NOISE = -1;

/**
 * Cluster points by density. `epsM` is the neighbourhood radius in metres,
 * `minSamples` the minimum neighbour count (including the point itself) to seed
 * a dense region.
 */
export function dbscan(points: ClusterPoint[], epsM: number, minSamples: number): number[] {
  const n = points.length;
  const labels = new Array<number>(n).fill(-2); // -2 = unvisited

  const regionQuery = (i: number): number[] => {
    const neighbours: number[] = [];
    for (let j = 0; j < n; j++) {
      if (
        haversineMeters(
          points[i].latitude,
          points[i].longitude,
          points[j].latitude,
          points[j].longitude
        ) <= epsM
      ) {
        neighbours.push(j);
      }
    }
    return neighbours;
  };

  let clusterId = NOISE;
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue; // already processed

    const neighbours = regionQuery(i);
    if (neighbours.length < minSamples) {
      labels[i] = NOISE;
      continue;
    }

    clusterId++;
    labels[i] = clusterId;

    // Grow the cluster (seed set expands as dense neighbours are found).
    const seeds = [...neighbours];
    for (let k = 0; k < seeds.length; k++) {
      const q = seeds[k];
      if (labels[q] === NOISE) labels[q] = clusterId; // border point
      if (labels[q] !== -2) continue;

      labels[q] = clusterId;
      const qNeighbours = regionQuery(q);
      if (qNeighbours.length >= minSamples) seeds.push(...qNeighbours);
    }
  }

  return labels;
}
