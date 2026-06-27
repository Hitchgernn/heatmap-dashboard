/**
 * Centralized environment configuration.
 * Reads from process.env with sensible defaults for local development.
 */

export type RepositoryDriver = "memory" | "hyperbase";

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  port: num(process.env.PORT, 3001),

  /** Which LocationRepository implementation to use. */
  repositoryDriver: (process.env.REPOSITORY_DRIVER as RepositoryDriver) || "memory",

  /** When using the memory repository, seed a small sample dataset on boot. */
  seedDevData: (process.env.SEED_DEV_DATA ?? "true").toLowerCase() === "true",

  /** Hyperbase connection settings (used when REPOSITORY_DRIVER=hyperbase). */
  hyperbase: {
    baseUrl: process.env.HYPERBASE_BASE_URL || "",
    projectId: process.env.HYPERBASE_PROJECT_ID || "",
    collectionId: process.env.HYPERBASE_LOCATION_COLLECTION_ID || "",
    tokenId: process.env.HYPERBASE_TOKEN_ID || "",
    tokenSecret: process.env.HYPERBASE_TOKEN_SECRET || "",
    pageSize: num(process.env.HYPERBASE_PAGE_SIZE, 500),
    timeoutMs: num(process.env.HYPERBASE_TIMEOUT_MS, 5000),
  },

  /** Machine learning module settings. */
  ml: {
    /** Path to precomputed DBSCAN hotspot output. Empty → service default. */
    hotspotsPath: process.env.ML_HOTSPOTS_PATH || "",
  },
};
