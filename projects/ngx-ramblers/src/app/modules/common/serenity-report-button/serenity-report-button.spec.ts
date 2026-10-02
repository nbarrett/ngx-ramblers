import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditType, Status } from "../../../models/ramblers-upload-audit.model";
import { UrlService } from "../../../services/url.service";
import { SerenityReportButtonComponent } from "./serenity-report-button";

describe("Serenity report loading", () => {
  const navigateToUrl = vi.fn();
  const reportUrl = "/api/aws/report/example-bucket/reports/example-export.gpx/_/index.html";
  const state = {button: null as SerenityReportButtonComponent | null, http: null as HttpTestingController | null};

  beforeEach(() => {
    navigateToUrl.mockReset();
    TestBed.configureTestingModule({providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: UrlService, useValue: {navigateToUrl}}
    ]});
    state.button = TestBed.runInInjectionContext(() => new SerenityReportButtonComponent());
    state.http = TestBed.inject(HttpTestingController);
    state.button.audit = {type: AuditType.SUMMARY, status: Status.SUCCESS, reportBucket: "example-bucket", reportKeyPrefix: "reports/example-export.gpx"};
  });

  it("keeps loading and prevents repeat requests until the report is ready", async () => {
    const event = new MouseEvent("click");
    const opening = state.button.openReport(event);
    expect(state.button.loading).toBe(true);
    expect(navigateToUrl).not.toHaveBeenCalled();
    await state.button.openReport(event);
    state.http.expectOne(reportUrl).flush("<html></html>");
    await opening;
    expect(state.button.loading).toBe(false);
    expect(navigateToUrl).toHaveBeenCalledWith(reportUrl, event);
    state.http.verify();
  });

  it("clears loading and allows retry after a failed download", async () => {
    const opening = state.button.openReport(new MouseEvent("click"));
    state.http.expectOne(reportUrl).flush("Unavailable", {status: 500, statusText: "Server error"});
    await opening;
    expect(state.button.loading).toBe(false);
    expect(state.button.errorMessage).toBeTruthy();
    expect(navigateToUrl).not.toHaveBeenCalled();
    const retry = state.button.openReport(new MouseEvent("click"));
    expect(state.button.errorMessage).toBe("");
    state.http.expectOne(reportUrl).flush("<html></html>");
    await retry;
    expect(navigateToUrl).toHaveBeenCalledOnce();
    state.http.verify();
  });
});
