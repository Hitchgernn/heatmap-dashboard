/**
 * Express application entrypoint.
 */

import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { openapiSpec } from "./config/swagger";
import heatmapRoutes from "./routes/heatmap.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import mockRoutes from "./routes/mock.routes";
import hotspotRoutes from "./routes/hotspot.routes";
import debugRoutes from "./routes/debug.routes";
import authRoutes from "./routes/auth/index";
import { requireAuth } from "./middleware/auth.middleware";

export function createApp() {
  const app = express();

  // An empty allowlist reflects whichever origin asks, which keeps local
  // development frictionless. Public deployments set CORS_ORIGINS so only the
  // deployed frontend can make credentialed requests — with SameSite=None the
  // cookie no longer blocks cross-site calls, so this is the control that does.
  app.use(
    cors({
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser(env.auth.cookieSecret));

  // Health check — kept outside /api so infra probes hit a stable path.
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // API documentation (public). Swagger UI at /api/docs, raw spec at /api/docs.json.
  app.get("/api/docs.json", (_req: Request, res: Response) => {
    res.status(200).json(openapiSpec);
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

  // Auth routes are public (they handle their own auth checks internally).
  app.use("/api/auth", authRoutes);

  // All data routes require an authenticated admin session.
  app.use("/api/heatmap", requireAuth, heatmapRoutes);
  app.use("/api/dashboard", requireAuth, dashboardRoutes);
  app.use("/api/mock", requireAuth, mockRoutes);
  app.use("/api/hotspots", requireAuth, hotspotRoutes);
  app.use("/api/debug", requireAuth, debugRoutes); // TEMPORARY — remove before production

  // 404 fallback in the standard error format.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Resource not found" },
    });
  });

  return app;
}

// Only start listening when run directly (not when imported by tests).
if (require.main === module) {
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://localhost:${env.port} (driver=${env.repositoryDriver})`);
  });
}
