/**
 * Authentication middleware for protected routes.
 *
 * Reads the JWT from the `borobudur_session` httpOnly cookie, validates it
 * against Hyperbase, and attaches the admin profile to `req.user`. If the
 * token was renewed, the updated cookie is set on the response automatically.
 *
 * Architecture: This middleware is role-agnostic at the transport layer — it
 * validates any session cookie. Role enforcement ("admin" vs future "visitor")
 * is handled by the `requireRole` helper, allowing `/api/auth/visitor/*`
 * routes to reuse the same middleware stack later.
 */

import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { validateSession, type AdminUser, AuthError } from "../services/auth.service";
import { errorResponse } from "../utils/httpResponse";

/** Extend Express Request to carry the authenticated user. */
declare global {
  namespace Express {
    interface Request {
      user?: AdminUser;
    }
  }
}

/** Cookie options shared between set and clear. */
function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict" as const,
    path: "/",
    maxAge: env.auth.cookieMaxAgeMs,
  };
}

/**
 * Middleware that requires a valid session cookie. On success, `req.user` is
 * set and the handler chain continues. On failure, responds with 401.
 *
 * If Hyperbase renews the JWT, the cookie is transparently updated.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[env.auth.cookieName];
  if (!token) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Authentication required");
  }

  try {
    const { user, token: refreshedToken } = await validateSession(token);

    // Transparently refresh the cookie if Hyperbase issued a new JWT.
    if (refreshedToken !== token) {
      res.cookie(env.auth.cookieName, refreshedToken, cookieOptions());
    }

    req.user = user;
    return next();
  } catch (err) {
    // Clear the stale cookie so the client doesn't keep sending it.
    res.clearCookie(env.auth.cookieName, { path: "/" });

    if (err instanceof AuthError && err.status === 403) {
      return errorResponse(res, 403, "FORBIDDEN", "Insufficient permissions");
    }
    return errorResponse(res, 401, "UNAUTHORIZED", "Invalid or expired session");
  }
}

/**
 * Higher-order middleware that checks `req.user.role` against an allowed role.
 * Must be placed after `requireAuth` in the middleware chain.
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return errorResponse(res, 403, "FORBIDDEN", `Role '${role}' required`);
    }
    return next();
  };
}

export { cookieOptions };
