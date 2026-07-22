/**
 * Idempotent schema initializer for the admin auth database.
 *
 * Run once against a fresh Postgres: `npm run db:init`. Safe to re-run — the
 * schema uses IF NOT EXISTS throughout.
 */

import { readFileSync } from "fs";
import path from "path";
import { pool } from "./pool";

export async function ensureSchema(): Promise<void> {
  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
}

if (require.main === module) {
  ensureSchema()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("[db] schema ensured");
      return pool.end();
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[db] schema init failed:", err);
      process.exit(1);
    });
}
