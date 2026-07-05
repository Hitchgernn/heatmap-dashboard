/**
 * Admin authentication routes.
 *
 * POST /signin  — authenticate admin, set session cookie
 * POST /signup  — create admin account (requires ADMIN_REGISTRATION_SECRET)
 * POST /logout  — clear session cookie
 * GET  /me      — return current admin profile
 *
 * All auth operations proxy to Hyperbase BaaS per the integration spec.
 * Mounted at /api/auth/admin in index.ts.
 *
 * Architecture: visitor auth routes will live at /api/auth/visitor/* in a
 * separate file, sharing middleware and the HyperbaseAuthClient.
 */

import { Router, type Request, type Response } from "express";
import { env } from "../../config/env";
import { signinAdmin, signupAdmin, AuthError } from "../../services/auth.service";
import { requireAuth, cookieOptions } from "../../middleware/auth.middleware";
import { errorResponse, successResponse } from "../../utils/httpResponse";

const router = Router();

// ── POST /signin ─────────────────────────────────────────────────────────────

router.post("/signin", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return errorResponse(res, 400, "VALIDATION_ERROR", "Email and password are required");
  }

  try {
    const jwt = await signinAdmin(email.trim(), password);

    res.cookie(env.auth.cookieName, jwt, cookieOptions());

    return successResponse(res, { email: email.trim().toLowerCase() });
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.status ?? 401;
      return errorResponse(res, status, "AUTH_FAILED", "Invalid email or password");
    }
    console.error("[auth] signin error:", err);
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", "Authentication service unavailable");
  }
});

// ── POST /signup ─────────────────────────────────────────────────────────────

router.post("/signup", async (req: Request, res: Response) => {
  const { email, password, registration_secret } = req.body ?? {};

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return errorResponse(res, 400, "VALIDATION_ERROR", "Email and password are required");
  }

  // Password strength: require at least 8 characters.
  if (password.length < 8) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "Password must be at least 8 characters");
  }

  // Gate admin registration behind a shared secret.
  const expectedSecret = env.auth.registrationSecret;
  if (!expectedSecret) {
    return errorResponse(
      res,
      503,
      "REGISTRATION_DISABLED",
      "Admin registration is not configured"
    );
  }

  if (registration_secret !== expectedSecret) {
    return errorResponse(res, 403, "FORBIDDEN", "Invalid registration secret");
  }

  try {
    const user = await signupAdmin(email.trim(), password);
    return successResponse(res, { _id: user._id, email: user.email, role: user.role }, 201);
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.status && err.status < 500 ? err.status : 400;
      return errorResponse(res, status, "SIGNUP_FAILED", err.message);
    }
    console.error("[auth] signup error:", err);
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", "Registration service unavailable");
  }
});

// ── POST /logout ─────────────────────────────────────────────────────────────

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(env.auth.cookieName, { path: "/" });
  return successResponse(res, { message: "Logged out" });
});

// ── GET /me ──────────────────────────────────────────────────────────────────

router.get("/me", requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  return successResponse(res, {
    _id: user._id,
    email: user.email,
    role: user.role,
  });
});

export default router;
