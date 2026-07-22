/**
 * PostgreSQL connection pool (admin auth store).
 *
 * A single shared pg.Pool for the process. Uses DATABASE_URL when set, else the
 * discrete PG* settings from env.database. Location data does NOT flow through
 * here — this is auth only.
 */

import { Pool } from "pg";
import { env } from "../config/env";

export const pool = new Pool(
  env.database.url
    ? { connectionString: env.database.url }
    : {
        host: env.database.host,
        port: env.database.port,
        user: env.database.user,
        password: env.database.password,
        database: env.database.name,
      }
);

/** Convenience typed query helper. */
export function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  return pool.query(text, params) as unknown as Promise<{ rows: T[] }>;
}
