import { ChangeDetectorRef, ElementRef } from "@angular/core";
import { DistanceUnit } from "../../models/walk.model";
import { StoredValue } from "../../models/ui-actions";
import { AppInstallPlatform, RouteFollowLocationError, RouteFollowMode, RouteFollowPoint, RouteFollowPayload, RouteFollowSession, RouteFollowSheetState, RouteFollowSource } from "../../models/route-follow.model";
import { DEFAULT_OS_STYLE, MapProvider } from "../../models/map.model";
import { RouteFollowComponent } from "./route-follow";
import * as L from "leaflet";

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

  it.each([0, 90, 156, 172, 180, 270])("keeps the rendered Android pointer on the same %s degree bearing as the compass tape", heading => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    const chevron = document.createElement("div");
    chevron.className = "follow-location-chevron";
    const markerElement = document.createElement("div");
    markerElement.appendChild(chevron);
    view["appShell"] = {platform: () => AppInstallPlatform.ANDROID} as unknown as typeof view["appShell"];
    view["followService"] = {compassAvailable: () => true} as unknown as typeof view["followService"];
    view["progress"] = {heading, routeHeading: 80} as typeof view["progress"];
    view["pointerMarker"] = {setLatLng: vi.fn(), getElement: () => markerElement} as unknown as typeof view["pointerMarker"];
    view["refreshTape"]();
    view["syncPointer"](51, 0, view["pointerHeading"]());
    expect(view["compassHeadingText"]).toBe(`${heading}°`);
    expect(chevron.style.transform).toBe(`rotate(${heading}deg)`);
    expect(chevron.style.getPropertyValue("--pointer-heading")).toBe(`${heading}deg`);
  });

  it("adds route-up map rotation once while keeping the pointer on its compass bearing", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    const chevron = document.createElement("div");
    chevron.className = "follow-location-chevron";
    const markerElement = document.createElement("div");
    markerElement.appendChild(chevron);
    const gestures = {setBearing: vi.fn()};
    view["gestures"] = gestures as unknown as typeof view["gestures"];
    view["appShell"] = {platform: () => AppInstallPlatform.ANDROID} as unknown as typeof view["appShell"];
    view["followService"] = {compassAvailable: () => true} as unknown as typeof view["followService"];
    view["progress"] = {heading: 110, routeHeading: 80, position: {latitude: 51, longitude: 0}} as typeof view["progress"];
    view["headingUp"] = true;
    view["mapBearing"] = 0;
    view["pointerMarker"] = {setLatLng: vi.fn(), getElement: () => markerElement} as unknown as typeof view["pointerMarker"];
    view["refreshHeadingVisuals"]();
    expect(gestures.setBearing).toHaveBeenCalledWith(-80, false);
    expect(chevron.style.transform).toBe("rotate(110deg)");
    expect(view["mapBearing"] + 110).toBe(30);
    view["progress"] = {...view["progress"], heading: 50};
    view["refreshHeadingVisuals"]();
    expect(gestures.setBearing).toHaveBeenCalledTimes(1);
    expect(chevron.style.transform).toBe("rotate(50deg)");
    expect(view["mapBearing"] + 50).toBe(-30);
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

  it("confirms discard through the existing controls without closing the route", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["discardAndClose"] = false;
    view["confirmingRecordingDiscard"] = true;
    view.cancelEdit = vi.fn();
    view.closeFollow = vi.fn();
    view.confirmRecordingDiscard();
    expect(view["confirmingRecordingDiscard"]).toBe(false);
    expect(view.cancelEdit).toHaveBeenCalledWith(true);
    expect(view.closeFollow).not.toHaveBeenCalled();
  });

  it("closes only after confirming a close that discards a recording", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["discardAndClose"] = true;
    view["confirmingRecordingDiscard"] = true;
    view.cancelEdit = vi.fn();
    view.closeFollow = vi.fn();
    view.confirmRecordingDiscard();
    expect(view["confirmingRecordingDiscard"]).toBe(false);
    expect(view.closeFollow).toHaveBeenCalledWith(true);
    expect(view.cancelEdit).not.toHaveBeenCalled();
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
  const recordedTitle = "Recorded walk, Thursday, 8 October 2026, 9:00 am";

  function recordingView(title: string): RouteFollowComponent {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    Object.defineProperty(view, "mobileAccess", {value: {allowed: () => true}});
    view["dateUtils"] = {
      dateTimeNow: () => ({}),
      displayDateAbbreviatedTime: () => "Thursday, 8 October 2026, 9:00 am"
    } as unknown as typeof view["dateUtils"];
    view["payload"] = {source: RouteFollowSource.RECORDING, title} as RouteFollowPayload;
    view["followService"] = {trackPoints: () => [], startRecording: vi.fn()} as unknown as typeof view["followService"];
    view["clearEditHandles"] = vi.fn();
    view["refreshArrows"] = vi.fn();
    view["redraw"] = vi.fn();
    view["requestWakeLock"] = vi.fn().mockResolvedValue(null);
    view.minimiseSheet = vi.fn();
    return view;
  }

  it("starts only on request and keeps the naming form hidden with the tray collapsed", () => {
    const view = recordingView("");
    view.recordRoute();
    expect(view["followService"].startRecording).toHaveBeenCalledWith(true);
    expect(view["recordingDetailsOpen"]).toBe(false);
    expect(view.minimiseSheet).toHaveBeenCalledOnce();
    expect(view["payload"].title).toBe(recordedTitle);
  });

  it("keeps a title the walker already typed", () => {
    const view = recordingView("Hillside Park loop");
    view.recordRoute();
    expect(view["payload"].title).toBe("Hillside Park loop");
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

describe("saved route delete", () => {
  it("asks before deleting a saved maps route and then returns home", async () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["payload"] = {source: RouteFollowSource.OS_MAPS, osMapsRouteId: "recording-fictional"} as RouteFollowPayload;
    view["canEditRoute"] = true;
    view["progress"] = {mode: RouteFollowMode.IDLE} as typeof view["progress"];
    view["followService"] = {recordingSession: () => false} as unknown as typeof view["followService"];
    view["osMapsExport"] = {deleteRoute: vi.fn().mockResolvedValue({deleted: true})} as unknown as typeof view["osMapsExport"];
    view["logger"] = {error: vi.fn()} as unknown as typeof view["logger"];
    view.expandSheet = vi.fn();
    view.closeFollow = vi.fn();
    expect(view.canDeleteSavedRoute()).toBe(true);
    view.requestRouteDelete();
    expect(view["confirmingRouteDelete"]).toBe(true);
    expect(view.expandSheet).toHaveBeenCalledOnce();
    await view.confirmRouteDelete();
    expect(view["osMapsExport"].deleteRoute).toHaveBeenCalledWith("recording-fictional");
    expect(view.closeFollow).toHaveBeenCalledWith(true);
    expect(view["confirmingRouteDelete"]).toBe(false);
  });

  it("does not delete when the route is still an unsaved recording", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["payload"] = {source: RouteFollowSource.RECORDING, osMapsRouteId: null} as RouteFollowPayload;
    view["canEditRoute"] = true;
    view["progress"] = {mode: RouteFollowMode.IDLE} as typeof view["progress"];
    view["followService"] = {recordingSession: () => true} as unknown as typeof view["followService"];
    view.requestRouteDelete();
    expect(view["confirmingRouteDelete"]).toBeFalsy();
  });
});

describe("walk route edit access", () => {
  it("lets a walk administrator edit a cached walk without the mobile Edit setting", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    Object.defineProperty(view, "mobileAccess", {value: {allowed: () => false}});
    view["walkDisplay"] = {allowEdits: () => false, allowAdminEdits: () => true} as unknown as typeof view["walkDisplay"];
    view["loadedWalk"] = null;
    const payload = {source: RouteFollowSource.WALK, walkId: "fictional-walk"} as RouteFollowPayload;
    expect(view["routeCanBeEdited"](payload)).toBe(true);
  });

  it("starts editing when the walk editor requested it", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["canEditRoute"] = true;
    view["route"] = {snapshot: {queryParamMap: {get: (key: string) => key === StoredValue.EDIT_ROUTE ? "true" : null}}} as unknown as typeof view["route"];
    view.editRoute = vi.fn();
    view["openRequestedEdit"]();
    expect(view.editRoute).toHaveBeenCalledOnce();
  });

  it("edits a walk route when canEditRoute is already true", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    Object.defineProperty(view, "mobileAccess", {value: {allowed: () => false}});
    view["canEditRoute"] = true;
    view["payload"] = {source: RouteFollowSource.WALK, points: [{latitude: 51, longitude: 0}, {latitude: 51.01, longitude: 0.01}]} as RouteFollowPayload;
    view["followService"] = {trackPoints: () => []} as unknown as typeof view["followService"];
    view["beginEditFromPoints"] = vi.fn();
    view.editRoute();
    expect(view["beginEditFromPoints"]).toHaveBeenCalledOnce();
    expect(view["persistError"]).toBeFalsy();
  });
});

