/**
 * Auth route aggregator.
 *
 * Mounts sub-routers for each auth domain under their respective prefixes.
 * Currently only admin auth is implemented; visitor auth can be added here
 * later without touching index.ts.
 *
 * Mounted at /api/auth in index.ts, so:
 *   /api/auth/admin/signin
 *   /api/auth/admin/signup
 *   /api/auth/admin/logout
 *   /api/auth/admin/me
 *
 * Future:
 *   /api/auth/visitor/signin
 *   /api/auth/visitor/signup
 */

import { Router } from "express";
import adminRoutes from "./admin.routes";

const router = Router();

router.use("/admin", adminRoutes);

export default router;
