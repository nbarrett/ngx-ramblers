import { LocationRenderingMode, LocationRowData, MapMarker, PageContent, PageContentRow, PageContentType } from "../models/content-text.model";
import { RouteWaypointKind } from "../models/route-follow.model";
import { formatGridReference } from "./grid-reference";

const LOCATION_KINDS = [RouteWaypointKind.START, RouteWaypointKind.END];

export function isAuthoredMarker(marker: MapMarker): boolean {
  return !!marker.instruction?.trim() || !!marker.id || (!!marker.kind && !LOCATION_KINDS.includes(marker.kind));
}

function locationMarker(point: LocationRowData["start"] | undefined, fallbackLabel: string, kind: RouteWaypointKind): MapMarker[] {
  const usable = point?.latitude != null && point?.longitude != null;
  return usable ? [{latitude: point.latitude, longitude: point.longitude, label: formatGridReference(point.description) || fallbackLabel, kind}] : [];
}

export function rowsWithin(rows: PageContentRow[] | undefined): PageContentRow[] {
  return (rows || []).flatMap(row => [row, ...(row.columns || []).flatMap(column => rowsWithin(column.rows))]);
}

export function routeRowIn(pageContent: PageContent | null | undefined): PageContentRow | undefined {
  return rowsWithin(pageContent?.rows).find(row => row.type === PageContentType.ROUTE);
}

export function pageLocation(pageContent: PageContent | null | undefined): LocationRowData | null {
  const locationRow = pageContent?.rows?.find(row => row.type === PageContentType.LOCATION && row.location);
  const routeRow = rowsWithin(pageContent?.rows).find(row => row.type === PageContentType.ROUTE && row.routeGuide?.start_location);
  return locationRow?.location || (routeRow ? {start: routeRow.routeGuide.start_location, renderingMode: LocationRenderingMode.HIDDEN} : null);
}

export function markersSyncedWithLocation(current: MapMarker[], location: Pick<LocationRowData, "start" | "end"> | undefined): MapMarker[] {
  return [
    ...locationMarker(location?.start, "Start", RouteWaypointKind.START),
    ...locationMarker(location?.end, "End", RouteWaypointKind.END),
    ...(current || []).filter(isAuthoredMarker)
  ];
}
