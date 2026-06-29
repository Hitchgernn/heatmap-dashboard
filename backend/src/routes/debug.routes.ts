/**
 * Temporary debug routes — REMOVE before production.
 *
 *   GET /api/debug/hyperbase  — verify Hyperbase token-based auth works
 *
 * Performs a fresh login against the configured Hyperbase instance and reports
 * whether authentication succeeded. Never returns the JWT or any credentials.
 */

import { Router, type Request, type Response } from "express";
import { env } from "../config/env";
import {
  HyperbaseHttpClient,
  HyperbaseError,
} from "../repositories/hyperbase-http-client";
import { successResponse, errorResponse } from "../utils/httpResponse";

const router = Router();

router.get("/hyperbase", async (_req: Request, res: Response) => {
  try {
    HyperbaseHttpClient.assertConfigured(env.hyperbase);
    const client = new HyperbaseHttpClient(env.hyperbase);
    await client.authenticate();
    return successResponse(res, { authenticated: true, baseUrl: env.hyperbase.baseUrl });
  } catch (err) {
    if (err instanceof HyperbaseError) {
      return successResponse(res, { authenticated: false, reason: err.message });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", message);
  }
});

export default router;
