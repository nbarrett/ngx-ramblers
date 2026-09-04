import { isAuthoredMarker, markersSyncedWithLocation, pageLocation } from "./map-location-markers";
import { RouteWaypointKind } from "../models/route-follow.model";
import { LocationRenderingMode, LocationRowData, MapMarker, PageContent, PageContentType } from "../models/content-text.model";

const location = {
  start: {latitude: 51.27, longitude: 1.21, description: "TR243576"},
  end: {latitude: 51.3, longitude: 1.25, description: ""}
} as LocationRowData;

describe("markersSyncedWithLocation", () => {
  it("keeps authored waypoints alongside the start and end markers from the location row", () => {
    const authored: MapMarker = {id: "w1", latitude: 51.28, longitude: 1.22, label: "1", instruction: "Turn left", kind: RouteWaypointKind.WAYPOINT};
    const stale: MapMarker = {latitude: 50, longitude: 0, label: "Old start"};
    const result = markersSyncedWithLocation([stale, authored], location);
    expect(result.map(marker => marker.label)).toEqual(["TR 243 576", "End", "1"]);
    expect(result[0].kind).toBe(RouteWaypointKind.START);
    expect(result[1].kind).toBe(RouteWaypointKind.END);
    expect(result[2]).toBe(authored);
  });

  it("produces only the start marker when there is no end location", () => {
    expect(markersSyncedWithLocation([], {start: location.start} as LocationRowData).map(marker => marker.label)).toEqual(["TR 243 576"]);
    expect(markersSyncedWithLocation([], undefined)).toEqual([]);
  });
});

describe("isAuthoredMarker", () => {
  it("treats markers with a direction, an id or a non-location kind as authored", () => {
    expect(isAuthoredMarker({latitude: 1, longitude: 1, label: "Start"})).toBe(false);
    expect(isAuthoredMarker({latitude: 1, longitude: 1, label: "Start", kind: RouteWaypointKind.START})).toBe(false);
    expect(isAuthoredMarker({latitude: 1, longitude: 1, instruction: "Go left"})).toBe(true);
    expect(isAuthoredMarker({id: "x", latitude: 1, longitude: 1})).toBe(true);
    expect(isAuthoredMarker({latitude: 1, longitude: 1, kind: RouteWaypointKind.TURN})).toBe(true);
  });
});

describe("pageLocation", () => {
  const start = {latitude: 51.2, longitude: 1.1, grid_reference_6: "", grid_reference_8: "", grid_reference_10: "", postcode: "CT4 6NZ", description: "Barham", w3w: ""};

  it("prefers a location row when the page has one", () => {
    const page = {rows: [{type: PageContentType.LOCATION, location: {start, renderingMode: LocationRenderingMode.VISIBLE}, columns: []}, {type: PageContentType.ROUTE, routeGuide: {start_location: {...start, postcode: "OTHER"}}, columns: []}]} as PageContent;
    expect(pageLocation(page)?.start.postcode).toBe("CT4 6NZ");
  });

  it("falls back to the route row's start when there is no location row", () => {
    const page = {rows: [{type: PageContentType.ROUTE, routeGuide: {start_location: start}, columns: []}]} as PageContent;
    expect(pageLocation(page)?.start.postcode).toBe("CT4 6NZ");
    expect(pageLocation(page)?.renderingMode).toBe(LocationRenderingMode.HIDDEN);
  });

  it("returns null when the page has neither", () => {
    expect(pageLocation({rows: [{type: PageContentType.TEXT, columns: []}]} as PageContent)).toBeNull();
  });
});