describe("plotting clicks", () => {
  it("appends a point while plotting even when the click is close on screen to an existing vertex", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["progress"] = {mode: RouteFollowMode.EDITING} as typeof view["progress"];
    view["originalEditCount"] = 0;
    view["editVertices"] = [{latitude: 52.9, longitude: -1.87}, {latitude: 52.89, longitude: -1.86}];
    view["mapRef"] = {} as unknown as typeof view["mapRef"];
    view["insertOffRouteVertex"] = vi.fn();
    view["insertPointOnRoute"](L.latLng(52.88, -1.85), {distanceTo: () => 4} as unknown as L.Point);
    expect(view["insertOffRouteVertex"]).toHaveBeenCalledWith({latitude: 52.88, longitude: -1.85});
  });
});

describe("compass while browsing", () => {
  it("hides the compass until the route is being followed", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["progress"] = {mode: RouteFollowMode.IDLE} as typeof view["progress"];
    expect(view.followingRoute()).toBe(false);
    view["progress"] = {mode: RouteFollowMode.FOLLOWING} as typeof view["progress"];
    expect(view.followingRoute()).toBe(true);
  });

  it("treats Find or plot as plotting, not following", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["drawingFromBlank"] = true;
    view["canEditRoute"] = true;
    view["payload"] = {source: RouteFollowSource.RECORDING, points: []} as RouteFollowPayload;
    view["followService"] = {trackPoints: () => []} as unknown as typeof view["followService"];
    view["progress"] = {mode: RouteFollowMode.IDLE} as typeof view["progress"];
    expect(view.plottingRoute()).toBe(true);
    view["drawingFromBlank"] = false;
    view["canEditRoute"] = false;
    expect(view.plottingRoute()).toBe(false);
  });

  it("hides the compass and the step banner while plotting", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["drawingFromBlank"] = true;
    view["directionsOnMap"] = true;
    view["progress"] = {mode: RouteFollowMode.FOLLOWING} as typeof view["progress"];
    expect(view.showCompassControl()).toBe(false);
    expect(view.showStepBanner()).toBe(false);
    view["drawingFromBlank"] = false;
    expect(view.showCompassControl()).toBe(true);
  });
});

