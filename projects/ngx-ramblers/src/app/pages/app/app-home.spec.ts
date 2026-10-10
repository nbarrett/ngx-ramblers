import { AppHomeComponent } from "./app-home";
import { AppHomeView, RouteFollowMode, RouteFollowSession, RouteFollowSummary } from "../../models/route-follow.model";
import { StoredValue } from "../../models/ui-actions";
import { DistanceUnit } from "../../models/search.model";

describe("map list batches", () => {
  it("shows twenty cards at a time, appends batches and resets the display window when filtering changes", () => {
    const component = Object.create(AppHomeComponent.prototype) as AppHomeComponent;
    component["routeWindow"] = {filterKey: null, limit: 20};
    const routes = [...new Array(55)].map((value, index) => ({title: `Fictional trail ${index}`} as RouteFollowSummary));
    component.visibleRoutes = vi.fn().mockReturnValue(routes);
    expect(component["displayedRoutes"]()).toEqual(routes.slice(0, 20));
    expect(component["moreRoutesAvailable"]()).toBe(true);
    component["showMoreRoutes"]();
    expect(component["displayedRoutes"]()).toEqual(routes.slice(0, 40));
    component["showMoreRoutes"]();
    expect(component["displayedRoutes"]()).toEqual(routes);
    expect(component["moreRoutesAvailable"]()).toBe(false);
    component["routeSearch"] = "woodland";
    expect(component["displayedRoutes"]()).toEqual(routes.slice(0, 20));
  });
});

describe("standalone recording launch", () => {
  function view(): AppHomeComponent {
    const component = Object.create(AppHomeComponent.prototype) as AppHomeComponent;
    component["memberLogin"] = {memberLoggedIn: () => true} as unknown as typeof component["memberLogin"];
    component["followService"] = {requestCompassPermission: vi.fn().mockResolvedValue(null)} as unknown as typeof component["followService"];
    component["router"] = {navigate: vi.fn().mockResolvedValue(true)} as unknown as typeof component["router"];
    component["activeSession"] = null;
    Object.defineProperty(component, "mobileAccess", {value: {allowed: () => true}});
    return component;
  }

  it("opens a new recording without a walk or route after sign-in", () => {
    const component = view();
    component.recordStandaloneRoute();
    const navigation = vi.mocked(component["router"].navigate).mock.calls[0];
    expect(navigation[0]).toEqual(["/app/route"]);
    expect(navigation[1].queryParams[StoredValue.RECORD_ROUTE]).toMatch(/^[a-zA-Z0-9-]{8,80}$/);
    expect(navigation[1].queryParams[StoredValue.WALK_ID]).toBeFalsy();
    expect(component["followService"].requestCompassPermission).toHaveBeenCalledOnce();
  });

  it("opens the unfinished recording instead of replacing it with a new draft", () => {
    const component = view();
    component["activeSession"] = {recordingId: "fictional-id", mode: RouteFollowMode.PAUSED} as RouteFollowSession;
    component.recordStandaloneRoute();
    expect(component["router"].navigate).toHaveBeenCalledWith(["/app/route"], {queryParams: {[StoredValue.RECORD_ROUTE]: "fictional-id"}});
  });

  it("waits for sign-in before launching a recording", () => {
    const component = view();
    component["afterSignIn"] = vi.fn();
    component.recordStandaloneRoute();
    expect(component["afterSignIn"]).toHaveBeenCalledOnce();
    expect(component["router"].navigate).not.toHaveBeenCalled();
  });
});


describe("walking app header counts", () => {
  function withCounts(): AppHomeComponent {
    const component = Object.create(AppHomeComponent.prototype) as AppHomeComponent;
    component["stringUtils"] = {
      pluraliseWithCount: (count: number, singular: string, plural?: string) => `${count} ${count === 1 ? singular : (plural || singular + "s")}`
    } as unknown as AppHomeComponent["stringUtils"];
    return component;
  }

  it("counts the visible walks when Upcoming is selected, without applying map filter labels", () => {
    const component = withCounts();
    component["view"] = AppHomeView.UPCOMING;
    component["favouritesOnly"] = true;
    component["nearbyOnly"] = true;
    component.visibleWalks = vi.fn().mockReturnValue([{}, {}]);
    component.visibleRoutes = vi.fn().mockReturnValue([{}, {}, {}]);
    expect(component.matchCountLabel()).toBe("Showing 2 upcoming walks");
    expect(component.visibleRoutes).not.toHaveBeenCalled();
    component.visibleWalks = vi.fn().mockReturnValue([{}]);
    expect(component.matchCountLabel()).toBe("Showing 1 upcoming walk");
  });

  it("counts the visible routes when Maps is selected", () => {
    const component = withCounts();
    component["view"] = AppHomeView.MAPS;
    component["favouritesOnly"] = false;
    component["nearbyOnly"] = false;
    component.visibleRoutes = vi.fn().mockReturnValue([{}, {}, {}]);
    expect(component.matchCountLabel()).toBe("Showing 3 routes");
  });

  it("pluralises the nearby mile range", () => {
    const component = withCounts();
    component["view"] = AppHomeView.MAPS;
    component["favouritesOnly"] = false;
    component["nearbyOnly"] = true;
    component["nearbyRange"] = {min: 0, max: 1, unit: DistanceUnit.MILES};
    component.visibleRoutes = vi.fn().mockReturnValue(Array.from({length: 18}));
    expect(component.matchCountLabel()).toBe("Showing 18 routes within 1 mile");
    component["nearbyRange"] = {min: 0, max: 2, unit: DistanceUnit.MILES};
    expect(component.matchCountLabel()).toBe("Showing 18 routes within 2 miles");
  });

  it("pluralises card distances", () => {
    const component = withCounts();
    expect(component.milesLabel(1)).toBe("1 mile");
    expect(component.milesLabel(7.1)).toBe("7.1 miles");
  });
});
