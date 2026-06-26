import { CircleMarker, Popup } from "react-leaflet";
import type { Hotspot } from "../types/hotspot";

interface HotspotLayerProps {
  hotspots: Hotspot[];
  visible: boolean;
}

/**
 * Renders hotspots as Leaflet circle markers (declarative children of the
 * MapContainer). Leaflet uses [latitude, longitude], so center is
 * [center_lat, center_lng] — the opposite of GeoJSON. Sky ring distinct from
 * the warm heat ramp.
 */
export default function HotspotLayer({ hotspots, visible }: HotspotLayerProps) {
  if (!visible) return null;

  return (
    <>
      {hotspots.map((h) => {
        // Scale radius by relative size (clamped) so big clusters read larger.
        const radius = Math.max(9, Math.min(22, 8 + Math.log10(h.total_points + 1) * 6));
        return (
          <CircleMarker
            key={h.cluster_id}
            center={[h.center_lat, h.center_lng]} // [lat, lng]
            radius={radius}
            pathOptions={{
              color: "#38bdf8",
              weight: 2,
              fillColor: "#38bdf8",
              fillOpacity: 0.22,
            }}
          >
            <Popup>
              <strong>{h.label}</strong>
              <br />
              {h.total_points} points
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
