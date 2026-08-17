import { inject, Injectable } from "@angular/core";
import { isNumber } from "es-toolkit/compat";
import { BehaviorSubject } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import {
  ROUTE_FOLLOW_APPROACH_METRES,
  ROUTE_FOLLOW_OFF_ROUTE_METRES,
  ROUTE_FOLLOW_RECORD_MIN_POINT_METRES,
  ROUTE_FOLLOW_EDIT_DETAIL_MAX,
  ROUTE_FOLLOW_EDIT_DETAIL_MIN,
  ROUTE_FOLLOW_PREVIEW_INTERVAL_MS,
  ROUTE_FOLLOW_PREVIEW_SPEED_DEFAULT,
  ROUTE_FOLLOW_PREVIEW_SPEED_MAX,
  ROUTE_FOLLOW_PREVIEW_SPEED_MIN,
  ROUTE_FOLLOW_PREVIEW_SPEED_SPAN,
  ROUTE_FOLLOW_PREVIEW_STEP_METRES,
  ROUTE_FOLLOW_WALKING_METRES_PER_MINUTE,
  RouteFollowLocationError,
  RouteFollowMode,
  RouteFollowPoint,
  RouteFollowProgress,
  RouteFollowReturnDirection,
  RouteFollowSnap,
  RouteFollowWaypoint,
  RouteWaypointKind
} from "../../models/route-follow.model";
import { GeoDistanceService } from "./geo-distance.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { returnDirectionFrom } from "./map-gestures";

@Injectable({
  providedIn: "root"
})
export class RouteFollowService {
  private geoDistance = inject(GeoDistanceService);
  private logger: Logger = inject(LoggerFactory).createLogger("RouteFollowService", NgxLoggerLevel.ERROR);
  private track: RouteFollowPoint[] = [];
  private cumulativeMetres: number[] = [];
  private waypoints: RouteFollowWaypoint[] = [];
  private visitedWaypointIds = new Set<string>();
  private watchId: number | null = null;
  private previewTimer: ReturnType<typeof setInterval> | null = null;
  private previewMetres = 0;
  private previewSpeedValue = ROUTE_FOLLOW_PREVIEW_SPEED_DEFAULT;
  private compassHeading: number | null = null;
  private orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;
  private state: RouteFollowProgress = this.emptyProgress();
  private progressSubject = new BehaviorSubject<RouteFollowProgress>(this.state);
  readonly progress$ = this.progressSubject.asObservable();

  loadRoute(points: RouteFollowPoint[], waypoints: RouteFollowWaypoint[]): void {
    this.stopAll();
    this.track = points || [];
    this.waypoints = waypoints || [];
    this.cumulativeMetres = this.buildCumulative(this.track);
    this.visitedWaypointIds = new Set<string>();
    this.previewMetres = 0;
    this.state = {
      ...this.emptyProgress(),
      totalMetres: this.totalMetres(),
      remainingMetres: this.totalMetres(),
      remainingMinutes: this.minutesFor(this.totalMetres()),
      currentElevationMetres: this.track[0]?.elevation ?? null
    };
    this.progressSubject.next(this.state);
  }

  progress(): RouteFollowProgress {
    return this.state;
  }

  totalMetres(): number {
    return this.cumulativeMetres.length > 0 ? this.cumulativeMetres[this.cumulativeMetres.length - 1] : 0;
  }

  trackPoints(): RouteFollowPoint[] {
    return this.track;
  }

  routeWaypoints(): RouteFollowWaypoint[] {
    return this.waypoints;
  }

  reverseRoute(): void {
    this.replaceTrack([...this.track].reverse());
    this.waypoints = this.reversedWaypoints(this.waypoints);
    this.visitedWaypointIds = new Set<string>();
  }

  private reversedWaypoints(waypoints: RouteFollowWaypoint[]): RouteFollowWaypoint[] {
    return [...waypoints].reverse().map(waypoint => {
      if (waypoint.kind === RouteWaypointKind.START) {
        return {...waypoint, kind: RouteWaypointKind.END};
      } else if (waypoint.kind === RouteWaypointKind.END) {
        return {...waypoint, kind: RouteWaypointKind.START};
      } else {
        return waypoint;
      }
    });
  }

