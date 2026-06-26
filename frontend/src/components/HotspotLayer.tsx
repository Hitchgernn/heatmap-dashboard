import { CircleMarker, Tooltip } from "react-leaflet";
import type { Hotspot } from "../types/hotspot";
import { hotspotTier, maxPoints, TIER_META } from "../lib/hotspots";

interface HotspotLayerProps {
  hotspots: Hotspot[];
  visible: boolean;
}

/**
 * Renders hotspots as Leaflet circle markers (declarative children of the
 * MapContainer). Leaflet uses [latitude, longitude], so center is
 * [center_lat, center_lng] — the opposite of GeoJSON. Each marker carries a
 * permanent label tooltip, and is colored by density tier relative to the
 * busiest cluster in the current set.
 */
export default function HotspotLayer({ hotspots, visible }: HotspotLayerProps) {
  if (!visible) return null;

  const max = maxPoints(hotspots);

  return (
    <>
      {hotspots.map((h) => {
        const tier = hotspotTier(h.total_points, max);
        const color = TIER_META[tier].color;
        // Scale radius by relative size (clamped) so big clusters read larger.
        const radius = Math.max(7, Math.min(16, 6 + Math.log10(h.total_points + 1) * 5));
        return (
          <CircleMarker
            key={h.cluster_id}
            center={[h.center_lat, h.center_lng]} // [lat, lng]
            radius={radius}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: color,
              fillOpacity: 1,
            }}
          >
            <Tooltip permanent direction="bottom" offset={[0, radius]} className="hotspot-label">
              {h.label}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
