import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import * as L from "leaflet";
import proj4 from "proj4";
import { EPSG_27700_PROJ4, MapProjectionCode } from "../../common/maps/map-projection.constants";
import { GridReferenceLookupResponse } from "../../models/address-model";
import { formatGridReference } from "../../functions/grid-reference";
import { LOCATE_OVERVIEW_CENTRE } from "../../models/locate.model";
import { StoredValue } from "../../models/ui-actions";
import { ClipboardService } from "../../services/clipboard.service";
import { GoogleMapsService } from "../../services/google-maps.service";
import { LoggerFactory } from "../../services/logger-factory.service";
import { CurrentLocationService } from "../../services/maps/current-location.service";
import { LocateMarkersService } from "../../services/maps/locate-markers.service";
import { GridReferenceService } from "../../services/maps/grid-reference.service";
import { MapMarkerStyleService } from "../../services/maps/map-marker-style.service";
import { MapTilesService } from "../../services/maps/map-tiles.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { PageService } from "../../services/page.service";
import { UiActionsService } from "../../services/ui-actions.service";
import { UrlService } from "../../services/url.service";
import { AddressQueryService } from "../../services/walks/address-query.service";
import { WalkDisplayService } from "../walks/walk-display.service";
import { LocatePageComponent } from "./locate-page";