  nearestSegment(position: RouteFollowPoint): {index: number; point: RouteFollowPoint; distanceMetres: number} | null {
    if (this.track.length < 2) {
      return null;
    } else {
      const result = this.track.slice(1).reduce((acc, end, offset) => {
        const projected = this.projectOnSegment(position, this.track[offset], end);
        if (projected.distanceMetres < acc.distanceMetres) {
          return {index: offset, point: projected.point, distanceMetres: projected.distanceMetres};
        } else {
          return acc;
        }
      }, {index: 0, point: this.track[0], distanceMetres: Number.POSITIVE_INFINITY});
      return result.distanceMetres === Number.POSITIVE_INFINITY ? null : result;
    }
  }

  replaceTrack(points: RouteFollowPoint[]): void {
    this.track = points || [];
    this.cumulativeMetres = this.buildCumulative(this.track);
    this.state = {
      ...this.state,
      totalMetres: this.totalMetres(),
      remainingMetres: this.remainingFrom(this.state.completedMetres),
      remainingMinutes: this.minutesFor(this.remainingFrom(this.state.completedMetres)),
      currentElevationMetres: this.track[0]?.elevation ?? this.state.currentElevationMetres
    };
    this.progressSubject.next(this.state);
  }

  startEditing(): void {
    this.stopPreview();
    this.clearWatch();
    this.stopCompass();
    this.applyMode(RouteFollowMode.EDITING);
  }

  startRecording(replace: boolean): void {
    this.stopPreview();
    this.visitedWaypointIds = new Set<string>();
    if (replace) {
      this.track = [];
      this.cumulativeMetres = [];
    }
    if (!navigator.geolocation) {
      this.logger.error("startRecording: geolocation is not available");
      this.applyLocationError(RouteFollowLocationError.UNSUPPORTED);
    } else {
      this.applyMode(RouteFollowMode.RECORDING);
      void this.startCompass();
      this.watchId = navigator.geolocation.watchPosition(
        position => this.onPosition(position),
        error => this.onPositionError(error),
        {enableHighAccuracy: true, maximumAge: 1000, timeout: 15000}
      );
    }
  }

  simplifiedTrack(spacingMetres: number, maxPoints: number): RouteFollowPoint[] {
    const kept = this.thinnedPoints(this.track, spacingMetres);
    if (kept.length <= maxPoints) {
      return kept;
    } else {
      const step = (kept.length - 1) / (maxPoints - 1);
      return Array.from({length: maxPoints}, (_, index) => kept[Math.round(index * step)]);
    }
  }

  thinnedPoints(points: RouteFollowPoint[], toleranceMetres: number): RouteFollowPoint[] {
    if (points.length <= 2) {
      return points.slice();
    } else {
      const start = points[0];
      const end = points[points.length - 1];
      const farthest = points.reduce((best, point, index) => {
        if (index === 0 || index === points.length - 1) {
          return best;
        } else {
          const distance = this.projectOnSegment(point, start, end).distanceMetres;
          return distance > best.distance ? {index, distance} : best;
        }
      }, {index: 0, distance: 0});
      if (farthest.distance > toleranceMetres) {
        const left = this.thinnedPoints(points.slice(0, farthest.index + 1), toleranceMetres);
        const right = this.thinnedPoints(points.slice(farthest.index), toleranceMetres);
        return [...left.slice(0, -1), ...right];
      } else {
        return [start, end];
      }
    }
  }

  thinningSpacingMetres(detail: number): number {
    const tightest = 1.25;
    const loosest = 80;
    const span = ROUTE_FOLLOW_EDIT_DETAIL_MAX - ROUTE_FOLLOW_EDIT_DETAIL_MIN;
    const t = (ROUTE_FOLLOW_EDIT_DETAIL_MAX - detail) / span;
    return tightest * Math.pow(loosest / tightest, t);
  }

