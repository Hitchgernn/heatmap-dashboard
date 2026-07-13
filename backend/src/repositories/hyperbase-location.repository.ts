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

import type { LocationLog, LocationQuery } from "../types/location";
import { resolveTimeRange } from "../utils/timeWindow";
import type { LocationRepository } from "./location.repository";
import {
  HyperbaseError,
  HyperbaseHttpClient,
  type HyperbaseClientConfig,
} from "./hyperbase-http-client";

/** Connection settings needed to talk to Hyperbase. */
export interface HyperbaseConfigShape extends HyperbaseClientConfig {
  pageSize: number;
}

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

  constructor(config: HyperbaseConfigShape) {
    HyperbaseHttpClient.assertConfigured(config);
    this.client = new HyperbaseHttpClient(config);
    this.projectId = config.projectId;
    this.collectionId = config.collectionId;
    // Clamp page size into a sane bounded range.
    this.pageSize = Math.min(Math.max(Math.floor(config.pageSize) || 500, 1), 1000);
  }

  private get recordsPath(): string {
    return `/api/rest/project/${this.projectId}/collection/${this.collectionId}/records`;
  }

  async getLocations(params: LocationQuery): Promise<LocationLog[]> {
    const source = params.source ?? "all";
    // The coordinate collection holds mobile-app data only; a mock-only query
    // can never match, so skip the round trip.
    if (source === "mock") return [];

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
        const mapped = mapRecord(record);
        if (mapped) results.push(mapped);
      }

      // Stop when the last page is short, or if we couldn't advance the cursor.
      if (records.length < this.pageSize || lastId === null) break;
      cursor = lastId;
    }

    return results;
  }

  async insertLocation(_location: LocationLog): Promise<void> {
    throw new HyperbaseError(INSERT_UNSUPPORTED);
  }

  async insertManyLocations(_locations: LocationLog[]): Promise<void> {
    throw new HyperbaseError(INSERT_UNSUPPORTED);
  }
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
function mapRecord(record: HyperbaseRecord): LocationLog | null {
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
    // Everything in the real collection comes from the mobile app.
    source: "mobile_app",
  };
}
