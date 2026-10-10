import { StoredValue } from "../../models/ui-actions";
import { AppInstallPlatform, RouteFollowLocationError, RouteFollowMode, RouteFollowPoint, RouteFollowPayload, RouteFollowSession, RouteFollowSheetState, RouteFollowSource } from "../../models/route-follow.model";
import { RouteFollowComponent } from "./route-follow";

describe("recording GPS messages", () => {
  it("keeps a waiting message until GPS is ready and does not claim a paused recording is active", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["appShell"] = {platform: () => AppInstallPlatform.IOS} as unknown as typeof view["appShell"];
    view["progress"] = {mode: RouteFollowMode.RECORDING, locationError: RouteFollowLocationError.ACQUIRING} as typeof view["progress"];
    expect(view.locationMessage).toContain("Recording is active");
    expect(view.locationMessage).toContain("Waiting for a GPS location");
    view["progress"] = {...view["progress"], locationError: RouteFollowLocationError.INACCURATE};
    expect(view.locationMessage).toContain("your recorded points are kept");
    view["progress"] = {...view["progress"], locationError: RouteFollowLocationError.NONE};
    expect(view.locationMessage).toBeNull();
    view["progress"] = {...view["progress"], mode: RouteFollowMode.PAUSED, locationError: RouteFollowLocationError.ACQUIRING};
    expect(view.locationMessage).toBeNull();
  });
});

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

  it.each([RouteFollowMode.IDLE, RouteFollowMode.FOLLOWING, RouteFollowMode.RECORDING, RouteFollowMode.PAUSED])("restores %s without a network route refresh", async mode => {
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
    view["networkPayload"] = vi.fn();
    await view["load"](null, null, "fictional-walk", null, null);
    expect(view["applyLoaded"]).toHaveBeenCalledWith(payload);
    expect(view["networkPayload"]).not.toHaveBeenCalled();
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
      flushRecording: async () => true,
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
  it.each([RouteFollowMode.IDLE, RouteFollowMode.RECORDING, RouteFollowMode.PAUSED])("opens an empty %s draft without fetching a route or automatically starting recording", async mode => {
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
    view["networkPayload"] = vi.fn();
    view["recordRoute"] = vi.fn();
    await view["load"](null, null, null, null, null, 0, [], "fictional-id");
    expect(view["applyLoaded"]).toHaveBeenCalledWith(payload);
    expect(view["networkPayload"]).not.toHaveBeenCalled();
    expect(view["recordRoute"]).not.toHaveBeenCalled();
    expect(view["usablePayload"](payload)).toBe(true);
    if (mode === RouteFollowMode.IDLE) {
      expect(view.sheetMinimised).toBe(true);
    }
  });
});

describe("finishing a recording", () => {
  it("starts only on request and keeps the naming form hidden with the tray collapsed", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    Object.defineProperty(view, "mobileAccess", {value: {allowed: () => true}});
    view["payload"] = {source: RouteFollowSource.RECORDING, title: ""} as RouteFollowPayload;
    view["followService"] = {trackPoints: () => [], startRecording: vi.fn()} as unknown as typeof view["followService"];
    view["clearEditHandles"] = vi.fn();
    view["refreshArrows"] = vi.fn();
    view["redraw"] = vi.fn();
    view["requestWakeLock"] = vi.fn().mockResolvedValue(null);
    view.minimiseSheet = vi.fn();
    view.recordRoute();
    expect(view["followService"].startRecording).toHaveBeenCalledWith(true);
    expect(view["recordingDetailsOpen"]).toBe(false);
    expect(view.minimiseSheet).toHaveBeenCalledOnce();
    expect(view["payload"].title).toBe("");
  });

  it("reads background points before pausing and opening the naming fields", async () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["followService"] = {flushRecording: vi.fn().mockResolvedValue(true)} as unknown as typeof view["followService"];
    view.pause = vi.fn();
    view.expandSheet = vi.fn();
    view["persistFollowSession"] = vi.fn();
    await view.finishRecording();
    expect(view.pause).toHaveBeenCalledOnce();
    expect(view["recordingDetailsOpen"]).toBe(true);
    expect(view.expandSheet).toHaveBeenCalledOnce();
    expect(view["persistFollowSession"]).toHaveBeenCalledWith(true);
  });

  it("keeps recording active if background points cannot be read", async () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["followService"] = {flushRecording: vi.fn().mockResolvedValue(false)} as unknown as typeof view["followService"];
    view["recordingDetailsOpen"] = false;
    view.pause = vi.fn();
    view.expandSheet = vi.fn();
    await view.finishRecording();
    expect(view.pause).not.toHaveBeenCalled();
    expect(view["recordingDetailsOpen"]).toBe(false);
    expect(view["persistError"]).toContain("points are kept");
  });
});


