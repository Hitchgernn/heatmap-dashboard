/**
 * Hotspot routes.
 *
 *   GET /api/hotspots?from=...&to=...&source=mock
 *
 * Returns precomputed DBSCAN hotspot results in the standard success envelope.
 * Query params are validated for format; for MVP the file is precomputed so
 * they do not filter the result set.
 */

import { Router, type Request, type Response } from "express";
import { readHotspots } from "../services/hotspot.service";
import { errorResponse, successResponse } from "../utils/httpResponse";
import { isValidTimestamp } from "../utils/validateLocation";
import type { SourceFilter } from "../types/location";

const router = Router();

const VALID_SOURCES: SourceFilter[] = ["mobile_app", "mock", "all"];

/**
 * @openapi
 * /api/hotspots:
 *   get:
 *     tags: [Hotspots]
 *     summary: DBSCAN hotspot detection results
 *     description: >
 *       Returns precomputed DBSCAN hotspot clusters. For MVP the result is read
 *       from ml/output/hotspots.json; query params are validated for format but
 *       do not filter the precomputed set.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FromParam'
 *       - $ref: '#/components/parameters/ToParam'
 *       - $ref: '#/components/parameters/SourceParam'
 *     responses:
 *       200:
 *         description: Hotspot clusters.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HotspotsResponse'
 *       400:
 *         description: Invalid query parameters.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid session cookie.
 */
router.get("/", async (req: Request, res: Response) => {
  const { from, to, source } = req.query;

  if (from !== undefined && !isValidTimestamp(from)) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "from must be a valid ISO timestamp");
  }
  if (to !== undefined && !isValidTimestamp(to)) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "to must be a valid ISO timestamp");
  }
  if (source !== undefined && !VALID_SOURCES.includes(source as SourceFilter)) {
    return errorResponse(
      res,
      400,
      "VALIDATION_ERROR",
      `source must be one of: ${VALID_SOURCES.join(", ")}`
    );
  }

  try {
    const hotspots = readHotspots();
    return successResponse(res, { hotspots });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", `Failed to read hotspots: ${message}`);
  }
});

export default router;
