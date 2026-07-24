import { Fragment } from "react";
import { Circle, Marker } from "react-leaflet";
import L from "leaflet";
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

/** Teardrop map pin as a Leaflet divIcon, colored by density tier. */
function pinIcon(color: string, selected: boolean): L.DivIcon {
  const w = selected ? 34 : 28;
  const h = Math.round(w * 1.33);
  return L.divIcon({
    className: "hotspot-pin",
    html: `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"
      style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z"
        fill="${color}" stroke="#ffffff" stroke-width="${selected ? 2.5 : 2}"/>
      <circle cx="12" cy="12" r="4.2" fill="#ffffff"/>
    </svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h], // tip at the exact centroid
    tooltipAnchor: [0, -h + 6],
  });
}

/**
 * Renders hotspots as interactive Leaflet map pins (declarative children of the
 * MapContainer). Each cluster gets a translucent extent circle sized to its real
 * radius (metres) and a teardrop pin at the centroid, colored by density tier.
 * Clicking selects it; the selected cluster's pin is enlarged and its extent
 * circle emphasized. Leaflet uses [latitude, longitude].
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

            {/* No permanent label — the cluster name shows in the detail card
                on click, keeping the map uncluttered. */}
            <Marker
              position={[h.center_lat, h.center_lng]} // [lat, lng]
              icon={pinIcon(color, selected)}
              eventHandlers={{ click: () => onSelect?.(h.cluster_id) }}
            />

          </Fragment>
        );
      })}
    </>
  );
}
