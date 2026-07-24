import { CircleMarker } from "react-leaflet";
import type { ClusterPoint } from "../types/hotspot";
import { TIER_META } from "../lib/hotspots";

interface ClusterPointsLayerProps {
  points: ClusterPoint[];
  visible: boolean;
}

/** Noise (unclustered) points render in a muted grey. */
const NOISE_COLOR = "#9aa4b2";

/**
 * DBSCAN scatter: one small dot per clustered point, colored by its cluster's
 * density tier (grey for noise) — the "what DBSCAN saw" view, like the notebook.
 * Aggregate/anonymous positions only (no visitor_id, no ordering). Rendered on
 * the map's canvas (MapContainer preferCanvas) so thousands of dots stay smooth.
 * Leaflet uses [latitude, longitude].
 */
export default function ClusterPointsLayer({ points, visible }: ClusterPointsLayerProps) {
  if (!visible) return null;

  return (
    <>
      {points.map((p, i) => {
        const color = p.tier ? TIER_META[p.tier].color : NOISE_COLOR;
        return (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]} // [lat, lng]
            radius={3}
            pathOptions={{
              stroke: false,
              fillColor: color,
              fillOpacity: p.tier ? 0.85 : 0.5,
            }}
          />
        );
      })}
    </>
  );
}
