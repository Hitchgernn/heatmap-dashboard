/**
 * Hyperbase-backed LocationRepository.
 *
 * Reads location data through the Hyperbase REST API only (never ScyllaDB
 * directly), from the mobile app's `coordinate data` collection:
 *
 *   _id (uuid, UUIDv7)  _created_by (uuid)  _updated_at (timestamp)
 *   altitude_m (double) client_id (string)  floor (int)
 *   latitude (double)   longitude (double)
 *
 * There is no custom `timestamp` field — record time is the Hyperbase-managed
 * `_updated_at`, and because `_id` is a UUIDv7 clustering key its high bits
 * encode the same milliseconds, so time-window filters are expressed as `_id`
 * range bounds (efficient clustering-key range, no reliance on filtering
 * built-in columns). Queries paginate backwards by tightening the `_id` upper
 * bound. `altitude_m` and `floor` exist in the collection but are not fetched —
 * the 2D heatmap has no use for them.
 *
 * The collection is written by the mobile app only; inserts through this
 * repository are unsupported and throw (mock data is a memory-driver feature).
 *
 * Privacy: `client_id` is mapped into the internal visitor_key/visitor_id for
 * distinct visitor counting but is never returned to the frontend (the
 * GeoJSON/summary transforms have no field for it).
 */

import { BOROBUDUR_BOUNDS, GRID_SIZE } from "../config/bounds";
import type { LocationLog, LocationQuery } from "../types/location";
import { resolveTimeRange } from "../utils/timeWindow";
import type { GridCount } from "../services/aggregation.service";
import type { LocationRepository } from "./location.repository";
import {
  HyperbaseError,
  HyperbaseHttpClient,
  type HyperbaseClientConfig,
} from "./hyperbase-http-client";

/** Connection settings needed to talk to Hyperbase. */
export interface HyperbaseConfigShape extends HyperbaseClientConfig {
  pageSize: number;
  /**
   * When true, inserts are allowed (real POSTs) instead of throwing. Only the
   * separate mock collection is writable; the real mobile-app collection is not.
   */
  writable?: boolean;
  /**
   * When true, this instance targets the separate MOCK collection: reads are not
   * short-circuited for source=mock, and mapped rows are labeled source "mock".
   */
  mockCollection?: boolean;
  /**
   * When true, getAggregatedCells runs a server-side SQL GROUP BY instead of
   * returning null. Requires the Hyperbase instance to expose /records/query.
   */
  sqlAggregation?: boolean;
}

/** Bounded concurrency for bulk inserts (Hyperbase has no native batch endpoint). */
const INSERT_CONCURRENCY = 10;

/** Fields requested from / returned by the Hyperbase record endpoints. */
const RECORD_FIELDS = [
  "_id",
  "_updated_at",
  "client_id",
  "latitude",
  "longitude",
] as const;

/** Hard ceiling on pages fetched per query, so a bad cursor can't loop forever. */
const MAX_PAGES = 100;

const INSERT_UNSUPPORTED =
  "The Hyperbase coordinate collection is written by the mobile app only — " +
  "inserts through the dashboard backend are not supported (use the memory driver for mock data)";

interface HyperbaseRecord {
  _id?: unknown;
  _updated_at?: unknown;
  client_id?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

interface QueryResponse {
  data?: HyperbaseRecord[];
  pagination?: { count?: number; total?: number };
}

/** One row of the SQL GROUP BY aggregation: grid indices + count. */
interface AggregateRow {
  gy?: unknown;
  gx?: unknown;
  c?: unknown;
}

interface AggregateQueryResponse {
  data?: AggregateRow[];
}

interface RecordFilter {
  field: string;
  op: string;
  value: unknown;
}

export class HyperbaseLocationRepository implements LocationRepository {
  private readonly client: HyperbaseHttpClient;
  private readonly projectId: string;
  private readonly collectionId: string;
  private readonly pageSize: number;
  private readonly writable: boolean;
  private readonly mockCollection: boolean;
  private readonly sqlAggregation: boolean;

