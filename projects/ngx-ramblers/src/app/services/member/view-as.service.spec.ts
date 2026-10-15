import { TestBed } from "@angular/core/testing";
import { Subject } from "rxjs";
import { AuthService } from "../../auth/auth.service";
import { MemberCookie } from "../../models/member.model";
import { ViewAsService } from "./view-as.service";
import { MemberService } from "./member.service";
import { StoredValue } from "../../models/ui-actions";

const actorId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const targetId = "bbbbbbbbbbbbbbbbbbbbbbbb";

describe("View as availability and shortcut", () => {
  const state = {actor: {memberId: actorId, memberAdmin: true, viewAsMember: true} as Partial<MemberCookie>, expired: false};
  const authChanges = new Subject();
  const originalUrl = window.location.href;

  beforeEach(() => {
    window.sessionStorage.clear();
    state.actor = {memberId: actorId, memberAdmin: true, viewAsMember: true};
    state.expired = false;
    TestBed.configureTestingModule({providers: [
      {provide: AuthService, useValue: {parseAuthToken: () => state.actor, tokenExpired: () => state.expired, authResponse: () => authChanges, sessionChanges: () => new Subject()}},
      {provide: MemberService, useValue: {getById: vi.fn().mockResolvedValue({id: targetId, firstName: "Alex", lastName: "Reed"})}}
    ]});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    window.history.replaceState(null, "", originalUrl);
  });

  it("requires Member Admin and the dedicated permission, without Content Admin", () => {
    const service = TestBed.inject(ViewAsService);
    expect(service.enabled()).toBe(true);
    state.actor.viewAsMember = false;
    expect(service.enabled()).toBe(false);
    state.actor.viewAsMember = true;
    state.actor.memberAdmin = false;
    expect(service.enabled()).toBe(false);
  });

  it("does not present an unassigned role as an active simulation", async () => {
    const service = TestBed.inject(ViewAsService);
    const url = new URL(window.location.href);
    url.searchParams.delete(StoredValue.VIEW_AS);
    url.searchParams.set(StoredValue.VIEW_AS_ROLE, "chair");
    window.history.replaceState(null, "", url);
    await service.hydrateFromLocation();
    expect(service.roleTypeFromLocation()).toBeNull();
    expect(service.viewedCookie()).toBeNull();
  });

  it("does not offer the feature to expired or anonymous sessions", () => {
    const service = TestBed.inject(ViewAsService);
    state.expired = true;
    expect(service.enabled()).toBe(false);
    state.expired = false;
    state.actor = {};
    expect(service.enabled()).toBe(false);
  });

  it("hides and restores the chrome without clearing the selected profile", async () => {
    const service = TestBed.inject(ViewAsService);
    const url = new URL(window.location.href);
    url.searchParams.set(StoredValue.VIEW_AS, targetId);
    window.history.replaceState(null, "", url);
    await service.hydrateFromLocation();
    service.setOptedIn(false);
    service.setChromeVisible(true);
    window.dispatchEvent(new KeyboardEvent("keydown", {altKey: true, shiftKey: true, code: "KeyV"}));
    expect(service.chromeVisible()).toBe(false);
    expect(service.viewedCookie()?.memberId).toBe(targetId);
    window.dispatchEvent(new KeyboardEvent("keydown", {altKey: true, shiftKey: true, code: "KeyV"}));
    expect(service.barVisible()).toBe(true);
    expect(service.viewedCookie()?.memberId).toBe(targetId);
  });

  it("keeps the selected person and role after navigation and a service restart", async () => {
    const service = TestBed.inject(ViewAsService);
    const url = new URL(window.location.href);
    url.searchParams.set(StoredValue.VIEW_AS, targetId);
    url.searchParams.set(StoredValue.VIEW_AS_ROLE, "chair");
    window.history.replaceState(null, "", url);
    await service.hydrateFromLocation();
    url.searchParams.delete(StoredValue.VIEW_AS);
    url.searchParams.delete(StoredValue.VIEW_AS_ROLE);
    window.history.replaceState(null, "", url);
    expect(service.memberIdFromLocation()).toBe(targetId);
    expect(service.roleTypeFromLocation()).toBe("chair");
    const restarted = TestBed.runInInjectionContext(() => new ViewAsService());
    await restarted.hydrateFromLocation();
    expect(restarted.viewedCookie()?.memberId).toBe(targetId);
    expect(restarted.roleTypeFromLocation()).toBe("chair");
    restarted.ngOnDestroy();
  });

  it("does not restore another administrator's selected profile", async () => {
    const service = TestBed.inject(ViewAsService);
    const url = new URL(window.location.href);
    url.searchParams.set(StoredValue.VIEW_AS, targetId);
    window.history.replaceState(null, "", url);
    await service.hydrateFromLocation();
    url.searchParams.delete(StoredValue.VIEW_AS);
    window.history.replaceState(null, "", url);
    state.actor.memberId = "cccccccccccccccccccccccc";
    await service.hydrateFromLocation();
    expect(service.memberIdFromLocation()).toBeNull();
    expect(service.viewedCookie()).toBeNull();
  });

  it("stops returning the simulated identity as soon as the real session loses access", async () => {
    const service = TestBed.inject(ViewAsService);
    const url = new URL(window.location.href);
    url.searchParams.set(StoredValue.VIEW_AS, targetId);
    window.history.replaceState(null, "", url);
    await service.hydrateFromLocation();
    expect(service.viewedCookie()?.memberId).toBe(targetId);
    state.actor = {};
    authChanges.next(null);
    expect(service.viewedCookie()).toBeNull();
  });
});
