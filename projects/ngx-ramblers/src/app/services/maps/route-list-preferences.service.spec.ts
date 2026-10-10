import { Capacitor } from "@capacitor/core";
import { NativeWalkingWindow } from "../../models/native-route.model";
import { Subscription } from "rxjs";
import { LoggerTestingModule } from "ngx-logger/testing";
import { MemberService } from "../member/member.service";
import { MemberLoginService } from "../member/member-login.service";
import { BroadcastService } from "../broadcast-service";
import { CachedMemberRoutePreferences, MemberRoutePreferences, RoutePreferenceAction } from "../../models/member.model";
import { routePreferencesAfterChange } from "../../functions/route-preferences";
import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoredValue } from "../../models/ui-actions";
import { UiActionsService } from "../ui-actions.service";
import { RouteListPreferencesService } from "./route-list-preferences.service";

describe("route list preferences", () => {
  const state = {memberId: null as string | null, profile: {favouriteKeys: [], hiddenKeys: []} as MemberRoutePreferences, cache: {} as Record<string, CachedMemberRoutePreferences>};
  const members = {routePreferences: vi.fn(), changeRoutePreference: vi.fn()};
  const uiActions = {
    initialObjectValueFor: vi.fn(),
    saveValueFor: vi.fn()
  };

  beforeEach(() => {
    vi.resetAllMocks();
    state.memberId = null;
    state.profile = {favouriteKeys: [], hiddenKeys: []};
    state.cache = {};
    uiActions.initialObjectValueFor.mockImplementation(key => key === StoredValue.APP_ROUTE_PREFERENCES ? state.cache : []);
    uiActions.saveValueFor.mockImplementation((key, value) => {
      if (key === StoredValue.APP_ROUTE_PREFERENCES) {
        state.cache = value;
      }
      return true;
    });
    members.routePreferences.mockImplementation(async () => state.profile);
    members.changeRoutePreference.mockImplementation(async change => {
      state.profile = routePreferencesAfterChange(state.profile, change);
      return state.profile;
    });
    TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [
      {provide: MemberService, useValue: members},
      {provide: MemberLoginService, useValue: {loggedInMember: () => ({memberId: state.memberId})}},
      {provide: BroadcastService, useValue: {on: () => new Subscription()}},
      {provide: UiActionsService, useValue: uiActions}
    ]});
  });

  afterEach(() => {
    (window as NativeWalkingWindow).ngxNativeSiteUrl = null;
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it("keeps native preferences on this device without attempting profile sync before rollout", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    (window as NativeWalkingWindow).ngxNativeSiteUrl = "https://group.example.org.uk";
    state.memberId = "fictional-native-member";
    const prefs = TestBed.inject(RouteListPreferencesService);
    prefs.toggleFavourite("os-maps:1007");
    await prefs.refresh();
    expect(prefs.isFavourite("os-maps:1007")).toBe(true);
    expect(members.routePreferences).not.toHaveBeenCalled();
    expect(members.changeRoutePreference).not.toHaveBeenCalled();
    expect(state.cache["https://group.example.org.uk:fictional-native-member"].pending).toHaveLength(1);
    expect(prefs.syncMessage).toBeNull();
  });

  it("toggles a favourite and persists the same key the app uses", () => {
    const prefs = TestBed.inject(RouteListPreferencesService);
    prefs.toggleFavourite("os-maps:1001");
    expect(prefs.isFavourite("os-maps:1001")).toBe(true);
    expect(uiActions.saveValueFor).toHaveBeenCalledWith(StoredValue.APP_FAVOURITE_ROUTES, ["os-maps:1001"]);
    prefs.toggleFavourite("os-maps:1001");
    expect(prefs.isFavourite("os-maps:1001")).toBe(false);
  });

  it("hides a map until show hidden is used", () => {
    const prefs = TestBed.inject(RouteListPreferencesService);
    prefs.hide("os-maps:1001");
    expect(prefs.isHidden("os-maps:1001")).toBe(true);
    expect(prefs.hiddenCount()).toBe(1);
    expect(uiActions.saveValueFor).toHaveBeenCalledWith(StoredValue.APP_HIDDEN_ROUTES, ["os-maps:1001"]);
    prefs.showHidden();
    expect(prefs.isHidden("os-maps:1001")).toBe(false);
    expect(prefs.hiddenCount()).toBe(0);
  });

  it("labels the show-hidden action with a counted plural", () => {
    const prefs = TestBed.inject(RouteListPreferencesService);
    prefs.hide("os-maps:1001");
    expect(prefs.hiddenMapsActionLabel()).toBe("Show 1 hidden map");
    prefs.hide("os-maps:1002");
    expect(prefs.hiddenMapsActionLabel()).toBe("Show 2 hidden maps");
  });

  it("loads and updates the signed-in profile without borrowing another member's cache", async () => {
    state.memberId = "fictional-member-a";
    state.profile = {favouriteKeys: ["os-maps:1001"], hiddenKeys: []};
    const prefs = TestBed.inject(RouteListPreferencesService);
    await prefs["operations"];
    expect(prefs.isFavourite("os-maps:1001")).toBe(true);
    prefs.hide("os-maps:1002");
    await prefs["operations"];
    expect(members.changeRoutePreference).toHaveBeenCalledWith({action: RoutePreferenceAction.HIDE, key: "os-maps:1002"});
    expect(state.profile.hiddenKeys).toEqual(["os-maps:1002"]);
    state.memberId = "fictional-member-b";
    state.profile = {favouriteKeys: [], hiddenKeys: []};
    expect(prefs.isFavourite("os-maps:1001")).toBe(false);
    expect(prefs.isHidden("os-maps:1002")).toBe(false);
    await prefs.refresh();
    expect(state.cache[`${window.location.origin}:fictional-member-a`].preferences.hiddenKeys).toEqual(["os-maps:1002"]);
    expect(state.cache[`${window.location.origin}:fictional-member-b`].preferences.hiddenKeys).toEqual([]);
  });

  it("keeps offline choices per member and sends them on reconnect", async () => {
    state.memberId = "fictional-offline-member";
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const prefs = TestBed.inject(RouteListPreferencesService);
    prefs.toggleFavourite("os-maps:1003");
    await prefs["operations"];
    expect(members.changeRoutePreference).not.toHaveBeenCalled();
    expect(state.cache[`${window.location.origin}:${state.memberId}`].pending).toHaveLength(1);
    online.mockReturnValue(true);
    await prefs.refresh();
    expect(state.profile.favouriteKeys).toEqual(["os-maps:1003"]);
    expect(state.cache[`${window.location.origin}:${state.memberId}`].pending).toEqual([]);
  });

  it("does not lose a click made while the initial profile read is pending", async () => {
    state.memberId = "fictional-pending-member";
    const pending = {resolve: null as ((preferences: MemberRoutePreferences) => void) | null};
    members.routePreferences.mockImplementationOnce(() => new Promise<MemberRoutePreferences>(resolve => pending.resolve = resolve));
    const prefs = TestBed.inject(RouteListPreferencesService);
    await Promise.resolve();
    prefs.toggleFavourite("os-maps:1004");
    pending.resolve?.({favouriteKeys: [], hiddenKeys: []});
    await prefs["operations"];
    expect(prefs.isFavourite("os-maps:1004")).toBe(true);
    expect(members.changeRoutePreference).toHaveBeenCalledTimes(1);
  });

  it("retains pending choices when profile sync fails", async () => {
    state.memberId = "fictional-failed-member";
    const prefs = TestBed.inject(RouteListPreferencesService);
    await prefs["operations"];
    members.changeRoutePreference.mockRejectedValue(new Error("Fictional connection failure"));
    prefs.hide("os-maps:1005");
    await prefs["operations"];
    expect(prefs.isHidden("os-maps:1005")).toBe(true);
    expect(state.cache[`${window.location.origin}:${state.memberId}`].pending).toHaveLength(1);
    expect(prefs.syncMessage).toContain("Profile sync failed");
  });

  it("does not send the previous member's queued choices after the account changes during a read", async () => {
    state.memberId = "fictional-first-member";
    const pending = {resolve: null as ((preferences: MemberRoutePreferences) => void) | null};
    members.routePreferences.mockImplementationOnce(() => new Promise<MemberRoutePreferences>(resolve => pending.resolve = resolve));
    const prefs = TestBed.inject(RouteListPreferencesService);
    await Promise.resolve();
    prefs.toggleFavourite("os-maps:1006");
    state.memberId = "fictional-second-member";
    pending.resolve?.({favouriteKeys: [], hiddenKeys: []});
    await prefs["operations"];
    expect(members.changeRoutePreference).not.toHaveBeenCalled();
    expect(prefs.isFavourite("os-maps:1006")).toBe(false);
    expect(state.cache[`${window.location.origin}:fictional-first-member`].pending).toHaveLength(1);
  });

});
