import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CurrentLocationService } from "./current-location.service";
import { GeoDistanceService } from "./geo-distance.service";
import { RouteNearbyService } from "./route-nearby.service";
import { StringUtilsService } from "../string-utils.service";

describe("shared route distance filtering", () => {
  const location = {currentPosition: vi.fn()};
  const distance = {calculateDistanceMiles: vi.fn()};
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({providers: [
      {provide: CurrentLocationService, useValue: location},
      {provide: GeoDistanceService, useValue: distance},
      {provide: StringUtilsService, useValue: {
        pluraliseWithCount: (count: number, singular: string, plural?: string) => `${count} ${count === 1 ? singular : (plural || singular + "s")}`
      }}
    ]});
  });
  afterEach(() => TestBed.resetTestingModule());

  it("uses the current location for nearby routes", async () => {
    location.currentPosition.mockResolvedValue({lat: 51, lng: 0});
    distance.calculateDistanceMiles.mockReturnValue(2);
    const service = TestBed.inject(RouteNearbyService);
    expect(await service.origin([{latitude: 51.01, longitude: 0.01}])).toEqual({latitude: 51, longitude: 0});
  });

  it("preserves the app's route-area fallback when device location is unavailable", async () => {
    location.currentPosition.mockResolvedValue(null);
    const service = TestBed.inject(RouteNearbyService);
    expect(await service.origin([{latitude: 51, longitude: 0}, {latitude: 53, longitude: 2}])).toEqual({latitude: 52, longitude: 1});
    expect(await service.origin([])).toBeNull();
  });

  it("does not treat routes without coordinates as zero miles away", () => {
    const service = TestBed.inject(RouteNearbyService);
    expect(service.milesAway({latitude: 51, longitude: 0}, null)).toBeNull();
    expect(distance.calculateDistanceMiles).not.toHaveBeenCalled();
  });

  it("pluralises miles in the away label", () => {
    const service = TestBed.inject(RouteNearbyService);
    expect(service.label(1)).toBe("1 mile away");
    expect(service.label(2)).toBe("2 miles away");
    expect(service.label(0.05)).toBe("Here");
  });
});
