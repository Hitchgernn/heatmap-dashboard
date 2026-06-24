/**
 * Heatmap routes.
 *
 *   GET /api/heatmap/aggregate?window=15m&source=mock
 *
 * Fetches raw locations from the repository, aggregates them into a grid, and
 * returns a GeoJSON FeatureCollection. Returns raw GeoJSON (not wrapped in the
 * standard success envelope) so the frontend can hand it straight to Mapbox.
 */

import { Router, type Request, type Response } from "express";
import { getLocationRepository } from "../repositories";
import { aggregateToGrid } from "../services/aggregation.service";
import { toFeatureCollection } from "../services/geojson.service";
import { resolveTimeRange } from "../utils/timeWindow";
import type { LocationQuery, SourceFilter, TimeWindowPreset } from "../types/location";

const router = Router();

const VALID_WINDOWS: TimeWindowPreset[] = ["5m", "15m", "1h", "today"];
const VALID_SOURCES: SourceFilter[] = ["mobile_app", "mock", "all"];

function errorResponse(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

router.get("/aggregate", async (req: Request, res: Response) => {
  const { window, source, from, to } = req.query;

  // Validate window (only when from/to are not both supplied).
  const hasCustomRange = typeof from === "string" && typeof to === "string";
  if (!hasCustomRange && window !== undefined && !VALID_WINDOWS.includes(window as TimeWindowPreset)) {
    return errorResponse(
      res,
      400,
      "INVALID_TIME_WINDOW",
      `window must be one of: ${VALID_WINDOWS.join(", ")}`
    );
  }

  if (source !== undefined && !VALID_SOURCES.includes(source as SourceFilter)) {
    return errorResponse(
      res,
      400,
      "VALIDATION_ERROR",
      `source must be one of: ${VALID_SOURCES.join(", ")}`
    );
  }

  const query: LocationQuery = {
    window: (window as TimeWindowPreset) ?? "15m",
    source: (source as SourceFilter) ?? "all",
    ...(hasCustomRange ? { from: from as string, to: to as string } : {}),
  };

  try {
    const repository = getLocationRepository();
    const locations = await repository.getLocations(query);
    const range = resolveTimeRange(query);
    const { cells } = aggregateToGrid(locations, range.label);
    return res.status(200).json(toFeatureCollection(cells));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", message);
  }
});

export default router;
