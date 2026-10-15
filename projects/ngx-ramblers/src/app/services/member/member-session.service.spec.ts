import { TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { defer, of, Subject, throwError } from "rxjs";
import { LoggerTestingModule } from "ngx-logger/testing";
import { AuthService } from "../../auth/auth.service";
import { MemberCookie } from "../../models/member.model";
import { WebSocketClientService } from "../websockets/websocket-client.service";
import { UrlService } from "../url.service";
import { ViewAsService } from "./view-as.service";
import { MemberSessionService } from "./member-session.service";

function setup() {
  const notifications = new Subject();
  const connections = new Subject<void>();
  const authChanges = new Subject();
  const state = {
    token: "fictional-token",
    refreshToken: "fictional-refresh",
    current: {memberId: "member-a", memberAdmin: true, viewAsMember: false} as Partial<MemberCookie>,
    stored: {memberId: "member-a", memberAdmin: true, viewAsMember: false} as Partial<MemberCookie>,
    viewed: null as MemberCookie | null,
    storedViewed: null as MemberCookie | null
  };
  const auth = {
    authToken: () => state.token,
    refreshToken: () => state.refreshToken,
    parseAuthToken: () => state.current,
    authResponse: () => authChanges,
    performTokenRefresh: vi.fn(() => defer(() => {
      state.current = {...state.stored};
      return of({auth: "renewed-token"});
    })),
    scheduleLogout: vi.fn()
  };
  const socket = {receiveMessages: () => notifications, connectionOpened: () => connections, connect: vi.fn().mockResolvedValue(null)};
  const url = {refresh: vi.fn()};
  TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [
    {provide: AuthService, useValue: auth},
    {provide: WebSocketClientService, useValue: socket},
    {provide: UrlService, useValue: url},
    {provide: ViewAsService, useValue: {viewedCookie: () => state.viewed, hydrateFromLocation: vi.fn(async () => {state.viewed = state.storedViewed;})}}
  ]});
  const service = TestBed.inject(MemberSessionService);
  service.initialise();
  return {service, notifications, connections, state, auth, socket, url};
}

describe("Member sessions on other computers", () => {
  afterEach(() => TestBed.resetTestingModule());

  it("refreshes an already open screen when a remote administrator grants a privilege", async () => {
    const {notifications, state, auth, url} = setup();
    await vi.waitFor(() => expect(auth.performTokenRefresh).toHaveBeenCalledOnce());
    state.stored = {...state.stored, viewAsMember: true};
    notifications.next({});
    await vi.waitFor(() => expect(url.refresh).toHaveBeenCalled());
    expect(state.current.viewAsMember).toBe(true);
  });

  it("updates removals in an existing session too", async () => {
    const {notifications, state, auth, url} = setup();
    await vi.waitFor(() => expect(auth.performTokenRefresh).toHaveBeenCalledOnce());
    state.stored = {...state.stored, memberAdmin: false};
    notifications.next({});
    await vi.waitFor(() => expect(url.refresh).toHaveBeenCalled());
    expect(state.current.memberAdmin).toBe(false);
  });

  it("does not reload another member whose own permissions are unchanged", async () => {
    const {notifications, auth, url} = setup();
    await vi.waitFor(() => expect(auth.performTokenRefresh).toHaveBeenCalledOnce());
    notifications.next({});
    await vi.waitFor(() => expect(auth.performTokenRefresh).toHaveBeenCalledTimes(2));
    expect(url.refresh).not.toHaveBeenCalled();
  });

  it("refreshes a simulated member when their privileges change on another computer", async () => {
    const {notifications, state, auth, url} = setup();
    await vi.waitFor(() => expect(auth.performTokenRefresh).toHaveBeenCalledOnce());
    state.viewed = {memberId: "member-b", memberAdmin: true} as MemberCookie;
    state.storedViewed = {memberId: "member-b", memberAdmin: false} as MemberCookie;
    notifications.next({});
    await vi.waitFor(() => expect(url.refresh).toHaveBeenCalled());
    expect(state.viewed.memberAdmin).toBe(false);
  });

  it("catches up after reconnecting when a notification was missed", async () => {
    const {connections, state, auth, url} = setup();
    await vi.waitFor(() => expect(auth.performTokenRefresh).toHaveBeenCalledOnce());
    state.stored = {...state.stored, memberAdmin: false};
    connections.next();
    await vi.waitFor(() => expect(url.refresh).toHaveBeenCalled());
  });

  it("signs out a session whose account has been revoked", async () => {
    const {notifications, auth, url} = setup();
    await vi.waitFor(() => expect(auth.performTokenRefresh).toHaveBeenCalledOnce());
    auth.performTokenRefresh.mockImplementation(() => throwError(() => new HttpErrorResponse({status: 401})));
    notifications.next({});
    await vi.waitFor(() => expect(auth.scheduleLogout).toHaveBeenCalledOnce());
    expect(url.refresh).toHaveBeenCalled();
  });

  it("does not reconnect or refresh anonymous visitors", async () => {
    const {notifications, state, auth, socket, service} = setup();
    await vi.waitFor(() => expect(auth.performTokenRefresh).toHaveBeenCalledOnce());
    state.token = null;
    service.initialise();
    notifications.next({});
    expect(socket.connect).toHaveBeenCalledOnce();
    expect(auth.performTokenRefresh).toHaveBeenCalledOnce();
  });
});
