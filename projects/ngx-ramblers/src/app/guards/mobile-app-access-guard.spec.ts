import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, convertToParamMap, Router } from "@angular/router";
import { MobileAppAccessGuard } from "./mobile-app-access-guard";
import { NativeSiteService } from "../services/maps/native-site.service";
import { MobileAppAccessService } from "../services/maps/mobile-app-access.service";
import { AppPath } from "../models/route-follow.model";
import { MobileAppAction } from "../models/walks-config.model";
import { StoredValue } from "../models/ui-actions";

describe("MobileAppAccessGuard", () => {
  const nativeSite = {needsChooser: vi.fn()};
  const access = {ready: vi.fn(), allowed: vi.fn()};
  const router = {navigate: vi.fn()};

  beforeEach(() => {
    vi.resetAllMocks();
    access.ready.mockResolvedValue(null);
    TestBed.configureTestingModule({providers: [
      {provide: NativeSiteService, useValue: nativeSite},
      {provide: MobileAppAccessService, useFactory: () => access},
      {provide: Router, useValue: router}
    ]});
  });

  function snapshot(path: string, recording = false): ActivatedRouteSnapshot {
    return {routeConfig: {path}, queryParamMap: convertToParamMap(recording ? {[StoredValue.RECORD_ROUTE]: "true"} : {})} as ActivatedRouteSnapshot;
  }

  it("opens the group chooser without checking site permissions", async () => {
    nativeSite.needsChooser.mockReturnValue(true);
    expect(await TestBed.runInInjectionContext(() => MobileAppAccessGuard(snapshot(AppPath.ROOT)))).toBe(true);
    expect(access.ready).not.toHaveBeenCalled();
    expect(access.allowed).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("routes a saved route to the chooser before a site has been selected", async () => {
    nativeSite.needsChooser.mockReturnValue(true);
    expect(await TestBed.runInInjectionContext(() => MobileAppAccessGuard(snapshot(`${AppPath.ROOT}/${AppPath.ROUTE}`)))).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(["/" + AppPath.ROOT]);
    expect(access.ready).not.toHaveBeenCalled();
  });

  it("checks access after a site has been selected", async () => {
    nativeSite.needsChooser.mockReturnValue(false);
    access.allowed.mockReturnValue(true);
    expect(await TestBed.runInInjectionContext(() => MobileAppAccessGuard(snapshot(AppPath.ROOT)))).toBe(true);
    expect(access.ready).toHaveBeenCalled();
    expect(access.allowed).toHaveBeenCalledWith(MobileAppAction.ACCESS);
  });

  it("keeps the sign-in requirement for recording", async () => {
    nativeSite.needsChooser.mockReturnValue(false);
    access.allowed.mockReturnValue(false);
    expect(await TestBed.runInInjectionContext(() => MobileAppAccessGuard(snapshot(AppPath.ROOT, true)))).toBe(false);
    expect(access.allowed).toHaveBeenCalledWith(MobileAppAction.RECORD);
    expect(router.navigate).toHaveBeenCalledWith(["/login"], {queryParams: {[StoredValue.REDIRECT]: "/" + AppPath.ROOT}});
  });
});
