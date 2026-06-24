interface LayerToggleProps {
  showHeatmap: boolean;
  showHotspots: boolean;
  onToggleHeatmap: (value: boolean) => void;
  onToggleHotspots: (value: boolean) => void;
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  /** Accent dot color so each layer reads at a glance. */
  dotClass: string;
}

/** A switch-style toggle with a clear on/off track and a layer color dot. */
function Toggle({ label, checked, onChange, dotClass }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm text-slate-300 transition-colors hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <span
        className={
          "relative h-4 w-7 rounded-full transition-colors " +
          (checked ? "bg-sky-500" : "bg-slate-700")
        }
      >
        <span
          className={
            "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform " +
            (checked ? "translate-x-3.5" : "translate-x-0.5")
          }
        />
      </span>
      <span className={"h-1.5 w-1.5 rounded-full " + dotClass} aria-hidden="true" />
      {label}
    </button>
  );
}

/** Toggles for the heatmap and hotspot layers. */
export default function LayerToggle({
  showHeatmap,
  showHotspots,
  onToggleHeatmap,
  onToggleHotspots,
}: LayerToggleProps) {
  return (
    <div className="inline-flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        Layers
      </span>
      <Toggle
        label="Heatmap"
        checked={showHeatmap}
        onChange={onToggleHeatmap}
        dotClass="bg-orange-400"
      />
      <Toggle
        label="Hotspots"
        checked={showHotspots}
        onChange={onToggleHotspots}
        dotClass="bg-sky-400"
      />
    </div>
  );
}
