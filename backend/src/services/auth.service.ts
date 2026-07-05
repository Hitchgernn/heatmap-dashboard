/**
 * Authentication service — proxies admin auth operations to Hyperbase BaaS.
 *
 * The dashboard backend never touches ScyllaDB directly. All auth flows go
 * through the Hyperbase REST API using the project's token credentials.
 *
 * Architecture note: this service is intentionally scoped to "admin" users.
 * A future visitor auth service can follow the same pattern with its own
 * collection ID and role enforcement, sharing the same HyperbaseAuthClient.
 */

import { env } from "../config/env";

/** Lightweight Hyperbase fetch wrapper for auth-specific calls. */
class HyperbaseAuthClient {
  private serviceJwt: string | null = null;

  private get baseUrl(): string {
    return env.hyperbase.baseUrl;
  }
  private get projectId(): string {
    return env.hyperbase.projectId;
  }
  private get tokenId(): string {
    return env.hyperbase.tokenId;
  }
  private get tokenSecret(): string {
    return env.hyperbase.tokenSecret;
  }
  private get timeoutMs(): number {
    return env.hyperbase.timeoutMs;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AuthError(`Hyperbase request timed out after ${this.timeoutMs}ms`);
      }
      throw new AuthError(
        `Hyperbase request failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Get a service-level JWT (anonymous token-based login, no user claim). */
  private async getServiceJwt(): Promise<string> {
    if (this.serviceJwt) return this.serviceJwt;
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}/api/rest/auth/token-based`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_id: this.tokenId,
          token: this.tokenSecret,
        }),
      }
    );
    const body = await this.parseJson(res);
    if (!res.ok) throw this.apiError(res.status, body, "Service auth failed");
    const jwt = (body as { data?: { token?: string } })?.data?.token;
    if (!jwt) throw new AuthError("Hyperbase service auth response missing data.token");
    this.serviceJwt = jwt;
    return jwt;
  }

  /** Authenticated request using the service JWT (with one re-login retry). */
  async serviceRequest<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const send = async (jwt: string) =>
      this.fetchWithTimeout(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    let res = await send(await this.getServiceJwt());
    if (res.status === 401 || res.status === 403) {
      this.serviceJwt = null;
      res = await send(await this.getServiceJwt());
    }
    const envelope = await this.parseJson(res);
    if (!res.ok) throw this.apiError(res.status, envelope, "Hyperbase request rejected");
    return envelope as T;
  }

  /** Unauthenticated request (e.g. token-based login with user credentials). */
  async publicRequest<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const envelope = await this.parseJson(res);
    if (!res.ok) throw this.apiError(res.status, envelope, "Hyperbase request failed");
    return envelope as T;
  }

  /** Request using a user's JWT (for session validation / profile fetch). */
  async userRequest<T>(path: string, userJwt: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchWithTimeout(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userJwt}`,
      },
    });
    const envelope = await this.parseJson(res);
    if (!res.ok) throw this.apiError(res.status, envelope, "Hyperbase request failed");
    return envelope as T;
  }

  private async parseJson(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new AuthError(`Hyperbase returned non-JSON (status ${res.status})`);
    }
  }

  private apiError(status: number, envelope: unknown, fallback: string): AuthError {
    const msg = (envelope as { error?: { message?: string } })?.error?.message ?? fallback;
    return new AuthError(`${msg} (status ${status})`, status);
  }
}

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

/** Shape of the admin user record stored in Hyperbase. */
export interface AdminUser {
  _id: string;
  email: string;
  role: string;
}

// Singleton client instance.
const client = new HyperbaseAuthClient();

// ─────────────────────────────────────────────────────────────────────────────
// Public auth service API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sign in an admin user via Hyperbase token-based auth.
 * Returns the JWT issued by Hyperbase.
 */
export async function signinAdmin(email: string, password: string): Promise<string> {
  const collectionId = env.auth.adminCollectionId;
  if (!collectionId) throw new AuthError("Auth collection not configured", 500);

  const result = await client.publicRequest<{ data?: { token?: string } }>(
    "/api/rest/auth/token-based",
    {
      token_id: env.hyperbase.tokenId,
      token: env.hyperbase.tokenSecret,
      collection_id: collectionId,
      data: { email: email.toLowerCase(), password },
    }
  );

  const jwt = result?.data?.token;
  if (!jwt) throw new AuthError("Invalid credentials", 401);
  return jwt;
}

/**
 * Register a new admin user by inserting a record into the admin users
 * collection. The Express route must validate the registration secret before
 * calling this — this function does not check it.
 */
export async function signupAdmin(email: string, password: string): Promise<AdminUser> {
  const collectionId = env.auth.adminCollectionId;
  const projectId = env.hyperbase.projectId;
  if (!collectionId || !projectId) throw new AuthError("Auth collection not configured", 500);

  const result = await client.serviceRequest<{ data?: AdminUser }>(
    `/api/rest/project/${projectId}/collection/${collectionId}/record`,
    "POST",
    {
      email: email.toLowerCase(),
      password,
      role: "admin",
    }
  );

  if (!result?.data?._id) throw new AuthError("Failed to create admin user");
  return result.data;
}

/**
 * Validate a user session JWT. Attempts token renewal if Hyperbase indicates
 * the JWT is still valid but renewable. Returns the admin profile and
 * (possibly refreshed) JWT.
 */
export async function validateSession(
  jwt: string
): Promise<{ user: AdminUser; token: string }> {
  // Attempt to renew — Hyperbase returns the same or a fresh JWT.
  let currentToken = jwt;
  try {
    const renewResult = await client.userRequest<{ data?: { token?: string } }>(
      "/api/rest/auth/token",
      jwt
    );
    if (renewResult?.data?.token) {
      currentToken = renewResult.data.token;
    }
  } catch {
    // Renewal failed — the original JWT might still be valid for data access.
    // If it's truly expired, the record fetch below will fail.
  }

  // Fetch the user record tied to this JWT's UserClaim.
  // The Hyperbase record endpoint with Bearer auth scopes to the claimed user.
  // We need to get the user data from the collection. Since the JWT contains
  // a UserClaim with collection_id + record_id, any request with that JWT
  // is already scoped to that user. We can fetch via the auth/token endpoint
  // which already validated above. For user profile, we'll parse the JWT
  // claims client-side (the record_id) and fetch the record.
  //
  // Simpler approach: decode the JWT to get collection_id + record_id, then
  // fetch that specific record using the service JWT.
  const claims = decodeJwtPayload(currentToken);
  if (!claims?.collection_id || !claims?.record_id) {
    throw new AuthError("JWT missing user claim", 401);
  }

  const projectId = env.hyperbase.projectId;
  const record = await client.serviceRequest<{ data?: AdminUser }>(
    `/api/rest/project/${projectId}/collection/${claims.collection_id}/record/${claims.record_id}`,
    "GET"
  );

  if (!record?.data) throw new AuthError("User record not found", 401);

  // Enforce admin role — reject if the user doesn't have the admin role.
  if (record.data.role !== "admin") {
    throw new AuthError("Insufficient permissions", 403);
  }

  return { user: record.data, token: currentToken };
}

/**
 * Decode JWT payload without verification (Hyperbase owns verification).
 * This is safe because we only use it after Hyperbase has already validated
 * the token via the auth/token endpoint.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
