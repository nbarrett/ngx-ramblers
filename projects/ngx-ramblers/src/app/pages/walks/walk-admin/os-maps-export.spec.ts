import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { of } from "rxjs";
import { OsMapsExportPage } from "./os-maps-export";
import { OsMapsExportService } from "../../../services/maps/os-maps-export.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { RamblersUploadAuditService } from "../../../services/walks/ramblers-upload-audit.service";
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
    latestExportResult: vi.fn(),
    exportRoutes: vi.fn(),
    cancelActive: vi.fn()
  };
  const state = {page: null as OsMapsExportPage | null};

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    service.listing.mockResolvedValue({listedAt: 0, routes: []});
    service.latestExportResult.mockResolvedValue(queued);
    TestBed.configureTestingModule({providers: [
      {provide: OsMapsExportService, useValue: service},
      {provide: LoggerFactory, useValue: {createLogger: () => ({error: vi.fn()})}},
      {provide: ActivatedRoute, useValue: {snapshot: {queryParams: {}}}},
      {provide: SystemConfigService, useValue: {osMapsLoginConfigured: () => true, events: () => of(null)}},
      {provide: StringUtilsService, useValue: {kebabCase: (value: string) => value, pluraliseWithCount: () => "1 GPX file"}},
      {provide: RamblersUploadAuditService, useValue: {all: async () => ({response: []})}},
      ...[DistanceValidationService, DateUtilsService, UiActionsService, UrlService, WalkDisplayService, Router]
        .map(provide => ({provide, useValue: {}}))
    ]});
    state.page = TestBed.runInInjectionContext(() => new OsMapsExportPage());
    state.page.ngOnInit();
  });

  afterEach(() => {
    state.page?.ngOnDestroy();
    vi.useRealTimers();
    TestBed.resetTestingModule();
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
  });

  it("stops polling when the page is closed", async () => {
    await vi.advanceTimersByTimeAsync(0);
    state.page.ngOnDestroy();
    await vi.advanceTimersByTimeAsync(OS_MAPS_EXPORT_POLL_INTERVAL_MS);
    expect(service.latestExportResult).toHaveBeenCalledTimes(1);
  });
});
