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

// min-w-0 lets the native date/time inputs shrink inside flex rows — without it
// they refuse to go below their (wide) min-content width and overflow the panel.
const INPUT_CLASS =
  "min-w-0 rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

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
    <div className="flex w-[min(18rem,calc(100vw-5rem))] flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
          className={`${INPUT_CLASS} w-full`}
        />
      ) : (
        // Labels stack above their inputs: a datetime-local is far too wide to
        // sit beside its label in this panel.
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300">
            {t("tl.from")}
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`${INPUT_CLASS} w-full`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300">
            {t("tl.to")}
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`${INPUT_CLASS} w-full`}
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
          className="tap rounded-md bg-gray-900 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
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
