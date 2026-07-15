# Heatmap Timelapse + Hotspot Marker Removal — Design

Date: 2026-07-15
Status: approved (design discussion in-session)

## Goal

Let an admin replay how the visitor heatmap changed over a chosen date or time
range, stepping through it in fixed intervals (5m/10m/…) with a draggable
slider and auto-play. Also remove the hotspot point markers from the Heatmap
page (they belong to the Dashboard and Hotspots pages).

Frontend-only. The backend already serves arbitrary historical slices via
`GET /api/heatmap/aggregate?from=<iso>&to=<iso>` (validated `from < to`,
span ≤ 90 days), so no backend change is needed.

## Part 1 — Remove hotspot markers from Heatmap page

`frontend/src/components/HeatmapView.tsx` currently renders
`<MapView … hotspots={hotspots} showHotspots>`. Change to
`showHotspots={false}` and stop passing `hotspots` (drop the prop from
`HeatmapViewProps` and the `App.tsx` call site). Dashboard and Hotspots pages
keep their markers.

## Part 2 — Timelapse mode (Heatmap page)

### Mode toggle

A `Live | Timelapse` pill toggle on the Heatmap page.

- **Live** — exactly today's behavior: TimeFilter pills + 30s polling data
  from `App.tsx`.
- **Timelapse** — TimeFilter hides; a range/step setup panel and a slider bar
  appear; the page ignores live `heatPoints` and renders the selected frame's
  points instead. `App.tsx` polling itself is untouched (other pages/summary
  still refresh).

### Range + step setup

- Range: either a single date (interpreted as that local day, 00:00–24:00) or
  an explicit from/to datetime pair.
- Step: `5m | 10m | 15m | 30m | 1h`.
- Frame count = ceil(range / step), **capped at 288 frames** (one day at 5m).
  Over the cap → inline validation message telling the user to increase the
  step or shrink the range. Backend's 90-day span cap also applies.

### Slider bar

Floating bar at the bottom of the map (same visual family as the legend):

- Play/pause button (auto-advance ~800ms per frame, pause at last frame).
- `<input type="range">` slider, one tick per frame, drag to seek.
- Current frame time label, e.g. `10:05 – 10:10`, and counter `13/288`.

### Frame data

- Frame `i` covers `[start + i·step, start + (i+1)·step)` — a slice, not
  cumulative, so heat appears/disappears as crowds move.
- Fetched with the existing `getAggregatedHeatmap({ from, to })` client and
  converted with the existing `toHeatPoints()`.
- Client-side cache `Map<frameIndex, HeatPoint[]>`, reset when range/step
  changes. Fetch on seek; while playing, prefetch the next 3 frames.
- `AbortController` cancels in-flight fetches on mode exit or range change.
- An empty slice renders an empty heatmap — honest signal, no interpolation.

### State & errors

- All timelapse state (mode, range, step, frame index, playing, cache) lives
  in `HeatmapView` — nothing added to `App.tsx`.
- A failed frame fetch shows a small error pill; the slider stays usable and
  re-seeking retries.

### i18n & verification

- New strings added to both `en` and `id` in `lib/i18n.ts` (type-enforced).
- Verified with `npm run build` (tsc + vite); manual check via dev server.
  No frontend test runner exists.

## Out of scope

- Backend changes, new endpoints, WebSockets.
- Interpolation/smoothing between frames.
- Timelapse on Dashboard or Hotspots pages.
- Exporting/recording the animation.
