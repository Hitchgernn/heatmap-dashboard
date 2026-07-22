/**
 * Authentication service — admin auth backed by PostgreSQL.
 *
 * Auth is self-hosted: passwords are hashed with bcrypt and sessions are our
 * own signed JWTs. This replaced the earlier Hyperbase-proxy implementation;
 * location data still lives in Hyperbase, but admin users live in Postgres
 * (see db/pool.ts, db/schema.sql). The exported surface (signinAdmin,
 * signupAdmin, validateSession, AuthError, AdminUser) is unchanged, so the
 * routes and middleware did not change shape.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { query } from "../db/pool";

const BCRYPT_ROUNDS = 10;

/** Error class for auth failures (carries optional HTTP status). */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Shape of the admin user returned to callers (never includes the hash). */
export interface AdminUser {
  _id: string;
  email: string;
  role: string;
}

/** Row shape from the admins table. */
interface AdminRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
}

/** Session JWT payload we sign and verify. */
interface SessionClaims {
  sub: string;
  email: string;
  role: string;
}

function signToken(user: AdminUser): string {
  const claims: SessionClaims = { sub: user._id, email: user.email, role: user.role };
  return jwt.sign(claims, env.jwt.secret, { expiresIn: env.jwt.expiresIn as jwt.SignOptions["expiresIn"] });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public auth service API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sign in an admin: verify the bcrypt hash and return a freshly signed session
 * JWT. Throws AuthError(401) on unknown email or bad password (same message for
 * both, so the response can't distinguish them).
 */
export async function signinAdmin(email: string, password: string): Promise<string> {
  const { rows } = await query<AdminRow>(
    "SELECT id, email, password_hash, role FROM admins WHERE email = $1",
    [email.toLowerCase()]
  );
  const row = rows[0];
  if (!row) throw new AuthError("Invalid credentials", 401);

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) throw new AuthError("Invalid credentials", 401);

  return signToken({ _id: row.id, email: row.email, role: row.role });
}

/**
 * Register a new admin: bcrypt-hash the password and insert. The route must
 * validate the registration secret before calling this. Throws AuthError(409)
 * if the email is already registered.
 */
export async function signupAdmin(email: string, password: string): Promise<AdminUser> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const { rows } = await query<AdminRow>(
      `INSERT INTO admins (email, password_hash, role)
       VALUES ($1, $2, 'admin')
       RETURNING id, email, role`,
      [email.toLowerCase(), hash]
    );
    const row = rows[0];
    return { _id: row.id, email: row.email, role: row.role };
  } catch (err) {
    // 23505 = unique_violation (email already exists).
    if ((err as { code?: string })?.code === "23505") {
      throw new AuthError("Email already registered", 409);
    }
    throw err;
  }
}

/**
 * Validate a session JWT: verify the signature/expiry, reload the admin from
 * Postgres (so a deleted or demoted user is rejected immediately), and enforce
 * the admin role. Returns the admin profile and the (still-valid) token.
 */
export async function validateSession(
  token: string
): Promise<{ user: AdminUser; token: string }> {
  let claims: SessionClaims;
  try {
    claims = jwt.verify(token, env.jwt.secret) as SessionClaims;
  } catch {
    throw new AuthError("Invalid or expired session", 401);
  }

  const { rows } = await query<AdminRow>(
    "SELECT id, email, password_hash, role FROM admins WHERE id = $1",
    [claims.sub]
  );
  const row = rows[0];
  if (!row) throw new AuthError("User record not found", 401);

  if (row.role !== "admin") {
    throw new AuthError("Insufficient permissions", 403);
  }

  return { user: { _id: row.id, email: row.email, role: row.role }, token };
}
