/**
 * Dashboard routes.
 *
 *   GET /api/dashboard/summary?window=15m&source=mock
 *
 * Returns aggregate-only statistics in the standard success envelope.
 */

import { Router, type Request, type Response } from "express";
import { getLocationRepository } from "../repositories";
import { buildDashboardSummary } from "../services/dashboard.service";
import { resolveTimeRange } from "../utils/timeWindow";
import { parseLocationQuery } from "../utils/parseQuery";
import { errorResponse, successResponse } from "../utils/httpResponse";

const router = Router();

router.get("/summary", async (req: Request, res: Response) => {
  const parsed = parseLocationQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) {
    return errorResponse(res, 400, parsed.code, parsed.message);
  }

  try {
    const repository = getLocationRepository();
    const locations = await repository.getLocations(parsed.value);
    const range = resolveTimeRange(parsed.value);
    const summary = buildDashboardSummary(locations, range.label);
    return successResponse(res, summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", message);
  }
});

export default router;
