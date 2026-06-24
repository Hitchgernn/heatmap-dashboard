/**
 * Standard HTTP response helpers, so every route emits the same envelope.
 */

import type { Response } from "express";

export function errorResponse(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

export function successResponse(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}
