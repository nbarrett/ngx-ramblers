import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { LoggerTestingModule } from "ngx-logger/testing";
import { ContainerComponent } from "./container";
import { SystemConfigService } from "../services/system/system-config.service";
import { DataPopulationService } from "../pages/admin/data-population.service";
import { VersionCheckService } from "../services/version-check.service";
import { CanonicalLinkService } from "../services/canonical-link.service";
import { NativeSiteService } from "../services/maps/native-site.service";
import { AppShellService } from "../services/maps/app-shell.service";
import { UrlService } from "../services/url.service";
import { RouterHistoryService } from "../services/router-history.service";
import { SystemConfig } from "../models/system.model";

describe("container header ownership", () => {
  it.each([
    {url: "/app", active: true, chooser: false, headers: 1},
    {url: "/app", active: false, chooser: false, headers: 1},
    {url: "/walks", active: false, chooser: false, headers: 1},
    {url: "/", active: false, chooser: false, headers: 1},
    {url: "/app/route", active: true, chooser: false, headers: 0},
    {url: "/app", active: true, chooser: true, headers: 0}
  ])("renders $headers shared headers on $url with shell=$active and chooser=$chooser", ({url, active, chooser, headers}) => {
    TestBed.configureTestingModule({
      imports: [ContainerComponent, LoggerTestingModule],
      providers: [
        ...[SystemConfigService, DataPopulationService, VersionCheckService, CanonicalLinkService, UrlService, RouterHistoryService]
          .map(provide => ({provide, useValue: {}})),
        {provide: Router, useValue: {url}},
        {provide: AppShellService, useValue: {installed: () => false}},
        {provide: NativeSiteService, useValue: {needsChooser: () => chooser}}
      ]
    }).overrideComponent(ContainerComponent, {set: {imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA]}});
    vi.spyOn(ContainerComponent.prototype, "ngOnInit").mockImplementation(() => null);
    const fixture = TestBed.createComponent(ContainerComponent);
    fixture.componentInstance["config"] = {} as SystemConfig;
    fixture.componentInstance["appShellActive"] = active;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll("app-navbar")).toHaveLength(headers);
    fixture.destroy();
    vi.restoreAllMocks();
  });
});