describe("recording permissions", () => {
  it("starts a separate recording when the original route cannot be edited", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    Object.defineProperty(view, "mobileAccess", {value: {allowed: () => true}});
    view["payload"] = {source: RouteFollowSource.WALK, walkId: "fictional-walk"} as RouteFollowPayload;
    view["canEditRoute"] = false;
    view["router"] = {navigate: vi.fn()} as unknown as typeof view["router"];
    view["followService"] = {startRecording: vi.fn()} as unknown as typeof view["followService"];
    view.recordRoute();
    expect(view["router"].navigate).toHaveBeenCalledWith(["/app/route"], {queryParams: {[StoredValue.RECORD_ROUTE]: expect.any(String)}});
    expect(view["followService"].startRecording).not.toHaveBeenCalled();
    expect(view["payload"].walkId).toBe("fictional-walk");
  });

  it("does not restart GPS when recording permission is denied", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    Object.defineProperty(view, "mobileAccess", {value: {allowed: () => false}});
    view["followService"] = {recordingSession: () => true, resume: vi.fn()} as unknown as typeof view["followService"];
    view.resume();
    expect(view["followService"].resume).not.toHaveBeenCalled();
    expect(view["persistError"]).toContain("permission");
  });
});


describe("restricted session restoration", () => {
  it("keeps recorded points paused instead of restarting location tracking", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    const points = [{latitude: 51, longitude: 0}, {latitude: 51.001, longitude: 0.001}];
    view["payload"] = {walkId: "fictional-walk", points, waypoints: []} as RouteFollowPayload;
    view["storedFollowSession"] = vi.fn().mockReturnValue({walkId: "fictional-walk", mode: RouteFollowMode.RECORDING,
      recordedPoints: points, visitedWaypointIds: []});
    Object.defineProperty(view, "mobileAccess", {value: {allowed: () => false}});
    view["followService"] = {setPreviewSpeed: vi.fn(), restorePaused: vi.fn(), restoreRecording: vi.fn()} as unknown as typeof view["followService"];
    view["requestWakeLock"] = vi.fn();
    view["restoreFollowSession"]();
    expect(view["followService"].restorePaused).toHaveBeenCalledWith([], RouteFollowMode.RECORDING, points, 0);
    expect(view["followService"].restoreRecording).not.toHaveBeenCalled();
    expect(view["requestWakeLock"]).not.toHaveBeenCalled();
    expect(view["persistError"]).toContain("permission");
  });
});

describe("desktop follow panel", () => {
  it("titles the panel Edit route while editing", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["progress"] = {mode: RouteFollowMode.EDITING} as typeof view["progress"];
    view["payload"] = {title: "Hillside trail", source: RouteFollowSource.OS_MAPS} as RouteFollowPayload;
    expect(view.sheetHeading()).toBe("Edit route");
  });

  it("uses the saved name when the route is not being edited", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["progress"] = {mode: RouteFollowMode.IDLE} as typeof view["progress"];
    view["payload"] = {title: "Hillside trail", source: RouteFollowSource.OS_MAPS} as RouteFollowPayload;
    expect(view.sheetHeading()).toBe("Hillside trail");
  });

  it("pads the map for a left-hand panel on a wide screen", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["appShell"] = {platform: () => AppInstallPlatform.OTHER} as unknown as typeof view["appShell"];
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({matches: query === "(min-width: 900px)"}));
    expect(view["routeFitPadding"]()).toEqual({paddingTopLeft: [408, 80], paddingBottomRight: [56, 56]});
    window.matchMedia = vi.fn().mockImplementation(() => ({matches: false}));
    expect(view["routeFitPadding"]()).toEqual({paddingTopLeft: [36, 72], paddingBottomRight: [36, 220]});
    view["appShell"] = {platform: () => AppInstallPlatform.IOS} as unknown as typeof view["appShell"];
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({matches: query === "(min-width: 900px)"}));
    expect(view["routeFitPadding"]()).toEqual({paddingTopLeft: [36, 72], paddingBottomRight: [36, 220]});
  });
});


