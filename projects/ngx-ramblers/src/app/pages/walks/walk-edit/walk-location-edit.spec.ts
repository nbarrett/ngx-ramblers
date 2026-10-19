import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { ActivatedRoute } from "@angular/router";
import * as L from "leaflet";
import proj4 from "proj4";
import { EPSG_27700_PROJ4, MapProjectionCode } from "../../../common/maps/map-projection.constants";
import { GridReferenceLookupResponse } from "../../../models/address-model";
import { LocationDetails } from "../../../models/ramblers-walks-manager";
import { LocationType } from "../../../models/map.model";
import { VenueWithUsageStats } from "../../../models/event-venue.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { GridReferenceService } from "../../../services/maps/grid-reference.service";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { GpxParserService } from "../../../services/maps/gpx-parser.service";
import { MapZoomService } from "../../../services/maps/map-zoom.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { BroadcastService } from "../../../services/broadcast-service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { WalkDisplayService } from "../walk-display.service";
import { WalkLocationEditComponent } from "./walk-location-edit";
import { MapEditComponent } from "./map-edit";

describe("Walk location coordinates", () => {
  const lookup = vi.fn();
  const warning = vi.fn();
  const state: {map: MapEditComponent; editor: WalkLocationEditComponent; grid: GridReferenceService; location: LocationDetails} = {
    map: null, editor: null, grid: null, location: null
  };

  beforeEach(() => {
    lookup.mockReset().mockResolvedValue([]);
    warning.mockReset();
    TestBed.configureTestingModule({providers: [
      provideHttpClient(), provideHttpClientTesting(),
      {provide: AddressQueryService, useValue: {gridReferenceLookupFromLatLng: lookup}},
      {provide: MapTilesService, useValue: {initializeProjections: () => proj4.defs(MapProjectionCode.BRITISH_NATIONAL_GRID, EPSG_27700_PROJ4)}},
      {provide: LoggerFactory, useValue: {createLogger: () => ({debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()})}},
      {provide: NotifierService, useValue: {createGlobalAlert: () => ({hide: vi.fn(), warning, success: vi.fn()})}},
      {provide: WalkDisplayService, useValue: {gridReferenceFrom: location => location.grid_reference_10, googleMapsUrl: () => null}},
      ...[MapMarkerStyleService, GpxParserService, MapZoomService, DateUtilsService, StringUtilsService, NumberUtilsService,
        GoogleMapsService, BroadcastService, WalksConfigService, SystemConfigService, UrlService, ActivatedRoute]
        .map(provide => ({provide, useValue: {}}))
    ]});
    state.map = TestBed.runInInjectionContext(() => new MapEditComponent());
    state.editor = TestBed.runInInjectionContext(() => new WalkLocationEditComponent());
    state.grid = TestBed.inject(GridReferenceService);
    state.location = {latitude: 51.5, longitude: -0.1, postcode: "AB1 2CD", description: "Hillside Park car park", grid_reference_6: null, grid_reference_8: null, grid_reference_10: null, w3w: null};
    state.map.locationDetails = state.location;
    state.map.locationType = LocationType.STARTING;
    state.map.notify = null;
    state.editor.locationDetails = state.location;
    state.editor.notify = null;
  });

  function drag(latitude: number, longitude: number, end = false): void {
    const event = {target: {getLatLng: () => L.latLng(latitude, longitude)}} as L.DragEndEvent;
    if (end) {
      state.map.onEndMarkerDragEnd(event);
    } else {
      state.map.onMarkerDragEnd(event);
    }
  }

  it("calculates the initial Google place grid from its exact coordinates without a postcode lookup", async () => {
    await state.editor.onVenueSelected({name: "Hillside Park car park", postcode: "AB1 2CD", lat: 51.501, lon: -0.102} as VenueWithUsageStats);
    expect(state.location.grid_reference_10).toBe(state.grid.fromLatLng(51.501, -0.102).gridReference10);
    expect(state.location.latitude).toBe(51.501);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("keeps the typed search wording as the place name when a Google result is chosen", async () => {
    await state.editor.onVenueSelected({
      name: "Hillside Lane & Station Approach, Hillside Park",
      address1: "Hillside Park",
      postcode: "AB1 2CD",
      lat: 51.523, lon: -1.133,
      enteredName: "Junction of Hillside Lane and Station Approach, Hillside Park"
    } as VenueWithUsageStats);
    expect(state.location.description).toBe("Junction of Hillside Lane and Station Approach, Hillside Park");
    expect(state.location.postcode).toBe("AB1 2CD");
    expect(state.location.latitude).toBe(51.523);
    await state.editor.onVenueSelected({
      name: "Hillside Lane & Station Approach, Hillside Park",
      address1: "Hillside Park",
      postcode: "AB1 2CD",
      lat: 51.523, lon: -1.133
    } as VenueWithUsageStats);
    expect(state.location.description).toBe("Hillside Lane & Station Approach, Hillside Park");
  });

  it("does not keep a lookup postcode in the typed place name", async () => {
    await state.editor.onVenueSelected({
      name: "Hillside Lane & Station Approach",
      postcode: "AB1 2CD",
      lat: 51.523, lon: -1.133,
      enteredName: "Junction of Hillside Lane and Station Approach, Hillside Park, AB9 9ZZ"
    } as VenueWithUsageStats);
    expect(state.location.description).toBe("Junction of Hillside Lane and Station Approach, Hillside Park");
    expect(state.location.postcode).toBe("AB1 2CD");
  });

  it("changes the postcode without moving the OS pin or losing the grid", async () => {
    const original = {...state.location, grid_reference_10: "TQ1234545678"};
    state.editor.locationDetails = {...original, postcode: "AB2 3CD"};
    await state.editor.onPostcodeSelected();
    expect(state.editor.locationDetails).toEqual({...original, postcode: "AB2 3CD"});
    expect(lookup).not.toHaveBeenCalled();
  });

  it("keeps a dragged start pin and its grid when there is no nearby postcode", async () => {
    drag(51.501, -0.102);
    await lookup.mock.results[0].value;
    expect(state.location.latitude).toBe(51.501);
    expect(state.location.longitude).toBe(-0.102);
    expect(state.location.grid_reference_10).toBe(state.grid.fromLatLng(51.501, -0.102).gridReference10);
    expect(state.location.postcode).toBeNull();
    expect(warning).toHaveBeenCalledWith(expect.objectContaining({title: "No nearby postcode"}));
  });

  it("keeps the location reference through parent updates until the dragged pin postcode resolves", async () => {
    lookup.mockResolvedValue([{postcode: "AB2 3CD", distance: 10}]);
    const parentUpdates = state.editor.locationDetailsChange.subscribe(location => {
      state.editor.locationDetails = location;
      state.map.locationDetails = location;
    });
    const mapUpdates = state.map.locationChange.subscribe(() => state.editor.onMapLocationChange());

    drag(51.501, -0.102);
    await lookup.mock.results[0].value;

    expect(state.map.locationDetails).toBe(state.location);
    expect(state.editor.locationDetails.postcode).toBe("AB2 3CD");
    expect(state.editor.locationDetails.grid_reference_10).toBe(state.grid.fromLatLng(51.501, -0.102).gridReference10);
    parentUpdates.unsubscribe();
    mapUpdates.unsubscribe();
  });

  it("keeps a dragged finish pin when the nearby postcode lookup fails", async () => {
    lookup.mockRejectedValue(new Error("Lookup unavailable"));
    state.map.endLocationDetails = {...state.location};
    drag(51.502, -0.103, true);
    await lookup.mock.results[0].value.catch(error => expect(error.message).toBe("Lookup unavailable"));
    expect(state.map.endLocationDetails.latitude).toBe(51.502);
    expect(state.map.endLocationDetails.grid_reference_10).toBe(state.grid.fromLatLng(51.502, -0.103).gridReference10);
    expect(warning).toHaveBeenCalledWith(expect.objectContaining({title: "Postcode lookup unavailable"}));
  });

  it("ignores an older lookup that completes after a newer drag", async () => {
    const pending: {resolve: (responses: GridReferenceLookupResponse[]) => void} = {resolve: null};
    lookup.mockImplementationOnce(() => new Promise<GridReferenceLookupResponse[]>(resolve => pending.resolve = resolve));
    lookup.mockResolvedValueOnce([{postcode: "AB2 3CD", description: "Nearby postcode", gridReference10: "SV0000000000"}]);
    drag(51.501, -0.102);
    drag(51.502, -0.103);
    await lookup.mock.results[1].value;
    pending.resolve([{postcode: "AB3 4CD", description: "Older result"}]);
    await lookup.mock.results[0].value;
    expect(state.location.latitude).toBe(51.502);
    expect(state.location.postcode).toBe("AB2 3CD");
    expect(state.location.grid_reference_10).toBe(state.grid.fromLatLng(51.502, -0.103).gridReference10);
    expect(state.location.description).toBe("Hillside Park car park");
  });
});
