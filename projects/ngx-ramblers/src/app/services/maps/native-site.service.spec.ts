import { TestBed } from "@angular/core/testing";
import { Capacitor } from "@capacitor/core";
import { HealthStatus } from "../../models/health.model";
import { StoredValue } from "../../models/ui-actions";
import { NATIVE_HTTP, NATIVE_SITE_NAVIGATION, NativeSiteService } from "./native-site.service";

function nativeStatus(url: string, status: number, data: unknown) {
  return {status, url, headers: {}, data};
}

describe("NativeSiteService", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{provide: NATIVE_SITE_NAVIGATION, useValue: {selectSite: vi.fn().mockResolvedValue(null)}}, NativeSiteService, {provide: NATIVE_HTTP, useValue: {request: vi.fn()}}]
    });
    window.localStorage.removeItem(StoredValue.APP_SITE_ORIGIN);
  });

  it("keeps the selected staging origin when the site advertises its public URL", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue(nativeStatus(
      "https://staging.group.example.org.uk/api/system-status",
      200,
      {status: HealthStatus.OK, group: {shortName: "Hillside", href: "https://www.group.example.org.uk"}}
    ));
    const service = TestBed.inject(NativeSiteService);
    await expect(service.connect("staging.group.example.org.uk")).resolves.toEqual({
      origin: "https://staging.group.example.org.uk",
      name: "Hillside"
    });
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBe("https://staging.group.example.org.uk");
  });

  it("selects the final canonical origin before opening a redirected group website", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue(nativeStatus(
      "https://www.group.example.org.uk/api/system-status",
      200,
      {status: HealthStatus.OK, group: {shortName: "Hillside", groupCode: "AB01"}}
    ));
    await expect(TestBed.inject(NativeSiteService).connect("https://group.example.org.uk", "AB01"))
      .resolves.toEqual({origin: "https://www.group.example.org.uk", name: "Hillside"});
    expect(TestBed.inject(NATIVE_SITE_NAVIGATION).selectSite).toHaveBeenCalledWith({origin: "https://www.group.example.org.uk"});
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBe("https://www.group.example.org.uk");
  });

  it("rejects a group check redirected to an unrelated website before granting native access", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue(nativeStatus(
      "https://other.example.org.uk/api/system-status",
      200,
      {status: HealthStatus.OK, group: {shortName: "Hillside", groupCode: "AB01"}}
    ));
    await expect(TestBed.inject(NativeSiteService).connect("https://group.example.org.uk", "AB01")).rejects.toThrow("unexpected address");
    expect(TestBed.inject(NATIVE_SITE_NAVIGATION).selectSite).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBeNull();
  });

  it("rejects a site with no group name", async () => {
    vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue(nativeStatus(
      "https://example.com/api/system-status",
      200,
      {status: HealthStatus.OK, group: {}}
    ));
    await expect(TestBed.inject(NativeSiteService).connect("https://example.com")).rejects.toThrow("does not support NGX Ramblers");
  });

  it("checks group compatibility without selecting the site", async () => {
    vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue(nativeStatus(
      "https://group.example.org.uk/api/system-status",
      200,
      {status: HealthStatus.OK, group: {shortName: "Hillside", groupCode: "AB01"}}
    ));
    const service = TestBed.inject(NativeSiteService);
    await expect(service.check("group.example.org.uk", "AB01")).resolves.toEqual({origin: "https://group.example.org.uk", name: "Hillside"});
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBeNull();
  });

  it("rejects a website for another group", async () => {
    vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue(nativeStatus(
      "https://group.example.org.uk/api/system-status",
      200,
      {status: HealthStatus.OK, group: {shortName: "Hillside", groupCode: "AB02"}}
    ));
    const service = TestBed.inject(NativeSiteService);
    await expect(service.connect("group.example.org.uk", "AB01")).rejects.toThrow("different group");
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBeNull();
  });

  it("rejects a degraded NGX website", async () => {
    vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue(nativeStatus(
      "https://group.example.org.uk/api/system-status",
      503,
      {status: HealthStatus.DEGRADED, group: {shortName: "Hillside"}}
    ));
    const service = TestBed.inject(NativeSiteService);
    await expect(service.connect("group.example.org.uk")).rejects.toThrow("temporarily unavailable");
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBeNull();
  });

  it("opens the saved group website from the local shell", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    window.localStorage.setItem(StoredValue.APP_SITE_ORIGIN, "https://group.example.org.uk");
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      hostname: "localhost",
      protocol: "https:",
      origin: "https://localhost",
      assign
    } as unknown as Location);
    expect(TestBed.inject(NativeSiteService).openSelectedGroup()).toBe(true);
    expect(assign).toHaveBeenCalledWith("https://group.example.org.uk/app");
  });

  it("forgets the group website, sign-in and saved follow screen so Change group can open the chooser", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    (window as {ngxNativeSiteUrl?: string}).ngxNativeSiteUrl = "https://baked.example.org.uk";
    window.localStorage.setItem(StoredValue.APP_SITE_ORIGIN, "https://group.example.org.uk");
    window.localStorage.setItem(StoredValue.AUTH_TOKEN, "fictional-token");
    window.localStorage.setItem(StoredValue.APP_LAST_URL, "/app/route?walk-id=fictional");
    window.localStorage.setItem(StoredValue.FOLLOW_SESSION, JSON.stringify({walkId: "fictional"}));
    await TestBed.inject(NativeSiteService).clear();
    expect(window.localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBe("");
    expect(window.localStorage.getItem(StoredValue.AUTH_TOKEN)).toBeNull();
    expect(window.localStorage.getItem(StoredValue.APP_LAST_URL)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(StoredValue.FOLLOW_SESSION))).toEqual({walkId: "fictional"});
    expect(TestBed.inject(NativeSiteService).needsChooser()).toBe(true);
    delete (window as {ngxNativeSiteUrl?: string}).ngxNativeSiteUrl;
  });

  it("resolves the www redirect once before sending API requests", async () => {
    const nativeRequest = vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue({
      status: 200, url: "https://group.example.org.uk/api/health", headers: {}, data: ""
    });
    const service = TestBed.inject(NativeSiteService);
    const first = service.canonicalOrigin("https://www.group.example.org.uk");
    const second = service.canonicalOrigin("https://www.group.example.org.uk");
    expect(first).toBe(second);
    await expect(first).resolves.toBe("https://group.example.org.uk");
    await expect(service.canonicalOrigin("https://www.group.example.org.uk")).resolves.toBe("https://group.example.org.uk");
    expect(nativeRequest).toHaveBeenCalledExactlyOnceWith({
      url: "https://www.group.example.org.uk/api/health", method: "GET", connectTimeout: 10000, readTimeout: 10000
    });
  });

  it("rejects a redirect to another website and permits another attempt", async () => {
    const nativeRequest = vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValueOnce({
      status: 200, url: "https://other.example.org.uk/api/health", headers: {}, data: ""
    }).mockResolvedValueOnce({
      status: 200, url: "https://group.example.org.uk/api/health", headers: {}, data: ""
    });
    const service = TestBed.inject(NativeSiteService);
    await expect(service.canonicalOrigin("https://group.example.org.uk")).rejects.toThrow("unexpected address");
    await expect(service.canonicalOrigin("https://group.example.org.uk")).resolves.toBe("https://group.example.org.uk");
    expect(nativeRequest).toHaveBeenCalledTimes(2);
  });

  it("keeps staging separate from its advertised public website", async () => {
    const nativeRequest = vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue({
      status: 200, url: "https://staging.group.example.org.uk/api/health", headers: {}, data: ""
    });
    await expect(TestBed.inject(NativeSiteService).canonicalOrigin("https://staging.group.example.org.uk"))
      .resolves.toBe("https://staging.group.example.org.uk");
  });

});
