import MapView from "./MapView";
import DashboardCards from "./DashboardCards";
import HotspotTable from "./HotspotTable";
import HotspotBarChart from "./HotspotBarChart";
import DensityDonut from "./DensityDonut";
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
 * Dashboard overview: a top row of summary cards, then a flexible map (left)
 * beside a fixed-width right column holding the points-per-area bar chart above
 * the hotspot summary table. The map absorbs the width freed when the sidebar
 * collapses; the right column stays put. Map shows heatmap + hotspot labels
 * with the time/layer controls and density legend overlaid.
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

      {/* Capped map (left, up to ~720px square) + flexible right column (bar
          chart over table). The map holds its size; the right column is 1fr, so
          it extends to fill the width freed when the sidebar collapses.
          items-start keeps the shorter right column from stretching to the
          map's height. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)] lg:items-start">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 shadow-sm">
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

        <div className="flex flex-col gap-5">
          {/* Two charts side by side (stack below xl so the bar labels keep room):
              per-area magnitude on the left, density-tier composition on the right. */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <HotspotBarChart hotspots={hotspots} loading={hotspotsLoading} />
            <DensityDonut hotspots={hotspots} loading={hotspotsLoading} />
          </div>
          <HotspotTable hotspots={hotspots} loading={hotspotsLoading} />
        </div>
      </div>
    </div>
  );
}
