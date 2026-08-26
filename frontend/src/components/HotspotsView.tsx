import { useState } from "react";
import MapView from "./MapView";
import TimeFilter from "./TimeFilter";
import ActiveIndicator from "./ActiveIndicator";
import DensityLegend from "./DensityLegend";
import DbscanControls, { type DbscanParams } from "./DbscanControls";
import HotspotDetailCard from "./HotspotDetailCard";
import { useLanguage } from "../context/language";
import type { TimeWindow } from "../types/heatmap";
import type { ClusterPoint, Hotspot } from "../types/hotspot";

interface HotspotsViewProps {
  timeWindow: TimeWindow;
  onTimeChange: (w: TimeWindow) => void;
  hotspots: Hotspot[];
  /** DBSCAN scatter points, colored by cluster tier (grey = noise). */
  clusterPoints: ClusterPoint[];
  dbscanParams: DbscanParams;
  onDbscanChange: (p: DbscanParams) => void;
  /** Non-null while recomputing (e.g. after a source/param switch). */
  aggregatingLabel?: string | null;
  /** Sidebar is collapsed — shift top-left controls clear of the show button. */
  sidebarCollapsed: boolean;
}

/**
 * Full-map hotspots page: interactive DBSCAN clusters (click for detail, extent
 * circles) plus tuning sliders (eps / min_samples), the time filter, and the
 * density legend. No heat layer, no summary cards.
 */
export default function HotspotsView({
  timeWindow,
  onTimeChange,
  hotspots,
  clusterPoints,
  dbscanParams,
  onDbscanChange,
  aggregatingLabel,
  sidebarCollapsed,
}: HotspotsViewProps) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = hotspots.find((h) => h.cluster_id === selectedId) ?? null;

  return (
    <div className="relative flex-1">
      <MapView
        heatPoints={[]}
        showHeatmap={false}
        clusterPoints={clusterPoints}
        showClusterPoints
        hotspots={hotspots}
        showHotspots
        selectedHotspotId={selectedId}
        onSelectHotspot={setSelectedId}
        aggregatingLabel={aggregatingLabel}
      >
        {/* z above the other z-[600] overlays so the date picker opens over them. */}
        <div className={"absolute top-3 z-[650] flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2 sm:max-w-[calc(100%-13rem)] " +
          (sidebarCollapsed ? "left-14" : "left-3")}>
          <TimeFilter value={timeWindow} onChange={onTimeChange} />
          <DbscanControls value={dbscanParams} onChange={onDbscanChange} />
        </div>

        <div className="absolute right-3 top-3 z-[600] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
          <ActiveIndicator label={t("active.hotspots")} />
          {selected && (
            <HotspotDetailCard hotspot={selected} hotspots={hotspots} onClose={() => setSelectedId(null)} />
          )}
        </div>

        <div className="absolute bottom-3 left-3 z-[600]">
          <DensityLegend />
        </div>
      </MapView>
    </div>
  );
}
