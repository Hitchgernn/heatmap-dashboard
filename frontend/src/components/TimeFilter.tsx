import type { TimeWindow } from "../types/heatmap";
import { useLanguage } from "../context/language";

interface TimeFilterProps {
  value: TimeWindow;
  onChange: (window: TimeWindow) => void;
}

// Duration labels (5m/15m/1h) are universal; only "Today" is translated.
const OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "today", label: "Today" },
];

/**
 * Segmented control for the time window. Light pills, black active item.
 * Changing it triggers a refetch upstream.
 */
export default function TimeFilter({ value, onChange }: TimeFilterProps) {
  const { t } = useLanguage();
  return (
    <div
      role="group"
      aria-label="Time window"
      className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={
              "rounded-md px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 " +
              (active
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white")
            }
          >
            {opt.value === "today" ? t("time.today") : opt.label}
          </button>
        );
      })}
    </div>
  );
}
