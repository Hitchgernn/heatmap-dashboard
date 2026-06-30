interface LayerToggleProps {
  showHeatmap: boolean;
  showHotspots: boolean;
  onToggleHeatmap: (value: boolean) => void;
  onToggleHotspots: (value: boolean) => void;
}

interface PillButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

/** One segmented button in the layer pill. */
function PillButton({ label, active, onClick, children }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 " +
        (active
          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white")
      }
    >
      {children}
      {label}
    </button>
  );
}

/** Segmented layer pill (Heatmap / Hotspots) for the dashboard map preview. */
export default function LayerToggle({
  showHeatmap,
  showHotspots,
  onToggleHeatmap,
  onToggleHotspots,
}: LayerToggleProps) {
  // "Heatmap" / "Hotspots" are section names — kept untranslated (see i18n.ts).
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <PillButton
        label="Heatmap"
        active={showHeatmap}
        onClick={() => onToggleHeatmap(!showHeatmap)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </PillButton>
      <PillButton
        label="Hotspots"
        active={showHotspots}
        onClick={() => onToggleHotspots(!showHotspots)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="10" r="3" />
          <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
        </svg>
      </PillButton>
    </div>
  );
}
