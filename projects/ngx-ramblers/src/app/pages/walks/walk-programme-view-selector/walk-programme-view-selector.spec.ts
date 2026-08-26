import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { of } from "rxjs";
import { vi } from "vitest";
import { WALKS_ADMIN_SEGMENT, WALKS_LEADER_SEGMENT, WalksAdminSegment } from "../../../models/walks-route-paths.model";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { UrlService } from "../../../services/url.service";
import { WalkDisplayService } from "../walk-display.service";
import { WalkProgrammeViewSelector } from "./walk-programme-view-selector";

describe("WalkProgrammeViewSelector", () => {
  const router = {
    navigate: vi.fn().mockName("Router.navigate")
  };
  const urlService = {
    lastPathSegment: vi.fn().mockName("UrlService.lastPathSegment")
  };
  const display = {
    walkPopulationLocal: vi.fn().mockName("WalkDisplayService.walkPopulationLocal"),
    walksArea: vi.fn().mockName("WalkDisplayService.walksArea"),
    rememberReturnUrl: vi.fn().mockName("WalkDisplayService.rememberReturnUrl")
  };
  const memberLoginService = {
    allowWalkAdminEdits: vi.fn().mockName("MemberLoginService.allowWalkAdminEdits")
  };

  beforeEach(() => {
    router.navigate.mockReset().mockResolvedValue(true);
    urlService.lastPathSegment.mockReset().mockReturnValue(WALKS_LEADER_SEGMENT);
    display.walkPopulationLocal.mockReset().mockReturnValue(false);
    display.walksArea.mockReset().mockReturnValue("go-walking");
    display.rememberReturnUrl.mockReset();
    memberLoginService.allowWalkAdminEdits.mockReset().mockReturnValue(false);
    TestBed.configureTestingModule({
      imports: [WalkProgrammeViewSelector],
      providers: [
        {provide: Router, useValue: router},
        {provide: ActivatedRoute, useValue: {queryParams: of({})}},
        {provide: UrlService, useValue: urlService},
        {provide: WalkDisplayService, useValue: display},
        {provide: MemberLoginService, useValue: memberLoginService}
      ]
    });
  });

  it("hides Admin when the member is not a walk admin", () => {
    const selector = TestBed.createComponent(WalkProgrammeViewSelector).componentInstance;
    expect(selector.tabs.map(tab => tab.label)).toEqual(["My Walks", "Overview", "Calendar", "Map"]);
  });

  it("shows Export then Admin when the member is a walk admin", () => {
    memberLoginService.allowWalkAdminEdits.mockReturnValue(true);
    const selector = TestBed.createComponent(WalkProgrammeViewSelector).componentInstance;
    expect(selector.tabs.map(tab => tab.label)).toEqual(["My Walks", "Overview", "Calendar", "Map", "Export", "Admin"]);
  });

  it("navigates to the walks admin hub when Admin is selected", async () => {
    memberLoginService.allowWalkAdminEdits.mockReturnValue(true);
    const selector = TestBed.createComponent(WalkProgrammeViewSelector).componentInstance;
    await selector.openView(WALKS_ADMIN_SEGMENT);
    expect(display.rememberReturnUrl).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(["/go-walking/admin"], {queryParamsHandling: "preserve"});
  });

  it("still navigates programme views under walks admin", async () => {
    const selector = TestBed.createComponent(WalkProgrammeViewSelector).componentInstance;
    await selector.openView(WalksAdminSegment.PROGRAMME);
    expect(router.navigate).toHaveBeenCalledWith(["/go-walking/admin/programme"], {queryParamsHandling: "preserve"});
  });

  it("navigates to the export page when Export is selected", async () => {
    memberLoginService.allowWalkAdminEdits.mockReturnValue(true);
    const selector = TestBed.createComponent(WalkProgrammeViewSelector).componentInstance;
    await selector.openView(WalksAdminSegment.EXPORT);
    expect(router.navigate).toHaveBeenCalledWith(["/go-walking/admin/export"], {queryParamsHandling: "preserve"});
  });
});
