import { useState } from "react";
import MapView from "./MapView";
import DashboardCards from "./DashboardCards";
import HotspotTable from "./HotspotTable";
import HotspotBarChart from "./HotspotBarChart";
import DensityDonut from "./DensityDonut";
import HotspotDetailCard from "./HotspotDetailCard";
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
  /** Non-null while recomputing (e.g. after a source/window switch). */
  aggregatingLabel?: string | null;
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
  aggregatingLabel,
  sidebarCollapsed,
}: DashboardViewProps) {
  // Selected hotspot, kept in sync between the table and the map markers.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = hotspots.find((h) => h.cluster_id === selectedId) ?? null;
  const toggleSelect = (id: string) => setSelectedId((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-4 p-4 sm:space-y-5 sm:p-6 wall:space-y-6 wall:p-8">
      {/* Summary cards across the top */}
      <DashboardCards summary={summary} loading={loading} areaCount={hotspots.length} />

      {/* Capped map (left, up to ~720px square) + flexible right column (bar
          chart over table). The map holds its size; the right column is 1fr, so
          it extends to fill the width freed when the sidebar collapses.
          items-start keeps the shorter right column from stretching to the
          map's height. */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)] lg:items-start wall:lg:grid-cols-[minmax(0,980px)_minmax(0,1fr)]">
        {/* Below `sm` a square map would push everything else off a phone-height
            viewport, so it takes a viewport fraction instead. */}
        <div className="relative h-[60vh] overflow-hidden rounded-xl border border-gray-200 shadow-sm sm:aspect-square sm:h-auto">
          <MapView
            heatPoints={heatPoints}
            showHeatmap={showHeatmap}
            hotspots={hotspots}
            showHotspots={showHotspots}
            selectedHotspotId={selectedId}
            onSelectHotspot={toggleSelect}
            aggregatingLabel={aggregatingLabel}
          >
            <div
              className={
                // Capped so the scrolling pill strip can never slide under the
                // layer toggle sitting at the map's top-right.
                "absolute top-3 z-[600] max-w-[50%] lg:max-w-[calc(100%-15rem)] " +
                (sidebarCollapsed ? "left-14" : "left-3")
              }
            >
              <TimeFilter value={timeWindow} onChange={onTimeChange} />
            </div>
            <div className="absolute right-3 top-3 z-[600] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
              <LayerToggle
                showHeatmap={showHeatmap}
                showHotspots={showHotspots}
                onToggleHeatmap={onToggleHeatmap}
                onToggleHotspots={onToggleHotspots}
              />
              {selected && showHotspots && (
                <HotspotDetailCard hotspot={selected} hotspots={hotspots} onClose={() => setSelectedId(null)} />
              )}
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
          <HotspotTable
            hotspots={hotspots}
            loading={hotspotsLoading}
            selectedId={selectedId}
            onSelect={toggleSelect}
          />
        </div>
      </div>
    </div>
  );
}
