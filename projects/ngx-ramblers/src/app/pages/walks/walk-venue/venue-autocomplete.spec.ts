import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";
import { VenueAutocompleteComponent } from "./venue-autocomplete";
import { VenueService } from "../../../services/venue/venue.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { GeoDistanceService } from "../../../services/maps/geo-distance.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { VenueTypeValue } from "../../../models/event-venue.model";
import { By } from "@angular/platform-browser";
import { NgSelectComponent } from "@ng-select/ng-select";
import { RecentSearchesService } from "../../../services/search/recent-searches.service";
import { StoredValue } from "../../../models/ui-actions";

describe("Venue search selection prompt", () => {
  const venueSearch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem(StoredValue.LOCATION_SEARCH_RECENT);
    venueSearch.mockReset().mockResolvedValue([
      {name: "Hillside Park car park", address1: "Station Approach", address2: null, postcode: "AB1 2CD", lat: 51.5, lon: -0.1}
    ]);
    TestBed.configureTestingModule({providers: [
      {provide: VenueService, useValue: {venues: () => of([]), searchVenues: () => [], inferVenueType: () => VenueTypeValue.LOCATION}},
      {provide: AddressQueryService, useValue: {venueSearch}},
      {provide: GeoDistanceService, useValue: {}},
      {provide: LoggerFactory, useValue: {createLogger: () => ({info: vi.fn(), error: vi.fn()})}}
    ]});
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem(StoredValue.LOCATION_SEARCH_RECENT);
  });

  it("keeps the typed search wording after a Google result is chosen", async () => {
    const fixture = TestBed.createComponent(VenueAutocompleteComponent);
    const selected = vi.spyOn(fixture.componentInstance.venueSelected, "emit");
    fixture.detectChanges();
    const query = "Junction of Hillside Lane and Station Approach, Hillside Park";
    const input: HTMLInputElement = fixture.nativeElement.querySelector("input");
    input.value = query;
    input.dispatchEvent(new Event("input", {bubbles: true}));
    await vi.advanceTimersByTimeAsync(300);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const select = fixture.debugElement.query(By.directive(NgSelectComponent)).componentInstance as NgSelectComponent;
    select.toggleItem(select.itemsList.filteredItems[0]);
    expect(TestBed.inject(RecentSearchesService).recentSearches(StoredValue.LOCATION_SEARCH_RECENT)).toEqual([query]);
    expect(selected).toHaveBeenCalledOnce();
    expect(selected.mock.calls[0][0].enteredName).toBe(query);
    expect(fixture.componentInstance.selectedVenue.enteredName).toBe(query);
    expect(fixture.componentInstance.selectedVenue.ngSelectLabel).toBe(query);
    expect(fixture.componentInstance.selectedVenue.lat).toBe(51.5);
    await vi.advanceTimersByTimeAsync(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(input.value).toBe(query);
    fixture.destroy();
  });

  it("lets a selected place be edited and searched again without retyping it or moving the pin", async () => {
    const fixture = TestBed.createComponent(VenueAutocompleteComponent);
    fixture.componentRef.setInput("initialVenue", {
      name: "Hillside Park car park", address1: "Station Approach", postcode: "AB1 2CD", lat: 51.5, lon: -0.1
    });
    const selected = vi.spyOn(fixture.componentInstance.venueSelected, "emit");
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector("input");
    expect(input.value).toBe("Hillside Park car park, Station Approach, AB1 2CD");
    input.focus();
    await vi.advanceTimersByTimeAsync(300);
    expect(venueSearch.mock.calls[0][0]).toBe(input.value);
    const edited = input.value.replace("Station Approach", "north entrance");
    input.value = edited;
    input.dispatchEvent(new Event("input", {bubbles: true}));
    await vi.advanceTimersByTimeAsync(300);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(venueSearch.mock.calls[1][0]).toBe(edited);
    expect(selected).not.toHaveBeenCalled();
    expect(fixture.componentInstance.selectedVenue.lat).toBe(51.5);
    fixture.destroy();
  });

  it("prompts when matches arrive without selecting a place, then removes the prompt after selection", async () => {
    const fixture = TestBed.createComponent(VenueAutocompleteComponent);
    const component = fixture.componentInstance;
    const selected = vi.spyOn(component.venueSelected, "emit");
    fixture.detectChanges();
    component.venueInput$.next("Junction of Hillside Lane and Station Approach, Hillside Park");
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Choose a result from the list to set the location");
    expect(selected).not.toHaveBeenCalled();
    expect(component.selectedVenue).toBeNull();
    component.selectedVenue = {name: "Hillside Park", usageCount: 0, distance: null};
    component.onVenueSelected(component.selectedVenue);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(selected).toHaveBeenCalledOnce();
    expect(selected.mock.calls[0][0].enteredName).toBe("Junction of Hillside Lane and Station Approach, Hillside Park");
    expect(component.selectedVenue.ngSelectLabel).toBe("Junction of Hillside Lane and Station Approach, Hillside Park");
    expect(fixture.nativeElement.textContent).toContain("Keep your wording or use the search result?");
    expect(fixture.nativeElement.textContent).not.toContain("Choose a result from the list to set the location");
    component.useResultPlaceName();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(selected).toHaveBeenCalledTimes(2);
    expect(selected.mock.calls[1][0].enteredName).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain("Keep your wording or use the search result?");
    fixture.destroy();
  });
});
