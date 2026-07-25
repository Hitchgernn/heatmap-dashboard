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

/**
 * @openapi
 * /api/auth/admin/signin:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in an admin, set session cookie
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Signed in. Sets the httpOnly borobudur_session cookie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     email: { type: string, format: email }
 *       400:
 *         description: Missing email or password.
 *       401:
 *         description: Invalid email or password.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /api/auth/admin/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Create an admin account (gated by registration secret)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, registration_secret]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, minLength: 8 }
 *               registration_secret: { type: string }
 *     responses:
 *       201:
 *         description: Admin created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/AdminUser' }
 *       400:
 *         description: Validation error.
 *       403:
 *         description: Invalid registration secret.
 *       503:
 *         description: Admin registration not configured.
 */
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

/**
 * @openapi
 * /api/auth/admin/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Clear the session cookie
 *     security: []
 *     responses:
 *       200:
 *         description: Logged out.
 */
router.post("/logout", (_req: Request, res: Response) => {
  // The clearing Set-Cookie must carry the same attributes the cookie was set
  // with, or the browser ignores it and the session survives logout. This
  // matters once crossSiteCookie flips Secure/SameSite on.
  //
  // maxAge is dropped deliberately: express derives `expires` from it, which
  // would override clearCookie's epoch expiry and re-issue a live cookie.
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions();
  res.clearCookie(env.auth.cookieName, clearOptions);
  return successResponse(res, { message: "Logged out" });
});

// ── GET /me ──────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/admin/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current admin profile
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current admin.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/AdminUser' }
 *       401:
 *         description: Missing or invalid session cookie.
 */
router.get("/me", requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  return successResponse(res, {
    _id: user._id,
    email: user.email,
    role: user.role,
  });
});

export default router;
