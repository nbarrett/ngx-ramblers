import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SerenityJobAuditPanelComponent } from "./serenity-job-audit-panel";
import { DateUtilsService } from "../../../services/date-utils.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { RamblersUploadAuditService } from "../../../services/walks/ramblers-upload-audit.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { AuditType, RamblersUploadAudit, Status } from "../../../models/ramblers-upload-audit.model";
import { OsMapsExportJobStatus, osMapsExportProgressMessage } from "../../../models/os-maps-export.model";
import { MessageType, RamblersUploadAuditProgressResponse } from "../../../models/websocket.model";
import { StoredValue } from "../../../models/ui-actions";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { LoggerTestingModule } from "ngx-logger/testing";

describe("Serenity job progress summary", () => {
  const state = {fixture: null as ComponentFixture<SerenityJobAuditPanelComponent> | null};
  const progressMessages = new Subject<RamblersUploadAuditProgressResponse>();
  const completeMessages = new Subject<RamblersUploadAuditProgressResponse>();
  const queryParams = new BehaviorSubject(convertToParamMap({}));
  const updateQueryParameters = vi.fn();

  beforeEach(async () => {
    vi.useFakeTimers();
    queryParams.next(convertToParamMap({}));
    updateQueryParameters.mockReset();
    await TestBed.configureTestingModule({
      imports: [SerenityJobAuditPanelComponent, LoggerTestingModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        {provide: ActivatedRoute, useValue: {queryParamMap: queryParams}},
        {provide: DateUtilsService, useValue: {formatDuration: () => "1s"}},
        {provide: StringUtilsService, useValue: {kebabCase: (value: string) => value}},
        {provide: UiActionsService, useValue: {updateQueryParameters}},
        {provide: RamblersUploadAuditService, useValue: {all: async () => ({response: []}), uniqueUploadSessions: async () => []}},
        {provide: WebSocketClientService, useValue: {
          connect: async () => null,
          receiveMessages: (type: MessageType) => type === MessageType.COMPLETE ? completeMessages : progressMessages
        }}
      ]
    }).compileComponents();
    state.fixture = TestBed.createComponent(SerenityJobAuditPanelComponent);
    state.fixture.componentRef.setInput("fileName", "example-export.gpx");
    state.fixture.detectChanges();
  });

  afterEach(() => {
    state.fixture?.destroy();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  function sendProgress(converted: number, total: number, failed = 0): void {
    const audit: RamblersUploadAudit = {
      id: "progress", record: converted + failed + 1,
      type: AuditType.STEP, status: Status.SUCCESS,
      fileName: "example-export.gpx",
      message: osMapsExportProgressMessage({converted, total, failed})
    };
    progressMessages.next({audits: [audit]});
    state.fixture.detectChanges();
  }

  it("shows converted counts and an accessible percentage bar with details hidden by default", () => {
    sendProgress(7, 50);
    const element = state.fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain("7 of 50 routes converted");
    expect(element.querySelector(".alert")).toBeNull();
    expect(element.querySelector("button fa-icon")).not.toBeNull();
    expect(element.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow")).toBe("14");
    expect(element.querySelector("app-sortable-table")).toBeNull();
    expect(element.textContent).toContain("Show details");
  });

  it("toggles the established detailed table and saves the choice in the URL", () => {
    const component = state.fixture.componentInstance;
    component.toggleDetails();
    state.fixture.detectChanges();
    expect(state.fixture.nativeElement.querySelector("app-sortable-table")).not.toBeNull();
    expect(updateQueryParameters).toHaveBeenCalledWith({[StoredValue.EXPANDED]: "true"});
    component.toggleDetails();
    state.fixture.detectChanges();
    expect(state.fixture.nativeElement.querySelector("app-sortable-table")).toBeNull();
    expect(updateQueryParameters).toHaveBeenLastCalledWith({[StoredValue.EXPANDED]: null});
  });

  it("restores the detailed view from the URL", () => {
    queryParams.next(convertToParamMap({[StoredValue.EXPANDED]: "true"}));
    state.fixture.detectChanges();
    expect(state.fixture.nativeElement.querySelector("app-sortable-table")).not.toBeNull();
  });

  it("uses cumulative totals and reports failures without claiming all routes were converted", () => {
    sendProgress(49, 50, 1);
    expect(state.fixture.componentInstance.summaryMessage()).toBe("49 of 50 routes converted");
    expect(state.fixture.componentInstance.progressPercent()).toBe(98);
    expect(state.fixture.nativeElement.textContent).toContain("1 route could not be converted");
    const element = state.fixture.nativeElement as HTMLElement;
    const alert = element.querySelector(".alert-warning");
    expect(element.querySelectorAll(".alert")).toHaveLength(1);
    expect(alert?.querySelector("strong")?.textContent).toContain("1 route could not be converted");
    expect(alert?.querySelector("fa-icon")).not.toBeNull();
    expect(alert?.textContent).toContain("Show details to see why.");
    expect(alert?.querySelector("[role=progressbar]")).toBeNull();
    expect(alert?.querySelector("button")).toBeNull();
    expect(alert?.textContent).not.toContain("49 of 50");
  });

  it("restores the final conversion counts from a saved result", () => {
    state.fixture.componentRef.setInput("exportResult", {
      jobId: "example", fileName: "example-export.gpx", status: OsMapsExportJobStatus.COMPLETED,
      createdAt: 1, routeUrls: ["route-1", "route-2"], gpxFiles: [{rootFolder: "gpx-routes", awsFileName: "example.gpx", originalFileName: "example.gpx"}]
    });
    state.fixture.detectChanges();
    expect(state.fixture.componentInstance.summaryProgress()).toEqual({converted: 1, total: 2, failed: 1});
  });

  it("resets progress for a new job and ignores late progress from the previous job", () => {
    sendProgress(5, 5);
    state.fixture.componentRef.setInput("fileName", "next-export.gpx");
    state.fixture.detectChanges();
    expect(state.fixture.componentInstance.summaryProgress()).toBeNull();
    sendProgress(5, 5);
    expect(state.fixture.componentInstance.summaryProgress()).toBeNull();
    progressMessages.next({audits: [{
      id: "next-progress", record: 1, type: AuditType.STEP, status: Status.SUCCESS,
      fileName: "next-export.gpx", message: osMapsExportProgressMessage({converted: 0, total: 50, failed: 0})
    }]});
    state.fixture.detectChanges();
    expect(state.fixture.componentInstance.summaryProgress()).toEqual({converted: 0, total: 50, failed: 0});
  });

  it("ignores progress from another job", () => {
    progressMessages.next({audits: [{type: AuditType.STEP, status: Status.SUCCESS, fileName: "another-export.gpx", message: osMapsExportProgressMessage({converted: 10, total: 10, failed: 0})}]});
    expect(state.fixture.componentInstance.summaryProgress()).toBeNull();
  });
});
