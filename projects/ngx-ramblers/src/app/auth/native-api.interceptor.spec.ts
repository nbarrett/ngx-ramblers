import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { Capacitor } from "@capacitor/core";
import { firstValueFrom } from "rxjs";
import { StoredValue } from "../models/ui-actions";
import { NATIVE_HTTP } from "../services/maps/native-site.service";
import { NativeApiInterceptor } from "./native-api.interceptor";

describe("Native API routing", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [
      provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting(),
      {provide: NATIVE_HTTP, useValue: {request: vi.fn()}},
      {provide: HTTP_INTERCEPTORS, useClass: NativeApiInterceptor, multi: true}
    ]});
    localStorage.setItem(StoredValue.APP_SITE_ORIGIN, "https://www.group.example.org.uk");
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem(StoredValue.APP_SITE_ORIGIN);
    vi.restoreAllMocks();
  });

  it("sends the login POST directly to the canonical origin with its body and headers intact", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue({
      status: 200, url: "https://www.group.example.org.uk/api/database/auth/login", headers: {}, data: {loginResponse: {memberLoggedIn: true}}
    });
    const body = {userName: "alex.reed", password: "test-password"};
    const completed = firstValueFrom(TestBed.inject(HttpClient).post("/api/database/auth/login", body, {
      headers: {"X-Test-Header": "retained", "Content-Type": "application/json"}
    }));
    await expect(completed).resolves.toEqual({loginResponse: {memberLoggedIn: true}});
    expect(TestBed.inject(NATIVE_HTTP).request).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://www.group.example.org.uk/api/database/auth/login", method: "POST", data: body, headers: {"X-Test-Header": "retained", "Content-Type": "application/json"}
    }));
    expect(localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBe("https://www.group.example.org.uk");
  });

  it("does not probe health when the WebView is already on the group website", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(window, "location", "get").mockReturnValue({
      hostname: "group.example.org.uk",
      protocol: "https:",
      origin: "https://group.example.org.uk"
    } as Location);
    const nativeRequest = vi.mocked(TestBed.inject(NATIVE_HTTP).request);
    const completed = firstValueFrom(TestBed.inject(HttpClient).get("/api/system-status"));
    TestBed.inject(HttpTestingController).expectOne("https://group.example.org.uk/api/system-status").flush({status: "ok"});
    await completed;
    expect(nativeRequest).not.toHaveBeenCalled();
  });

  it("requests local-shell API data through native HTTP without a browser CORS request or health probe", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const nativeRequest = vi.mocked(TestBed.inject(NATIVE_HTTP).request);
    nativeRequest.mockResolvedValue({status: 200, url: "https://www.group.example.org.uk/api/system-status", headers: {}, data: {status: "ok"}});
    await expect(firstValueFrom(TestBed.inject(HttpClient).get("/api/system-status"))).resolves.toEqual({status: "ok"});
    expect(nativeRequest).toHaveBeenCalledOnce();
    expect(nativeRequest).toHaveBeenCalledWith(expect.objectContaining({url: "https://www.group.example.org.uk/api/system-status"}));
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it("preserves API failures from native requests", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.mocked(TestBed.inject(NATIVE_HTTP).request).mockResolvedValue({status: 401, url: "https://www.group.example.org.uk/api/database/auth/login", headers: {}, data: {message: "Invalid login"}});
    await expect(firstValueFrom(TestBed.inject(HttpClient).post("/api/database/auth/login", {}))).rejects.toMatchObject({status: 401, error: {message: "Invalid login"}});
  });

  it("retains query parameters once when routing requests", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(window, "location", "get").mockReturnValue({hostname: "group.example.org.uk", protocol: "https:", origin: "https://group.example.org.uk"} as Location);
    const completed = firstValueFrom(TestBed.inject(HttpClient).get("/api/system-status", {params: {scope: "public"}}));
    TestBed.inject(HttpTestingController).expectOne("https://group.example.org.uk/api/system-status?scope=public").flush({status: "ok"});
    await completed;
  });

  it("leaves browser login requests on the current website", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    const nativeRequest = vi.mocked(TestBed.inject(NATIVE_HTTP).request);
    const completed = firstValueFrom(TestBed.inject(HttpClient).post("/api/database/auth/login", {}));
    TestBed.inject(HttpTestingController).expectOne("/api/database/auth/login").flush({});
    await completed;
    expect(nativeRequest).not.toHaveBeenCalled();
  });
});
