import MapView from "./MapView";
import TimeFilter from "./TimeFilter";
import DensityLegend from "./DensityLegend";
import ActiveIndicator from "./ActiveIndicator";
import { useLanguage } from "../context/language";
import type { HeatPoint } from "../lib/map";
import type { TimeWindow } from "../types/heatmap";

interface HeatmapViewProps {
  timeWindow: TimeWindow;
  onTimeChange: (w: TimeWindow) => void;
  heatPoints: HeatPoint[];
  /** Sidebar is collapsed — shift top-left controls clear of the show button. */
  sidebarCollapsed: boolean;
}

/**
 * Full-map heatmap page: just the map, the time filter, a "Heatmap Active"
 * indicator, and the density legend. No summary cards, table, or hotspot
 * markers — those live on the Dashboard and Hotspots pages.
 */
export default function HeatmapView({
  timeWindow,
  onTimeChange,
  heatPoints,
  sidebarCollapsed,
}: HeatmapViewProps) {
  const { t } = useLanguage();
  return (
    <div className="relative flex-1">
      <MapView heatPoints={heatPoints} showHeatmap hotspots={[]} showHotspots={false}>
        <div className={"absolute top-3 z-[600] " + (sidebarCollapsed ? "left-14" : "left-3")}>
          <TimeFilter value={timeWindow} onChange={onTimeChange} />
        </div>
        <div className="absolute right-3 top-3 z-[600]">
          <ActiveIndicator label={t("active.heatmap")} />
        </div>
        <div className="absolute bottom-3 left-3 z-[600]">
          <DensityLegend />
        </div>
      </MapView>
    </div>
  );
}