describe("recording map starting location", () => {
  function recordingView(points: RouteFollowPoint[] = []) {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["loadSequence"] = 1;
    view["followService"] = {trackPoints: () => points} as unknown as typeof view["followService"];
    view["currentLocation"] = {currentPosition: vi.fn().mockResolvedValue({lat: 51.2, lng: 0.3})} as unknown as typeof view["currentLocation"];
    view["mapTiles"] = {maxZoomForStyle: () => 18} as unknown as typeof view["mapTiles"];
    view["buildMapOptions"] = vi.fn();
    return view;
  }

  it("centres an empty recording on a fresh location before showing its map", async () => {
    const view = recordingView();
    const payload = {source: RouteFollowSource.RECORDING} as RouteFollowPayload;
    await view["prepareMapOptions"](payload);
    expect(view["currentLocation"].currentPosition).toHaveBeenCalledWith(true);
    expect(view["restoredMapView"]?.center.lat).toBe(51.2);
    expect(view["restoredMapView"]?.center.lng).toBe(0.3);
    expect(view["buildMapOptions"]).toHaveBeenCalledWith(payload, view["restoredMapView"]);
  });

  it("does not show a fallback map when the current location is unavailable", async () => {
    const view = recordingView();
    vi.mocked(view["currentLocation"].currentPosition).mockResolvedValue(null);
    await view["prepareMapOptions"]({source: RouteFollowSource.RECORDING} as RouteFollowPayload);
    expect(view["options"]).toBeNull();
    expect(view["error"]).toContain("current location could not be found");
    expect(view["buildMapOptions"]).not.toHaveBeenCalled();
  });

  it("preserves the map of a recording with recovered points", async () => {
    const view = recordingView([{latitude: 51.2, longitude: 0.3}]);
    await view["prepareMapOptions"]({source: RouteFollowSource.RECORDING} as RouteFollowPayload);
    expect(view["currentLocation"].currentPosition).not.toHaveBeenCalled();
    expect(view["buildMapOptions"]).toHaveBeenCalled();
  });

  it("ignores a location response after another route has been opened", async () => {
    const view = recordingView();
    vi.mocked(view["currentLocation"].currentPosition).mockImplementation(async () => {
      view["loadSequence"] = 2;
      return {lat: 51.2, lng: 0.3};
    });
    await view["prepareMapOptions"]({source: RouteFollowSource.RECORDING} as RouteFollowPayload);
    expect(view["buildMapOptions"]).not.toHaveBeenCalled();
  });
});

describe("follow sheet handle drag", () => {
  function handleView(): RouteFollowComponent {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["sheetState"] = RouteFollowSheetState.MINIMISED;
    view["sheetDrag"] = {active: false, pointerId: -1, startY: 0, lastY: 0, moved: false, target: null};
    view["persistFollowSession"] = vi.fn();
    view["refreshMapSize"] = vi.fn();
    return view;
  }

  function handleEvent(view: RouteFollowComponent, type: string, clientY: number, pointerId = 1): PointerEvent {
    const target = document.createElement("button");
    target.setPointerCapture = vi.fn();
    target.releasePointerCapture = vi.fn();
    target.hasPointerCapture = vi.fn().mockReturnValue(type !== "pointerdown");
    const event = {
      pointerId,
      clientY,
      cancelable: true,
      preventDefault: vi.fn(),
      currentTarget: target
    } as unknown as PointerEvent;
    if (type === "pointerdown") {
      view.onSheetHandlePointerDown(event);
    } else if (type === "pointermove") {
      view.onSheetPointerMove(event);
    } else {
      view.onSheetPointerUp(event);
    }
    return event;
  }

  it("expands when the grab is swiped up", () => {
    const view = handleView();
    handleEvent(view, "pointerdown", 400);
    handleEvent(view, "pointermove", 320);
    handleEvent(view, "pointerup", 320);
    expect(view["sheetState"]).toBe(RouteFollowSheetState.EXPANDED);
  });

  it("minimises when the grab is swiped down", () => {
    const view = handleView();
    view["sheetState"] = RouteFollowSheetState.EXPANDED;
    handleEvent(view, "pointerdown", 200);
    handleEvent(view, "pointermove", 280);
    handleEvent(view, "pointerup", 280);
    expect(view["sheetState"]).toBe(RouteFollowSheetState.MINIMISED);
  });

  it("does not toggle again from the leftover click after a swipe", () => {
    const view = handleView();
    handleEvent(view, "pointerdown", 400);
    handleEvent(view, "pointermove", 320);
    handleEvent(view, "pointerup", 320);
    view.onSheetHandleClick();
    expect(view["sheetState"]).toBe(RouteFollowSheetState.EXPANDED);
  });
});
