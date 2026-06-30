interface ActiveIndicatorProps {
  /** Resolved, already-translated label (e.g. "Heatmap Active"). */
  label: string;
  /** Dot color (defaults to emerald). */
  color?: string;
}

/** A small "<layer> active" status pill for the dedicated full-map pages. */
export default function ActiveIndicator({ label, color = "#10b981" }: ActiveIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
  );
}
