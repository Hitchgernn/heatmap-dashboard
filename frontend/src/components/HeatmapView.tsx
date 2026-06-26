import MapView from "./MapView";
import TimeFilter from "./TimeFilter";
import DensityLegend from "./DensityLegend";
import ActiveIndicator from "./ActiveIndicator";
import type { HeatPoint } from "../lib/map";
import type { TimeWindow } from "../types/heatmap";
import type { Hotspot } from "../types/hotspot";

interface HeatmapViewProps {
  timeWindow: TimeWindow;
  onTimeChange: (w: TimeWindow) => void;
  heatPoints: HeatPoint[];
  hotspots: Hotspot[];
  /** Sidebar is collapsed — shift top-left controls clear of the show button. */
  sidebarCollapsed: boolean;
}

/**
 * Full-map heatmap page: just the map, the time filter, a "Heatmap Active"
 * indicator, and the density legend. No summary cards or table. Heatmap is
 * always on here; hotspot labels stay visible for orientation.
 */
export default function HeatmapView({
  timeWindow,
  onTimeChange,
  heatPoints,
  hotspots,
  sidebarCollapsed,
}: HeatmapViewProps) {
  return (
    <div className="relative flex-1">
      <MapView heatPoints={heatPoints} showHeatmap hotspots={hotspots} showHotspots>
        <div className={"absolute top-3 z-[600] " + (sidebarCollapsed ? "left-14" : "left-3")}>
          <TimeFilter value={timeWindow} onChange={onTimeChange} />
        </div>
        <div className="absolute right-3 top-3 z-[600]">
          <ActiveIndicator label="Heatmap Active" />
        </div>
        <div className="absolute bottom-3 left-3 z-[600]">
          <DensityLegend />
        </div>
      </MapView>
    </div>
  );
}
