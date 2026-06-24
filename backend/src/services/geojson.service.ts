/**
 * GeoJSON transformation service.
 *
 * Converts internal aggregated grid cells into a frontend-facing GeoJSON
 * FeatureCollection. visitor_id is never part of this structure, so privacy is
 * preserved by construction. Coordinates are emitted as [longitude, latitude].
 */

import type {
  AggregatedGridCell,
  HeatmapFeature,
  HeatmapFeatureCollection,
} from "../types/location";

export function toFeature(cell: AggregatedGridCell): HeatmapFeature {
  return {
    type: "Feature",
    properties: {
      grid_id: cell.grid_id,
      visitor_count: cell.visitor_count,
      weight: cell.weight,
      density_level: cell.density_level,
    },
    geometry: {
      type: "Point",
      // GeoJSON spec + Mapbox: [longitude, latitude]. Never [lat, lng].
      coordinates: [cell.center_lng, cell.center_lat],
    },
  };
}

export function toFeatureCollection(cells: AggregatedGridCell[]): HeatmapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells.map(toFeature),
  };
}
