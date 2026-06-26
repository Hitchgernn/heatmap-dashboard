import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import type { HeatPoint } from "../lib/map";
import { HEAT_GRADIENT } from "../lib/map";

interface HeatLayerProps {
  points: HeatPoint[];
  visible: boolean;
}

/**
 * Renders the leaflet.heat layer onto the parent map. Draws nothing itself
 * (returns null); the heat layer is created once and its points are updated in
 * place — never recreated on poll. Points are [lat, lng, intensity].
 */
export default function HeatLayer({ points, visible }: HeatLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.HeatLayer | null>(null);

  // Create the heat layer once.
  useEffect(() => {
    const layer = L.heatLayer([], {
      radius: 28,
      blur: 20,
      maxZoom: 18,
      minOpacity: 0.25,
      gradient: HEAT_GRADIENT,
    });
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map]);

  // Push new points into the existing layer (no layer recreation).
  useEffect(() => {
    layerRef.current?.setLatLngs(points);
  }, [points]);

  // Toggle visibility by adding/removing from the map.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (visible) layer.addTo(map);
    else layer.remove();
  }, [visible, map]);

  return null;
}