describe("plot map basemap", () => {
  it("opens plot on OS Explorer even when the saved payload or last map was OSM", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["drawingFromBlank"] = true;
    view["mapTiles"] = {hasOsApiKey: () => true} as unknown as typeof view["mapTiles"];
    const loaded = {provider: MapProvider.OSM, osStyle: "", title: "Plotted route"} as RouteFollowPayload;
    view["applyPlotOrFollowBasemap"](loaded, {provider: MapProvider.OSM, osStyle: "Outdoor_27700"});
    expect(view["mapProvider"]).toBe(MapProvider.OS);
    expect(view["osStyle"]).toBe(DEFAULT_OS_STYLE);
    expect(view["payload"]?.provider).toBe(MapProvider.OS);
    expect(view["payload"]?.osStyle).toBe(DEFAULT_OS_STYLE);
  });
});

describe("place search on the follow map", () => {
  it("pans the map to a Google venue result and stops following the user", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["followUser"] = true;
    view["mapRef"] = {getZoom: () => 10, setView: vi.fn(), fitBounds: vi.fn(), invalidateSize: vi.fn()} as unknown as typeof view["mapRef"];
    view["mapTiles"] = {maxZoomForStyle: () => 11, minZoomForStyle: () => 7, matchingZoom: () => 8} as unknown as typeof view["mapTiles"];
    view["mapProvider"] = MapProvider.OS;
    view["osStyle"] = "Leisure_27700";
    view["persistFollowSession"] = vi.fn();
    view["followService"] = {trackPoints: () => []} as unknown as typeof view["followService"];
    view["payload"] = {waypoints: [], points: []} as unknown as typeof view["payload"];
    view["payloadService"] = {
      planningWaypointsFromLocation: vi.fn().mockReturnValue([{id: "start", latitude: 50.57, longitude: -3.9, kind: "start"}])
    } as unknown as typeof view["payloadService"];
    view["refreshWaypointPins"] = vi.fn();
    view["redraw"] = vi.fn();
    view.onPlaceSearch({name: "Dartmoor", lat: 50.57, lon: -3.9, type: "county"} as never);
    expect(view["followUser"]).toBe(false);
    expect(view["mapRef"].setView).toHaveBeenCalledWith([50.57, -3.9], 8);
    expect(view["nearbyPlaceName"]).toBe("Dartmoor");
    expect(view["payloadService"].planningWaypointsFromLocation).toHaveBeenCalled();
    expect(view["refreshWaypointPins"]).toHaveBeenCalled();
  });

  it("pans to a town that includes a Google viewport instead of fitting that viewport", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["followUser"] = true;
    view["mapRef"] = {getZoom: () => 9, setView: vi.fn(), fitBounds: vi.fn(), invalidateSize: vi.fn()} as unknown as typeof view["mapRef"];
    view["mapTiles"] = {maxZoomForStyle: () => 11, minZoomForStyle: () => 7, matchingZoom: () => 9} as unknown as typeof view["mapTiles"];
    view["mapProvider"] = MapProvider.OS;
    view["osStyle"] = DEFAULT_OS_STYLE;
    view["persistFollowSession"] = vi.fn();
    view["followService"] = {trackPoints: () => []} as unknown as typeof view["followService"];
    view["payload"] = {waypoints: [], points: []} as unknown as typeof view["payload"];
    view["payloadService"] = {
      planningWaypointsFromLocation: vi.fn().mockReturnValue([{id: "start", latitude: 53.833, longitude: -2.337, kind: "start"}])
    } as unknown as typeof view["payloadService"];
    view["refreshWaypointPins"] = vi.fn();
    view["redraw"] = vi.fn();
    view.onPlaceSearch({
      name: "Sabden",
      lat: 53.833,
      lon: -2.337,
      type: "town",
      viewport: {south: 53.82, west: -2.35, north: 53.84, east: -2.32}
    } as never);
    expect(view["mapRef"].fitBounds).not.toHaveBeenCalled();
    expect(view["mapRef"].setView).toHaveBeenCalledWith([53.833, -2.337], 9);
    expect(view["nearbyPlaceName"]).toBe("Sabden");
  });
});

