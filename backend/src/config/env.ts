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

  /**
   * Hyperbase connection for the LOCATION project (mobile app's
   * `coordinate data` collection; used when REPOSITORY_DRIVER=hyperbase).
   */
  hyperbase: {
    baseUrl: process.env.HYPERBASE_BASE_URL || "",
    projectId: process.env.HYPERBASE_PROJECT_ID || "",
    collectionId: process.env.HYPERBASE_LOCATION_COLLECTION_ID || "",
    tokenId: process.env.HYPERBASE_TOKEN_ID || "",
    tokenSecret: process.env.HYPERBASE_TOKEN_SECRET || "",
    pageSize: num(process.env.HYPERBASE_PAGE_SIZE, 500),
    timeoutMs: num(process.env.HYPERBASE_TIMEOUT_MS, 5000),
  },

  /**
   * Hyperbase connection for a SEPARATE MOCK collection — distinct from the
   * mobile app's real `coordinate data` collection. When
   * HYPERBASE_MOCK_COLLECTION_ID is set (and REPOSITORY_DRIVER=hyperbase), the
   * mock generator writes here instead of being rejected, and reads with
   * source=mock are routed to this collection so generated data can be observed
   * (e.g. DBSCAN clustering) without touching real mobile-app data. Each var
   * overrides its location counterpart and falls back to it when unset, mirroring
   * the hyperbaseAuth pattern (a different project needs its own token).
   */
  hyperbaseMock: {
    baseUrl: process.env.HYPERBASE_MOCK_BASE_URL || process.env.HYPERBASE_BASE_URL || "",
    projectId: process.env.HYPERBASE_MOCK_PROJECT_ID || process.env.HYPERBASE_PROJECT_ID || "",
    collectionId: process.env.HYPERBASE_MOCK_COLLECTION_ID || "",
    tokenId: process.env.HYPERBASE_MOCK_TOKEN_ID || process.env.HYPERBASE_TOKEN_ID || "",
    tokenSecret:
      process.env.HYPERBASE_MOCK_TOKEN_SECRET || process.env.HYPERBASE_TOKEN_SECRET || "",
    pageSize: num(process.env.HYPERBASE_PAGE_SIZE, 500),
    timeoutMs: num(process.env.HYPERBASE_TIMEOUT_MS, 5000),
  },

  /** True when a separate Hyperbase mock collection is configured. */
  get mockCollectionEnabled(): boolean {
    return Boolean(process.env.HYPERBASE_MOCK_COLLECTION_ID);
  },

  /**
   * Hyperbase connection for the AUTH project (admin users collection).
   * The auth collection may live in a different Hyperbase project than the
   * location data — each HYPERBASE_AUTH_* var overrides its location
   * counterpart and falls back to it when unset, so a single-project setup
   * needs no extra configuration. Note: Hyperbase tokens are scoped to a
   * project, so a different HYPERBASE_AUTH_PROJECT_ID requires its own
   * HYPERBASE_AUTH_TOKEN_ID / HYPERBASE_AUTH_TOKEN_SECRET.
   */
  hyperbaseAuth: {
    baseUrl: process.env.HYPERBASE_AUTH_BASE_URL || process.env.HYPERBASE_BASE_URL || "",
    projectId: process.env.HYPERBASE_AUTH_PROJECT_ID || process.env.HYPERBASE_PROJECT_ID || "",
    tokenId: process.env.HYPERBASE_AUTH_TOKEN_ID || process.env.HYPERBASE_TOKEN_ID || "",
    tokenSecret:
      process.env.HYPERBASE_AUTH_TOKEN_SECRET || process.env.HYPERBASE_TOKEN_SECRET || "",
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
    /**
     * Send the session cookie cross-site (frontend served from another origin,
     * e.g. Vercel). Switches SameSite from "strict" to "none", which browsers
     * only honour together with Secure — so this requires HTTPS.
     */
    crossSiteCookie: process.env.CROSS_SITE_COOKIE === "true",
    /**
     * Explicit override for the cookie's Secure flag. Unset means "derive it"
     * (production or cross-site). Set it to "false" to serve over plain HTTP
     * without turning the whole app out of production mode — browsers discard
     * Secure cookies on http://, which presents as a successful login followed
     * by "Authentication required" on every later request.
     */
    cookieSecure:
      process.env.COOKIE_SECURE === undefined || process.env.COOKIE_SECURE === ""
        ? undefined
        : process.env.COOKIE_SECURE === "true",
  },

  /**
   * PostgreSQL connection for admin auth. Auth is self-hosted in Postgres
   * (NOT Hyperbase) — location logs stay in Hyperbase, auth lives here. Prefer
   * DATABASE_URL; discrete PG* vars are the fallback.
   */
  database: {
    url: process.env.DATABASE_URL || "",
    host: process.env.PGHOST || "localhost",
    port: num(process.env.PGPORT, 5432),
    user: process.env.PGUSER || "borobudur",
    password: process.env.PGPASSWORD || "",
    name: process.env.PGDATABASE || "borobudur_auth",
  },

  /** JSON Web Token settings for admin sessions (we sign our own tokens now). */
  jwt: {
    secret: process.env.JWT_SECRET || "dev-jwt-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },

  /** Whether the app is running in production. */
  isProduction: process.env.NODE_ENV === "production",

  /**
   * Origins allowed to make credentialed (cookie-bearing) requests, as a
   * comma-separated list. Empty reflects whichever origin asks, which is fine
   * for local development but must not be left empty on a public deployment.
   */
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  /** Machine learning module settings. */
  ml: {
    /** Path to precomputed DBSCAN hotspot output. Empty → service default. */
    hotspotsPath: process.env.ML_HOTSPOTS_PATH || "",
  },
};
