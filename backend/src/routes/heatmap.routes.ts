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
import type { AggregatedGridCell } from "../types/location";
import { getLocationRepository } from "../repositories";
import { aggregateToGrid, cellsFromCounts } from "../services/aggregation.service";
import { toFeatureCollection } from "../services/geojson.service";
import { resolveTimeRange } from "../utils/timeWindow";
import { parseLocationQuery } from "../utils/parseQuery";

const router = Router();

function errorResponse(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

/**
 * @openapi
 * /api/heatmap/aggregate:
 *   get:
 *     tags: [Heatmap]
 *     summary: Aggregated heatmap as GeoJSON
 *     description: >
 *       Fetches raw locations for the time window, cleans + bounds-filters them,
 *       snaps to a grid, and returns a raw GeoJSON FeatureCollection (no
 *       envelope). Coordinates are [longitude, latitude]. visitor_id is never
 *       included.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/WindowParam'
 *       - $ref: '#/components/parameters/FromParam'
 *       - $ref: '#/components/parameters/ToParam'
 *       - $ref: '#/components/parameters/SourceParam'
 *     responses:
 *       200:
 *         description: GeoJSON FeatureCollection (empty features array when no data).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HeatmapFeatureCollection'
 *       400:
 *         description: Invalid query parameters or time window.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid session cookie.
 *       500:
 *         description: Internal error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/aggregate", async (req: Request, res: Response) => {
  const parsed = parseLocationQuery(req.query);
  if (!parsed.ok) {
    return errorResponse(res, 400, parsed.code, parsed.message);
  }
  const query = parsed.value;

  try {
    const repository = getLocationRepository();
    const range = resolveTimeRange(query);
    let cells: AggregatedGridCell[] | undefined;

    // Prefer server-side SQL aggregation when the driver supports it and it's
    // enabled; fall back to fetch-then-aggregate if it's unavailable (null) or
    // the query fails, so a flaky endpoint degrades rather than breaks.
    if (repository.getAggregatedCells) {
      try {
        const counts = await repository.getAggregatedCells(query);
        if (counts) cells = cellsFromCounts(counts, range.label);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        // eslint-disable-next-line no-console
        console.warn(`[heatmap] SQL aggregation failed, falling back to pagination: ${message}`);
      }
    }

    if (!cells) {
      const locations = await repository.getLocations(query);
      cells = aggregateToGrid(locations, range.label).cells;
    }

    return res.status(200).json(toFeatureCollection(cells));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", message);
  }
});

export default router;