  suggestedThinningDetail(points: RouteFollowPoint[], target: number): number {
    const count = ROUTE_FOLLOW_EDIT_DETAIL_MAX - ROUTE_FOLLOW_EDIT_DETAIL_MIN + 1;
    const details = Array.from({length: count}, (_, index) => ROUTE_FOLLOW_EDIT_DETAIL_MIN + index);
    return details.reduce((best, detail) => {
      const kept = this.thinnedPoints(points, this.thinningSpacingMetres(detail)).length;
      const score = Math.abs(kept - target);
      return score < best.score ? {detail, score} : best;
    }, {detail: 10, score: Number.POSITIVE_INFINITY}).detail;
  }

  startFollowing(): void {
    this.stopPreview();
    this.visitedWaypointIds = new Set<string>();
    this.beginLocationWatch();
  }

  restoreFollowing(visitedWaypointIds: string[]): void {
    this.stopPreview();
    this.visitedWaypointIds = new Set(visitedWaypointIds || []);
    this.beginLocationWatch();
  }

  restorePaused(visitedWaypointIds: string[]): void {
    this.stopAll();
    this.visitedWaypointIds = new Set(visitedWaypointIds || []);
    this.applyMode(RouteFollowMode.PAUSED);
  }

  restorePreview(metres: number, visitedWaypointIds: string[]): void {
    this.clearWatch();
    this.visitedWaypointIds = new Set(visitedWaypointIds || []);
    this.previewMetres = metres > 0 ? metres : 0;
    this.applyMode(RouteFollowMode.PREVIEW);
    this.showPreviewAt(this.previewMetres);
    this.startPreviewTimer();
  }

  visitedIds(): string[] {
    return [...this.visitedWaypointIds];
  }

  previewProgressMetres(): number {
    return this.previewMetres;
  }

  pause(): void {
    if (this.state.mode === RouteFollowMode.FOLLOWING) {
      this.clearWatch();
      this.applyMode(RouteFollowMode.PAUSED);
    } else if (this.state.mode === RouteFollowMode.PREVIEW) {
      this.stopPreviewTimerOnly();
      this.applyMode(RouteFollowMode.PAUSED);
    }
  }

  resume(): void {
    if (this.state.mode === RouteFollowMode.PAUSED) {
      this.beginLocationWatch();
    }
  }

  startPreview(): void {
    this.clearWatch();
    this.visitedWaypointIds = new Set<string>();
    this.previewMetres = 0;
    this.applyMode(RouteFollowMode.PREVIEW);
    this.advancePreview();
    this.startPreviewTimer();
  }

  private beginLocationWatch(): void {
    if (!navigator.geolocation) {
      this.logger.error("startFollowing: geolocation is not available");
      this.applyLocationError(RouteFollowLocationError.UNSUPPORTED);
    } else {
      this.applyMode(RouteFollowMode.FOLLOWING);
      void this.startCompass();
      this.clearWatch();
      this.watchId = navigator.geolocation.watchPosition(
        position => this.onPosition(position),
        error => this.onPositionError(error),
        {enableHighAccuracy: true, maximumAge: 1000, timeout: 15000}
      );
    }
  }

  previewSpeed(): number {
    return this.previewSpeedValue;
  }

  setPreviewSpeed(speed: number): void {
    const rounded = Math.round(speed);
    const bounded = rounded < ROUTE_FOLLOW_PREVIEW_SPEED_MIN
      ? ROUTE_FOLLOW_PREVIEW_SPEED_MIN
      : (rounded > ROUTE_FOLLOW_PREVIEW_SPEED_MAX ? ROUTE_FOLLOW_PREVIEW_SPEED_MAX : rounded);
    this.previewSpeedValue = bounded;
    if (this.previewTimer !== null) {
      this.startPreviewTimer();
    }
  }

  async requestCompassPermission(): Promise<void> {
    const orientation = DeviceOrientationEvent as unknown as {requestPermission?: () => Promise<string>};
    if (orientation.requestPermission) {
      await orientation.requestPermission();
    }
  }

  listenForCompass(): void {
    void this.startCompass();
  }

  stop(): void {
    this.stopAll();
    this.visitedWaypointIds = new Set<string>();
    this.previewMetres = 0;
    this.state = {
      ...this.emptyProgress(),
      totalMetres: this.totalMetres(),
      remainingMetres: this.totalMetres(),
      remainingMinutes: this.minutesFor(this.totalMetres()),
      currentElevationMetres: this.track[0]?.elevation ?? null
    };
    this.progressSubject.next(this.state);
  }

