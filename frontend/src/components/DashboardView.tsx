import MapView from "./MapView";
import DashboardCards from "./DashboardCards";
import HotspotTable from "./HotspotTable";
import TimeFilter from "./TimeFilter";
import LayerToggle from "./LayerToggle";
import DensityLegend from "./DensityLegend";
import type { HeatPoint } from "../lib/map";
import type { DashboardSummary, TimeWindow } from "../types/heatmap";
import type { Hotspot } from "../types/hotspot";

interface DashboardViewProps {
  timeWindow: TimeWindow;
  onTimeChange: (w: TimeWindow) => void;
  heatPoints: HeatPoint[];
  showHeatmap: boolean;
  showHotspots: boolean;
  onToggleHeatmap: (v: boolean) => void;
  onToggleHotspots: (v: boolean) => void;
  hotspots: Hotspot[];
  summary: DashboardSummary | null;
  loading: boolean;
  hotspotsLoading: boolean;
  /** Sidebar is collapsed — shift the top-left control clear of the show button. */
  sidebarCollapsed: boolean;
}

/**
 * Dashboard overview: a top row of summary cards, then a map (left) with the
 * hotspot summary panel beside it (right). The map shows the heatmap + hotspot
 * labels, with the time/layer controls and density legend overlaid.
 */
export default function DashboardView({
  timeWindow,
  onTimeChange,
  heatPoints,
  showHeatmap,
  showHotspots,
  onToggleHeatmap,
  onToggleHotspots,
  hotspots,
  summary,
  loading,
  hotspotsLoading,
  sidebarCollapsed,
}: DashboardViewProps) {
  return (
    <div className="space-y-5 p-6">
      {/* Summary cards across the top */}
      <DashboardCards summary={summary} loading={loading} areaCount={hotspots.length} />

      {/* Map (left) + hotspot summary panel (right) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="relative h-[480px] overflow-hidden rounded-xl border border-gray-200 shadow-sm">
          <MapView
            heatPoints={heatPoints}
            showHeatmap={showHeatmap}
            hotspots={hotspots}
            showHotspots={showHotspots}
          >
            <div className={"absolute top-3 z-[600] " + (sidebarCollapsed ? "left-14" : "left-3")}>
              <TimeFilter value={timeWindow} onChange={onTimeChange} />
            </div>
            <div className="absolute right-3 top-3 z-[600]">
              <LayerToggle
                showHeatmap={showHeatmap}
                showHotspots={showHotspots}
                onToggleHeatmap={onToggleHeatmap}
                onToggleHotspots={onToggleHotspots}
              />
            </div>
            <div className="absolute bottom-3 left-3 z-[600]">
              <DensityLegend />
            </div>
          </MapView>
        </div>

        <HotspotTable hotspots={hotspots} loading={hotspotsLoading} />
      </div>
    </div>
  );
}
