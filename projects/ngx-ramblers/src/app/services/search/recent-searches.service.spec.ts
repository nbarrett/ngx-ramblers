import { TestBed } from "@angular/core/testing";
import { RecentSearchesService } from "./recent-searches.service";
import { StoredValue } from "../../models/ui-actions";
import { LoggerFactory } from "../logger-factory.service";

describe("Shared recent searches", () => {
  beforeEach(() => {
    localStorage.removeItem(StoredValue.SITE_SEARCH_RECENT);
    localStorage.removeItem(StoredValue.LOCATION_SEARCH_RECENT);
    TestBed.configureTestingModule({providers: [
      {provide: LoggerFactory, useValue: {createLogger: () => ({warn: vi.fn()})}}
    ]});
  });

  afterEach(() => {
    localStorage.removeItem(StoredValue.SITE_SEARCH_RECENT);
    localStorage.removeItem(StoredValue.LOCATION_SEARCH_RECENT);
  });

  it("retains the existing site-search history and keeps location searches separate", () => {
    localStorage.setItem(StoredValue.SITE_SEARCH_RECENT, JSON.stringify(["walk programme"]));
    const service = TestBed.inject(RecentSearchesService);
    service.addRecentSearch("Hillside Park car park, just outside the village", StoredValue.LOCATION_SEARCH_RECENT);
    expect(service.recentSearches()).toEqual(["walk programme"]);
    expect(service.recentSearches(StoredValue.LOCATION_SEARCH_RECENT)).toEqual(["Hillside Park car park, just outside the village"]);
  });

  it("deduplicates, keeps the five most recent queries and persists their wording", () => {
    const service = TestBed.inject(RecentSearchesService);
    ["first", "second", "third", "fourth", "fifth", "sixth", "third"].forEach(query => service.addRecentSearch(query));
    expect(service.recentSearches()).toEqual(["third", "sixth", "fifth", "fourth", "second"]);
    expect(JSON.parse(localStorage.getItem(StoredValue.SITE_SEARCH_RECENT))).toEqual(service.recentSearches());
  });

  it("ignores malformed stored histories", () => {
    localStorage.setItem(StoredValue.LOCATION_SEARCH_RECENT, "{}");
    expect(TestBed.inject(RecentSearchesService).recentSearches(StoredValue.LOCATION_SEARCH_RECENT)).toEqual([]);
  });
});
