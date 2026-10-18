import { TestBed } from "@angular/core/testing";
import { lastValueFrom } from "rxjs";
import { PostcodeNavigationService } from "./postcode-navigation.service";
import { AddressQueryService } from "../walks/address-query.service";
import { GoogleMapsService } from "../google-maps.service";
import { LoggerFactory } from "../logger-factory.service";
import { LocationDetails } from "../../models/ramblers-walks-manager";
import { PostcodeNavigationStatus, PostcodeRoadCheckStatus } from "../../models/postcode-navigation.model";

describe("Automatic postcode navigation checks", () => {
  const lookup = vi.fn();
  const driving = vi.fn();
  const location: LocationDetails = {latitude: 51.5, longitude: -0.1, postcode: "AB1 2CD", description: "Hillside Park car park",
    grid_reference_6: "TQ123456", grid_reference_8: "TQ12344566", grid_reference_10: "TQ1234545678", w3w: null};
  const state: {service: PostcodeNavigationService} = {service: null};

  beforeEach(() => {
    lookup.mockReset().mockResolvedValue({latlng: {lat: 51.5, lng: -0.0812}, description: "Postcode destination"});
    driving.mockReset().mockResolvedValue(1);
    TestBed.configureTestingModule({providers: [
      {provide: AddressQueryService, useValue: {gridReferenceLookup: lookup}},
      {provide: GoogleMapsService, useValue: {drivingDistanceMiles: driving}},
      {provide: LoggerFactory, useValue: {createLogger: () => ({warn: vi.fn()})}}
    ]});
    state.service = TestBed.inject(PostcodeNavigationService);
  });

  it("flags a postcode about 1.3 km from the pin without changing the chosen coordinates or grid", async () => {
    const original = {...location};
    const result = await lastValueFrom(state.service.check(location, true));
    expect(result.status).toBe(PostcodeNavigationStatus.SEPARATED);
    expect(result.separationMetres).toBeGreaterThan(1200);
    expect(result.separationMetres).toBeLessThan(1400);
    expect(driving).toHaveBeenCalledWith("AB1 2CD", "51.5,-0.1", {lat: 51.5, lng: -0.0812}, {lat: 51.5, lng: -0.1});
    expect(location).toEqual(original);
  });

  it("detects a large road detour even when the postcode is close in a straight line", async () => {
    lookup.mockResolvedValue({latlng: {lat: 51.5, lng: -0.098}, description: "Across the river"});
    driving.mockResolvedValue(2);
    const result = await lastValueFrom(state.service.check(location, true));
    expect(result.separationMetres).toBeLessThan(200);
    expect(result.status).toBe(PostcodeNavigationStatus.DETOUR);
    expect(result.drivingMetres).toBeGreaterThan(3000);
  });

  it("does not infer road access from a close postcode", async () => {
    lookup.mockResolvedValue({latlng: {lat: 51.5, lng: -0.1}, description: "Same position"});
    const result = await lastValueFrom(state.service.check(location, true));
    expect(result.status).toBe(PostcodeNavigationStatus.CLOSE);
    expect(result.roadStatus).toBe(PostcodeRoadCheckStatus.NOT_CHECKED);
    expect(driving).not.toHaveBeenCalled();
  });

  it("keeps the separation warning when routing is unavailable", async () => {
    driving.mockResolvedValue(null);
    const result = await lastValueFrom(state.service.check(location, true));
    expect(result.status).toBe(PostcodeNavigationStatus.SEPARATED);
    expect(result.roadStatus).toBe(PostcodeRoadCheckStatus.UNAVAILABLE);
  });

  it("does not call the authenticated road endpoint for anonymous visitors", async () => {
    const result = await lastValueFrom(state.service.check(location, false));
    expect(result.status).toBe(PostcodeNavigationStatus.SEPARATED);
    expect(result.roadStatus).toBe(PostcodeRoadCheckStatus.NOT_CHECKED);
    expect(driving).not.toHaveBeenCalled();
  });

  it("reuses a postcode lookup after the pin moves", async () => {
    await lastValueFrom(state.service.check(location, false));
    await lastValueFrom(state.service.check({...location, latitude: 51.501}, false));
    expect(lookup).toHaveBeenCalledOnce();
  });

  it("retries failed postcode checks and does not report success on failure", async () => {
    lookup.mockRejectedValueOnce(new Error("Unavailable"));
    expect((await lastValueFrom(state.service.check(location, false))).status).toBe(PostcodeNavigationStatus.UNAVAILABLE);
    expect((await lastValueFrom(state.service.check(location, false))).status).toBe(PostcodeNavigationStatus.SEPARATED);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("handles missing and invalid postcodes without remote requests", async () => {
    expect((await lastValueFrom(state.service.check({...location, postcode: null}, true))).status).toBe(PostcodeNavigationStatus.MISSING);
    expect((await lastValueFrom(state.service.check({...location, postcode: "AB1"}, true))).status).toBe(PostcodeNavigationStatus.INVALID);
    expect(await lastValueFrom(state.service.check({...location, latitude: null}, true))).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});
