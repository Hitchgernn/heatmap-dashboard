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

/** Promise-based sleep — kept local so this file stays dependency-free. */
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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
  /** Proxy/gateway statuses that mean "upstream hiccup", not a real API answer. */
  private static readonly TRANSIENT_STATUSES = new Set([502, 503, 504]);
  /** Extra attempts after the first, for a transient failure only. */
  private static readonly TRANSIENT_RETRIES = 2;
  /** First backoff step; each further retry waits 3x the previous one. */
  private static readonly RETRY_BASE_DELAY_MS = 300;

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
    const { res, envelope } = await this.requestJson(() =>
      this.fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_id: this.config.tokenId,
          token: this.config.tokenSecret,
        }),
      })
    );

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
   * may have expired between requests. Gateway blips are absorbed a layer down,
   * in `requestJson`.
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

    let { res, envelope } = await this.requestJson(async () => send(await this.getJwt()));
    if (res.status === 401 || res.status === 403) {
      this.jwt = null; // force re-login and retry once
      ({ res, envelope } = await this.requestJson(async () => send(await this.getJwt())));
    }

    if (!res.ok) {
      throw this.envelopeError(res.status, envelope, "Hyperbase request rejected");
    }
    return envelope as T;
  }

  /**
   * Send a request and parse its JSON body, retrying a couple of times when the
   * proxy in front of Hyperbase answers with a gateway error (502/503/504) or an
   * HTML error page instead of JSON. Those clear on their own within a second, so
   * absorbing them here stops a blip surfacing as a red banner on the dashboard.
   *
   * Timeouts and transport errors are deliberately NOT retried: they already
   * waited out `timeoutMs`, and retrying would multiply the stall.
   */
  private async requestJson(
    send: () => Promise<Response>
  ): Promise<{ res: Response; envelope: unknown }> {
    const retries = HyperbaseHttpClient.TRANSIENT_RETRIES;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        await delay(HyperbaseHttpClient.RETRY_BASE_DELAY_MS * 3 ** (attempt - 1));
      }

      const res = await send();
      const isLast = attempt === retries;

      if (HyperbaseHttpClient.TRANSIENT_STATUSES.has(res.status) && !isLast) {
        await res.text().catch(() => ""); // drain the body so the socket is released
        lastError = new HyperbaseError(`Hyperbase gateway error (status ${res.status})`, res.status);
        continue;
      }

      try {
        return { res, envelope: await this.parseJson(res) };
      } catch (err) {
        // On the last attempt a gateway status is the more useful diagnosis than
        // "non-JSON body", which is only the shape of the proxy's HTML error page.
        if (isLast) {
          throw HyperbaseHttpClient.TRANSIENT_STATUSES.has(res.status)
            ? new HyperbaseError(`Hyperbase gateway error (status ${res.status})`, res.status)
            : err;
        }
        lastError = err;
      }
    }

    // Unreachable: the final attempt always returns or throws.
    throw lastError instanceof Error
      ? lastError
      : new HyperbaseError("Hyperbase request failed after retries");
  }

  private async parseJson(res: Response): Promise<unknown> {
    const text = await res.text();
    if (text.length === 0) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new HyperbaseError(
        `Hyperbase returned non-JSON response (status ${res.status})`,
        res.status
      );
    }
  }

  /** Build an error from a Hyperbase `{ error: { message } }` envelope. */
  private envelopeError(status: number, envelope: unknown, fallback: string): HyperbaseError {
    const message =
      (envelope as { error?: { message?: unknown } })?.error?.message ?? fallback;
    return new HyperbaseError(`${String(message)} (status ${status})`, status);
  }
}
