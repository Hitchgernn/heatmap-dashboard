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

export function useTimelapse(
  config: TimelapseConfig | null,
  source: string = "all"
): Timelapse {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [points, setPoints] = useState<HeatPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const cacheRef = useRef(new Map<number, Promise<HeatPoint[]>>());
  const abortRef = useRef<AbortController | null>(null);

  const totalFrames = config ? frameCount(config.range, config.step) : 0;

  // Full reset when the range/step changes, the mode toggles, or the data
  // source switches — cached frames belong to the old source and must be dropped.
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
  }, [config, source]);

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
          source,
          abortRef.current?.signal
        ).then(toHeatPoints);
        p.catch(() => cache.delete(index));
        cache.set(index, p);
      }
      return p;
    },
    [config, source]
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
