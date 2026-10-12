import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { Capacitor } from "@capacitor/core";
import { HealthStatus } from "../../models/health.model";
import { StoredValue } from "../../models/ui-actions";
import { NativeSiteService } from "./native-site.service";

describe("NativeSiteService", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), NativeSiteService]
    });
    window.localStorage.removeItem(StoredValue.APP_SITE_ORIGIN);
  });

  it("keeps the selected staging origin when the site advertises its public URL", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(NativeSiteService);
    const pending = service.connect("staging.group.example.org.uk");
    http.expectOne("https://staging.group.example.org.uk/api/system-status").flush({
      status: HealthStatus.OK,
      group: {shortName: "Hillside", href: "https://www.group.example.org.uk"}
    });
    await expect(pending).resolves.toEqual({origin: "https://staging.group.example.org.uk", name: "Hillside"});
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBe("https://staging.group.example.org.uk");
    http.verify();
  });

  it("rejects a site with no group name", async () => {
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(NativeSiteService);
    const pending = service.connect("https://example.com");
    http.expectOne("https://example.com/api/system-status").flush({status: HealthStatus.OK, group: {}});
    await expect(pending).rejects.toThrow("does not support NGX Ramblers");
    http.verify();
  });
  it("checks group compatibility without selecting the site", async () => {
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(NativeSiteService);
    const pending = service.check("group.example.org.uk", "AB01");
    http.expectOne("https://group.example.org.uk/api/system-status").flush({status: HealthStatus.OK, group: {shortName: "Hillside", groupCode: "AB01"}});
    await expect(pending).resolves.toEqual({origin: "https://group.example.org.uk", name: "Hillside"});
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBeNull();
    http.verify();
  });

  it("rejects a website for another group", async () => {
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(NativeSiteService);
    const pending = service.connect("group.example.org.uk", "AB01");
    http.expectOne("https://group.example.org.uk/api/system-status").flush({status: HealthStatus.OK, group: {shortName: "Hillside", groupCode: "AB02"}});
    await expect(pending).rejects.toThrow("different group");
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBeNull();
    http.verify();
  });

  it("rejects a degraded NGX website", async () => {
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(NativeSiteService);
    const pending = service.connect("group.example.org.uk");
    http.expectOne("https://group.example.org.uk/api/system-status").flush({status: HealthStatus.DEGRADED, group: {shortName: "Hillside"}}, {status: 503, statusText: "Unavailable"});
    await expect(pending).rejects.toThrow("temporarily unavailable");
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBeNull();
    http.verify();
  });

  it("forgets the group website, sign-in and saved follow screen so Change group can open the chooser", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    (window as {ngxNativeSiteUrl?: string}).ngxNativeSiteUrl = "https://baked.example.org.uk";
    window.localStorage.setItem(StoredValue.APP_SITE_ORIGIN, "https://group.example.org.uk");
    window.localStorage.setItem(StoredValue.AUTH_TOKEN, "fictional-token");
    window.localStorage.setItem(StoredValue.APP_LAST_URL, "/app/route?walk-id=fictional");
    window.localStorage.setItem(StoredValue.FOLLOW_SESSION, JSON.stringify({walkId: "fictional"}));
    TestBed.inject(NativeSiteService).clear();
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBe("");
    expect(window.localStorage.getItem(StoredValue.AUTH_TOKEN)).toBeNull();
    expect(window.localStorage.getItem(StoredValue.APP_LAST_URL)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(StoredValue.FOLLOW_SESSION))).toEqual({walkId: "fictional"});
    expect(TestBed.inject(NativeSiteService).needsChooser()).toBe(true);
    delete (window as {ngxNativeSiteUrl?: string}).ngxNativeSiteUrl;
  });

});
