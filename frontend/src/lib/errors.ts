/**
 * Typed transport errors.
 *
 * The API clients used to throw a bare `Error` carrying only a message, which
 * made every failure look alike to callers. An expired session (401) and a
 * backend fault (500) need opposite responses — one returns you to the login
 * page, the other retries — so the status code has to survive the throw.
 */

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * True when the backend rejected the session rather than the request.
 *
 * The admin cookie lasts 24h; a dashboard left open overnight wakes up to this.
 * Treating it as an ordinary fetch failure strands the operator on stale data
 * behind a banner that promises a retry which can never succeed.
 */
export function isSessionError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

/** True when the request never left the machine (offline, DNS, refused). */
export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}
