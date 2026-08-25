/**
 * Auth API client for the Borobudur backend.
 *
 * Talks to /api/auth/admin/* endpoints. All requests include credentials
 * so the httpOnly session cookie is sent/received automatically.
 */

import { ApiError } from "./errors";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export interface AuthUser {
  _id: string;
  email: string;
  role: string;
}

export interface SigninParams {
  email: string;
  password: string;
}

export interface SignupParams {
  email: string;
  password: string;
  registration_secret: string;
}

/** Envelope returned by auth endpoints. */
interface AuthEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function authFetch<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Network unreachable", 0);
  }

  const envelope = (await res.json().catch(() => null)) as AuthEnvelope<T> | null;

  if (!res.ok || !envelope?.success) {
    throw new ApiError(envelope?.error?.message ?? `HTTP ${res.status}`, res.status);
  }

  return envelope.data as T;
}

export function signin(params: SigninParams): Promise<{ email: string }> {
  return authFetch("/api/auth/admin/signin", "POST", params);
}

export function signup(params: SignupParams): Promise<AuthUser> {
  return authFetch("/api/auth/admin/signup", "POST", params);
}

export function logout(): Promise<void> {
  return authFetch("/api/auth/admin/logout", "POST");
}

export function getMe(): Promise<AuthUser> {
  return authFetch("/api/auth/admin/me", "GET");
}
