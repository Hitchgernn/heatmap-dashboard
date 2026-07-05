/**
 * Centralized environment configuration.
 * Reads from process.env with sensible defaults for local development.
 *
 * dotenv is loaded here, the single module that touches process.env, so the
 * backend/.env file is applied before any value below is read. Every other
 * module imports `env` from here, guaranteeing this runs first.
 */

import "dotenv/config";

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

  /** Auth settings for dashboard admin users. */
  auth: {
    /** Hyperbase collection where admin user records are stored. */
    adminCollectionId: process.env.HYPERBASE_AUTH_COLLECTION_ID || "",
    /** Shared secret required in the signup body to create admin accounts. */
    registrationSecret: process.env.ADMIN_REGISTRATION_SECRET || "",
    /** Secret used to sign the session cookie. */
    cookieSecret: process.env.COOKIE_SECRET || "dev-cookie-secret-change-me",
    /** Cookie name for the admin session JWT. */
    cookieName: "borobudur_session",
    /** Cookie max-age in milliseconds (default 24h). */
    cookieMaxAgeMs: num(process.env.COOKIE_MAX_AGE_MS, 86_400_000),
  },

  /** Whether the app is running in production. */
  isProduction: process.env.NODE_ENV === "production",

  /** Machine learning module settings. */
  ml: {
    /** Path to precomputed DBSCAN hotspot output. Empty → service default. */
    hotspotsPath: process.env.ML_HOTSPOTS_PATH || "",
  },
};
