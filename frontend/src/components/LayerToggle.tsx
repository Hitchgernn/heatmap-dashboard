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
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
      />
      {label}
    </label>
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
    <div className="inline-flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Layers</span>
      <Toggle label="Heatmap" checked={showHeatmap} onChange={onToggleHeatmap} />
      <Toggle label="Hotspots" checked={showHotspots} onChange={onToggleHotspots} />
    </div>
  );
}
