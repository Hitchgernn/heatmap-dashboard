import type { TimeWindow } from "../types/heatmap";

interface TimeFilterProps {
  value: TimeWindow;
  onChange: (window: TimeWindow) => void;
}

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
  return (
    <div
      role="group"
      aria-label="Time window"
      className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
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
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
