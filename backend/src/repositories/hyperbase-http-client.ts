/**
 * Server-side Hyperbase REST client.
 *
 * Talks to the Hyperbase BaaS over its REST API only (never ScyllaDB directly).
 * Handles token-based service auth, caches the Bearer JWT in memory, attaches it
 * to record requests, and enforces a request timeout. This is intentionally a
 * tiny fetch wrapper — the browser/Svelte Hyperbase UI SDK must not be used here
 * because it relies on localStorage and Svelte stores.
 */

/** Connection settings needed to talk to Hyperbase. */
export interface HyperbaseClientConfig {
  baseUrl: string;
  projectId: string;
  collectionId: string;
  tokenId: string;
  tokenSecret: string;
  timeoutMs: number;
}

/** Error thrown for any Hyperbase transport/API failure. */
export class HyperbaseError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "HyperbaseError";
  }
}

export class HyperbaseHttpClient {
  private jwt: string | null = null;

  constructor(private readonly config: HyperbaseClientConfig) {}

  /** Validate that all required connection settings are present. */
  static assertConfigured(config: HyperbaseClientConfig): void {
    const missing = (
      [
        ["HYPERBASE_BASE_URL", config.baseUrl],
        ["HYPERBASE_PROJECT_ID", config.projectId],
        ["HYPERBASE_LOCATION_COLLECTION_ID", config.collectionId],
        ["HYPERBASE_TOKEN_ID", config.tokenId],
        ["HYPERBASE_TOKEN_SECRET", config.tokenSecret],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new HyperbaseError(
        `Hyperbase driver selected but missing env: ${missing.join(", ")}`
      );
    }
  }

  /** fetch wrapped with an AbortController-based timeout. */
  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new HyperbaseError(`Hyperbase request timed out after ${this.config.timeoutMs}ms`);
      }
      const message = err instanceof Error ? err.message : "Unknown transport error";
      throw new HyperbaseError(`Hyperbase request failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Exchange the service token id/secret for a Bearer JWT and cache it.
   * POST /api/rest/auth/token-based
   */
  private async login(): Promise<string> {
    const url = `${this.config.baseUrl}/api/rest/auth/token-based`;
    const res = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token_id: this.config.tokenId,
        token: this.config.tokenSecret,
      }),
    });

    const envelope = await this.parseJson(res);
    if (!res.ok) {
      throw this.envelopeError(res.status, envelope, "Hyperbase auth failed");
    }

    const token = (envelope as { data?: { token?: unknown } })?.data?.token;
    if (typeof token !== "string" || token.length === 0) {
      throw new HyperbaseError("Hyperbase auth response missing data.token");
    }

    this.jwt = token;
    return token;
  }

  /** Return a cached JWT or perform a fresh login. */
  private async getJwt(): Promise<string> {
    return this.jwt ?? (await this.login());
  }

  /**
   * Force a fresh token-based login to verify the configured credentials work.
   * Resolves on success, throws HyperbaseError on failure. Never returns or logs
   * the JWT — intended for connectivity/debug checks only.
   */
  async authenticate(): Promise<void> {
    await this.login();
  }

  /**
   * Authenticated JSON request against a Hyperbase record endpoint. Retries once
   * after a fresh login if the cached JWT is rejected (401/403), since the JWT
   * may have expired between requests.
   */
  async authedRequest<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    const send = async (jwt: string): Promise<Response> =>
      this.fetchWithTimeout(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    let res = await send(await this.getJwt());
    if (res.status === 401 || res.status === 403) {
      this.jwt = null; // force re-login and retry once
      res = await send(await this.getJwt());
    }

    const envelope = await this.parseJson(res);
    if (!res.ok) {
      throw this.envelopeError(res.status, envelope, "Hyperbase request rejected");
    }
    return envelope as T;
  }

  private async parseJson(res: Response): Promise<unknown> {
    const text = await res.text();
    if (text.length === 0) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new HyperbaseError(`Hyperbase returned non-JSON response (status ${res.status})`);
    }
  }

  /** Build an error from a Hyperbase `{ error: { message } }` envelope. */
  private envelopeError(status: number, envelope: unknown, fallback: string): HyperbaseError {
    const message =
      (envelope as { error?: { message?: unknown } })?.error?.message ?? fallback;
    return new HyperbaseError(`${String(message)} (status ${status})`, status);
  }
}