describe("Locate pin interaction", () => {
  const lookup = vi.fn();
  const updateQueryParameters = vi.fn().mockResolvedValue(true);
  const state: {component: LocatePageComponent; map: L.Map; grid: GridReferenceService} = {component: null, map: null, grid: null};

  beforeEach(() => {
    lookup.mockReset().mockResolvedValue([]);
    updateQueryParameters.mockClear();
    TestBed.configureTestingModule({providers: [
      LocateMarkersService,
      {provide: ActivatedRoute, useValue: {snapshot: {queryParamMap: convertToParamMap({})}}},
      {provide: UiActionsService, useValue: {initialValueFor: () => null, updateQueryParameters}},
      {provide: MapTilesService, useValue: {
        initializeProjections: () => proj4.defs(MapProjectionCode.BRITISH_NATIONAL_GRID, EPSG_27700_PROJ4),
        matchingZoom: () => 16
      }},
      {provide: MapMarkerStyleService, useValue: {markerIcon: () => L.divIcon(), numberedMarkerIcon: () => L.divIcon(), previewPinHtml: () => "<svg></svg>"}},
      {provide: AddressQueryService, useValue: {gridReferenceLookupFromLatLng: lookup}},
      {provide: LoggerFactory, useValue: {createLogger: () => ({warn: vi.fn()})}},
      {provide: WalkDisplayService, useValue: {
        googleDirectionsAvailable: () => false,
        formatGrid: (grid, digits) => formatGridReference(grid, digits, true)
      }},
      ...[PageService, UrlService, CurrentLocationService, GoogleMapsService, MemberLoginService, ClipboardService]
        .map(provide => ({provide, useValue: {}}))
    ]});
    state.component = TestBed.runInInjectionContext(() => new LocatePageComponent());
    state.grid = TestBed.inject(GridReferenceService);
    state.map = L.map(document.createElement("div")).setView([51.5, -0.1], 16);
    state.component.onMapReady(state.map);
  });

  afterEach(() => {
    state.map.remove();
    state.component.ngOnDestroy();
  });

  it("resets the map to the overview without removing the selected location", async () => {
    state.component.onMapClick({latlng: L.latLng(51.5, -0.1)} as L.LeafletMouseEvent);
    const point = state.component.point;
    const moved = new Promise<void>(resolve => state.map.once("moveend", () => resolve()));
    state.component.resetView();
    await moved;
    expect(state.map.getCenter().lat).toBeCloseTo(LOCATE_OVERVIEW_CENTRE[0], 3);
    expect(state.map.getCenter().lng).toBeCloseTo(LOCATE_OVERVIEW_CENTRE[1], 3);
    expect(state.component.point).toEqual(point);
  });

  it("updates all coordinate formats during drag and looks up the address on release", async () => {
    state.component.onMapClick({latlng: L.latLng(51.5, -0.1)} as L.LeafletMouseEvent);
    await Promise.resolve();
    lookup.mockClear();
    const layers: L.Marker[] = [];
    state.map.eachLayer(layer => {
      if (layer instanceof L.Marker) {
        layers.push(layer);
      }
    });
    const pin = layers[0];
    pin.setLatLng([51.501, -0.102]).fire("drag");
    const point = state.grid.fromLatLng(51.501, -0.102);
    expect(state.component.point).toEqual(point);
    expect(state.component.location.latitude).toBe(51.501);
    expect(state.component.location.grid_reference_10).toBe(point.gridReference10);
    expect(state.component.coordinateInputs.eastings).toBe(String(point.eastings));
    expect(lookup).not.toHaveBeenCalled();
    pin.fire("dragend");
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(updateQueryParameters).toHaveBeenLastCalledWith(expect.objectContaining({[StoredValue.LAT]: "51.5010000", [StoredValue.LON]: "-0.1020000"}));
    await Promise.resolve();
    expect(state.component.describing).toBe(false);
  });

  it("ignores an old address response after the pin has moved", async () => {
    const pending: {resolve: (value: GridReferenceLookupResponse[]) => void} = {resolve: null};
    lookup.mockReturnValueOnce(new Promise<GridReferenceLookupResponse[]>(resolve => pending.resolve = resolve));
    state.component.onMapClick({latlng: L.latLng(51.5, -0.1)} as L.LeafletMouseEvent);
    state.component.onMapClick({latlng: L.latLng(51.501, -0.102)} as L.LeafletMouseEvent);
    pending.resolve([{postcode: "AA1 1AA", description: "Hillside Park"}]);
    await Promise.resolve();
    expect(state.component.location.postcode).toBe("");
    expect(state.component.point.latitude).toBe(51.501);
  });

  it("fills advanced inputs from the selected pin and validates edits", () => {
    state.component.onMapClick({latlng: L.latLng(51.5, 0)} as L.LeafletMouseEvent);
    expect(state.component.coordinateInputs.longitude).toBe("0.0000000");
    state.component.coordinateInputs.gridReference = "SU 12345 67890";
    state.component.locateGridReference();
    expect(state.component.point.gridReference10).toBe("SU1234567890");
    const selected = state.component.point;
    state.component.coordinateInputs.latitude = "wrong";
    state.component.locateCoordinates();
    expect(state.component.point).toBe(selected);
    expect(state.component.notice).toContain("Check the coordinates");
  });

  it("provides an exact coordinate link before any URL navigation completes", () => {
    state.component.onMapClick({latlng: L.latLng(51.5001234, -0.1005678)} as L.LeafletMouseEvent);
    const shared = new URL(state.component.shareUrl);
    expect(shared.searchParams.get(StoredValue.LAT)).toBe("51.5001234");
    expect(shared.searchParams.get(StoredValue.LON)).toBe("-0.1005678");
    expect(shared.searchParams.has(StoredValue.GRID_REF)).toBe(false);
  });

  it("keeps the pin usable when reverse geocoding fails", async () => {
    lookup.mockRejectedValueOnce(new Error("Offline"));
    state.component.onMapClick({latlng: L.latLng(51.5, -0.1)} as L.LeafletMouseEvent);
    await Promise.resolve();
    expect(state.component.describing).toBe(false);
    expect(state.component.addressMessage).toContain("unavailable");
    expect(state.component.point.gridReference10).toBeTruthy();
  });
  it("keeps multiple numbered pins and updates the selected saved point while dragging", () => {
    state.component.onMapClick({latlng: L.latLng(51.5, -0.1)} as L.LeafletMouseEvent);
    state.component.addPoint();
    const first = state.component.savedPoints[0];
    state.component.onMapClick({latlng: L.latLng(51.501, -0.102)} as L.LeafletMouseEvent);
    state.component.addPoint();
    expect(state.component.savedPoints).toHaveLength(2);
    expect(state.component.savedPoints[0].point.latitude).toBe(51.5);
    const pins: L.Marker[] = [];
    state.map.eachLayer(layer => {
      if (layer instanceof L.Marker) {
        pins.push(layer);
      }
    });
    expect(pins).toHaveLength(2);
    pins[0].setLatLng([51.502, -0.104]).fire("drag");
    expect(state.component.activeSavedPointId).toBe(first.id);
    expect(state.component.savedPoints[0].point.latitude).toBe(51.502);
    expect(state.component.savedPoints[1].point.latitude).toBe(51.501);
    pins[0].fire("dragend");
    const shared = JSON.parse(new URL(state.component.shareUrl).searchParams.get(StoredValue.LOCATE_POINTS));
    expect(shared[0][0]).toBe(51.502);
    expect(shared[0][1]).toBe(-0.104);
    expect(shared[0][2]).not.toBe("Point 1");
    expect(shared[1][2]).not.toBe("Point 2");
    state.component.removeSavedPoint(first.id);
    expect(state.component.savedPoints[0].number).toBe(2);
  });

  it("renames saved points and clears the selected pin when it is removed", () => {
    state.component.onMapClick({latlng: L.latLng(51.5, -0.1)} as L.LeafletMouseEvent);
    state.component.addPoint();
    const id = state.component.savedPoints[0].id;
    state.component.renameSavedPoint({id, name: "Hillside Park"});
    expect(state.component.savedPoints[0].name).toBe("Hillside Park");
    state.component.removeSavedPoint(id);
    expect(state.component.savedPoints).toHaveLength(0);
    expect(state.component.activeSavedPointId).toBeNull();
    expect(state.component.point).toBeNull();
    expect(new URL(state.component.shareUrl).searchParams.has(StoredValue.LOCATE_POINTS)).toBe(false);
  });

  it("names a saved point from the nearest place", async () => {
    lookup.mockResolvedValueOnce([{postcode: "AA11 1AA", description: "Hillside Park"}]);
    state.component.onMapClick({latlng: L.latLng(51.5, -0.1)} as L.LeafletMouseEvent);
    state.component.addPoint();
    await Promise.resolve();
    await Promise.resolve();
    expect(state.component.savedPoints[0].name).toBe("Hillside Park");
  });

  it("flies the map to a selected saved point and fits all pins", () => {
    state.component.onMapClick({latlng: L.latLng(51.5, -0.1)} as L.LeafletMouseEvent);
    state.component.addPoint();
    state.component.onMapClick({latlng: L.latLng(51.52, -0.12)} as L.LeafletMouseEvent);
    state.component.addPoint();
    const flyTo = vi.spyOn(state.map, "flyTo");
    state.component.selectSavedPoint(state.component.savedPoints[0]);
    expect(flyTo).toHaveBeenCalled();
    const flyToBounds = vi.spyOn(state.map, "flyToBounds");
    state.component.showAllPins();
    expect(flyToBounds).toHaveBeenCalled();
  });

});