describe("desktop follow panel", () => {
  it("titles the panel Edit route while editing", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["progress"] = {mode: RouteFollowMode.EDITING} as typeof view["progress"];
    view["payload"] = {title: "Hillside trail", source: RouteFollowSource.OS_MAPS} as RouteFollowPayload;
    expect(view.sheetHeading()).toBe("Edit route");
  });

  it("lets the name and description be edited on a wide screen", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["progress"] = {mode: RouteFollowMode.EDITING} as typeof view["progress"];
    view["followPanelWide"] = true;
    view["followExtraSettings"] = false;
    view["payload"] = {title: "Hillside trail", source: RouteFollowSource.OS_MAPS} as RouteFollowPayload;
    view["followService"] = {trackPoints: () => [{latitude: 51, longitude: 0}, {latitude: 51.01, longitude: 0.01}]} as unknown as typeof view["followService"];
    expect(view.editingRouteDetails()).toBe(true);
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
    view["followService"] = {trackPoints: () => points, applyPosition: vi.fn()} as unknown as typeof view["followService"];
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
    expect(view["followService"].applyPosition).toHaveBeenCalledWith({latitude: 51.2, longitude: 0.3}, null, null);
    expect(view["restoredMapView"]?.center.lat).toBe(51.2);
    expect(view["restoredMapView"]?.center.lng).toBe(0.3);
    expect(view["buildMapOptions"]).toHaveBeenCalledWith(payload, view["restoredMapView"]);
  });

  it("opens plotting without requiring a current GPS location", async () => {
    const view = recordingView();
    view["drawingFromBlank"] = true;
    vi.mocked(view["currentLocation"].currentPosition).mockResolvedValue(null);
    const payload = {source: RouteFollowSource.RECORDING} as RouteFollowPayload;
    await view["prepareMapOptions"](payload);
    expect(view["currentLocation"].currentPosition).not.toHaveBeenCalled();
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
    expect(view["followService"].applyPosition).not.toHaveBeenCalled();
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
      type,
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

  it("moves with the finger and animates to the expanded height on release", () => {
    const view = handleView();
    const sheet = document.createElement("section");
    sheet.setPointerCapture = vi.fn();
    sheet.releasePointerCapture = vi.fn();
    sheet.hasPointerCapture = vi.fn().mockReturnValue(true);
    sheet.getBoundingClientRect = vi.fn().mockImplementation(() => ({height: Number.parseFloat(sheet.style.height) || (view.sheetMinimised ? 100 : 400)}));
    Object.defineProperty(sheet, "scrollHeight", {configurable: true, get: () => 400});
    sheet.animate = vi.fn().mockReturnValue({cancel: vi.fn(), onfinish: null});
    window.matchMedia = vi.fn().mockReturnValue({matches: false});
    view["followSheet"] = new ElementRef(sheet);
    view["changeDetector"] = {detectChanges: vi.fn()} as unknown as ChangeDetectorRef;
    handleEvent(view, "pointerdown", 400);
    handleEvent(view, "pointermove", 320);
    expect(sheet.style.height).toBe("180px");
    handleEvent(view, "pointerup", 320);
    expect(sheet.animate).toHaveBeenCalledWith([{height: "180px"}, {height: "400px"}], expect.objectContaining({duration: 240}));
    expect(sheet.style.height).toBe("");
    view["startLocationMessage"] = "You are 12.4 miles from the start.";
    view.minimiseSheet();
    expect(view.sheetMinimised).toBe(true);
    expect(sheet.animate).toHaveBeenLastCalledWith([{height: "400px"}, {height: "100px"}], expect.objectContaining({duration: 240}));
  });

  it("closes when the expanded content is pulled down", () => {
    const view = handleView();
    view["sheetState"] = RouteFollowSheetState.EXPANDED;
    view.onSheetBodyDragging(true);
    view.onSheetBodySwipeOffset(80);
    view.onSheetBodyDragging(false);
    expect(view.sheetMinimised).toBe(true);
  });

  it("keeps the content open after a small pull", () => {
    const view = handleView();
    view["sheetState"] = RouteFollowSheetState.EXPANDED;
    view.onSheetBodyDragging(true);
    view.onSheetBodySwipeOffset(10);
    view.onSheetBodyDragging(false);
    expect(view.sheetMinimised).toBe(false);
  });

  it("restores the original state when a swipe is cancelled", () => {
    const view = handleView();
    handleEvent(view, "pointerdown", 400);
    handleEvent(view, "pointermove", 320);
    handleEvent(view, "pointercancel", 320);
    expect(view.sheetMinimised).toBe(true);
  });

  it("does not reveal expanded controls when the collapsed drawer is pulled down", () => {
    const view = handleView();
    const sheet = document.createElement("section");
    sheet.setPointerCapture = vi.fn();
    sheet.releasePointerCapture = vi.fn();
    sheet.hasPointerCapture = vi.fn().mockReturnValue(true);
    sheet.getBoundingClientRect = vi.fn().mockImplementation(() => ({height: Number.parseFloat(sheet.style.height) || 100}));
    Object.defineProperty(sheet, "scrollHeight", {configurable: true, get: () => 400});
    sheet.animate = vi.fn().mockReturnValue({cancel: vi.fn(), onfinish: null});
    window.matchMedia = vi.fn().mockReturnValue({matches: false});
    view["followSheet"] = new ElementRef(sheet);
    view["changeDetector"] = {detectChanges: vi.fn()} as unknown as ChangeDetectorRef;
    handleEvent(view, "pointerdown", 400);
    handleEvent(view, "pointermove", 480);
    expect(view.sheetMinimised).toBe(true);
    expect(sheet.style.height).toBe("100px");
    handleEvent(view, "pointerup", 480);
    expect(view.sheetMinimised).toBe(true);
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

describe("opening a route", () => {
  it("starts with the drawer collapsed even if the previous route was expanded", async () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["loadSequence"] = 0;
    view["sheetState"] = RouteFollowSheetState.EXPANDED;
    view["mapTiles"] = {allowCachedOsTiles: vi.fn()} as unknown as typeof view["mapTiles"];
    view["followService"] = {stop: vi.fn()} as unknown as typeof view["followService"];
    const payload = {routeId: "fictional-route", points: [{latitude: 51, longitude: 0}, {latitude: 51.001, longitude: 0.001}]} as RouteFollowPayload;
    view["cachedPayload"] = vi.fn().mockResolvedValue(payload);
    view["applyLoaded"] = vi.fn().mockResolvedValue(null);
    await view["load"]("fictional-route", "fictional-route", null, null, null);
    expect(view["applyLoaded"]).toHaveBeenCalledWith(payload);
    expect(view.sheetMinimised).toBe(true);
  });
});

describe("centring on the current location", () => {
  function locationView() {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["loadSequence"] = 1;
    view["currentLocation"] = {currentPosition: vi.fn().mockResolvedValue({lat: 51.2, lng: 0.3})} as unknown as typeof view["currentLocation"];
    view["mapRef"] = {setView: vi.fn(), getZoom: () => 16} as unknown as typeof view["mapRef"];
    view["followService"] = {applyPosition: vi.fn()} as unknown as typeof view["followService"];
    return view;
  }

  it("shows the centred state while following a known position and clears it after dragging", () => {
    const view = locationView();
    view["progress"] = {position: {latitude: 51.2, longitude: 0.3}} as typeof view["progress"];
    view["followUser"] = true;
    expect(view["currentLocationCentred"]()).toBe(true);
    view["followUser"] = false;
    expect(view["currentLocationCentred"]()).toBe(false);
    view["followUser"] = true;
    view["progress"] = null;
    expect(view["currentLocationCentred"]()).toBe(false);
  });

  it("uses a fresh GPS position rather than the route start", async () => {
    const view = locationView();
    view["payload"] = {points: [{latitude: 52, longitude: 1}]} as RouteFollowPayload;
    await view.recenter();
    expect(view["currentLocation"].currentPosition).toHaveBeenCalledWith(true);
    expect(view["mapRef"].setView).toHaveBeenCalledWith([51.2, 0.3], 16, {animate: false});
    expect(view["followService"].applyPosition).toHaveBeenCalledWith({latitude: 51.2, longitude: 0.3}, null, null);
    expect(view["followUser"]).toBe(true);
    expect(view["locatingPosition"]).toBe(false);
  });

  it("reports missing location without pretending the route start is the user", async () => {
    const view = locationView();
    vi.mocked(view["currentLocation"].currentPosition).mockResolvedValue(null);
    await view.recenter();
    expect(view["mapRef"].setView).not.toHaveBeenCalled();
    expect(view["persistError"]).toContain("current location could not be found");
  });

  it("ignores a GPS response after switching routes", async () => {
    const view = locationView();
    vi.mocked(view["currentLocation"].currentPosition).mockImplementation(async () => {
      view["loadSequence"] = 2;
      return {lat: 51.2, lng: 0.3};
    });
    await view.recenter();
    expect(view["mapRef"].setView).not.toHaveBeenCalled();
    expect(view["followService"].applyPosition).not.toHaveBeenCalled();
  });
});


describe("checking the walk start before following", () => {
  function startView(metres: number | null): RouteFollowComponent {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["payload"] = {points: [{latitude: 51, longitude: 0}, {latitude: 51.01, longitude: 0.01}]} as RouteFollowPayload;
    Object.defineProperty(view, "mobileAccess", {value: {allowed: vi.fn().mockReturnValue(true)}});
    view["currentLocation"] = {currentPosition: vi.fn().mockResolvedValue({lat: 51, lng: 0})} as unknown as typeof view["currentLocation"];
    view["followService"] = {
      requestCompassPermission: vi.fn().mockResolvedValue(null),
      trackPoints: vi.fn().mockReturnValue(view["payload"].points),
      distanceFromStart: vi.fn().mockReturnValue(metres),
      formatDistance: vi.fn().mockReturnValue("12.4 miles"),
      startFollowing: vi.fn()
    } as unknown as typeof view["followService"];
    view.expandSheet = vi.fn();
    view.minimiseSheet = vi.fn();
    view["requestWakeLock"] = vi.fn().mockResolvedValue(null);
    return view;
  }

  it("shows the distance and keeps directions stopped when far from the start", async () => {
    const view = startView(20000);
    await view.start();
    expect(view["startLocationMessage"]).toContain("12.4 miles from the start");
    expect(view["startLocationMessage"]).toContain("straight-line distance");
    expect(view["followService"].startFollowing).not.toHaveBeenCalled();
    expect(view.expandSheet).toHaveBeenCalled();
    expect(view["startingFollow"]).toBe(false);
  });

  it("starts directions when within reach of the start", async () => {
    const view = startView(40);
    await view.start();
    expect(view["startLocationMessage"]).toBeNull();
    expect(view["followService"].startFollowing).toHaveBeenCalled();
    expect(view.minimiseSheet).toHaveBeenCalled();
  });

  it("keeps directions stopped when location is unavailable", async () => {
    const view = startView(null);
    view["currentLocation"].currentPosition = vi.fn().mockResolvedValue(null);
    await view.start();
    expect(view["startLocationMessage"]).toContain("current location could not be found");
    expect(view["followService"].startFollowing).not.toHaveBeenCalled();
  });
});


describe("recording stop and save availability", () => {
  it("allows stopping without GPS points but requires a line to save", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["payload"] = {source: RouteFollowSource.RECORDING} as RouteFollowPayload;
    view["recordingDetailsOpen"] = false;
    view["savingRoute"] = false;
    view["followService"] = {trackPoints: vi.fn().mockReturnValue([])} as unknown as typeof view["followService"];
    expect(view.recordingActionDisabled).toBe(false);
    view["recordingDetailsOpen"] = true;
    expect(view.recordingActionDisabled).toBe(true);
    view["followService"].trackPoints = vi.fn().mockReturnValue([{latitude: 51, longitude: 0}, {latitude: 51.001, longitude: 0.001}]);
    expect(view.recordingActionDisabled).toBe(false);
    view["savingRoute"] = true;
    expect(view.recordingActionDisabled).toBe(true);
  });
});

describe("live route edit statistics", () => {
  it("remembers the selected unit", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["uiActions"] = {saveValueFor: vi.fn()} as unknown as typeof view["uiActions"];
    view.distanceUnitChanged(DistanceUnit.KILOMETRES);
    expect(view["distanceUnit"]).toBe(DistanceUnit.KILOMETRES);
    expect(view["uiActions"].saveValueFor).toHaveBeenCalledWith(StoredValue.DISTANCE_UNIT, DistanceUnit.KILOMETRES);
  });

  it("uses the edited line for distance and estimated time even when editing a recording", () => {
    const view = Object.create(RouteFollowComponent.prototype) as RouteFollowComponent;
    view["progress"] = {mode: RouteFollowMode.EDITING, remainingMetres: 100, remainingMinutes: 2} as typeof view["progress"];
    view["payload"] = {source: RouteFollowSource.RECORDING} as RouteFollowPayload;
    const track = {metres: 1600};
    view["followService"] = {
      totalMetres: () => track.metres,
      minutesFor: (metres: number) => metres / 80,
      formatDistance: (metres: number) => `${metres} metres`,
      formatDuration: (minutes: number) => `${minutes} minutes`
    } as unknown as typeof view["followService"];
    expect(view.remainingDistance).toBe("1600 metres");
    expect(view.remainingTime).toBe("20 minutes");
    track.metres = 2400;
    expect(view.remainingDistance).toBe("2400 metres");
    expect(view.remainingTime).toBe("30 minutes");
    track.metres = 0;
    expect(view.remainingDistance).toBe("0 metres");
    expect(view.remainingTime).toBe("0 minutes");
  });
});
