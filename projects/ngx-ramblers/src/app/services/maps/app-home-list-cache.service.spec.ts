import { Capacitor } from "@capacitor/core";
import { saveNativeWalkingSite } from "../../functions/native-walking";
import { AppHomeListSnapshot } from "../../models/app-home-list-cache.model";
import { RouteFollowSummary } from "../../models/route-follow.model";
import { StoredValue } from "../../models/ui-actions";
import { AppHomeListCacheService } from "./app-home-list-cache.service";

describe("group home list isolation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.removeItem(StoredValue.APP_SITE_ORIGIN);
    window.sessionStorage.clear();
  });

  it("keeps memory and stored lists separate even when both groups are signed out", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const cache = Object.create(AppHomeListCacheService.prototype) as AppHomeListCacheService;
    cache["memberLogin"] = {loggedInMember: () => null} as unknown as typeof cache["memberLogin"];
    const first = {routes: [{routeId: "first-route"} as RouteFollowSummary], walks: [], websiteMapKeys: [], importedOsMapsByKey: {}, previewPoints: {}, offlineByKey: {}} as AppHomeListSnapshot;
    saveNativeWalkingSite("https://first.example.org.uk");
    cache.save(first);
    expect(cache.snapshot()?.routes).toEqual(first.routes);
    saveNativeWalkingSite("https://second.example.org.uk");
    expect(cache.snapshot()).toBeNull();
    cache.save({...first, routes: [{routeId: "second-route"} as RouteFollowSummary]});
    saveNativeWalkingSite("https://first.example.org.uk");
    expect(cache.snapshot()?.routes).toEqual(first.routes);
  });
});
