import { RouteFollowMode, RouteFollowPayload, RouteFollowSession, RouteFollowSource } from "../../models/route-follow.model";
import { RouteFollowComponent } from "./route-follow";

describe("route follow compass pointer", () => {
  it("turns with the compass while the route-up map keeps its route bearing", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["headingUp"] = true;
    view["progress"] = {heading: 110, routeHeading: 80} as typeof view["progress"];
    expect(view["pointerHeading"]()).toBe(110);
    expect(view["routeMapHeading"]()).toBe(80);
    view["progress"] = {...view["progress"], heading: 50};
    expect(view["pointerHeading"]()).toBe(50);
    expect(view["routeMapHeading"]()).toBe(80);
    view["headingUp"] = false;
    expect(view["pointerHeading"]()).toBe(50);
  });
});

describe("route follow local restoration", () => {
  it("ignores an older route load that finishes after a newer selection", async () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["loadSequence"] = 0;
    view["mapTiles"] = {allowCachedOsTiles: vi.fn()} as unknown as typeof view["mapTiles"];
    view["followService"] = {stop: vi.fn()} as unknown as typeof view["followService"];
    const pending: ((value: RouteFollowPayload) => void)[] = [];
    view["cachedPayload"] = vi.fn().mockImplementation(() => new Promise(resolve => pending.push(resolve)));
    view["applyLoaded"] = vi.fn().mockImplementation(async () => {
      view["progress"] = {mode: RouteFollowMode.FOLLOWING} as typeof view["progress"];
    });
    view["revealIdleSheet"] = vi.fn();
    const first = view["load"](null, null, "first-walk", null, null);
    const second = view["load"](null, null, "second-walk", null, null);
    const payload = {walkId: "second-walk", points: [{latitude: 51, longitude: 0}, {latitude: 51.001, longitude: 0.001}]} as RouteFollowPayload;
    pending[1](payload);
    await second;
    pending[0]({...payload, walkId: "first-walk"});
    await first;
    expect(view["applyLoaded"]).toHaveBeenCalledExactlyOnceWith(payload);
  });

  it.each([RouteFollowMode.FOLLOWING, RouteFollowMode.RECORDING, RouteFollowMode.PAUSED])("restores %s without a network route refresh", async mode => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["loadSequence"] = 0;
    view["mapTiles"] = {allowCachedOsTiles: vi.fn()} as unknown as typeof view["mapTiles"];
    view["followService"] = {stop: vi.fn()} as unknown as typeof view["followService"];
    const payload = {walkId: "fictional-walk", points: [{latitude: 51, longitude: 0}, {latitude: 51.001, longitude: 0.001}]} as RouteFollowPayload;
    view["cachedPayload"] = vi.fn().mockResolvedValue(payload);
    view["applyLoaded"] = vi.fn().mockImplementation(async () => {
      view["progress"] = {mode} as typeof view["progress"];
    });
    view["revealIdleSheet"] = vi.fn();
    view["refreshFromNetwork"] = vi.fn();
    view["networkPayload"] = vi.fn();
    await view["load"](null, null, "fictional-walk", null, null);
    expect(view["applyLoaded"]).toHaveBeenCalledWith(payload);
    expect(view["networkPayload"]).not.toHaveBeenCalled();
    expect(view["refreshFromNetwork"]).not.toHaveBeenCalled();
    expect(view["loading"]).toBe(false);
  });
});

