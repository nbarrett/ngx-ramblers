import { LocationRenderingMode, LocationRowData, MapMarker, PageContent, PageContentRow, PageContentType } from "../models/content-text.model";
import { RouteWaypointKind } from "../models/route-follow.model";
import { formatGridReference, parseGridReference } from "./grid-reference";

const LOCATION_KINDS = [RouteWaypointKind.START, RouteWaypointKind.END];

export function isAuthoredMarker(marker: MapMarker): boolean {
  return !!marker.instruction?.trim() || !!marker.id || (!!marker.kind && !LOCATION_KINDS.includes(marker.kind));
}

function gridReferenceLabel(point: LocationRowData["start"]): string | null {
  const gridReference = [point.description, point.grid_reference_6, point.grid_reference_8, point.grid_reference_10]
    .find(value => !!parseGridReference(value || ""));
  return gridReference ? formatGridReference(gridReference) : null;
}

function locationMarker(point: LocationRowData["start"] | undefined, fallbackLabel: string, kind: RouteWaypointKind): MapMarker[] {
  const usable = point?.latitude != null && point?.longitude != null;
  return usable ? [{
    latitude: point.latitude,
    longitude: point.longitude,
    label: gridReferenceLabel(point) || fallbackLabel,
    instruction: point.description || point.postcode || null,
    kind
  }] : [];
}

export function rowsWithin(rows: PageContentRow[] | undefined): PageContentRow[] {
  return (rows || []).flatMap(row => [row, ...(row.columns || []).flatMap(column => rowsWithin(column.rows))]);
}

export function routeRowIn(pageContent: PageContent | null | undefined): PageContentRow | undefined {
  return rowsWithin(pageContent?.rows).find(row => row.type === PageContentType.ROUTE);
}

export function pageLocation(pageContent: PageContent | null | undefined): LocationRowData | null {
  const rows = rowsWithin(pageContent?.rows);
  const locationRow = rows.find(row => row.type === PageContentType.LOCATION && row.location);
  const routeRow = rows.find(row => row.type === PageContentType.ROUTE && row.routeGuide?.start_location);
  return locationRow?.location || (routeRow ? {start: routeRow.routeGuide.start_location, renderingMode: LocationRenderingMode.HIDDEN} : null);
}

export function markersSyncedWithLocation(current: MapMarker[], location: Pick<LocationRowData, "start" | "end"> | undefined): MapMarker[] {
  return [
    ...locationMarker(location?.start, "Start", RouteWaypointKind.START),
    ...locationMarker(location?.end, "End", RouteWaypointKind.END),
    ...(current || []).filter(isAuthoredMarker)
  ];
}
