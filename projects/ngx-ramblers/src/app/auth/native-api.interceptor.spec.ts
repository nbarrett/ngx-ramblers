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
      status: 200, url: "https://group.example.org.uk/api/health", headers: {}, data: ""
    });
    const body = {userName: "alex.reed", password: "test-password"};
    const completed = firstValueFrom(TestBed.inject(HttpClient).post("/api/database/auth/login", body, {
      headers: {"X-Test-Header": "retained"}
    }));
    await vi.waitFor(() => {
      const pending = TestBed.inject(HttpTestingController).expectOne("https://group.example.org.uk/api/database/auth/login");
      expect(pending.request.method).toBe("POST");
      expect(pending.request.body).toEqual(body);
      expect(pending.request.headers.get("X-Test-Header")).toBe("retained");
      pending.flush({loginResponse: {memberLoggedIn: true}});
    });
    await expect(completed).resolves.toEqual({loginResponse: {memberLoggedIn: true}});
    expect(localStorage.getItem(StoredValue.APP_SITE_ORIGIN)).toBe("https://www.group.example.org.uk");
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
