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
    <div
      role="group"
      aria-label="Time window"
      className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1"
    >
      <span className="px-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        Window
      </span>
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 " +
              (active
                ? "bg-sky-500 text-slate-950"
                : "text-slate-300 hover:bg-slate-800 hover:text-slate-100")
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
