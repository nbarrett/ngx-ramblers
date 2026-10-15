import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { firstValueFrom } from "rxjs";
import { AuthService } from "./auth.service";
import { BroadcastService } from "../services/broadcast-service";
import { SiteEditService } from "../site-edit/site-edit.service";
import { DateUtilsService } from "../services/date-utils.service";
import { StoredValue } from "../models/ui-actions";

function token(memberId: string, memberAdmin: boolean): string {
  return `header.${btoa(JSON.stringify({memberId, memberAdmin, iat: 1, exp: 4000000000}))}.signature`;
}

describe("Refreshing a live member session", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      {provide: BroadcastService, useValue: {broadcast: vi.fn()}},
      {provide: SiteEditService, useValue: {active: () => false}},
      {provide: DateUtilsService, useValue: {displayDateAndTime: () => "", nowAsValue: () => 1000}}
    ]});
    localStorage.setItem(StoredValue.AUTH_TOKEN, token("member-a", true));
    localStorage.setItem(StoredValue.REFRESH_TOKEN, "refresh-a");
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem(StoredValue.AUTH_TOKEN);
    localStorage.removeItem(StoredValue.REFRESH_TOKEN);
  });

  it("replaces cached permissions and announces session changes without emitting a login response", async () => {
    const service = TestBed.inject(AuthService);
    expect(service.parseAuthToken().memberAdmin).toBe(true);
    const sessionChanged = vi.fn();
    const loginResponse = vi.fn();
    service.sessionChanges().subscribe(sessionChanged);
    service.authResponse().subscribe(loginResponse);
    const refreshed = firstValueFrom(service.performTokenRefresh());
    TestBed.inject(HttpTestingController).expectOne("/api/database/auth/refresh").flush({auth: token("member-a", false)});
    await refreshed;
    expect(service.parseAuthToken().memberAdmin).toBe(false);
    expect(sessionChanged).toHaveBeenCalledOnce();
    expect(loginResponse).not.toHaveBeenCalled();
  });

  it("does not overwrite a different session when an older refresh finishes", async () => {
    const service = TestBed.inject(AuthService);
    const refreshed = firstValueFrom(service.performTokenRefresh());
    localStorage.setItem(StoredValue.AUTH_TOKEN, token("member-b", false));
    localStorage.setItem(StoredValue.REFRESH_TOKEN, "refresh-b");
    TestBed.inject(HttpTestingController).expectOne("/api/database/auth/refresh").flush({auth: token("member-a", true)});
    await refreshed;
    expect(service.authToken()).toBe(token("member-b", false));
  });
});

describe("Authentication responses", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      {provide: BroadcastService, useValue: {broadcast: vi.fn()}},
      {provide: SiteEditService, useValue: {active: () => false}},
      {provide: DateUtilsService, useValue: {displayDateAndTime: () => "", nowAsValue: () => 1000}}
    ]});
    localStorage.setItem(StoredValue.AUTH_TOKEN, token("member-a", true));
    localStorage.setItem(StoredValue.REFRESH_TOKEN, "refresh-a");
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem(StoredValue.AUTH_TOKEN);
    localStorage.removeItem(StoredValue.REFRESH_TOKEN);
  });

  it("stores a successful login response and announces the session once", async () => {
    const service = TestBed.inject(AuthService);
    const response = {loginResponse: {memberLoggedIn: true}, tokens: {auth: token("member-b", false), refresh: "refresh-b"}};
    const completed = service.login("alex.reed", "test-password");
    TestBed.inject(HttpTestingController).expectOne("/api/database/auth/login").flush(JSON.stringify(response));
    expect(await completed).toEqual(response.loginResponse);
    expect(service.authToken()).toBe(response.tokens.auth);
    expect(service.refreshToken()).toBe("refresh-b");
    expect(TestBed.inject(BroadcastService).broadcast).toHaveBeenCalledOnce();
  });

  it("preserves an existing session when a disabled account returns empty tokens", async () => {
    const service = TestBed.inject(AuthService);
    const loginResponse = {memberLoggedIn: false, alertMessage: "This account is disabled"};
    const completed = service.login("alex.reed", "test-password");
    TestBed.inject(HttpTestingController).expectOne("/api/database/auth/login").flush(
      JSON.stringify({loginResponse, tokens: {auth: null, refresh: null}}), {status: 401, statusText: "Unauthorised"});
    expect(await completed).toEqual(loginResponse);
    expect(service.authToken()).toBe(token("member-a", true));
    expect(service.refreshToken()).toBe("refresh-a");
    expect(TestBed.inject(BroadcastService).broadcast).not.toHaveBeenCalled();
  });

  it("keeps the password reset response without storing empty tokens", async () => {
    const service = TestBed.inject(AuthService);
    const loginResponse = {showResetPassword: true};
    const completed = service.login("alex.reed", "test-password");
    TestBed.inject(HttpTestingController).expectOne("/api/database/auth/login").flush(
      JSON.stringify({loginResponse, tokens: {auth: null, refresh: null}}));
    expect(await completed).toEqual(loginResponse);
    expect(service.authToken()).toBe(token("member-a", true));
    expect(TestBed.inject(BroadcastService).broadcast).not.toHaveBeenCalled();
  });

  it("reports an unexpected HTML response without announcing a login", async () => {
    const service = TestBed.inject(AuthService);
    const completed = service.login("alex.reed", "test-password");
    TestBed.inject(HttpTestingController).expectOne("/api/database/auth/login").flush("<!doctype html><html></html>");
    expect((await completed).memberLoggedIn).toBe(false);
    expect(service.refreshToken()).toBe("refresh-a");
    expect(TestBed.inject(BroadcastService).broadcast).not.toHaveBeenCalled();
  });
});