  constructor(config: HyperbaseConfigShape) {
    HyperbaseHttpClient.assertConfigured(config);
    this.client = new HyperbaseHttpClient(config);
    this.projectId = config.projectId;
    this.collectionId = config.collectionId;
    // Clamp page size into a sane bounded range.
    this.pageSize = Math.min(Math.max(Math.floor(config.pageSize) || 500, 1), 1000);
    this.writable = config.writable ?? false;
    this.mockCollection = config.mockCollection ?? false;
    this.sqlAggregation = config.sqlAggregation ?? false;
  }

  private get recordsPath(): string {
    return `/api/rest/project/${this.projectId}/collection/${this.collectionId}/records`;
  }

  private get recordPath(): string {
    return `/api/rest/project/${this.projectId}/collection/${this.collectionId}/record`;
  }

  async getLocations(params: LocationQuery): Promise<LocationLog[]> {
    const source = params.source ?? "all";
    // The real coordinate collection holds mobile-app data only; a mock-only
    // query can never match, so skip the round trip. The separate mock
    // collection is exempt — it holds only mock rows.
    if (!this.mockCollection && source === "mock") return [];

    const range = resolveTimeRange(params);
    const lowerBound = uuidV7Bound(range.from);
    const upperBound = uuidV7Bound(range.to);

    const results: LocationLog[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      // Time window as a UUIDv7 `_id` range. Paginating backwards tightens the
      // upper bound instead of adding a second `<` restriction on `_id`, which
      // ScyllaDB would reject.
      const children: RecordFilter[] = [
        { field: "_id", op: ">=", value: lowerBound },
        { field: "_id", op: "<", value: cursor ?? upperBound },
      ];

      const body = {
        fields: [...RECORD_FIELDS],
        filters: [{ op: "AND", children }],
        limit: this.pageSize,
      };

      const res = await this.client.authedRequest<QueryResponse>(this.recordsPath, "POST", body);
      const records = Array.isArray(res.data) ? res.data : [];
      if (records.length === 0) break;

      let lastId: string | null = null;
      for (const record of records) {
        if (typeof record._id === "string") lastId = record._id;
        const mapped = mapRecord(record, this.mockCollection ? "mock" : "mobile_app");
        if (mapped) results.push(mapped);
      }

      // Stop when the last page is short, or if we couldn't advance the cursor.
      if (records.length < this.pageSize || lastId === null) break;
      cursor = lastId;
    }

    return results;
  }

  /**
   * Server-side grid aggregation via Hyperbase SQL (`POST /records/query`),
   * returning the same per-cell counts `aggregateToGrid` would compute in Node
   * without shipping raw rows. Returns null when SQL aggregation is disabled, so
   * the caller falls back. Throws on transport/query error so the caller can
   * likewise fall back rather than serve an empty heatmap.
   */
  async getAggregatedCells(params: LocationQuery): Promise<GridCount[] | null> {
    if (!this.sqlAggregation) return null;

    const source = params.source ?? "all";
    // Same short-circuit as getLocations: the real collection has no mock rows.
    if (!this.mockCollection && source === "mock") return [];

    const range = resolveTimeRange(params);
    const lowerBound = uuidV7Bound(range.from);
    const upperBound = uuidV7Bound(range.to);
    const b = BOROBUDUR_BOUNDS;

    // ROUND (not CAST): Hyperbase CAST-to-int happens to round, but that is
    // undocumented, so make the rounding explicit. The lat/lng bounds replicate
    // cleanLocations' bounds filtering — required for parity with the Node path,
    // which drops out-of-bounds points before snapping.
    const query =
      `SELECT ROUND(latitude / ${GRID_SIZE}) AS gy, ` +
      `ROUND(longitude / ${GRID_SIZE}) AS gx, COUNT(*) AS c ` +
      `FROM 'data' WHERE _id >= '${lowerBound}' AND _id < '${upperBound}' ` +
      `AND latitude >= ${b.minLat} AND latitude <= ${b.maxLat} ` +
      `AND longitude >= ${b.minLng} AND longitude <= ${b.maxLng} ` +
      `GROUP BY gy, gx`;

    const res = await this.client.authedRequest<AggregateQueryResponse>(
      `${this.recordsPath}/query`,
      "POST",
      { query }
    );

    const rows = Array.isArray(res.data) ? res.data : [];
    const counts: GridCount[] = [];
    for (const row of rows) {
      const gy = Number(row.gy);
      const gx = Number(row.gx);
      const count = Number(row.c);
      if (!Number.isFinite(gy) || !Number.isFinite(gx) || !Number.isFinite(count)) continue;
      // ROUND returns a float (e.g. -77674.0); snap to the integer grid index.
      counts.push({ gy: Math.round(gy), gx: Math.round(gx), count });
    }
    return counts;
  }

