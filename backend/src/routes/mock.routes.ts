/**
 * Mock data routes (development/testing only).
 *
 *   POST /api/mock/location   — insert one mock location
 *   POST /api/mock/generate   — generate + insert a clustered batch
 *
 * Both force source "mock" and insert through the active repository.
 */

import { Router, type Request, type Response } from "express";
import { env } from "../config/env";
import { getLocationRepository, getMockLocationRepository } from "../repositories";
import type { LocationRepository } from "../repositories/location.repository";
import { generateMockId, generateMockLocations } from "../services/mock-data.service";
import {
  isValidLatitude,
  isValidLongitude,
  isValidTimestamp,
} from "../utils/validateLocation";
import { errorResponse, successResponse } from "../utils/httpResponse";
import type { LocationLog, LocationSource } from "../types/location";

const router = Router();

// Guard rails for bulk generation so a typo can't create millions of rows.
const MAX_VISITORS = 5000;
const MAX_POINTS_PER_VISITOR = 500;

/**
 * Mock writes target the memory driver, OR — on the hyperbase driver — a
 * SEPARATE mock collection when one is configured (HYPERBASE_MOCK_COLLECTION_ID).
 * They are only rejected on the hyperbase driver when no mock collection is set:
 * the real coordinate collection is written by the mobile app alone (no `source`
 * column, Hyperbase-set `_updated_at`), so mock rows must never land there.
 */
function rejectMockUnavailable(res: Response): boolean {
  if (env.repositoryDriver !== "hyperbase") return false;
  if (env.mockCollectionEnabled) return false;
  errorResponse(
    res,
    400,
    "VALIDATION_ERROR",
    "Mock data is unavailable: set HYPERBASE_MOCK_COLLECTION_ID to write mock rows to a separate collection, or use the memory driver"
  );
  return true;
}

/** The repository mock inserts go through (mock collection on hyperbase, else memory). */
function mockWriteRepository(): LocationRepository {
  return env.repositoryDriver === "hyperbase"
    ? (getMockLocationRepository() as LocationRepository)
    : getLocationRepository();
}

/**
 * @openapi
 * /api/mock/location:
 *   post:
 *     tags: [Mock]
 *     summary: Insert one mock location (dev/testing)
 *     description: Inserts a single mock location. source is forced to "mock".
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [visitor_id, timestamp, latitude, longitude]
 *             properties:
 *               visitor_id: { type: string, example: mock_visitor_001 }
 *               timestamp: { type: string, format: date-time }
 *               latitude: { type: number, example: -7.6079 }
 *               longitude: { type: number, example: 110.2037 }
 *     responses:
 *       201:
 *         description: Inserted.
 *       400:
 *         description: Validation error, or mock unavailable on the hyperbase driver.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid session cookie.
 */
router.post("/location", async (req: Request, res: Response) => {
  if (rejectMockUnavailable(res)) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const { visitor_id, timestamp, latitude, longitude, id_data } = body;

  if (typeof visitor_id !== "string" || visitor_id.length === 0) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "visitor_id is required");
  }
  if (!isValidTimestamp(timestamp)) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "timestamp must be a valid ISO timestamp");
  }
  if (!isValidLatitude(latitude)) {
    return errorResponse(res, 400, "INVALID_COORDINATE", "latitude is required and must be a number");
  }
  if (!isValidLongitude(longitude)) {
    return errorResponse(res, 400, "INVALID_COORDINATE", "longitude is required and must be a number");
  }

  const location: LocationLog = {
    id_data: typeof id_data === "string" && id_data.length > 0 ? id_data : generateMockId(),
    timestamp: timestamp as string,
    visitor_id,
    latitude: latitude as number,
    longitude: longitude as number,
    source: "mock", // forced
  };

  try {
    const repository = mockWriteRepository();
    await repository.insertLocation(location);
    return res.status(201).json({ success: true, message: "Mock location inserted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", message);
  }
});

/**
 * @openapi
 * /api/mock/generate:
 *   post:
 *     tags: [Mock]
 *     summary: Bulk-generate clustered mock data (dev/testing)
 *     description: >
 *       Generates realistic clustered mock visitor points around Borobudur and
 *       inserts them. Distribution follows config/areas.ts (Main Stupa 45%,
 *       Entrance 25%, East Stairs 15%, West 10%, scatter 5%).
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [visitor_count, points_per_visitor]
 *             properties:
 *               visitor_count: { type: integer, minimum: 1, maximum: 5000, example: 100 }
 *               points_per_visitor: { type: integer, minimum: 1, maximum: 500, example: 10 }
 *               source: { type: string, enum: [mock, mobile_app], default: mock }
 *     responses:
 *       201:
 *         description: Inserted count.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 inserted: { type: integer, example: 1000 }
 *                 source: { type: string, example: mock }
 *       400:
 *         description: Validation error, or mock unavailable on the hyperbase driver.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid session cookie.
 */
router.post("/generate", async (req: Request, res: Response) => {
  if (rejectMockUnavailable(res)) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const visitorCount = Number(body.visitor_count);
  const pointsPerVisitor = Number(body.points_per_visitor);

  if (!Number.isInteger(visitorCount) || visitorCount <= 0 || visitorCount > MAX_VISITORS) {
    return errorResponse(
      res,
      400,
      "VALIDATION_ERROR",
      `visitor_count must be an integer between 1 and ${MAX_VISITORS}`
    );
  }
  if (
    !Number.isInteger(pointsPerVisitor) ||
    pointsPerVisitor <= 0 ||
    pointsPerVisitor > MAX_POINTS_PER_VISITOR
  ) {
    return errorResponse(
      res,
      400,
      "VALIDATION_ERROR",
      `points_per_visitor must be an integer between 1 and ${MAX_POINTS_PER_VISITOR}`
    );
  }

  // Source is optional; default to "mock". Only the known sources are accepted.
  let source: LocationSource = "mock";
  if (body.source !== undefined) {
    if (body.source !== "mock" && body.source !== "mobile_app") {
      return errorResponse(
        res,
        400,
        "VALIDATION_ERROR",
        'source must be "mock" or "mobile_app"'
      );
    }
    source = body.source;
  }

  try {
    const repository = mockWriteRepository();
    const locations = generateMockLocations({ visitorCount, pointsPerVisitor, source });
    await repository.insertManyLocations(locations);
    return res.status(201).json({ success: true, inserted: locations.length, source });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", message);
  }
});

export default router;