  snapToRoute(position: RouteFollowPoint): RouteFollowSnap | null {
    if (this.track.length < 2) {
      return null;
    } else {
      const result = this.track.slice(1).reduce((acc, end, offset) => {
        const start = this.track[offset];
        const projected = this.projectOnSegment(position, start, end);
        const better = projected.distanceMetres < acc.distanceMetres;
        return better ? {
          point: projected.point,
          index: offset,
          distanceMetres: projected.distanceMetres,
          progressMetres: this.cumulativeMetres[offset] + projected.alongMetres
        } : acc;
      }, {
        point: this.track[0],
        index: 0,
        distanceMetres: Number.POSITIVE_INFINITY,
        progressMetres: 0
      });
      return result.distanceMetres === Number.POSITIVE_INFINITY ? null : result;
    }
  }

  remainingFrom(progressMetres: number): number {
    const remaining = this.totalMetres() - progressMetres;
    return remaining > 0 ? remaining : 0;
  }

  nextWaypointFrom(progressMetres: number, position: RouteFollowPoint): {waypoint: RouteFollowWaypoint; metres: number} | null {
    const remaining = this.waypoints
      .filter(waypoint => !this.visitedWaypointIds.has(waypoint.id))
      .map(waypoint => {
        const snap = this.snapToRoute(waypoint);
        const along = snap ? snap.progressMetres : 0;
        const metres = this.metresBetween(position, waypoint);
        return {waypoint, along, metres};
      })
      .filter(item => item.along >= progressMetres - 10)
      .sort((left, right) => left.along - right.along);
    return remaining.length > 0 ? {waypoint: remaining[0].waypoint, metres: remaining[0].metres} : null;
  }

  formatDistance(metres: number | null): string {
    if (!isNumber(metres) || metres < 0) {
      return "";
    } else if (metres < 1000) {
      return `${Math.round(metres)} m`;
    } else {
      const miles = metres / 1609.34;
      return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
    }
  }

  formatDuration(minutes: number): string {
    const rounded = Math.max(0, Math.round(minutes));
    if (rounded < 60) {
      return `${rounded} min`;
    } else {
      const hours = Math.floor(rounded / 60);
      const mins = rounded % 60;
      return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
    }
  }

  formatElevation(metres: number | null): string {
    if (!isNumber(metres)) {
      return "—";
    } else {
      return `${Math.round(metres * 3.28084)} ft`;
    }
  }

  directionMarkers(fromMetres: number, spacingMetres: number): {point: RouteFollowPoint; heading: number}[] {
    const total = this.totalMetres();
    const start = fromMetres < 0 ? 0 : fromMetres;
    if (total <= start || this.track.length < 2 || spacingMetres <= 0) {
      return [];
    } else {
      const count = Math.floor((total - start) / spacingMetres);
      return Array.from({length: count}, (_, index) => this.pointAt(start + (index + 1) * spacingMetres));
    }
  }

  headingBetween(from: RouteFollowPoint, to: RouteFollowPoint): number {
    const fromLat = this.toRadians(from.latitude);
    const toLat = this.toRadians(to.latitude);
    const deltaLng = this.toRadians(to.longitude - from.longitude);
    const y = Math.sin(deltaLng) * Math.cos(toLat);
    const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
    return (this.toDegrees(Math.atan2(y, x)) + 360) % 360;
  }