  async insertLocation(location: LocationLog): Promise<void> {
    if (!this.writable) throw new HyperbaseError(INSERT_UNSUPPORTED);
    await this.client.authedRequest(this.recordPath, "POST", toRecordBody(location));
  }

  async insertManyLocations(locations: LocationLog[]): Promise<void> {
    if (!this.writable) throw new HyperbaseError(INSERT_UNSUPPORTED);
    // Hyperbase exposes single-record insert only; fan out with bounded
    // concurrency so a large batch can't open thousands of sockets at once.
    for (let i = 0; i < locations.length; i += INSERT_CONCURRENCY) {
      const chunk = locations.slice(i, i + INSERT_CONCURRENCY);
      await Promise.all(
        chunk.map((loc) => this.client.authedRequest(this.recordPath, "POST", toRecordBody(loc)))
      );
    }
  }
}

/**
 * Map an internal LocationLog to a Hyperbase record body.
 * Only the dashboard-relevant fields are written; Hyperbase sets `_id` (UUIDv7)
 * and `_updated_at` itself, so mock rows are timestamped at insert time (the
 * backdated LocationLog.timestamp is not persisted — fine for spatial
 * clustering observation within the current window).
 *
 * `source` is required (non-nullable) by the mock collection's schema — omitting
 * it makes Hyperbase reject the insert with 400 "Value for 'source' is required".
 * Only the mock collection is ever written to (the mobile-app collection throws
 * before reaching here), so sending it unconditionally is safe.
 */
function toRecordBody(location: LocationLog): Record<string, unknown> {
  return {
    client_id: location.visitor_id,
    latitude: location.latitude,
    longitude: location.longitude,
    source: location.source,
  };
}

/**
 * Synthesize a UUIDv7 boundary value for a point in time: the 48-bit unix
 * millisecond timestamp in the high bits, version/variant bits set so it
 * compares within the same version class as real UUIDv7 ids, and zeroed
 * random bits so it sorts before every real id generated in that millisecond.
 * Usable as an inclusive lower / exclusive upper `_id` range bound.
 */
function uuidV7Bound(date: Date): string {
  const ms = Math.max(date.getTime(), 0);
  const hex = ms.toString(16).padStart(12, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7000-8000-000000000000`;
}

/**
 * Map a Hyperbase `coordinate data` record into an internal LocationLog.
 * Returns null for records with missing/invalid fields so a single bad row
 * can't poison aggregation. Bounds filtering is intentionally left to the
 * cleansing step downstream.
 */
function mapRecord(
  record: HyperbaseRecord,
  source: "mobile_app" | "mock"
): LocationLog | null {
  const { _id, _updated_at, client_id, latitude, longitude } = record;

  if (typeof _id !== "string" || _id.length === 0) return null;
  if (typeof _updated_at !== "string" || !Number.isFinite(Date.parse(_updated_at))) return null;
  if (typeof latitude !== "number" || !Number.isFinite(latitude)) return null;
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) return null;

  const key = typeof client_id === "string" && client_id.length > 0 ? client_id : undefined;

  return {
    id_data: _id,
    timestamp: _updated_at,
    // Mirror the pseudonymous client id into visitor_id so existing internal
    // counting (which reads visitor_id) keeps working; both stay internal-only.
    visitor_id: key ?? _id,
    visitor_key: key,
    latitude,
    longitude,
    // Real collection = mobile app; the separate mock collection = mock.
    source,
  };
}
