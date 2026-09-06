import { MapMarker, RouteGuideEntry } from "../models/content-text.model";
import { RouteFollowPoint, RouteWaypointKind } from "../models/route-follow.model";
import { cumulativeDistances, pointAlongRoute } from "./route-geometry";
import { distanceAlongRouteMetres } from "./route-directions";
import { isAuthoredMarker } from "./map-location-markers";

export function guideEntriesFor(markers: MapMarker[], points: RouteFollowPoint[], includeUnwritten: boolean): RouteGuideEntry[] {
  return markers
    .map((marker, index) => ({marker, index}))
    .filter(entry => includeUnwritten ? isAuthoredMarker(entry.marker) : !!entry.marker.instruction?.trim())
    .map(entry => ({...entry, distanceMetres: distanceAlongRouteMetres(points, entry.marker)}));
}

export function stepAfter(points: RouteFollowPoint[], entries: RouteGuideEntry[], entry: RouteGuideEntry, id: string): MapMarker {
  const position = entries.indexOf(entry);
  const cumulative = cumulativeDistances(points);
  const from = entry.distanceMetres ?? 0;
  const next = entries[position + 1]?.distanceMetres ?? cumulative[cumulative.length - 1];
  const along = pointAlongRoute(points, cumulative, (from + next) / 2);
  return {id, latitude: along.point.latitude, longitude: along.point.longitude, label: "", instruction: "", kind: RouteWaypointKind.TURN};
}

export function renumberedSteps(markers: MapMarker[], points: RouteFollowPoint[]): MapMarker[] {
  const directed = markers.filter(marker => marker.kind === RouteWaypointKind.TURN || !!marker.instruction?.trim());
  const others = markers.filter(marker => !directed.includes(marker));
  const ordered = [...directed].sort((left, right) => (distanceAlongRouteMetres(points, left) ?? 0) - (distanceAlongRouteMetres(points, right) ?? 0));
  ordered.forEach((marker, index) => marker.label = String(index + 1));
  return [...others, ...ordered];
}
