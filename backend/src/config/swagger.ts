/**
 * OpenAPI / Swagger specification.
 *
 * Built with swagger-jsdoc from the `@openapi` JSDoc blocks on the route files
 * plus the reusable component schemas below (mirroring docs/API.md, the
 * authoritative contract, and src/types/location.ts). Served by swagger-ui at
 * /api/docs — see index.ts.
 *
 * The `apis` glob points at both .ts (ts-node-dev) and .js (compiled dist)
 * route files, resolved relative to this file, so annotations are found in dev
 * and in production. tsc keeps JSDoc comments (removeComments is not set), so
 * the dist .js files still carry the @openapi blocks.
 */

import path from "path";
import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Borobudur Aggregated Heatmap Dashboard API",
      version: "1.0.0",
      description:
        "Backend REST API. Fetches raw visitor GPS logs from Hyperbase, cleans " +
        "and aggregates them into a grid, and serves privacy-safe GeoJSON + " +
        "summary statistics. The heatmap endpoint returns raw GeoJSON; all " +
        "other endpoints use the { success, data } envelope. visitor_id is " +
        "never exposed. See docs/API.md for the authoritative contract.",
    },
    servers: [
      { url: "http://localhost:3001", description: "Local development" },
      { url: "/api", description: "Behind Nginx (VITE_API_BASE_URL=/api)" },
    ],
    tags: [
      { name: "Heatmap", description: "Aggregated GeoJSON heatmap" },
      { name: "Dashboard", description: "Aggregate summary statistics" },
      { name: "Hotspots", description: "Precomputed DBSCAN hotspot results" },
      { name: "Mock", description: "Development-only mock data generation" },
      { name: "Auth", description: "Admin authentication" },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: env.auth.cookieName,
          description:
            "httpOnly session cookie set by POST /api/auth/admin/signin. All " +
            "data routes require it.",
        },
      },
      schemas: {
        DensityLevel: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  enum: [
                    "VALIDATION_ERROR",
                    "INVALID_TIME_WINDOW",
                    "INVALID_COORDINATE",
                    "NOT_FOUND",
                    "AUTH_FAILED",
                    "INTERNAL_SERVER_ERROR",
                  ],
                },
                message: { type: "string" },
              },
            },
          },
        },
        HeatmapFeature: {
          type: "object",
          properties: {
            type: { type: "string", example: "Feature" },
            properties: {
              type: "object",
              properties: {
                grid_id: { type: "string", example: "grid_-7.6079_110.2037" },
                visitor_count: { type: "integer", example: 120 },
                weight: { type: "number", format: "float", example: 0.92 },
                density_level: { $ref: "#/components/schemas/DensityLevel" },
              },
            },
            geometry: {
              type: "object",
              properties: {
                type: { type: "string", example: "Point" },
                coordinates: {
                  type: "array",
                  description: "GeoJSON order: [longitude, latitude].",
                  items: { type: "number" },
                  example: [110.2037, -7.6079],
                },
              },
            },
          },
        },
        HeatmapFeatureCollection: {
          type: "object",
          properties: {
            type: { type: "string", example: "FeatureCollection" },
            features: {
              type: "array",
              items: { $ref: "#/components/schemas/HeatmapFeature" },
            },
          },
        },
        DashboardSummary: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                estimated_active_visitors: { type: "integer", example: 245 },
                total_location_points: { type: "integer", example: 3021 },
                most_crowded_area: { type: "string", example: "Main Stupa" },
                last_updated: {
                  type: "string",
                  format: "date-time",
                  example: "2026-06-16T10:30:00Z",
                },
              },
            },
          },
        },
        Hotspot: {
          type: "object",
          properties: {
            cluster_id: { type: "string", example: "hotspot_01" },
            center_lat: { type: "number", example: -7.6079 },
            center_lng: { type: "number", example: 110.2037 },
            total_points: { type: "integer", example: 420 },
            label: { type: "string", example: "High Density Hotspot" },
          },
        },
        HotspotsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                hotspots: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Hotspot" },
                },
              },
            },
          },
        },
        AdminUser: {
          type: "object",
          properties: {
            _id: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", example: "admin" },
          },
        },
      },
      parameters: {
        WindowParam: {
          name: "window",
          in: "query",
          required: false,
          description: "Time window preset. Default 15m.",
          schema: {
            type: "string",
            enum: ["5m", "15m", "1h", "today", "3d", "7d", "30d"],
            default: "15m",
          },
        },
        FromParam: {
          name: "from",
          in: "query",
          required: false,
          description: "Custom range start (ISO timestamp). Use with `to`.",
          schema: { type: "string", format: "date-time" },
        },
        ToParam: {
          name: "to",
          in: "query",
          required: false,
          description: "Custom range end (ISO timestamp). Must be after `from`; span ≤ 90 days.",
          schema: { type: "string", format: "date-time" },
        },
        SourceParam: {
          name: "source",
          in: "query",
          required: false,
          description: "Data source filter. Default all.",
          schema: {
            type: "string",
            enum: ["mobile_app", "mock", "all"],
            default: "all",
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  },
  apis: [
    path.join(__dirname, "../routes/**/*.ts"),
    path.join(__dirname, "../routes/**/*.js"),
  ],
};

export const openapiSpec = swaggerJSDoc(options) as Record<string, unknown>;