describe("route follow interrupted sessions", () => {
  it("restores the route from its session even when IndexedDB is unavailable", async () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    const payload = {walkId: "fictional-walk", points: [{latitude: 51, longitude: 0}]} as RouteFollowPayload;
    view["storedFollowSession"] = vi.fn().mockReturnValue({walkId: "fictional-walk", payload});
    view["followCache"] = {payload: vi.fn().mockRejectedValue(new Error("Cache unavailable"))} as unknown as typeof view["followCache"];
    expect(await view["cachedPayload"]("walk:fictional-walk")).toBe(payload);
    expect(view["followCache"].payload).not.toHaveBeenCalled();
  });

  it("does not substitute another route's saved session", async () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    const payload = {walkId: "first-walk"} as RouteFollowPayload;
    view["storedFollowSession"] = vi.fn().mockReturnValue({walkId: "first-walk", payload});
    view["followCache"] = {payload: vi.fn().mockResolvedValue(null)} as unknown as typeof view["followCache"];
    expect(await view["cachedPayload"]("walk:second-walk")).toBeNull();
    expect(view["followCache"].payload).toHaveBeenCalledWith("walk:second-walk");
  });

  it("asks before closing discards an unsaved recording", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["followService"] = {recordingSession: () => true, stop: vi.fn()} as unknown as typeof view["followService"];
    view["expandSheet"] = vi.fn();
    view.closeFollow();
    expect(view["confirmingRecordingDiscard"]).toBe(true);
    expect(view["followService"].stop).not.toHaveBeenCalled();
  });

  it("reports a failed checkpoint while keeping the current session", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["payload"] = {walkId: "fictional-walk"} as RouteFollowPayload;
    view["progress"] = {mode: RouteFollowMode.FOLLOWING} as typeof view["progress"];
    view["followService"] = {recordingSession: () => false, trackPoints: () => []} as unknown as typeof view["followService"];
    view["uiActions"] = {saveValueFor: vi.fn().mockReturnValue(false)} as unknown as typeof view["uiActions"];
    view["followSessionSnapshot"] = vi.fn().mockReturnValue({walkId: "fictional-walk"} as RouteFollowSession);
    view["persistFollowSession"](true);
    expect(view["sessionStorageError"]).toContain("could not save");
    expect(view["progress"].mode).toBe(RouteFollowMode.FOLLOWING);
  });
});

describe("route follow failed recording upload", () => {
  it.each([RouteFollowSource.WALK, RouteFollowSource.RECORDING])("keeps the paused %s recording and its checkpoint when saving fails", async source => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    const points = [{latitude: 51, longitude: 0}, {latitude: 51.001, longitude: 0.001}];
    view["payload"] = {source, recordingId: "fictional-id", title: "Hillside trail", walkId: "fictional-walk", points} as RouteFollowPayload;
    view["progress"] = {mode: RouteFollowMode.RECORDING} as typeof view["progress"];
    view["followService"] = {
      recordingSession: () => true,
      trackPoints: () => points,
      pause: () => view["progress"] = {...view["progress"], mode: RouteFollowMode.PAUSED}
    } as unknown as typeof view["followService"];
    view["routeSave"] = {save: vi.fn().mockRejectedValue(new Error("Network unavailable")), saveStandalone: vi.fn().mockRejectedValue(new Error("Network unavailable"))} as unknown as typeof view["routeSave"];
    view["logger"] = {error: vi.fn()} as unknown as typeof view["logger"];
    view["persistFollowSession"] = vi.fn();
    view["clearFollowSession"] = vi.fn();
    await view.saveRoute();
    expect(view["progress"].mode).toBe(RouteFollowMode.PAUSED);
    expect(view["followService"].trackPoints()).toEqual(points);
    expect(view["persistFollowSession"]).toHaveBeenCalledWith(true);
    expect(view["clearFollowSession"]).not.toHaveBeenCalled();
    expect(view["persistError"]).toBeTruthy();
    expect(view["savingRoute"]).toBe(false);
  });
});


describe("standalone recording restoration", () => {
  it.each([RouteFollowMode.RECORDING, RouteFollowMode.PAUSED])("restores an empty %s draft without fetching a route or restarting recording", async mode => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["loadSequence"] = 0;
    view["mapTiles"] = {allowCachedOsTiles: vi.fn()} as unknown as typeof view["mapTiles"];
    view["followService"] = {stop: vi.fn()} as unknown as typeof view["followService"];
    const payload = {source: RouteFollowSource.RECORDING, recordingId: "fictional-id", points: [], waypoints: [], title: "My draft"} as RouteFollowPayload;
    view["cachedPayload"] = vi.fn().mockResolvedValue(payload);
    view["applyLoaded"] = vi.fn().mockImplementation(async () => {
      view["progress"] = {mode} as typeof view["progress"];
    });
    view["revealIdleSheet"] = vi.fn();
    view["refreshFromNetwork"] = vi.fn();
    view["networkPayload"] = vi.fn();
    view["recordRoute"] = vi.fn();
    await view["load"](null, null, null, null, null, 0, [], "fictional-id");
    expect(view["applyLoaded"]).toHaveBeenCalledWith(payload);
    expect(view["networkPayload"]).not.toHaveBeenCalled();
    expect(view["refreshFromNetwork"]).not.toHaveBeenCalled();
    expect(view["recordRoute"]).not.toHaveBeenCalled();
    expect(view["usablePayload"](payload)).toBe(true);
  });
});