  private onPosition(position: GeolocationPosition): void {
    const current: RouteFollowPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      elevation: isNumber(position.coords.altitude) ? position.coords.altitude : null
    };
    const heading = isNumber(position.coords.heading) && !isNaN(position.coords.heading)
      ? position.coords.heading
      : this.headingFromLast(current);
    if (this.state.mode === RouteFollowMode.RECORDING) {
      this.appendRecordedPoint(current);
    }
    this.applyPosition(current, heading, position.coords.accuracy);
  }

  private appendRecordedPoint(point: RouteFollowPoint): void {
    const last = this.track.length > 0 ? this.track[this.track.length - 1] : null;
    if (!last || this.metresBetween(last, point) >= ROUTE_FOLLOW_RECORD_MIN_POINT_METRES) {
      this.track = [...this.track, point];
      this.cumulativeMetres = this.buildCumulative(this.track);
    }
  }

  private onPositionError(error: GeolocationPositionError): void {
    this.logger.error("onPositionError:", error.code, error.message);
    if (error.code === error.PERMISSION_DENIED) {
      this.applyLocationError(RouteFollowLocationError.DENIED);
    } else if (error.code === error.TIMEOUT) {
      this.applyLocationError(RouteFollowLocationError.TIMEOUT);
    } else {
      this.applyLocationError(RouteFollowLocationError.UNAVAILABLE);
    }
  }

  applyPosition(position: RouteFollowPoint, heading: number | null, accuracyMetres: number | null): void {
    const snap = this.snapToRoute(position);
    const progressMetres = snap ? snap.progressMetres : 0;
    const approached = this.markApproached(position);
    const next = this.nextWaypointFrom(progressMetres, position);
    const remainingMetres = this.track.length >= 2
      ? this.remainingFrom(progressMetres)
      : (next?.metres ?? 0);
    const offRoute = snap ? snap.distanceMetres > ROUTE_FOLLOW_OFF_ROUTE_METRES : false;
    const routeHeading = this.routeHeadingAt(snap ? snap.index : -1);
    this.state = {
      mode: this.state.mode,
      position,
      heading: this.compassHeading ?? heading,
      accuracyMetres,
      snap,
      remainingMetres,
      remainingMinutes: this.minutesFor(remainingMetres),
      nextWaypoint: next?.waypoint || approached || null,
      nextWaypointMetres: next?.metres ?? (approached ? 0 : null),
      approachedWaypoint: approached,
      offRoute,
      completedMetres: progressMetres,
      totalMetres: this.totalMetres(),
      locationError: RouteFollowLocationError.NONE,
      routeHeading,
      returnDirection: this.returnDirectionFor(position, snap, routeHeading),
      currentElevationMetres: this.elevationAt(position, snap)
    };
    this.progressSubject.next(this.state);
  }

  private markApproached(position: RouteFollowPoint): RouteFollowWaypoint | null {
    const nearby = this.waypoints.find(waypoint => {
      const alreadyVisited = this.visitedWaypointIds.has(waypoint.id);
      const metres = this.metresBetween(position, waypoint);
      return !alreadyVisited && metres <= ROUTE_FOLLOW_APPROACH_METRES;
    });
    if (nearby) {
      this.visitedWaypointIds.add(nearby.id);
      return nearby;
    } else {
      return null;
    }
  }

  private headingFromLast(position: RouteFollowPoint): number | null {
    if (!this.state.position) {
      return null;
    } else {
      return this.headingBetween(this.state.position, position);
    }
  }

  private advancePreview(): void {
    if (this.track.length === 0) {
      this.stopPreview();
    } else {
      this.showPreviewAt(this.previewMetres);
      const total = this.totalMetres();
      if (total <= 0) {
        this.stopPreview();
      } else {
        const next = this.previewMetres + this.previewStepMetres();
        if (next >= total) {
          this.visitedWaypointIds = new Set<string>();
        }
        this.previewMetres = next % total;
      }
    }
  }

  private showPreviewAt(metres: number): void {
    if (this.track.length === 0) {
      this.stopPreview();
    } else {
      const sample = this.pointAt(metres);
      this.applyPosition(sample.point, sample.heading, 5);
    }
  }

  private pointAt(metres: number): {point: RouteFollowPoint; heading: number} {
    const capped = metres > this.totalMetres() ? this.totalMetres() : metres;
    const lastIndex = this.track.length - 1;
    const found = this.track.slice(1).reduce((acc, end, offset) => {
      if (acc.found) {
        return acc;
      } else {
        const startMetres = this.cumulativeMetres[offset];
        const endMetres = this.cumulativeMetres[offset + 1];
        if (capped <= endMetres || offset === lastIndex - 1) {
          const span = endMetres - startMetres;
          const t = span === 0 ? 0 : (capped - startMetres) / span;
          const start = this.track[offset];
          return {
            found: true,
            point: {
              latitude: start.latitude + (end.latitude - start.latitude) * t,
              longitude: start.longitude + (end.longitude - start.longitude) * t,
              elevation: this.interpolatedElevation(start, end, t)
            },
            heading: this.headingBetween(start, end)
          };
        } else {
          return acc;
        }
      }
    }, {found: false, point: this.track[0], heading: 0});
    return {point: found.point, heading: found.heading};
  }

  private projectOnSegment(point: RouteFollowPoint, start: RouteFollowPoint, end: RouteFollowPoint): {point: RouteFollowPoint; distanceMetres: number; alongMetres: number} {
    const startToEnd = this.metresBetween(start, end);
    if (startToEnd === 0) {
      return {point: start, distanceMetres: this.metresBetween(point, start), alongMetres: 0};
    } else {
      const dx = end.longitude - start.longitude;
      const dy = end.latitude - start.latitude;
      const tUnclamped = ((point.longitude - start.longitude) * dx + (point.latitude - start.latitude) * dy) / (dx * dx + dy * dy);
      const t = tUnclamped < 0 ? 0 : (tUnclamped > 1 ? 1 : tUnclamped);
      const projected: RouteFollowPoint = {
        latitude: start.latitude + dy * t,
        longitude: start.longitude + dx * t
      };
      return {
        point: projected,
        distanceMetres: this.metresBetween(point, projected),
        alongMetres: startToEnd * t
      };
    }
  }

  private buildCumulative(points: RouteFollowPoint[]): number[] {
    return points.reduce((acc: number[], point, index) => {
      if (index === 0) {
        return [0];
      } else {
        return [...acc, acc[index - 1] + this.metresBetween(points[index - 1], point)];
      }
    }, []);
  }

  private metresBetween(from: RouteFollowPoint, to: RouteFollowPoint): number {
    const km = this.geoDistance.calculateDistanceKm(from, to);
    return km === null ? 0 : km * 1000;
  }

  private interpolatedElevation(start: RouteFollowPoint, end: RouteFollowPoint, t: number): number | null {
    if (isNumber(start.elevation) && isNumber(end.elevation)) {
      return start.elevation + (end.elevation - start.elevation) * t;
    } else if (isNumber(start.elevation)) {
      return start.elevation;
    } else if (isNumber(end.elevation)) {
      return end.elevation;
    } else {
      return null;
    }
  }

  private elevationAt(position: RouteFollowPoint, snap: RouteFollowSnap | null): number | null {
    if (isNumber(position.elevation)) {
      return position.elevation;
    } else if (!snap) {
      return this.track[0]?.elevation ?? null;
    } else {
      const start = this.track[snap.index];
      const end = this.track[snap.index + 1] || start;
      const span = this.metresBetween(start, end);
      const along = this.metresBetween(start, snap.point);
      const t = span === 0 ? 0 : along / span;
      return this.interpolatedElevation(start, end, t);
    }
  }

  private minutesFor(metres: number): number {
    return metres / ROUTE_FOLLOW_WALKING_METRES_PER_MINUTE;
  }

  private applyMode(mode: RouteFollowMode): void {
    this.state = {...this.state, mode};
    this.progressSubject.next(this.state);
  }

  private emptyProgress(): RouteFollowProgress {
    return {
      mode: RouteFollowMode.IDLE,
      position: null,
      heading: null,
      accuracyMetres: null,
      snap: null,
      remainingMetres: 0,
      remainingMinutes: 0,
      nextWaypoint: null,
      nextWaypointMetres: null,
      approachedWaypoint: null,
      offRoute: false,
      completedMetres: 0,
      totalMetres: 0,
      locationError: RouteFollowLocationError.NONE,
      routeHeading: null,
      returnDirection: null,
      currentElevationMetres: null
    };
  }

  private async startCompass(): Promise<void> {
    this.stopCompass();
    const handler = (event: DeviceOrientationEvent) => this.onOrientation(event);
    this.orientationHandler = handler;
    const target = window as Window & {addEventListener: Window["addEventListener"]};
    target.addEventListener("deviceorientationabsolute" as "deviceorientation", handler, true);
    target.addEventListener("deviceorientation", handler, true);
  }

  private stopCompass(): void {
    if (this.orientationHandler) {
      window.removeEventListener("deviceorientation", this.orientationHandler, true);
      window.removeEventListener("deviceorientationabsolute", this.orientationHandler, true);
      this.orientationHandler = null;
    }
  }

  private onOrientation(event: DeviceOrientationEvent): void {
    const webkitHeading = (event as DeviceOrientationEvent & {webkitCompassHeading?: number}).webkitCompassHeading;
    const fromWebkit = isNumber(webkitHeading) && !isNaN(webkitHeading);
    const fromAlpha = event.absolute !== false && isNumber(event.alpha) && !isNaN(event.alpha);
    if (fromWebkit) {
      this.setCompassHeading(webkitHeading);
    } else if (fromAlpha) {
      this.setCompassHeading((360 - (event.alpha as number)) % 360);
    }
  }

  private setCompassHeading(next: number): void {
    const previous = this.compassHeading;
    const delta = previous === null ? 360 : Math.min((next - previous + 360) % 360, (previous - next + 360) % 360);
    if (previous === null || delta >= 2) {
      this.compassHeading = next;
      this.publishHeading();
    }
  }

  private publishHeading(): void {
    if (this.state.mode !== RouteFollowMode.EDITING && this.state.position) {
      this.applyPosition(this.state.position, this.state.heading, this.state.accuracyMetres);
    } else if (this.state.mode !== RouteFollowMode.EDITING) {
      this.state = {...this.state, heading: this.compassHeading};
      this.progressSubject.next(this.state);
    }
  }

  private routeHeadingAt(index: number): number | null {
    if (this.track.length < 2) {
      return null;
    } else if (index >= 0 && index < this.track.length - 1) {
      return this.headingBetween(this.track[index], this.track[index + 1]);
    } else if (index >= this.track.length - 1) {
      return this.headingBetween(this.track[this.track.length - 2], this.track[this.track.length - 1]);
    } else {
      return this.headingBetween(this.track[0], this.track[1]);
    }
  }

  private returnDirectionFor(
    position: RouteFollowPoint,
    snap: RouteFollowSnap | null,
    routeHeading: number | null
  ): RouteFollowReturnDirection | null {
    if (!snap || !isNumber(routeHeading) || snap.distanceMetres < 1) {
      return null;
    } else {
      return returnDirectionFrom(routeHeading, this.headingBetween(position, snap.point));
    }
  }

  private applyLocationError(locationError: RouteFollowLocationError): void {
    this.clearWatch();
    this.state = {
      ...this.state,
      mode: RouteFollowMode.IDLE,
      locationError
    };
    this.progressSubject.next(this.state);
  }

  private stopAll(): void {
    this.clearWatch();
    this.stopPreview();
    this.stopCompass();
    this.compassHeading = null;
  }

  private clearWatch(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private startPreviewTimer(): void {
    this.stopPreviewTimerOnly();
    this.previewTimer = setInterval(() => this.advancePreview(), this.previewIntervalMs());
  }

  private previewIntervalMs(): number {
    return ROUTE_FOLLOW_PREVIEW_INTERVAL_MS;
  }

  private previewStepMetres(): number {
    const range = ROUTE_FOLLOW_PREVIEW_SPEED_MAX - ROUTE_FOLLOW_PREVIEW_SPEED_MIN;
    const extra = (this.previewSpeedValue - ROUTE_FOLLOW_PREVIEW_SPEED_MIN) / range;
    return ROUTE_FOLLOW_PREVIEW_STEP_METRES * (1 + extra * ROUTE_FOLLOW_PREVIEW_SPEED_SPAN);
  }

  private stopPreview(): void {
    this.stopPreviewTimerOnly();
  }

  private stopPreviewTimerOnly(): void {
    if (this.previewTimer !== null) {
      clearInterval(this.previewTimer);
      this.previewTimer = null;
    }
  }

  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  private toDegrees(radians: number): number {
    return radians * 180 / Math.PI;
  }
}
