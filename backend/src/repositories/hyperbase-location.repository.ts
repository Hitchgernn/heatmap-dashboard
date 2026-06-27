/**
 * Hyperbase-backed LocationRepository.
 *
 * Reads and writes location logs through the Hyperbase REST API only (never
 * ScyllaDB directly). Queries are always bounded by a time range and a page
 * size, and paginate backwards using the `_id` UUIDv7 clustering key. Bulk
 * inserts run with bounded concurrency rather than an unbounded Promise.all.
 *
 * Privacy: `visitor_key` is mapped into the internal LocationLog for distinct
 * visitor counting but is never returned to the frontend (the GeoJSON/summary
 * transforms have no field for it).
 */

import type { LocationLog, LocationQuery, LocationSource } from "../types/location";
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
  "id_data",
  "timestamp",
  "visitor_key",
  "latitude",
  "longitude",
  "source",
] as const;

/** Hard ceiling on pages fetched per query, so a bad cursor can't loop forever. */
const MAX_PAGES = 100;
/** Concurrent insert requests for bulk insert (doc suggests 10–25). */
const INSERT_CONCURRENCY = 15;

interface HyperbaseRecord {
  _id?: unknown;
  id_data?: unknown;
  timestamp?: unknown;
  visitor_key?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  source?: unknown;
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

  private get recordPath(): string {
    return `/api/rest/project/${this.projectId}/collection/${this.collectionId}/record`;
  }

  async getLocations(params: LocationQuery): Promise<LocationLog[]> {
    const range = resolveTimeRange(params);
    const source = params.source ?? "all";

    // Base AND children: always time-bounded, source filter unless "all".
    const baseChildren: RecordFilter[] = [
      { field: "timestamp", op: ">=", value: range.from.toISOString() },
      { field: "timestamp", op: "<", value: range.to.toISOString() },
    ];
    if (source !== "all") {
      baseChildren.push({ field: "source", op: "=", value: source });
    }

    const results: LocationLog[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      const children = [...baseChildren];
      // Paginate backwards on the _id clustering key (descending order).
      if (cursor !== null) {
        children.push({ field: "_id", op: "<", value: cursor });
      }

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

  async insertLocation(location: LocationLog): Promise<void> {
    await this.client.authedRequest(this.recordPath, "POST", toRecordPayload(location));
  }

  async insertManyLocations(locations: LocationLog[]): Promise<void> {
    // Bounded concurrency: process a sliding window of INSERT_CONCURRENCY
    // requests instead of an unbounded Promise.all over every record.
    let index = 0;
    let failed = 0;
    let firstError: unknown = null;

    const worker = async (): Promise<void> => {
      while (index < locations.length) {
        const current = locations[index++];
        try {
          await this.insertLocation(current);
        } catch (err) {
          failed++;
          if (firstError === null) firstError = err;
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(INSERT_CONCURRENCY, locations.length) },
      () => worker()
    );
    await Promise.all(workers);

    if (failed > 0) {
      const detail = firstError instanceof Error ? firstError.message : "unknown error";
      throw new HyperbaseError(
        `Bulk insert: ${failed}/${locations.length} records failed (first error: ${detail})`
      );
    }
  }
}

const VALID_SOURCES: readonly LocationSource[] = ["mobile_app", "mock"];

/**
 * Map a Hyperbase record into an internal LocationLog. Returns null for records
 * with missing/invalid fields so a single bad row can't poison aggregation.
 * Bounds filtering is intentionally left to the cleansing step downstream.
 */
function mapRecord(record: HyperbaseRecord): LocationLog | null {
  const { id_data, timestamp, visitor_key, latitude, longitude, source } = record;

  if (typeof id_data !== "string" || id_data.length === 0) return null;
  if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) return null;
  if (typeof latitude !== "number" || !Number.isFinite(latitude)) return null;
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) return null;
  if (typeof source !== "string" || !VALID_SOURCES.includes(source as LocationSource)) return null;

  const key = typeof visitor_key === "string" && visitor_key.length > 0 ? visitor_key : undefined;

  return {
    id_data,
    timestamp,
    // Mirror the pseudonymous key into visitor_id so existing internal counting
    // (which reads visitor_id) keeps working; both stay internal-only.
    visitor_id: key ?? id_data,
    visitor_key: key,
    latitude,
    longitude,
    source: source as LocationSource,
  };
}

/** Build the Hyperbase insert payload, preferring visitor_key for the schema. */
function toRecordPayload(location: LocationLog): Record<string, unknown> {
  return {
    id_data: location.id_data,
    timestamp: location.timestamp,
    visitor_key: location.visitor_key ?? location.visitor_id,
    latitude: location.latitude,
    longitude: location.longitude,
    source: location.source,
  };
}
