import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { appAppearanceFromStored, AppAppearance, followCacheKey, RouteFollowLocationError, RouteFollowMode, RouteWaypointKind } from "../../models/route-follow.model";
import { GeoDistanceService } from "./geo-distance.service";
import { RouteFollowService } from "./route-follow.service";

describe("appAppearanceFromStored", () => {
  it("reads a stored appearance and falls back to match phone", () => {
    expect(appAppearanceFromStored("light")).toBe(AppAppearance.LIGHT);
    expect(appAppearanceFromStored("dark")).toBe(AppAppearance.DARK);
    expect(appAppearanceFromStored("system")).toBe(AppAppearance.SYSTEM);
    expect(appAppearanceFromStored(null)).toBe(AppAppearance.SYSTEM);
  });
});

describe("followCacheKey", () => {
  it("builds a stable key for each kind of route", () => {
    expect(followCacheKey({ramblersSlug: "egerton-kent"})).toBe("ramblers:egerton-kent");
    expect(followCacheKey({walkId: "abc"})).toBe("walk:abc");
    expect(followCacheKey({path: "walks/foo", routeId: "r1"})).toBe("page:walks/foo:r1");
  });
});

describe("RouteFollowService", () => {
  let service: RouteFollowService;

  const eastWest = [
    {latitude: 51.2, longitude: 1.0},
    {latitude: 51.2, longitude: 1.01},
    {latitude: 51.2, longitude: 1.02}
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [RouteFollowService, GeoDistanceService]
    });
    service = TestBed.inject(RouteFollowService);
    service.loadRoute(eastWest, [
      {id: "start", latitude: 51.2, longitude: 1.0, label: "1", instruction: "Leave the churchyard", kind: RouteWaypointKind.START},
      {id: "mid", latitude: 51.2, longitude: 1.01, label: "2", instruction: "Turn left at the stile", kind: RouteWaypointKind.TURN},
      {id: "end", latitude: 51.2, longitude: 1.02, label: "3", instruction: "Finish at the green", kind: RouteWaypointKind.END}
    ]);
  });

  it("snaps a point on the line to the nearest segment", () => {
    const snap = service.snapToRoute({latitude: 51.2002, longitude: 1.005});
    expect(snap).toBeTruthy();
    expect(snap.distanceMetres).toBeLessThan(50);
    expect(snap.progressMetres).toBeGreaterThan(0);
    expect(snap.progressMetres).toBeLessThan(service.totalMetres());
  });

  it("reports remaining distance from the start as the full route", () => {
    expect(service.remainingFrom(0)).toBeCloseTo(service.totalMetres(), 0);
  });

  it("reports remaining distance of zero at the end", () => {
    expect(service.remainingFrom(service.totalMetres())).toBe(0);
  });

  it("selects the next waypoint ahead of progress", () => {
    const next = service.nextWaypointFrom(0, eastWest[0]);
    expect(next.waypoint.id).toBe("start");
    const afterStart = service.nextWaypointFrom(service.totalMetres() / 2, eastWest[1]);
    expect(afterStart.waypoint.id).toBe("mid");
  });

  it("marks a waypoint as approached when the walker is close", () => {
    service.applyPosition(eastWest[1], 90, 5);
    expect(service.progress().approachedWaypoint?.id).toBe("mid");
    expect(service.progress().approachedWaypoint?.instruction).toBe("Turn left at the stile");
  });

  it("flags off-route when the walker is far from the line", () => {
    service.applyPosition({latitude: 51.25, longitude: 1.01}, 0, 5);
    expect(service.progress().offRoute).toBe(true);
  });

  it("formats short distances in metres and longer ones in miles", () => {
    expect(service.formatDistance(80)).toBe("80 m");
    expect(service.formatDistance(3200)).toContain("mi");
  });

  it("formats durations under and over an hour", () => {
    expect(service.formatDuration(12)).toBe("12 min");
    expect(service.formatDuration(70)).toBe("1 hr 10 min");
    expect(service.formatDuration(120)).toBe("2 hr");
  });

  it("reports the direction of the path at the nearest segment", () => {
    service.applyPosition({latitude: 51.2, longitude: 1.005}, 0, 5);
    const heading = service.progress().routeHeading;
    expect(heading).not.toBeNull();
    expect(heading).toBeGreaterThan(70);
    expect(heading).toBeLessThan(110);
  });

  it("starts in idle mode with the full remaining distance", () => {
    expect(service.progress().mode).toBe(RouteFollowMode.IDLE);
    expect(service.progress().remainingMetres).toBeCloseTo(service.totalMetres(), 0);
    expect(service.progress().locationError).toBe(RouteFollowLocationError.NONE);
  });

  it("formats elevation in feet and spaces direction markers along the line", () => {
    expect(service.formatElevation(null)).toBe("—");
    expect(service.formatElevation(27.7)).toBe("91 ft");
    const markers = service.directionMarkers(0, 200);
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.length).toBe(Math.floor(service.totalMetres() / 200));
    expect(markers[0].heading).toBeGreaterThan(70);
    expect(markers[0].heading).toBeLessThan(110);
    const close = service.directionMarkers(0, 30);
    expect(close.length).toBe(Math.floor(service.totalMetres() / 30));
    expect(close.length).toBeGreaterThan(36);
  });

  it("enters editing mode and keeps a drawn line on the track", () => {
    service.startEditing();
    expect(service.progress().mode).toBe(RouteFollowMode.EDITING);
    service.replaceTrack([
      {latitude: 51.2, longitude: 1.0},
      {latitude: 51.21, longitude: 1.02}
    ]);
    expect(service.trackPoints().length).toBe(2);
    expect(service.totalMetres()).toBeGreaterThan(0);
  });

  it("does not emit heading updates while the route is being edited", () => {
    service.startEditing();
    service.listenForCompass();
    const seen: RouteFollowMode[] = [];
    const subscription = service.progress$.subscribe(progress => seen.push(progress.mode));
    window.dispatchEvent(Object.assign(new Event("deviceorientation"), {alpha: 90, absolute: true}));
    subscription.unsubscribe();
    expect(seen.every(mode => mode === RouteFollowMode.EDITING)).toBe(true);
    expect(service.progress().heading).toBeNull();
  });

  it("thins a dense track and picks a detail level near the target count", () => {
    const dense = Array.from({length: 400}, (_, index) => ({
      latitude: 51.2,
      longitude: 1 + index * 0.0002
    }));
    const thinned = service.thinnedPoints(dense, 80);
    expect(thinned.length).toBeLessThan(dense.length);
    expect(thinned[0].longitude).toBe(dense[0].longitude);
    expect(thinned[thinned.length - 1].longitude).toBe(dense[dense.length - 1].longitude);
    const detail = service.suggestedThinningDetail(dense, 120);
    expect(detail).toBeGreaterThanOrEqual(1);
    expect(detail).toBeLessThanOrEqual(20);
    const finest = service.thinningSpacingMetres(20);
    const next = service.thinningSpacingMetres(19);
    expect(next / finest).toBeLessThan(2);
  });

  it("reverses the line so the old finish becomes the start", () => {
    const start = {latitude: 51.2, longitude: 1.0};
    const end = {latitude: 51.2, longitude: 1.02};
    service.replaceTrack([start, {latitude: 51.2, longitude: 1.01}, end]);
    service.reverseRoute();
    const points = service.trackPoints();
    expect(points[0].longitude).toBeCloseTo(1.02, 5);
    expect(points[points.length - 1].longitude).toBeCloseTo(1.0, 5);
  });

  it("finds the nearest segment so a tap can insert a point on the line", () => {
    service.replaceTrack([
      {latitude: 51.2, longitude: 1.0},
      {latitude: 51.2, longitude: 1.02}
    ]);
    const nearest = service.nearestSegment({latitude: 51.2004, longitude: 1.01});
    expect(nearest).toBeTruthy();
    expect(nearest.index).toBe(0);
    expect(nearest.point.longitude).toBeCloseTo(1.01, 3);
  });

  it("replaces the track when a drawn line is saved locally", () => {
    service.replaceTrack([
      {latitude: 51.2, longitude: 1.0},
      {latitude: 51.21, longitude: 1.02}
    ]);
    expect(service.trackPoints().length).toBe(2);
    expect(service.totalMetres()).toBeGreaterThan(0);
  });

  it("uses the track elevation when the GPS point has none", () => {
    service.loadRoute([
      {latitude: 51.2, longitude: 1.0, elevation: 20},
      {latitude: 51.2, longitude: 1.01, elevation: 30},
      {latitude: 51.2, longitude: 1.02, elevation: 40}
    ], []);
    service.applyPosition({latitude: 51.2, longitude: 1.01}, 90, 5);
    expect(service.progress().currentElevationMetres).toBe(30);
  });
});
