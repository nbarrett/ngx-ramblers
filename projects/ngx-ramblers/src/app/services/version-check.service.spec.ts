import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { BuildVersion } from "../models/build-version.model";
import { VersionCheckService } from "./version-check.service";

describe("VersionCheckService", () => {
  let service: VersionCheckService;
  let httpMock: HttpTestingController;
  let reloads: number;

  function respondWith(buildNumber: string) {
    const request = httpMock.expectOne("/api/version");
    const response: BuildVersion = {buildNumber};
    request.flush(response);
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule, RouterTestingModule],
      providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    });
    service = TestBed.inject(VersionCheckService);
    httpMock = TestBed.inject(HttpTestingController);
    reloads = 0;
    service["reloadPage"] = () => reloads++;
    service.initialise();
    respondWith("745");
    await Promise.resolve();
  });

  afterEach(() => httpMock.verify());

  it("does not reload when the deployed version is unchanged", async () => {
    const check = service["checkForNewVersion"]();
    respondWith("745");
    await check;
    expect(reloads).toBe(0);
  });

  it("reloads when a new version is deployed and the page is idle", async () => {
    const check = service["checkForNewVersion"]();
    respondWith("746");
    await check;
    expect(reloads).toBe(1);
  });

  it("does not reload when an older machine responds during a rolling deploy", async () => {
    const check = service["checkForNewVersion"]();
    respondWith("744");
    await check;
    expect(reloads).toBe(0);
  });

  it("defers the reload while the user has been editing", async () => {
    document.dispatchEvent(new Event("input", {bubbles: true}));
    const check = service["checkForNewVersion"]();
    respondWith("746");
    await check;
    expect(reloads).toBe(0);
  });

  it("reloads once the user stops editing", async () => {
    document.dispatchEvent(new Event("input", {bubbles: true}));
    const check = service["checkForNewVersion"]();
    respondWith("746");
    await check;
    expect(reloads).toBe(0);
    service["userHasEditedSinceNavigation"] = false;
    service["reloadIfReady"]();
    expect(reloads).toBe(1);
  });
});
