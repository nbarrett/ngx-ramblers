import { TestBed } from "@angular/core/testing";
import { CURRENT_LOCATION_MAX_AGE_MS, CURRENT_LOCATION_TIMEOUT_MS } from "../../models/current-location.model";
import { CurrentLocationService } from "./current-location.service";

describe("current location freshness", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([false, true])("requests a location with fresh=%s", async fresh => {
    const request = vi.fn().mockImplementation(success => success({coords: {latitude: 51.2, longitude: 0.3}}));
    vi.stubGlobal("navigator", {geolocation: {getCurrentPosition: request}});
    const service = TestBed.inject(CurrentLocationService);
    expect(await service.currentPosition(fresh)).toEqual({lat: 51.2, lng: 0.3});
    expect(request).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: fresh,
      maximumAge: fresh ? 0 : CURRENT_LOCATION_MAX_AGE_MS,
      timeout: CURRENT_LOCATION_TIMEOUT_MS
    });
  });

  it("reports an unavailable location without supplying a default position", async () => {
    vi.stubGlobal("navigator", {geolocation: {getCurrentPosition: vi.fn().mockImplementation((success, failure) => failure())}});
    expect(await TestBed.inject(CurrentLocationService).currentPosition(true)).toBeNull();
  });
});
