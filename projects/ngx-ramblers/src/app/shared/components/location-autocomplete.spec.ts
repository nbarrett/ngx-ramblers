import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";
import { LocationAutocompleteComponent } from "./location-autocomplete";
import { AddressQueryService } from "../../services/walks/address-query.service";
import { GridReferenceService } from "../../services/maps/grid-reference.service";
import { LoggerFactory } from "../../services/logger-factory.service";
import { LocationSuggestion } from "../../models/locate.model";

describe("Location autocomplete", () => {
  const venueSearch = vi.fn();
  const placeNameLookup = vi.fn();
  const gridReferenceLookup = vi.fn();
  const fromSearch = vi.fn();
  const state: {component: LocationAutocompleteComponent} = {component: null};

  beforeEach(() => {
    vi.useFakeTimers();
    venueSearch.mockReset().mockResolvedValue([]);
    placeNameLookup.mockReset().mockResolvedValue({description: "", error: "Not found"});
    gridReferenceLookup.mockReset();
    fromSearch.mockReset().mockReturnValue(null);
    TestBed.configureTestingModule({providers: [
      {provide: AddressQueryService, useValue: {venueSearch, placeNameLookup, gridReferenceLookup}},
      {provide: GridReferenceService, useValue: {fromSearch}},
      {provide: LoggerFactory, useValue: {createLogger: () => ({info: vi.fn(), warn: vi.fn(), error: vi.fn()})}}
    ]});
    state.component = TestBed.runInInjectionContext(() => new LocationAutocompleteComponent());
    state.component.ngOnInit();
  });

  afterEach(() => vi.useRealTimers());

  async function suggestions(term: string): Promise<LocationSuggestion[]> {
    const result = firstValueFrom(state.component.locationSuggestions$);
    state.component.locationInput$.next(term);
    await vi.advanceTimersByTimeAsync(300);
    return result;
  }

  it("offers Google Places results and preserves the selected place coordinates rather than its postcode centre", async () => {
    venueSearch.mockResolvedValue([
      {name: "Hillside Park car park", address1: "Station Approach", address2: null, postcode: "AB1 2CD", lat: 51.5, lon: -0.1},
      {name: "Hillside Park entrance", address1: null, address2: null, postcode: null, lat: 51.501, lon: -0.102}
    ]);
    const results = await suggestions("White Hill car park, just outside Kingsclere");
    expect(venueSearch).toHaveBeenCalledWith("White Hill car park, just outside Kingsclere");
    expect(results.length).toBe(2);
    expect(results[0].description).toBe("Hillside Park car park, Station Approach");
    expect(results[1].lat).toBe(51.501);
    expect(state.component.selectionRequired).toBe(true);
    const changed = vi.spyOn(state.component.locationChange, "emit");
    state.component.onLocationSelected(results[0]);
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({latlng: {lat: 51.5, lng: -0.1}, postcode: "AB1 2CD"}));
    expect(state.component.selectionRequired).toBe(false);
    expect(gridReferenceLookup).not.toHaveBeenCalled();
    expect(placeNameLookup).not.toHaveBeenCalled();
    expect(state.component.locationLoading).toBe(false);
  });

  it("retains direct postcode lookup", async () => {
    gridReferenceLookup.mockResolvedValue({description: "Hillside Park", postcode: "AB1 2CD", latlng: {lat: 51.5, lng: -0.1}});
    const results = await suggestions("AB1 2CD");
    expect(results[0].postcode).toBe("AB1 2CD");
    expect(gridReferenceLookup).toHaveBeenCalledWith("AB1 2CD");
    expect(venueSearch).not.toHaveBeenCalled();
  });

  it("retains local grid reference lookup without a remote search", async () => {
    fromSearch.mockReturnValue({latitude: 51.5, longitude: -0.1, gridReference6: "TQ123456", gridReference8: "TQ12344566", gridReference10: "TQ1234545678"});
    const results = await suggestions("TQ1234545678");
    expect(results[0].gridReference10).toBe("TQ1234545678");
    expect(venueSearch).not.toHaveBeenCalled();
    expect(placeNameLookup).not.toHaveBeenCalled();
  });

  it("falls back to place lookup when Google Places returns no results", async () => {
    placeNameLookup.mockResolvedValue({description: "Hillside Park", latlng: {lat: 51.5, lng: -0.1}});
    const results = await suggestions("Hillside Park");
    expect(results[0].description).toBe("Hillside Park");
    expect(placeNameLookup).toHaveBeenCalledWith("Hillside Park");
  });

  it("falls back when Google Places is unavailable and clears loading when both searches fail", async () => {
    venueSearch.mockRejectedValue(new Error("Search unavailable"));
    placeNameLookup.mockRejectedValue(new Error("Lookup unavailable"));
    expect(await suggestions("Hillside Park")).toEqual([]);
    expect(placeNameLookup).toHaveBeenCalledWith("Hillside Park");
    expect(state.component.locationLoading).toBe(false);
  });
});
