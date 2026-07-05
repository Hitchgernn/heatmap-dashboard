import MapView from "./MapView";
import TimeFilter from "./TimeFilter";
import ActiveIndicator from "./ActiveIndicator";
import DensityLegend from "./DensityLegend";
import { useLanguage } from "../context/language";
import type { TimeWindow } from "../types/heatmap";
import type { Hotspot } from "../types/hotspot";

interface HotspotsViewProps {
  timeWindow: TimeWindow;
  onTimeChange: (w: TimeWindow) => void;
  hotspots: Hotspot[];
  /** Sidebar is collapsed — shift top-left controls clear of the show button. */
  sidebarCollapsed: boolean;
}

/**
 * Full-map hotspots page: the map with hotspot markers + labels only (no heat
 * layer), the time filter, and a "Hotspots Active" indicator. No summary cards
 * or table.
 */
export default function HotspotsView({
  timeWindow,
  onTimeChange,
  hotspots,
  sidebarCollapsed,
}: HotspotsViewProps) {
  const { t } = useLanguage();
  return (
    <div className="relative flex-1">
      <MapView heatPoints={[]} showHeatmap={false} hotspots={hotspots} showHotspots>
        <div className={"absolute top-3 z-[600] " + (sidebarCollapsed ? "left-14" : "left-3")}>
          <TimeFilter value={timeWindow} onChange={onTimeChange} />
        </div>
        <div className="absolute right-3 top-3 z-[600]">
          <ActiveIndicator label={t("active.hotspots")} />
        </div>
        <div className="absolute bottom-3 left-3 z-[600]">
          <DensityLegend />
        </div>
      </MapView>
    </div>
  );
}
