# Heatmap Timelapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replay how the visitor heatmap changed over a chosen date or time range via a draggable frame slider with auto-play, and remove hotspot markers from the Heatmap page.

**Architecture:** Frontend-only. Each slider frame is one absolute historical slice fetched from the existing `GET /api/heatmap/aggregate?from&to` endpoint, cached client-side by frame index. All timelapse state lives in `HeatmapView`; `App.tsx` polling is untouched.

**Tech Stack:** React 18 + TypeScript + Tailwind v4 + Leaflet (`leaflet.heat` via existing `HeatLayer`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-15-heatmap-timelapse-design.md`

## Global Constraints

- Frontend has **no test runner** (CLAUDE.md). Verification per task is `npm run typecheck` from `frontend/`; final task runs `npm run build` plus a manual dev-server check.
- Frame cap: **288 frames**; backend span cap: **90 days** (mirror of `backend/src/utils/parseQuery.ts`).
- GeoJSON is `[lng, lat]`; Leaflet heat is `[lat, lng, weight]` — always convert via existing `toHeatPoints()`, never inline.
- Never add `visitor_id` (or any per-visitor field) to frontend types.
- i18n: `en` object in `frontend/src/lib/i18n.ts` defines `TranslationKey`; `id` must cover the same keys (type-enforced). "Live" / "Timelapse" stay as English literals in components (product-name convention), not dictionary entries.
- Commits: Conventional Commits, title only, no trailers.
- All commands below run from `frontend/` unless a path says otherwise.

---

### Task 1: Remove hotspot markers from Heatmap page

**Files:**
- Modify: `frontend/src/components/HeatmapView.tsx`
- Modify: `frontend/src/App.tsx:229-237` (heatmap page block)

**Interfaces:**
- Produces: `HeatmapViewProps` without `hotspots` — Task 5 rewrites this file and must keep that shape.

- [ ] **Step 1: Drop the `hotspots` prop from HeatmapView**

Replace the full contents of `frontend/src/components/HeatmapView.tsx` with:

```tsx
import MapView from "./MapView";
import TimeFilter from "./TimeFilter";
import DensityLegend from "./DensityLegend";
import ActiveIndicator from "./ActiveIndicator";
import { useLanguage } from "../context/language";
import type { HeatPoint } from "../lib/map";
import type { TimeWindow } from "../types/heatmap";

interface HeatmapViewProps {
  timeWindow: TimeWindow;
  onTimeChange: (w: TimeWindow) => void;
  heatPoints: HeatPoint[];
  /** Sidebar is collapsed — shift top-left controls clear of the show button. */
  sidebarCollapsed: boolean;
}

/**
 * Full-map heatmap page: just the map, the time filter, a "Heatmap Active"
 * indicator, and the density legend. No summary cards, table, or hotspot
 * markers — those live on the Dashboard and Hotspots pages.
 */
export default function HeatmapView({
  timeWindow,
  onTimeChange,
  heatPoints,
  sidebarCollapsed,
}: HeatmapViewProps) {
  const { t } = useLanguage();
  return (
    <div className="relative flex-1">
      <MapView heatPoints={heatPoints} showHeatmap hotspots={[]} showHotspots={false}>
        <div className={"absolute top-3 z-[600] " + (sidebarCollapsed ? "left-14" : "left-3")}>
          <TimeFilter value={timeWindow} onChange={onTimeChange} />
        </div>
        <div className="absolute right-3 top-3 z-[600]">
          <ActiveIndicator label={t("active.heatmap")} />
        </div>
        <div className="absolute bottom-3 left-3 z-[600]">
          <DensityLegend />
        </div>
      </MapView>
    </div>
  );
}
```

- [ ] **Step 2: Update the App.tsx call site**

In `frontend/src/App.tsx`, the heatmap page block currently reads:

```tsx
{page === "heatmap" && (
  <HeatmapView
    timeWindow={timeWindow}
    onTimeChange={setTimeWindow}
    heatPoints={heatPoints}
    hotspots={hotspots}
    sidebarCollapsed={!showSidebar}
  />
)}
```

Delete the `hotspots={hotspots}` line.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/HeatmapView.tsx frontend/src/App.tsx
git commit -m "feat(frontend): remove hotspot markers from heatmap page"
```

---

### Task 2: Timelapse frame helpers + slice fetcher

**Files:**
- Create: `frontend/src/lib/timelapse.ts`
- Modify: `frontend/src/lib/api.ts` (append one function)

**Interfaces:**
- Produces (used by Tasks 3–5):
  - `type TimelapseStep = "5m" | "10m" | "15m" | "30m" | "1h"`
  - `STEPS: TimelapseStep[]`, `STEP_MS: Record<TimelapseStep, number>`, `MAX_FRAMES = 288`, `MAX_SPAN_MS`
  - `interface TimelapseRange { fromMs: number; toMs: number }`
  - `type TimelapseRangeError = "invalidRange" | "spanTooLong" | "tooManyFrames"`
  - `validateRange(range, step): TimelapseRangeError | null`
  - `frameCount(range, step): number`
  - `frameBounds(range, step, index): TimelapseRange`
  - `dayRange(dateValue: string): TimelapseRange`
  - `formatTime(msEpoch: number): string`, `formatDate(msEpoch: number, locale?: string): string`
  - `getHeatmapSlice(fromIso: string, toIso: string, signal?): Promise<HeatmapFeatureCollection>` in `lib/api.ts`

- [ ] **Step 1: Create `frontend/src/lib/timelapse.ts`**

```ts
/**
 * Timelapse frame math: split a historical range into fixed-step frames.
 *
 * Pure helpers only — fetching and playback live in hooks/useTimelapse.ts.
 * The backend serves any absolute slice via from/to, so frames are plain
 * time arithmetic on unix-ms epochs.
 */

export type TimelapseStep = "5m" | "10m" | "15m" | "30m" | "1h";

export const STEPS: TimelapseStep[] = ["5m", "10m", "15m", "30m", "1h"];

export const STEP_MS: Record<TimelapseStep, number> = {
  "5m": 5 * 60_000,
  "10m": 10 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
};

/** Hard cap on slider frames (one full day at 5m). */
export const MAX_FRAMES = 288;

/** Mirror the backend's 90-day custom-range cap (parseQuery.ts). */
export const MAX_SPAN_MS = 90 * 24 * 60 * 60 * 1000;

/** Historical range to replay, unix ms. */
export interface TimelapseRange {
  fromMs: number;
  toMs: number;
}

export type TimelapseRangeError = "invalidRange" | "spanTooLong" | "tooManyFrames";

export function frameCount(range: TimelapseRange, step: TimelapseStep): number {
  return Math.ceil((range.toMs - range.fromMs) / STEP_MS[step]);
}

/** Validate a candidate range + step; null when ok. */
export function validateRange(
  range: TimelapseRange,
  step: TimelapseStep
): TimelapseRangeError | null {
  if (!Number.isFinite(range.fromMs) || !Number.isFinite(range.toMs) || range.fromMs >= range.toMs)
    return "invalidRange";
  if (range.toMs - range.fromMs > MAX_SPAN_MS) return "spanTooLong";
  if (frameCount(range, step) > MAX_FRAMES) return "tooManyFrames";
  return null;
}

/** Bounds of frame `index`: [from + i*step, min(from + (i+1)*step, to)). */
export function frameBounds(
  range: TimelapseRange,
  step: TimelapseStep,
  index: number
): TimelapseRange {
  const ms = STEP_MS[step];
  return {
    fromMs: range.fromMs + index * ms,
    toMs: Math.min(range.fromMs + (index + 1) * ms, range.toMs),
  };
}

/** Whole local day for a yyyy-mm-dd date-input value. */
export function dayRange(dateValue: string): TimelapseRange {
  const fromMs = new Date(`${dateValue}T00:00:00`).getTime(); // local midnight
  return { fromMs, toMs: fromMs + 24 * 60 * 60 * 1000 };
}

/** "10:05" local time for the slider label. */
export function formatTime(msEpoch: number): string {
  return new Date(msEpoch).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Local date string, shown when the range spans multiple days. */
export function formatDate(msEpoch: number, locale?: string): string {
  return new Date(msEpoch).toLocaleDateString(locale);
}
```

- [ ] **Step 2: Append `getHeatmapSlice` to `frontend/src/lib/api.ts`**

Add after `getAggregatedHeatmap` (which ends at the line `return fetchJson<HeatmapFeatureCollection>(url, signal);` followed by `}`):

```ts
/**
 * Fetch one absolute historical slice (a timelapse frame). Same raw-GeoJSON
 * endpoint as getAggregatedHeatmap, but with explicit from/to instants
 * instead of a rolling window.
 */
export function getHeatmapSlice(
  fromIso: string,
  toIso: string,
  signal?: AbortSignal
): Promise<HeatmapFeatureCollection> {
  const url = buildUrl("/api/heatmap/aggregate", { from: fromIso, to: toIso, source: "all" });
  return fetchJson<HeatmapFeatureCollection>(url, signal);
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/timelapse.ts frontend/src/lib/api.ts
git commit -m "feat(frontend): add timelapse frame helpers and slice fetcher"
```

---

### Task 3: useTimelapse playback hook

**Files:**
- Create: `frontend/src/hooks/useTimelapse.ts` (new `hooks/` directory)

**Interfaces:**
- Consumes: `getHeatmapSlice` (Task 2), `frameBounds`/`frameCount`/types (Task 2), `toHeatPoints`/`HeatPoint` from `lib/map.ts`.
- Produces (used by Task 5):
  - `interface TimelapseConfig { range: TimelapseRange; step: TimelapseStep }`
  - `useTimelapse(config: TimelapseConfig | null): Timelapse` where `Timelapse` has `totalFrames: number`, `frameIndex: number`, `seek(index: number): void`, `playing: boolean`, `togglePlay(): void`, `points: HeatPoint[]`, `loading: boolean`, `error: boolean`, `bounds: TimelapseRange | null`.
  - `FRAME_INTERVAL_MS = 800`
- Note for the implementer: the caller must keep `config` in React state (stable identity). A new object every render would reset the hook each render.

- [ ] **Step 1: Create `frontend/src/hooks/useTimelapse.ts`**

```ts
/**
 * Timelapse playback engine. Each frame is one absolute historical slice
 * served by the backend's existing from/to path. Frames are cached by index
 * as promises so concurrent prefetches never double-fetch; failed fetches
 * evict themselves so re-seeking retries.
 *
 * Pass `null` to disable (live mode) — all state resets and in-flight
 * fetches abort. `config` must have stable identity (keep it in state).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getHeatmapSlice } from "../lib/api";
import { toHeatPoints, type HeatPoint } from "../lib/map";
import {
  frameBounds,
  frameCount,
  type TimelapseRange,
  type TimelapseStep,
} from "../lib/timelapse";

/** Auto-play speed: one frame per interval. */
export const FRAME_INTERVAL_MS = 800;
/** Frames fetched ahead of the current one while seeking/playing. */
const PREFETCH_AHEAD = 3;

export interface TimelapseConfig {
  range: TimelapseRange;
  step: TimelapseStep;
}

export interface Timelapse {
  totalFrames: number;
  frameIndex: number;
  /** Jump to a frame (pauses playback). */
  seek: (index: number) => void;
  playing: boolean;
  togglePlay: () => void;
  /** Current frame's heat points ([] while loading or genuinely empty). */
  points: HeatPoint[];
  loading: boolean;
  error: boolean;
  /** Current frame bounds (unix ms) for the time label; null when disabled. */
  bounds: TimelapseRange | null;
}

export function useTimelapse(config: TimelapseConfig | null): Timelapse {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [points, setPoints] = useState<HeatPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const cacheRef = useRef(new Map<number, Promise<HeatPoint[]>>());
  const abortRef = useRef<AbortController | null>(null);

  const totalFrames = config ? frameCount(config.range, config.step) : 0;

  // Full reset when the range/step changes or the mode toggles.
  useEffect(() => {
    cacheRef.current = new Map();
    const controller = config ? new AbortController() : null;
    abortRef.current = controller;
    setFrameIndex(0);
    setPlaying(false);
    setPoints([]);
    setLoading(false);
    setError(false);
    return () => controller?.abort();
  }, [config]);

  const fetchFrame = useCallback(
    (index: number): Promise<HeatPoint[]> => {
      if (!config) return Promise.resolve([]);
      // Capture the map: after a config change a late rejection must evict
      // from its own generation's cache, not the fresh one.
      const cache = cacheRef.current;
      let p = cache.get(index);
      if (!p) {
        const b = frameBounds(config.range, config.step, index);
        p = getHeatmapSlice(
          new Date(b.fromMs).toISOString(),
          new Date(b.toMs).toISOString(),
          abortRef.current?.signal
        ).then(toHeatPoints);
        p.catch(() => cache.delete(index));
        cache.set(index, p);
      }
      return p;
    },
    [config]
  );

  // Load the current frame and prefetch the next few.
  useEffect(() => {
    if (!config) return;
    let stale = false;
    setLoading(true);
    fetchFrame(frameIndex)
      .then((pts) => {
        if (stale) return;
        setPoints(pts);
        setError(false);
      })
      .catch(() => {
        if (!stale) setError(true);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    for (let i = frameIndex + 1; i < Math.min(frameIndex + 1 + PREFETCH_AHEAD, totalFrames); i++) {
      fetchFrame(i).catch(() => {});
    }
    return () => {
      stale = true;
    };
  }, [config, frameIndex, fetchFrame, totalFrames]);

  // Auto-advance while playing; the next effect pauses at the last frame.
  useEffect(() => {
    if (!playing || totalFrames === 0) return;
    const id = setInterval(() => {
      setFrameIndex((i) => Math.min(i + 1, totalFrames - 1));
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, totalFrames]);

  useEffect(() => {
    if (playing && frameIndex >= totalFrames - 1) setPlaying(false);
  }, [playing, frameIndex, totalFrames]);

  const seek = useCallback((index: number) => {
    setPlaying(false);
    setFrameIndex(index);
  }, []);

  const togglePlay = useCallback(() => {
    // Play pressed at the end restarts from the first frame.
    if (!playing && totalFrames > 0 && frameIndex >= totalFrames - 1) setFrameIndex(0);
    setPlaying((p) => !p);
  }, [playing, frameIndex, totalFrames]);

  return {
    totalFrames,
    frameIndex,
    seek,
    playing,
    togglePlay,
    points,
    loading,
    error,
    bounds: config ? frameBounds(config.range, config.step, frameIndex) : null,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useTimelapse.ts
git commit -m "feat(frontend): add useTimelapse playback hook"
```

---

### Task 4: i18n keys + TimelapseSetup + TimelapseBar components

**Files:**
- Modify: `frontend/src/lib/i18n.ts` (append keys to both `en` and `id`)
- Create: `frontend/src/components/TimelapseSetup.tsx`
- Create: `frontend/src/components/TimelapseBar.tsx`

**Interfaces:**
- Consumes: `TimelapseConfig` (Task 3), timelapse helpers (Task 2), `useLanguage` + `TranslationKey` from existing code.
- Produces (used by Task 5):
  - `<TimelapseSetup onStart={(config: TimelapseConfig) => void} />`
  - `<TimelapseBar playing onTogglePlay frameIndex totalFrames onSeek timeLabel dateLabel loading error />` (exact prop types in the code below).

- [ ] **Step 1: Add i18n keys**

In `frontend/src/lib/i18n.ts`, in the **`en`** object, after the `"time.days": "days",` line, insert:

```ts
  // Timelapse (heatmap page)
  "tl.date": "Date",
  "tl.range": "Range",
  "tl.from": "From",
  "tl.to": "To",
  "tl.step": "Interval",
  "tl.start": "Start",
  "tl.play": "Play",
  "tl.pause": "Pause",
  "tl.loading": "Loading frame…",
  "tl.frameError": "Frame failed to load — drag to retry",
  "tl.errInvalidRange": "End must be after start",
  "tl.errSpanTooLong": "Range too long (max 90 days)",
  "tl.errTooManyFrames": "Too many frames — increase interval or shrink range",
```

In the **`id`** object, after its `"time.days": "hari",` line, insert:

```ts
  // Timelapse (heatmap page)
  "tl.date": "Tanggal",
  "tl.range": "Rentang",
  "tl.from": "Dari",
  "tl.to": "Sampai",
  "tl.step": "Interval",
  "tl.start": "Mulai",
  "tl.play": "Putar",
  "tl.pause": "Jeda",
  "tl.loading": "Memuat bingkai…",
  "tl.frameError": "Bingkai gagal dimuat — geser untuk mencoba lagi",
  "tl.errInvalidRange": "Waktu akhir harus setelah waktu awal",
  "tl.errSpanTooLong": "Rentang terlalu panjang (maks 90 hari)",
  "tl.errTooManyFrames": "Terlalu banyak bingkai — perbesar interval atau persempit rentang",
```

- [ ] **Step 2: Create `frontend/src/components/TimelapseSetup.tsx`**

```tsx
import { useState } from "react";
import { useLanguage } from "../context/language";
import type { TranslationKey } from "../lib/i18n";
import {
  STEPS,
  dayRange,
  validateRange,
  type TimelapseRange,
  type TimelapseRangeError,
  type TimelapseStep,
} from "../lib/timelapse";
import type { TimelapseConfig } from "../hooks/useTimelapse";

interface TimelapseSetupProps {
  onStart: (config: TimelapseConfig) => void;
}

const ERROR_KEYS: Record<TimelapseRangeError, TranslationKey> = {
  invalidRange: "tl.errInvalidRange",
  spanTooLong: "tl.errSpanTooLong",
  tooManyFrames: "tl.errTooManyFrames",
};

/** Local yyyy-mm-dd (not UTC — Indonesia is UTC+7, toISOString would drift). */
function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MODE_PILL_BASE =
  "rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ";
const MODE_PILL_ACTIVE = "bg-gray-900 text-white dark:bg-white dark:text-gray-900";
const MODE_PILL_IDLE =
  "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white";

const INPUT_CLASS =
  "rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

/**
 * Range + step picker for timelapse mode: a whole day (date input) or an
 * explicit from/to pair, plus the frame step. Start hands a validated
 * TimelapseConfig up to HeatmapView.
 */
export default function TimelapseSetup({ onStart }: TimelapseSetupProps) {
  const { t } = useLanguage();
  const [rangeMode, setRangeMode] = useState<"date" | "range">("date");
  const [date, setDate] = useState(todayLocal());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [step, setStep] = useState<TimelapseStep>("5m");

  const range: TimelapseRange | null =
    rangeMode === "date"
      ? date
        ? dayRange(date)
        : null
      : from && to
        ? { fromMs: new Date(from).getTime(), toMs: new Date(to).getTime() }
        : null;

  const error: TimelapseRangeError | null = range ? validateRange(range, step) : null;
  const canStart = range !== null && error === null;

  return (
    <div className="flex w-64 flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div
        role="group"
        aria-label="Range mode"
        className="inline-flex items-center gap-0.5 self-start rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
      >
        <button
          type="button"
          onClick={() => setRangeMode("date")}
          aria-pressed={rangeMode === "date"}
          className={MODE_PILL_BASE + (rangeMode === "date" ? MODE_PILL_ACTIVE : MODE_PILL_IDLE)}
        >
          {t("tl.date")}
        </button>
        <button
          type="button"
          onClick={() => setRangeMode("range")}
          aria-pressed={rangeMode === "range"}
          className={MODE_PILL_BASE + (rangeMode === "range" ? MODE_PILL_ACTIVE : MODE_PILL_IDLE)}
        >
          {t("tl.range")}
        </button>
      </div>

      {rangeMode === "date" ? (
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label={t("tl.date")}
          className={INPUT_CLASS}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
            {t("tl.from")}
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
            {t("tl.to")}
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
          {t("tl.step")}
          <select
            value={step}
            onChange={(e) => setStep(e.target.value as TimelapseStep)}
            className={INPUT_CLASS}
          >
            {STEPS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!canStart}
          onClick={() => range && onStart({ range, step })}
          className="rounded-md bg-gray-900 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {t("tl.start")}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {t(ERROR_KEYS[error])}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/TimelapseBar.tsx`**

```tsx
import { useLanguage } from "../context/language";

interface TimelapseBarProps {
  playing: boolean;
  onTogglePlay: () => void;
  frameIndex: number;
  totalFrames: number;
  onSeek: (index: number) => void;
  /** e.g. "10:05 – 10:10" */
  timeLabel: string;
  /** Frame-start date when the range spans multiple days; null hides it. */
  dateLabel: string | null;
  loading: boolean;
  error: boolean;
}

/**
 * Floating playback bar: play/pause, a frame slider (drag like a volume
 * knob), and the current frame's time label + counter. Presentational only —
 * playback state lives in useTimelapse.
 */
export default function TimelapseBar({
  playing,
  onTogglePlay,
  frameIndex,
  totalFrames,
  onSeek,
  timeLabel,
  dateLabel,
  loading,
  error,
}: TimelapseBarProps) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? t("tl.pause") : t("tl.play")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {playing ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="M4.5 2.6v10.8a.5.5 0 0 0 .76.42l8.6-5.4a.5.5 0 0 0 0-.84l-8.6-5.4a.5.5 0 0 0-.76.42Z" />
            </svg>
          )}
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(totalFrames - 1, 0)}
          step={1}
          value={frameIndex}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Frame"
          className="h-1.5 flex-1 cursor-pointer accent-gray-900 dark:accent-white"
        />

        <div className="flex shrink-0 flex-col items-end font-mono text-xs tabular-nums text-gray-700 dark:text-gray-200">
          <span>{timeLabel}</span>
          <span className="text-gray-400 dark:text-gray-500">
            {dateLabel ? `${dateLabel} · ` : ""}
            {frameIndex + 1}/{totalFrames}
          </span>
        </div>
      </div>

      {(loading || error) && (
        <p className={"text-xs " + (error ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500")}>
          {error ? t("tl.frameError") : t("tl.loading")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit 0. (The two components are not imported anywhere yet — that's fine; `tsc --noEmit` still checks them.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/i18n.ts frontend/src/components/TimelapseSetup.tsx frontend/src/components/TimelapseBar.tsx
git commit -m "feat(frontend): add timelapse setup panel and playback bar"
```

---

### Task 5: Wire timelapse mode into HeatmapView + verify

**Files:**
- Modify: `frontend/src/components/HeatmapView.tsx` (full rewrite, replacing Task 1's version)

**Interfaces:**
- Consumes: everything produced by Tasks 2–4. `HeatmapViewProps` stays exactly as Task 1 left it (`timeWindow`, `onTimeChange`, `heatPoints`, `sidebarCollapsed`) — `App.tsx` is untouched.

- [ ] **Step 1: Rewrite `frontend/src/components/HeatmapView.tsx`**

```tsx
import { useState } from "react";
import MapView from "./MapView";
import TimeFilter from "./TimeFilter";
import DensityLegend from "./DensityLegend";
import ActiveIndicator from "./ActiveIndicator";
import TimelapseSetup from "./TimelapseSetup";
import TimelapseBar from "./TimelapseBar";
import { useTimelapse, type TimelapseConfig } from "../hooks/useTimelapse";
import { formatDate, formatTime } from "../lib/timelapse";
import { useLanguage } from "../context/language";
import type { HeatPoint } from "../lib/map";
import type { TimeWindow } from "../types/heatmap";

interface HeatmapViewProps {
  timeWindow: TimeWindow;
  onTimeChange: (w: TimeWindow) => void;
  heatPoints: HeatPoint[];
  /** Sidebar is collapsed — shift top-left controls clear of the show button. */
  sidebarCollapsed: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Same pill styling as TimeFilter's segmented control.
const PILL_BASE =
  "rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ";
const PILL_ACTIVE = "bg-gray-900 text-white dark:bg-white dark:text-gray-900";
const PILL_IDLE =
  "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white";

/**
 * Full-map heatmap page with two modes:
 *  - Live: the polled heatmap from App.tsx plus the TimeFilter (existing
 *    behavior).
 *  - Timelapse: replay a historical date/range in fixed steps. Frame data is
 *    fetched per-slice by useTimelapse; the live heatPoints prop is ignored
 *    while active (App's polling itself keeps running for other pages).
 * No hotspot markers here — those live on the Dashboard and Hotspots pages.
 */
export default function HeatmapView({
  timeWindow,
  onTimeChange,
  heatPoints,
  sidebarCollapsed,
}: HeatmapViewProps) {
  const { t, lang } = useLanguage();
  const [mode, setMode] = useState<"live" | "timelapse">("live");
  const [config, setConfig] = useState<TimelapseConfig | null>(null);
  const timelapseActive = mode === "timelapse";
  const tl = useTimelapse(timelapseActive ? config : null);

  const displayPoints = timelapseActive ? tl.points : heatPoints;
  const multiDay = config !== null && config.range.toMs - config.range.fromMs > DAY_MS;

  return (
    <div className="relative flex-1">
      <MapView heatPoints={displayPoints} showHeatmap hotspots={[]} showHotspots={false}>
        <div
          className={
            "absolute top-3 z-[600] flex flex-col items-start gap-2 " +
            (sidebarCollapsed ? "left-14" : "left-3")
          }
        >
          {/* "Live" / "Timelapse" are product-style names — English in both locales. */}
          <div
            role="group"
            aria-label="Map mode"
            className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <button
              type="button"
              onClick={() => setMode("live")}
              aria-pressed={!timelapseActive}
              className={PILL_BASE + (!timelapseActive ? PILL_ACTIVE : PILL_IDLE)}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => setMode("timelapse")}
              aria-pressed={timelapseActive}
              className={PILL_BASE + (timelapseActive ? PILL_ACTIVE : PILL_IDLE)}
            >
              Timelapse
            </button>
          </div>

          {timelapseActive ? (
            <TimelapseSetup onStart={setConfig} />
          ) : (
            <TimeFilter value={timeWindow} onChange={onTimeChange} />
          )}
        </div>

        {!timelapseActive && (
          <div className="absolute right-3 top-3 z-[600]">
            <ActiveIndicator label={t("active.heatmap")} />
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-[600]">
          <DensityLegend />
        </div>

        {timelapseActive && config && tl.bounds && (
          <div className="absolute bottom-3 left-1/2 z-[600] w-[min(560px,calc(100%-180px))] -translate-x-1/2">
            <TimelapseBar
              playing={tl.playing}
              onTogglePlay={tl.togglePlay}
              frameIndex={tl.frameIndex}
              totalFrames={tl.totalFrames}
              onSeek={tl.seek}
              timeLabel={`${formatTime(tl.bounds.fromMs)} – ${formatTime(tl.bounds.toMs)}`}
              dateLabel={multiDay ? formatDate(tl.bounds.fromMs, lang === "id" ? "id-ID" : "en-GB") : null}
              loading={tl.loading}
              error={tl.error}
            />
          </div>
        )}
      </MapView>
    </div>
  );
}
```

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: tsc passes, vite build succeeds (chunk-size warnings about Leaflet are pre-existing and fine).

- [ ] **Step 3: Manual verification (dev servers)**

Backend on :3001 (check `ss -ltnp | grep :3001`; if down, `npm run dev` from `backend/` in background). Frontend: `npm run dev` from `frontend/`, open http://localhost:5173, sign in, go to Heatmap page. Verify:
- No hotspot circle markers on the map.
- `Live | Timelapse` toggle appears; Live behaves exactly as before.
- Timelapse: pick today's date, step 5m, Start → slider bar appears bottom-center; drag seeks frames (time label updates, e.g. `10:05 – 10:10`); play auto-advances ~0.8s/frame and pauses at the end; DevTools network shows `from`/`to` requests only for uncached frames.
- Over-cap check: Range mode spanning 30 days at 5m shows the "too many frames" error and Start disabled.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/HeatmapView.tsx
git commit -m "feat(frontend): wire timelapse mode into heatmap page"
```

- [ ] **Step 5: Update local CLAUDE.md (untracked, no commit)**

Add to the "Frontend architecture" section: a bullet noting the Heatmap page has Live/Timelapse modes — timelapse fetches per-frame slices via `getHeatmapSlice(from, to)` cached by frame index in `hooks/useTimelapse.ts` (cap 288 frames), and the Heatmap page no longer renders hotspot markers.
