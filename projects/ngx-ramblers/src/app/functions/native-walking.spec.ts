import { NativeWalkingWindow } from "../models/native-route.model";
import { Capacitor } from "@capacitor/core";
import { StoredValue } from "../models/ui-actions";
import { nativeApiUrl, nativeBuildLabel, nativeWalkingSite, parseHttpsOrigin, saveNativeWalkingSite } from "./native-walking";

describe("nativeApiUrl", () => {
  it("uses the directory only for lookups before group selection", () => {
    const platform = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    (window as NativeWalkingWindow).ngxNativeDirectoryUrl = "https://directory.example.org.uk";
    expect(nativeApiUrl("api/areas/available-areas", null)).toBe("https://directory.example.org.uk/api/areas/available-areas");
    expect(nativeApiUrl("/api/ramblers/walks-manager/list-groups", null)).toBe("https://directory.example.org.uk/api/ramblers/walks-manager/list-groups");
    expect(nativeApiUrl("/api/walks", null)).toBe("/api/walks");
    expect(nativeApiUrl("api/areas/available-areas", "https://group.example.org.uk")).toBe("https://group.example.org.uk/api/areas/available-areas");
    platform.mockReturnValue(false);
    expect(nativeApiUrl("api/areas/available-areas", null)).toBe("api/areas/available-areas");
    platform.mockRestore();
    delete (window as NativeWalkingWindow).ngxNativeDirectoryUrl;
  });
  it("sends relative API requests to the configured group website", () => {
    expect(nativeApiUrl("api/database/config", "https://group.example.org.uk")).toBe("https://group.example.org.uk/api/database/config");
    expect(nativeApiUrl("/api/walks", "https://group.example.org.uk")).toBe("https://group.example.org.uk/api/walks");
    expect(nativeApiUrl("https://localhost/api/database/auth/login", "https://group.example.org.uk")).toBe("https://group.example.org.uk/api/database/auth/login");
    expect(nativeApiUrl("https://127.0.0.1/api/database/config", "https://group.example.org.uk")).toBe("https://group.example.org.uk/api/database/config");
  });

  it("keeps bundled assets and external requests unchanged", () => {
    expect(nativeApiUrl("assets/images/icon.svg", "https://group.example.org.uk")).toBe("assets/images/icon.svg");
    expect(nativeApiUrl("https://tiles.example.org/map", "https://group.example.org.uk")).toBe("https://tiles.example.org/map");
    expect(nativeApiUrl("/api/walks", null)).toBe("/api/walks");
  });
});

describe("parseHttpsOrigin", () => {
  it("accepts a hostname and an https origin", () => {
    expect(parseHttpsOrigin("group.example.org.uk")).toBe("https://group.example.org.uk");
    expect(parseHttpsOrigin("https://www.group.example.org.uk")).toBe("https://www.group.example.org.uk");
  });

  it("rejects a path, query or non-https url", () => {
    expect(parseHttpsOrigin("https://www.group.example.org.uk/app")).toBeNull();
    expect(parseHttpsOrigin("http://www.group.example.org.uk")).toBeNull();
    expect(parseHttpsOrigin("https://localhost")).toBeNull();
    expect(parseHttpsOrigin("https://127.0.0.1")).toBeNull();
    expect(parseHttpsOrigin("")).toBeNull();
  });

  it("accepts a local http origin for on-machine testing", () => {
    expect(parseHttpsOrigin("http://127.0.0.1:4200")).toBe("http://127.0.0.1:4200");
    expect(parseHttpsOrigin("http://localhost:4200")).toBe("http://localhost:4200");
    expect(parseHttpsOrigin("http://10.0.2.2:4200")).toBe("http://10.0.2.2:4200");
  });
});

describe("nativeWalkingSite", () => {
  it("uses the origin saved on the phone before any baked window value", () => {
    const platform = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    window.localStorage.removeItem(StoredValue.APP_SITE_ORIGIN);
    (window as {ngxNativeSiteUrl?: string}).ngxNativeSiteUrl = "https://baked.example.org.uk";
    saveNativeWalkingSite("https://saved.example.org.uk");
    expect(nativeWalkingSite()).toBe("https://saved.example.org.uk");
    window.localStorage.removeItem(StoredValue.APP_SITE_ORIGIN);
    expect(nativeWalkingSite()).toBe("https://baked.example.org.uk");
    saveNativeWalkingSite(null);
    expect(nativeWalkingSite()).toBeNull();
    platform.mockRestore();
    delete (window as {ngxNativeSiteUrl?: string}).ngxNativeSiteUrl;
  });

  it("uses the live website origin when the shell has already opened the group", () => {
    const platform = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const location = vi.spyOn(window, "location", "get").mockReturnValue({
      hostname: "group.example.org.uk",
      protocol: "https:",
      origin: "https://group.example.org.uk"
    } as Location);
    expect(nativeWalkingSite()).toBe("https://group.example.org.uk");
    location.mockRestore();
    platform.mockRestore();
  });
});

describe("nativeBuildLabel", () => {
  it("returns a Build label from the baked native build number", () => {
    delete (window as NativeWalkingWindow).ngxNativeBuildNumber;
    expect(nativeBuildLabel()).toBeNull();
    (window as NativeWalkingWindow).ngxNativeBuildNumber = "641";
    expect(nativeBuildLabel()).toBe("Build 641");
    delete (window as NativeWalkingWindow).ngxNativeBuildNumber;
  });
});
