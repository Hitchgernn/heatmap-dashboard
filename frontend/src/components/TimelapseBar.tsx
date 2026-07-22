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

      {(loading || error) &&
        (error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{t("tl.frameError")}</p>
        ) : (
          <p
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
            role="status"
            aria-live="polite"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-3 w-3 animate-spin text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
              <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t("tl.processing")}
          </p>
        ))}
    </div>
  );
}
