import { useMemo, useState } from "react";
import { useLanguage } from "../context/language";

interface DatePickerProps {
  /** Currently selected day, `yyyy-mm-dd`, or null when no date window is active. */
  value: string | null;
  onSelect: (date: string) => void;
  onClose: () => void;
}

/** `yyyy-mm-dd` for a Date, in local time (never toISOString — that is UTC). */
export function toDateValue(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Parse `yyyy-mm-dd` as a local-midnight Date (`new Date(str)` would be UTC). */
export function fromDateValue(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const CELL =
  "tap flex h-9 w-9 items-center justify-center rounded-lg font-mono text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-30 wall:h-11 wall:w-11 wall:text-base";
const CELL_SELECTED = "bg-gray-900 text-white dark:bg-white dark:text-gray-900";
const CELL_IDLE = "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800";
const CELL_MUTED = "text-gray-400 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-gray-800";
const NAV_BTN =
  "tap flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white";
const WIDE_CELL =
  "tap rounded-lg px-2 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-30";

/** Years shown per page in the year grid. */
const YEAR_PAGE = 12;

type Panel = "days" | "months" | "years";

/**
 * Calendar for picking one exact day. Three panels — days, months, years — so
 * a date years back is a few clicks, not months of arrow-tapping.
 *
 * Everything is local-time: log timestamps are read against the operator's
 * clock, so "12 July" must mean local midnight to local midnight.
 */
export default function DatePicker({ value, onSelect, onClose }: DatePickerProps) {
  const { t, lang } = useLanguage();
  const locale = lang === "id" ? "id-ID" : "en-GB";

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const selected = value ? fromDateValue(value) : null;

  const [panel, setPanel] = useState<Panel>("days");
  const [view, setView] = useState(() => {
    const anchor = selected ?? today;
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  });

  // Weekday initials in the active locale, starting Sunday (matching the grid).
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 8, 1 + i))); // 2024-09-01 is a Sunday
  }, [locale]);

  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "short" });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)));
  }, [locale]);

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(view.year, view.month, 1)
  );

  // Six weeks of cells starting on the Sunday on or before the 1st, so the grid
  // height never jumps between months.
  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const start = new Date(view.year, view.month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: d, outside: d.getMonth() !== view.month };
    });
  }, [view]);

  const yearStart = view.year - ((view.year % YEAR_PAGE) + YEAR_PAGE) % YEAR_PAGE;

  const shortcuts = useMemo(() => {
    const day = (offset: number) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return [
      { key: "time.today" as const, date: day(0) },
      { key: "time.yesterday" as const, date: day(-1) },
      { key: "time.weekAgo" as const, date: day(-7) },
    ];
  }, [today]);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Logs cannot exist in the future — a forward day would always come back empty.
  const isFuture = (d: Date) => d.getTime() > today.getTime();

  const pick = (d: Date) => {
    if (isFuture(d)) return;
    onSelect(toDateValue(d));
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  return (
    <div className="w-[19rem] rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-base text-gray-900 dark:text-white">{t("time.pickDate")}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("time.close")}
          className="tap flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() =>
            panel === "days"
              ? shiftMonth(-1)
              : panel === "months"
                ? setView((v) => ({ ...v, year: v.year - 1 }))
                : setView((v) => ({ ...v, year: v.year - YEAR_PAGE }))
          }
          aria-label={t("time.prev")}
          className={NAV_BTN}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* The header cycles days → months → years, so the same control that
            labels the view is also how you zoom out of it. */}
        <button
          type="button"
          onClick={() => setPanel(panel === "days" ? "months" : panel === "months" ? "years" : "days")}
          className="tap rounded-md px-2 py-1 font-display text-base text-gray-900 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:text-white dark:hover:bg-gray-800"
        >
          {panel === "days"
            ? monthLabel
            : panel === "months"
              ? view.year
              : `${yearStart}–${yearStart + YEAR_PAGE - 1}`}
        </button>

        <button
          type="button"
          onClick={() =>
            panel === "days"
              ? shiftMonth(1)
              : panel === "months"
                ? setView((v) => ({ ...v, year: v.year + 1 }))
                : setView((v) => ({ ...v, year: v.year + YEAR_PAGE }))
          }
          disabled={
            panel === "days"
              ? view.year === today.getFullYear() && view.month === today.getMonth()
              : panel === "months"
                ? view.year >= today.getFullYear()
                : yearStart + YEAR_PAGE > today.getFullYear()
          }
          aria-label={t("time.next")}
          className={NAV_BTN}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {panel === "days" && (
        <>
          <div className="grid grid-cols-7 gap-0.5">
            {weekdays.map((w) => (
              <span
                key={w}
                className="flex h-7 items-center justify-center font-mono text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                {w.slice(0, 2)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map(({ date, outside }) => {
              const isSelected = selected !== null && date.getTime() === selected.getTime();
              const isToday = date.getTime() === today.getTime();
              return (
                <button
                  key={date.getTime()}
                  type="button"
                  onClick={() => pick(date)}
                  disabled={isFuture(date)}
                  aria-pressed={isSelected}
                  aria-label={dateFmt.format(date)}
                  className={
                    CELL +
                    " " +
                    (isSelected ? CELL_SELECTED : outside ? CELL_MUTED : CELL_IDLE) +
                    (isToday && !isSelected ? " ring-1 ring-gray-300 dark:ring-gray-600" : "")
                  }
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </>
      )}

      {panel === "months" && (
        <div className="grid grid-cols-3 gap-1">
          {monthNames.map((name, i) => {
            const future = view.year > today.getFullYear() || (view.year === today.getFullYear() && i > today.getMonth());
            const active = selected !== null && selected.getFullYear() === view.year && selected.getMonth() === i;
            return (
              <button
                key={name}
                type="button"
                disabled={future}
                onClick={() => {
                  setView((v) => ({ ...v, month: i }));
                  setPanel("days");
                }}
                className={WIDE_CELL + " " + (active ? CELL_SELECTED : CELL_IDLE)}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {panel === "years" && (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: YEAR_PAGE }, (_, i) => yearStart + i).map((year) => (
            <button
              key={year}
              type="button"
              disabled={year > today.getFullYear()}
              onClick={() => {
                setView((v) => ({ ...v, year }));
                setPanel("months");
              }}
              className={
                WIDE_CELL +
                " font-mono tabular-nums " +
                (selected !== null && selected.getFullYear() === year ? CELL_SELECTED : CELL_IDLE)
              }
            >
              {year}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-0.5 border-t border-gray-200 pt-2 dark:border-gray-700">
        {shortcuts.map(({ key, date }) => (
          <button
            key={key}
            type="button"
            onClick={() => pick(date)}
            className="tap flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <span>{t(key)}</span>
            <span className="font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {dateFmt.format(date)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
