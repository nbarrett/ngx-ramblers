import { TestBed } from "@angular/core/testing";
import { HttpParams, provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { Capacitor } from "@capacitor/core";
import { LoggerTestingModule } from "ngx-logger/testing";
import { ConfigService } from "./config.service";
import { CommonDataService } from "./common-data-service";
import { ConfigKey } from "../models/config.model";
import { saveNativeWalkingSite } from "../functions/native-walking";
import { StoredValue } from "../models/ui-actions";

describe("configuration before native group selection", () => {
  beforeEach(() => {
    saveNativeWalkingSite(null);
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), {
        provide: CommonDataService,
        useValue: {toHttpParams: criteria => new HttpParams({fromObject: criteria})}
      }]
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
    window.localStorage.removeItem(StoredValue.APP_SITE_ORIGIN);
  });

  it("uses the supplied defaults without requesting a local API before native group selection", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    saveNativeWalkingSite(null);
    const service = TestBed.inject(ConfigService);
    const defaults = {name: "Example group"};
    expect(await service.queryConfig(ConfigKey.SYSTEM, defaults)).toBe(defaults);
    expect(await service.queryConfig(ConfigKey.WALKS, defaults)).toBe(defaults);
    expect(await service.queryConfig(ConfigKey.COMMITTEE, defaults)).toBe(defaults);
    TestBed.inject(HttpTestingController).expectNone(request => request.url.startsWith("/api/"));
  });

  [true, false].forEach(native => {
    it(`requests website configuration for ${native ? "a selected native group" : "a browser visit"}`, async () => {
      vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(native);
      saveNativeWalkingSite(native ? "https://group.example.org.uk" : null);
      const service = TestBed.inject(ConfigService);
      const expected = {name: "Example group"};
      const loaded = service.queryConfig(ConfigKey.SYSTEM, {name: "Default group"});
      TestBed.inject(HttpTestingController).expectOne("/api/database/config?key=system").flush({response: expected});
      expect(await loaded).toEqual(expected);
    });
  });
});
