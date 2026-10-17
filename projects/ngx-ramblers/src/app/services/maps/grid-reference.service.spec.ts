import { TestBed } from "@angular/core/testing";
import proj4 from "proj4";
import { EPSG_27700_PROJ4, MapProjectionCode } from "../../common/maps/map-projection.constants";
import { gridReference10From, parseGridReference } from "../../functions/grid-reference";
import { GridReferenceService } from "./grid-reference.service";
import { MapTilesService } from "./map-tiles.service";

describe("Locate coordinate conversion", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [{provide: MapTilesService, useValue: {
      initializeProjections: () => proj4.defs(MapProjectionCode.BRITISH_NATIONAL_GRID, EPSG_27700_PROJ4)
    }}]});
  });

  it("converts eastings and northings without moving the chosen point", () => {
    const service = TestBed.inject(GridReferenceService);
    const point = service.fromEastingsNorthings(412345, 167890);
    expect(point.gridReference10).toBe("SU1234567890");
    expect(service.fromLatLng(point.latitude, point.longitude)).toEqual(point);
    expect(service.fromGridReference("SU 12345 67890")).toEqual(point);
  });

  it("recognises pasted coordinates and grid references locally", () => {
    const service = TestBed.inject(GridReferenceService);
    expect(service.fromSearch("51.5, -0.1")).toEqual(service.fromLatLng(51.5, -0.1));
    expect(service.fromSearch("412345, 167890")).toEqual(service.fromGridReference("SU1234567890"));
    expect(service.fromSearch("su 12345 67890").gridReference10).toBe("SU1234567890");
    expect(service.fromSearch("Hillside Park")).toBeNull();
  });

  it("accepts the prime meridian and rejects malformed and out-of-range coordinates", () => {
    const service = TestBed.inject(GridReferenceService);
    expect(service.fromLatLng(51.5, 0).longitude).toBe(0);
    expect(service.fromLatLng(Number.NaN, 0)).toBeNull();
    expect(service.fromLatLng(51.5, Number.POSITIVE_INFINITY)).toBeNull();
    expect(service.fromLatLng(0, 0)).toBeNull();
    expect(service.fromLatLng(91, 0)).toBeNull();
    expect(service.fromEastingsNorthings(-1, 167890)).toBeNull();
    expect(service.fromEastingsNorthings(412345, 1300000)).toBeNull();
    expect(service.fromGridReference("SU123456789012")).toBeNull();
  });

  it("handles northern grid squares and preserves the full northing", () => {
    const service = TestBed.inject(GridReferenceService);
    expect(gridReference10From(412345, 1167890)).toBe("HU1234567890");
    expect(parseGridReference("HU1234567890")).toEqual({eastings: 412345, northings: 1167890});
    expect(service.fromGridReference("HU1234567890").gridReference10).toBe("HU1234567890");
  });
});
