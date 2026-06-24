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

/** Segmented control for the time window. Changing it triggers a refetch upstream. */
export default function TimeFilter({ value, onChange }: TimeFilterProps) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
              (active
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-100")
            }
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
