/**
 * Hotspot routes.
 *
 *   GET /api/hotspots?window=15m&source=mock&eps=8&minSamples=5
 *
 * Runs DBSCAN live over the current window's location data (source-aware via the
 * repository) and returns aggregate clusters in the standard success envelope.
 * eps (metres) and minSamples are tunable so the caller can watch clusters merge
 * and split; both are clamped to safe bounds.
 */

import { Router, type Request, type Response } from "express";
import { getLocationRepository } from "../repositories";
import { detectHotspots } from "../services/hotspot-detection.service";
import { parseLocationQuery } from "../utils/parseQuery";
import { errorResponse, successResponse } from "../utils/httpResponse";
import {
  DEFAULT_EPS_M,
  DEFAULT_MIN_SAMPLES,
  EPS_M_MIN,
  EPS_M_MAX,
  MIN_SAMPLES_MIN,
  MIN_SAMPLES_MAX,
  clamp,
} from "../config/dbscan";

const router = Router();

/** Parse a numeric query param, clamped to bounds; falls back to the default. */
function numParam(raw: unknown, min: number, max: number, fallback: number): number {
  if (raw === undefined) return fallback;
  return clamp(Number(raw), min, max, fallback);
}

/**
 * @openapi
 * /api/hotspots:
 *   get:
 *     tags: [Hotspots]
 *     summary: Live DBSCAN hotspot detection
 *     description: >
 *       Runs DBSCAN over the current time window's location data (filtered by
 *       source) and returns aggregate clusters. eps (metres) and minSamples are
 *       tunable and clamped to safe bounds. Aggregate only — no visitor_id.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/WindowParam'
 *       - $ref: '#/components/parameters/FromParam'
 *       - $ref: '#/components/parameters/ToParam'
 *       - $ref: '#/components/parameters/SourceParam'
 *       - in: query
 *         name: eps
 *         schema: { type: number, default: 8, minimum: 2, maximum: 200 }
 *         description: DBSCAN neighbourhood radius in metres.
 *       - in: query
 *         name: minSamples
 *         schema: { type: integer, default: 5, minimum: 2, maximum: 50 }
 *         description: Minimum neighbours to seed a dense cluster.
 *     responses:
 *       200:
 *         description: Hotspot clusters.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HotspotsResponse'
 *       400:
 *         description: Invalid query parameters or time window.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid session cookie.
 */
router.get("/", async (req: Request, res: Response) => {
  const parsed = parseLocationQuery(req.query);
  if (!parsed.ok) {
    return errorResponse(res, 400, parsed.code, parsed.message);
  }

  const epsM = numParam(req.query.eps, EPS_M_MIN, EPS_M_MAX, DEFAULT_EPS_M);
  const minSamples = numParam(
    req.query.minSamples,
    MIN_SAMPLES_MIN,
    MIN_SAMPLES_MAX,
    DEFAULT_MIN_SAMPLES
  );

  try {
    const repository = getLocationRepository();
    const locations = await repository.getLocations(parsed.value);
    const { hotspots, points } = detectHotspots(locations, { epsM, minSamples });
    return successResponse(res, { hotspots, points });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", `Failed to detect hotspots: ${message}`);
  }
});

export default router;
