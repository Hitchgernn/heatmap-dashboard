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
import { parseLocationQuery } from "../utils/parseQuery";

const router = Router();

function errorResponse(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

router.get("/aggregate", async (req: Request, res: Response) => {
  const parsed = parseLocationQuery(req.query);
  if (!parsed.ok) {
    return errorResponse(res, 400, parsed.code, parsed.message);
  }
  const query = parsed.value;

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
