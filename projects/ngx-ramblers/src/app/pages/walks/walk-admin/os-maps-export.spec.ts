import { MemberLoginService } from "../../../services/member/member-login.service";
import { RouteNearbyService } from "../../../services/maps/route-nearby.service";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { of } from "rxjs";
import { OsMapsExportPage } from "./os-maps-export";
import { OsMapsExportService } from "../../../services/maps/os-maps-export.service";
import { OsMapsRouteListCacheService } from "../../../services/maps/os-maps-route-list-cache.service";
import { RouteListPreferencesService } from "../../../services/maps/route-list-preferences.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { RamblersUploadAuditService } from "../../../services/walks/ramblers-upload-audit.service";
import { StoredValue } from "../../../models/ui-actions";
import { SerenityFeature } from "../../../models/serenity-feature.model";
import { OsMapsAccountScope, OsMapsExportTab, OsMapsListedRoute } from "../../../models/os-maps-export.model";
import { OS_MAPS_EXPORT_POLL_INTERVAL_MS, OsMapsExportJobResult, OsMapsExportJobStatus } from "../../../models/os-maps-export.model";

describe("OS Maps export job reconnection", () => {
  const queued: OsMapsExportJobResult = {
    jobId: "active-export",
    fileName: "active-export.gpx",
    status: OsMapsExportJobStatus.QUEUED,
    walkId: null,
    routeUrls: [],
    gpxFiles: [],
    error: null,
    createdAt: 1,
    completedAt: null
  };
  const service = {
    listing: vi.fn(),
    deleteRoute: vi.fn(),
    latestExportResult: vi.fn(),
    exportRoutes: vi.fn(),
    cancelActive: vi.fn(),
    refresh: vi.fn()
  };
  const listCache = {
    snapshot: vi.fn(),
    save: vi.fn()
  };
  const listPreferences = {
    isFavourite: vi.fn(),
    isHidden: vi.fn(),
    toggleFavourite: vi.fn(),
    hide: vi.fn(),
    showHidden: vi.fn(),
    hiddenCount: vi.fn()
  };
  const state = {page: null as OsMapsExportPage | null};

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    service.listing.mockResolvedValue({listedAt: 0, routes: []});
    service.latestExportResult.mockResolvedValue(queued);
    listCache.snapshot.mockReturnValue(null);
    listPreferences.isFavourite.mockReturnValue(false);
    listPreferences.isHidden.mockReturnValue(false);
    listPreferences.hiddenCount.mockReturnValue(0);
    TestBed.configureTestingModule({providers: [
      {provide: MemberLoginService, useValue: {loggedInMember: () => ({memberId: "member-admin", walkAdmin: true})}},
      {provide: RouteNearbyService, useValue: {}},
      {provide: OsMapsExportService, useValue: service},
      {provide: OsMapsRouteListCacheService, useValue: listCache},
      {provide: RouteListPreferencesService, useValue: listPreferences},
      {provide: LoggerFactory, useValue: {createLogger: () => ({error: vi.fn()})}},
      {provide: ActivatedRoute, useValue: {snapshot: {queryParams: {}}}},
      {provide: SystemConfigService, useValue: {osMapsLoginConfigured: () => true, events: () => of(null)}},
      {provide: StringUtilsService, useValue: {kebabCase: (value: string) => value, pluraliseWithCount: () => "1 GPX file"}},
      {provide: RamblersUploadAuditService, useValue: {all: async () => ({response: []})}},
      ...[DistanceValidationService, DateUtilsService, UiActionsService, UrlService, WalkDisplayService, Router]
        .map(provide => ({provide, useValue: {}}))
    ]});
    TestBed.overrideProvider(UiActionsService, {useValue: {updateQueryParameters: vi.fn(), initialValueFor: () => null}});
    TestBed.overrideProvider(DateUtilsService, {useValue: {asString: () => "04 Oct 2026 20:57"}});
    state.page = TestBed.runInInjectionContext(() => new OsMapsExportPage());
    state.page.ngOnInit();
  });

  afterEach(() => {
    state.page?.ngOnDestroy();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it("allows members to select their own unimported routes but not reimport shared routes", () => {
    state.page["memberLogin"] = {loggedInMember: () => ({memberId: "alex"})} as unknown as MemberLoginService;
    const imported = {id: "shared", importedAt: 1} as OsMapsListedRoute;
    const pending = {id: "personal", importedAt: 0} as OsMapsListedRoute;
    state.page.toggleSelected(imported);
    state.page.toggleSelected(pending);
    expect(state.page.selectedIds.has(imported.id)).toBe(false);
    expect(state.page.selectedIds.has(pending.id)).toBe(true);
    expect(state.page.isAdmin()).toBe(false);
  });

  it("blocks another export while checking and restores the running job after reopening", async () => {
    expect(state.page.busy()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.page.converting).toBe(true);
    expect(state.page.currentJobFileName).toBe(queued.fileName);
    state.page.selectedIds.add("route");
    await state.page.convertSelected();
    expect(service.exportRoutes).not.toHaveBeenCalled();
  });

  it("unlocks the page when the restored job finishes", async () => {
    await vi.advanceTimersByTimeAsync(0);
    service.latestExportResult.mockResolvedValue({...queued, status: OsMapsExportJobStatus.COMPLETED});
    await vi.advanceTimersByTimeAsync(OS_MAPS_EXPORT_POLL_INTERVAL_MS);
    expect(state.page.busy()).toBe(false);
    expect(state.page.successMessage).toContain("saved and ready");
    expect(service.listing).toHaveBeenCalledTimes(2);
  });

  it("keeps the active job controllable when a status request fails", async () => {
    await vi.advanceTimersByTimeAsync(0);
    service.latestExportResult.mockRejectedValue(new Error("Temporary network failure"));
    await vi.advanceTimersByTimeAsync(OS_MAPS_EXPORT_POLL_INTERVAL_MS);
    expect(state.page.busy()).toBe(true);
    expect(state.page.converting).toBe(true);
    expect(state.page.jobStatusUnavailable).toBe(true);
    expect(state.page.errorMessage).toContain("Retrying automatically");
    service.latestExportResult.mockResolvedValue({...queued, status: OsMapsExportJobStatus.COMPLETED});
    await vi.advanceTimersByTimeAsync(OS_MAPS_EXPORT_POLL_INTERVAL_MS);
    expect(state.page.busy()).toBe(false);
    expect(state.page.jobStatusUnavailable).toBe(false);
    expect(state.page.errorMessage).toBe("");
  });

  it("shows reload progress and keeps export polling from replacing it", async () => {
    service.latestExportResult.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(0);
    service.refresh.mockResolvedValue({jobId: "listing-job", fileName: "os-maps-list-example.json"});
    service.listing.mockResolvedValue({listedAt: 1, routes: []});
    await state.page.refreshRoutes();
    expect(state.page.jobFeature).toBe(SerenityFeature.OS_MAPS_LIST);
    expect(state.page.activeTabId).toBe(OsMapsExportTab.JOB_PROGRESS);
    expect(state.page.currentJobFileName).toBe("os-maps-list-example.json");
    expect(state.page.startingJob).toBe(false);
    expect(state.page.loading).toBe(false);
    expect(state.page.successMessage).toBe("Routes reloaded from OS Maps");
    service.latestExportResult.mockResolvedValue(queued);
    await vi.advanceTimersByTimeAsync(OS_MAPS_EXPORT_POLL_INTERVAL_MS);
    expect(state.page.currentJobFileName).toBe("os-maps-list-example.json");
    expect(state.page.converting).toBe(false);
  });

  it("restores the reload session after refreshing the page", async () => {
    state.page.ngOnDestroy();
    TestBed.inject(ActivatedRoute).snapshot.queryParams[StoredValue.SESSION] = "os-maps-list-example.json";
    state.page = TestBed.runInInjectionContext(() => new OsMapsExportPage());
    state.page.ngOnInit();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.page.jobFeature).toBe(SerenityFeature.OS_MAPS_LIST);
    expect(state.page.currentJobFileName).toBe("os-maps-list-example.json");
    expect(state.page.checkingJob).toBe(false);
    expect(state.page.converting).toBe(false);
    expect(service.latestExportResult).not.toHaveBeenCalled();
  });

  it("clears reload starting state if dispatch fails", async () => {
    service.latestExportResult.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(0);
    service.refresh.mockRejectedValue(new Error("Worker unavailable"));
    await state.page.refreshRoutes();
    expect(state.page.loading).toBe(false);
    expect(state.page.startingJob).toBe(false);
    expect(state.page.errorMessage).toContain("Worker unavailable");
  });

  it("clears dispatched selections so the next conversion includes only newly selected routes", async () => {
    service.latestExportResult.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(0);
    const routes = [
      {id: "first", url: "https://group.example.org.uk/routes/first"},
      {id: "second", url: "https://group.example.org.uk/routes/second"}
    ];
    service.listing.mockResolvedValue({listedAt: 0, routes});
    await vi.advanceTimersByTimeAsync(OS_MAPS_EXPORT_POLL_INTERVAL_MS);
    state.page.listing = {listedAt: 0, routes} as typeof state.page.listing;
    service.exportRoutes.mockResolvedValue({jobId: "first-job", fileName: "first-job.gpx"});
    state.page.selectedIds.add("first");
    await state.page.convertSelected();
    expect(state.page.selectedIds.size).toBe(0);
    state.page.selectedIds.add("second");
    service.exportRoutes.mockResolvedValue({jobId: "second-job", fileName: "second-job.gpx"});
    await state.page.convertSelected();
    expect(service.exportRoutes.mock.calls.map(call => call[0])).toEqual([[routes[0].url], [routes[1].url]]);
  });

  it("keeps the selection available for retry if dispatch fails", async () => {
    service.latestExportResult.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(0);
    state.page.selectedIds.add("first");
    service.exportRoutes.mockRejectedValue(new Error("Worker unavailable"));
    await state.page.convertSelected();
    expect(state.page.selectedIds.has("first")).toBe(true);
  });

  it("uses the public walk path for referenced walk links", () => {
    TestBed.inject(WalkDisplayService).walksArea = () => "walks";
    expect(state.page.walkReferenceLink({id: "walk-one", slug: "hillside-walk", title: "Hillside walk", startDateTime: ""}))
      .toEqual(["/walks", "hillside-walk"]);
  });

  it("does not request deletion for a route linked to a walk", async () => {
    const route = {id: "1001", walks: [{id: "walk-one"}]} as OsMapsListedRoute;
    state.page.deleteRouteId = route.id;
    await state.page.deleteRoute(route);
    expect(service.deleteRoute).not.toHaveBeenCalled();
    expect(state.page.errorMessage).toContain("linked to a walk");
    expect(state.page.deleteRouteId).toBeNull();
  });

  it("reloads references when the server rejects a stale delete request", async () => {
    await vi.advanceTimersByTimeAsync(0);
    service.deleteRoute.mockRejectedValue({error: {error: "This route cannot be deleted because it is linked to a walk"}});
    const route = {id: "1001", walks: []} as OsMapsListedRoute;
    await state.page.deleteRoute(route);
    expect(service.listing).toHaveBeenCalledTimes(2);
    expect(state.page.errorMessage).toContain("linked to a walk");
    expect(state.page.deletingRoute).toBe(false);
  });

  it("stops polling when the page is closed", async () => {
    await vi.advanceTimersByTimeAsync(0);
    state.page.ngOnDestroy();
    await vi.advanceTimersByTimeAsync(OS_MAPS_EXPORT_POLL_INTERVAL_MS);
    expect(service.latestExportResult).toHaveBeenCalledTimes(1);
  });

  it("does not show No routes loaded yet while the saved listing is still loading", () => {
    service.listing.mockReturnValue(new Promise(() => {}));
    state.page.ngOnDestroy();
    state.page = TestBed.runInInjectionContext(() => new OsMapsExportPage());
    state.page.ngOnInit();
    expect(state.page.listingLoading).toBe(true);
    expect(state.page.emptyMessage()).toBe("Loading saved routes…");
  });

  it("shows cached routes immediately while the listing request is in flight", () => {
    const cached = {listedAt: 9, routes: [{id: "cached-route", title: "Hillside Park"} as OsMapsListedRoute]};
    listCache.snapshot.mockReturnValue(cached);
    service.listing.mockReturnValue(new Promise(() => {}));
    state.page.ngOnDestroy();
    state.page = TestBed.runInInjectionContext(() => new OsMapsExportPage());
    state.page.ngOnInit();
    expect(state.page.listing.routes.map(route => route.id)).toEqual(["cached-route"]);
    expect(state.page.lastLoadedLabel).toBe("04 Oct 2026 20:57");
    expect(state.page.listingLoading).toBe(false);
  });

  it("stores the latest listing in the session cache", async () => {
    await vi.advanceTimersByTimeAsync(0);
    expect(listCache.save).toHaveBeenCalledWith(OsMapsAccountScope.GROUP, {listedAt: 0, routes: []});
  });

  it("uses the same favourite key as the app and can hide a route from the list", () => {
    const route = {id: "1001", title: "Hillside Park", url: "https://explore.osmaps.com/route/1001", createdAt: "", createdAtValue: 1, distanceMetres: 1000, source: "created"} as OsMapsListedRoute;
    state.page.listing = {listedAt: 1, routes: [route]};
    expect(state.page.routeKey(route)).toBe("os-maps:1001");
    listPreferences.isHidden.mockImplementation((key: string) => key === "os-maps:1001");
    expect(state.page.visibleRoutes()).toEqual([]);
    state.page.hideRoute(route);
    expect(listPreferences.hide).toHaveBeenCalledWith("os-maps:1001");
  });

  it("limits the list to favourites when that filter is on", () => {
    const favourite = {id: "1001", title: "Hillside Park", url: "https://explore.osmaps.com/route/1001", createdAt: "", createdAtValue: 1, distanceMetres: 1000, source: "created"} as OsMapsListedRoute;
    const other = {id: "1002", title: "Other", url: "https://explore.osmaps.com/route/1002", createdAt: "", createdAtValue: 1, distanceMetres: 1000, source: "created"} as OsMapsListedRoute;
    state.page.listing = {listedAt: 1, routes: [favourite, other]};
    listPreferences.isFavourite.mockImplementation((key: string) => key === "os-maps:1001");
    state.page.favouritesOnly = true;
    expect(state.page.visibleRoutes().map(route => route.id)).toEqual(["1001"]);
  });
});
