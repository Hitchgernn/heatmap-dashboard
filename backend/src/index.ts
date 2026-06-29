/**
 * Express application entrypoint.
 */

import express, { type Request, type Response } from "express";
import cors from "cors";
import { env } from "./config/env";
import heatmapRoutes from "./routes/heatmap.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import mockRoutes from "./routes/mock.routes";
import hotspotRoutes from "./routes/hotspot.routes";
import debugRoutes from "./routes/debug.routes";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check — kept outside /api so infra probes hit a stable path.
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/heatmap", heatmapRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/mock", mockRoutes);
  app.use("/api/hotspots", hotspotRoutes);
  app.use("/api/debug", debugRoutes); // TEMPORARY — remove before production

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
