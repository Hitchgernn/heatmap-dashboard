import { useEffect, useRef, useState } from "react";
import type { CustomTimeUnit, TimeWindow, TimeWindowPreset } from "../types/heatmap";
import { useLanguage } from "../context/language";

interface TimeFilterProps {
  value: TimeWindow;
  onChange: (window: TimeWindow) => void;
}

// Duration labels (5m/15m/1h/3d/7d/30d) are universal; only "Today" is translated.
const OPTIONS: { value: TimeWindowPreset; label: string }[] = [
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "today", label: "Today" },
  { value: "3d", label: "3d" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

// Mirror the backend's 90-day custom-range cap (parseQuery.ts).
const MAX_DAYS = 90;
const MAX_HOURS = MAX_DAYS * 24;

const PILL_BASE =
  "rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ";
const PILL_ACTIVE = "bg-gray-900 text-white dark:bg-white dark:text-gray-900";
const PILL_IDLE =
  "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white";

/**
 * Segmented control for the time window. Light pills, black active item.
 * The trailing "Custom" pill opens a small popover for a "last N hours/days"
 * window. Changing the selection triggers a refetch upstream.
 */
export default function TimeFilter({ value, onChange }: TimeFilterProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(value.kind === "custom" ? String(value.amount) : "3");
  const [unit, setUnit] = useState<CustomTimeUnit>(value.kind === "custom" ? value.unit : "days");
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const parsed = Number(amount);
  const maxAmount = unit === "hours" ? MAX_HOURS : MAX_DAYS;
  const amountValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= maxAmount;

  const customActive = value.kind === "custom";
  const customLabel = customActive
    ? `${value.amount}${value.unit === "hours" ? "h" : "d"}`
    : t("time.custom");

  const apply = () => {
    if (!amountValid) return;
    onChange({ kind: "custom", amount: parsed, unit });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative inline-flex">
      <div
        role="group"
        aria-label="Time window"
        className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        {OPTIONS.map((opt) => {
          const active = value.kind === "preset" && opt.value === value.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setOpen(false);
                onChange({ kind: "preset", value: opt.value });
              }}
              aria-pressed={active}
              className={PILL_BASE + (active ? PILL_ACTIVE : PILL_IDLE)}
            >
              {opt.value === "today" ? t("time.today") : opt.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-pressed={customActive}
          aria-expanded={open}
          className={PILL_BASE + (customActive ? PILL_ACTIVE : PILL_IDLE)}
        >
          {customLabel}
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full z-[1000] mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <span className="text-sm text-gray-600 dark:text-gray-300">{t("time.last")}</span>
          <input
            type="number"
            min={1}
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
            }}
            aria-label={t("time.last")}
            aria-invalid={!amountValid}
            className={
              "w-16 rounded-md border bg-white px-2 py-1 font-mono text-sm tabular-nums text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:bg-gray-950 dark:text-gray-100 " +
              (amountValid
                ? "border-gray-200 dark:border-gray-700"
                : "border-red-400 dark:border-red-500")
            }
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as CustomTimeUnit)}
            aria-label="Unit"
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            <option value="hours">{t("time.hours")}</option>
            <option value="days">{t("time.days")}</option>
          </select>
          <button
            type="button"
            onClick={apply}
            disabled={!amountValid}
            className="rounded-md bg-gray-900 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {t("time.apply")}
          </button>
        </div>
      )}
    </div>
  );
}
