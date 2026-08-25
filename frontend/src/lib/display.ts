/**
 * Display mode — which physical screen the dashboard is running on.
 *
 * "desk" is the default: a seated operator on a laptop or desktop.
 * "wall" is a control-room / large-format screen read from across a room,
 * usually unattended. It is entered with a URL flag so a wall machine can be
 * pointed at a bookmark and left alone:
 *
 *     http://<host>/?display=wall
 *     http://<host>/?display=wall&page=heatmap   (pin the view too)
 *
 * The mode is resolved once at module load — it never changes for the life of
 * the tab — so components can import `isWall()` directly instead of threading a
 * prop through every layer. The `wall` class it puts on <html> drives the
 * `wall:` Tailwind variant declared in index.css.
 */

import type { Page } from "../types/nav";

export type DisplayMode = "desk" | "wall";

/** Pages a `?page=` pin may name (mirrors PERSISTED_PAGES in App.tsx). */
const PINNABLE_PAGES: Page[] = ["dashboard", "heatmap", "hotspots", "mock"];

function readParams(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

const params = readParams();

export const DISPLAY_MODE: DisplayMode = params?.get("display") === "wall" ? "wall" : "desk";

/** True when this tab is running as a wall / control-room display. */
export function isWall(): boolean {
  return DISPLAY_MODE === "wall";
}

/**
 * The page named by `?page=`, or null. Lets a wall bookmark pin a view without
 * inheriting whatever page the last operator left in localStorage.
 */
export function pinnedPage(): Page | null {
  const value = params?.get("page") as Page | null;
  return value && PINNABLE_PAGES.includes(value) ? value : null;
}

/** Put the `wall` class on <html> so the `wall:` variant applies. Idempotent. */
export function applyDisplayMode(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("wall", DISPLAY_MODE === "wall");
}
