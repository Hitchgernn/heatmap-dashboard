/**
 * Parity + correctness tests for the grid aggregation service.
 *
 * The central guarantee: the Node path (aggregateToGrid, which buckets raw
 * points) and the SQL path (cellsFromCounts, fed per-cell counts the database
 * produced) yield byte-identical cells. These tests lock that in CI so a future
 * change to either side can't silently diverge the two heatmap code paths.
 *
 * Run: node --test --import tsx ./src/services/aggregation.service.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { aggregateToGrid, cellsFromCounts, type GridCount } from "./aggregation.service";
import { BOROBUDUR_BOUNDS, GRID_SIZE } from "../config/bounds";
import type { LocationLog } from "../types/location";

const CENTER_LAT = (BOROBUDUR_BOUNDS.minLat + BOROBUDUR_BOUNDS.maxLat) / 2;
const CENTER_LNG = (BOROBUDUR_BOUNDS.minLng + BOROBUDUR_BOUNDS.maxLng) / 2;

let seq = 0;
function log(latitude: number, longitude: number): LocationLog {
  seq += 1;
  return {
    id_data: `id-${seq}`,
    timestamp: new Date("2026-07-01T00:00:00Z").toISOString(),
    visitor_id: `v-${seq}`,
    latitude,
    longitude,
    source: "mobile_app",
  };
}

/** Reduce cleaned points to the integer grid counts the SQL GROUP BY returns. */
function countsFromLocations(locations: LocationLog[]): GridCount[] {
  const buckets = new Map<string, GridCount>();
  for (const l of locations) {
    const gy = Math.round(l.latitude / GRID_SIZE);
    const gx = Math.round(l.longitude / GRID_SIZE);
    const key = `${gy}_${gx}`;
    const b = buckets.get(key);
    if (b) b.count += 1;
    else buckets.set(key, { gy, gx, count: 1 });
  }
  return [...buckets.values()];
}

test("Node and SQL paths produce identical cells for in-bounds points", () => {
  // Three cells: 3 points, 2 points, 1 point — exercises weight normalization.
  const locations: LocationLog[] = [
    log(CENTER_LAT, CENTER_LNG),
    log(CENTER_LAT + 1e-6, CENTER_LNG - 1e-6), // same grid cell as above
    log(CENTER_LAT + 2e-6, CENTER_LNG), // still same cell (< half a grid step)
    log(CENTER_LAT + GRID_SIZE, CENTER_LNG), // adjacent cell north, 1 point
    log(CENTER_LAT, CENTER_LNG + GRID_SIZE), // adjacent cell east, 1 point
  ];

  const node = aggregateToGrid(locations, "15m").cells;
  const sql = cellsFromCounts(countsFromLocations(locations), "15m");

  const sortKey = (c: { grid_id: string }) => c.grid_id;
  node.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  sql.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  assert.deepEqual(sql, node, "SQL-path cells must equal Node-path cells exactly");
  assert.equal(node.length, 3, "expected three distinct grid cells");
});

test("busiest cell gets weight 1 and high density", () => {
  const locations = [
    log(CENTER_LAT, CENTER_LNG),
    log(CENTER_LAT, CENTER_LNG),
    log(CENTER_LAT, CENTER_LNG),
  ];
  const [cell] = aggregateToGrid(locations, "1h").cells;
  assert.equal(cell.visitor_count, 3);
  assert.equal(cell.weight, 1);
  assert.equal(cell.density_level, "high");
  assert.equal(cell.time_window, "1h");
});

test("out-of-bounds points are dropped by the Node path", () => {
  // The SQL path relies on a bounds WHERE to match this; here we assert the
  // Node side drops them, which is the behaviour that WHERE must replicate.
  const locations = [
    log(CENTER_LAT, CENTER_LNG), // in bounds
    log(-7.767, 110.41), // Yogyakarta — well outside Borobudur bounds
    log(0, 0), // null island
  ];
  const result = aggregateToGrid(locations, "15m");
  assert.equal(result.validPointCount, 1, "only the in-bounds point survives cleaning");
  assert.equal(result.cells.length, 1);
});

test("empty input yields no cells", () => {
  assert.deepEqual(aggregateToGrid([], "15m").cells, []);
  assert.deepEqual(cellsFromCounts([], "15m"), []);
});
