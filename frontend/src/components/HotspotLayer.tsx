import { Fragment } from "react";
import { Circle, CircleMarker, Tooltip } from "react-leaflet";
import type { Hotspot } from "../types/hotspot";
import { hotspotTier, maxPoints, TIER_META, type DensityTier } from "../lib/hotspots";

interface HotspotLayerProps {
  hotspots: Hotspot[];
  visible: boolean;
  /** Currently selected cluster id (highlighted), or null. */
  selectedId?: string | null;
  /** Called when a cluster marker is clicked. */
  onSelect?: (id: string) => void;
}

/** Prefer the backend's density tier; fall back to the relative derivation. */
function tierOf(h: Hotspot, max: number): DensityTier {
  return (h.density_level as DensityTier) ?? hotspotTier(h.total_points, max);
}

/**
 * Renders hotspots as interactive Leaflet circle markers (declarative children
 * of the MapContainer). Each cluster gets a translucent extent circle sized to
 * its real radius (metres), a centroid marker colored by density tier, and a
 * permanent label. Clicking a marker selects it; the selected cluster is
 * enlarged and its extent circle emphasized. Leaflet uses [latitude, longitude].
 */
export default function HotspotLayer({ hotspots, visible, selectedId, onSelect }: HotspotLayerProps) {
  if (!visible) return null;

  const max = maxPoints(hotspots);

  return (
    <>
      {hotspots.map((h) => {
        const tier = tierOf(h, max);
        const color = TIER_META[tier].color;
        const selected = selectedId === h.cluster_id;
        // Scale radius by relative size (clamped) so big clusters read larger.
        const markerRadius = Math.max(7, Math.min(16, 6 + Math.log10(h.total_points + 1) * 5));

        return (
          <Fragment key={h.cluster_id}>
            {/* Extent circle — real cluster spread in metres (skip if unknown/0). */}
            {h.radius_m && h.radius_m > 0 && (
              <Circle
                center={[h.center_lat, h.center_lng]}
                radius={h.radius_m}
                pathOptions={{
                  color,
                  weight: selected ? 2 : 1,
                  opacity: selected ? 0.9 : 0.4,
                  fillColor: color,
                  fillOpacity: selected ? 0.18 : 0.08,
                }}
                eventHandlers={{ click: () => onSelect?.(h.cluster_id) }}
              />
            )}

            <CircleMarker
              center={[h.center_lat, h.center_lng]} // [lat, lng]
              radius={selected ? markerRadius + 3 : markerRadius}
              pathOptions={{
                color: "#ffffff",
                weight: selected ? 3 : 2,
                fillColor: color,
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelect?.(h.cluster_id) }}
            >
              <Tooltip permanent direction="bottom" offset={[0, markerRadius]} className="hotspot-label">
                {h.label}
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </>
  );
}
