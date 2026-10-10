import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { isNumber } from "es-toolkit/compat";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faFlagCheckered, faLocationDot } from "@fortawesome/free-solid-svg-icons";
import { formatOsGridReference, RouteFollowPoint, RouteFollowWaypoint, RouteWaypointKind } from "../../models/route-follow.model";
import { elevationSvgPath, routeElevationStats, RouteElevationStats } from "../../functions/route-elevation";
import { GridReferenceService } from "../../services/maps/grid-reference.service";
import { RouteFollowService } from "../../services/maps/route-follow.service";

const CHART_WIDTH = 100;
const CHART_HEIGHT = 36;

@Component({
  selector: "app-route-elevation",
  imports: [FontAwesomeModule],
  styles: [`
    :host
      display: block

    .route-elevation-chart
      display: block
      width: 100%
      height: 72px
      margin: 4px 0 8px

    .route-elevation-chart path
      fill: none
      stroke: currentColor
      stroke-width: 1.6
      stroke-linejoin: round
      stroke-linecap: round
      vector-effect: non-scaling-stroke

    .route-elevation-stats
      display: flex
      flex-wrap: wrap
      gap: 12px 16px
      margin: 0
      color: var(--follow-muted, #5b6560)
      font-size: 0.88rem

    .route-elevation-stats strong
      color: var(--follow-ink, #1b1b1b)
      font-weight: 600

    .route-points
      display: grid
      gap: 8px

    .route-point
      display: flex
      align-items: center
      justify-content: flex-start
      gap: 10px
      width: 100%
      margin-left: 0 !important
      border-radius: 999px
      text-align: left
      white-space: normal

    .route-point span
      display: flex
      flex-direction: column
      align-items: flex-start
      gap: 2px
      min-width: 0

    .route-point small
      color: var(--follow-muted, #5b6560)
  `],
  template: `
    @if (stats) {
      <div class="thumbnail-heading-frame thumbnail-heading-frame-compact">
        <div class="thumbnail-heading">Elevation</div>
        <svg class="route-elevation-chart" [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight" preserveAspectRatio="none" aria-hidden="true">
          <path [attr.d]="path"/>
        </svg>
        <p class="route-elevation-stats">
          <span>Low <strong>{{ metresLabel(stats.minMetres) }}</strong></span>
          <span>High <strong>{{ metresLabel(stats.maxMetres) }}</strong></span>
          <span>Ascent <strong>{{ metresLabel(stats.ascentMetres) }}</strong></span>
        </p>
      </div>
    }
    @if (start || finish) {
      <div class="thumbnail-heading-frame thumbnail-heading-frame-compact" [class.mt-3]="!!stats">
        <div class="thumbnail-heading">Points</div>
        <div class="route-points">
          @if (start) {
            <button type="button" class="btn btn-quiet route-point" (click)="select(start)">
              <fa-icon [icon]="faLocationDot"/>
              <span>
                <strong>Start</strong>
                <small>{{ pointLabel(start) }}</small>
              </span>
            </button>
          }
          @if (finish) {
            <button type="button" class="btn btn-quiet route-point" (click)="select(finish)">
              <fa-icon [icon]="faFlagCheckered"/>
              <span>
                <strong>Finish</strong>
                <small>{{ pointLabel(finish) }}</small>
              </span>
            </button>
          }
        </div>
      </div>
    }
  `
})
export class RouteElevationComponent {
  private follow = inject(RouteFollowService);
  private grid = inject(GridReferenceService);
  protected readonly faLocationDot = faLocationDot;
  protected readonly faFlagCheckered = faFlagCheckered;
  protected readonly chartWidth = CHART_WIDTH;
  protected readonly chartHeight = CHART_HEIGHT;
  protected stats: RouteElevationStats | null = null;
  protected path = "";
  protected start: RouteFollowWaypoint | null = null;
  protected finish: RouteFollowWaypoint | null = null;
  @Output() pointSelect = new EventEmitter<RouteFollowWaypoint>();

  @Input() set points(value: RouteFollowPoint[]) {
    this.routePoints = value || [];
    this.refresh();
  }

  @Input() set waypoints(value: RouteFollowWaypoint[]) {
    this.routeWaypoints = value || [];
    this.refresh();
  }

  private routePoints: RouteFollowPoint[] = [];
  private routeWaypoints: RouteFollowWaypoint[] = [];

  metresLabel(metres: number): string {
    return this.follow.formatElevation(metres);
  }

  pointLabel(waypoint: RouteFollowWaypoint): string {
    const located = this.grid.fromLatLng(waypoint.latitude, waypoint.longitude);
    const grid = located ? formatOsGridReference(located.eastings, located.northings) : "";
    const metres = this.elevationAt(waypoint);
    const elevation = isNumber(metres) && metres !== 0 && this.stats ? this.follow.formatElevation(metres) : "";
    if (grid && elevation) {
      return `${grid} · ${elevation}`;
    } else {
      return grid || elevation || waypoint.label || "";
    }
  }

  select(waypoint: RouteFollowWaypoint): void {
    this.pointSelect.emit(waypoint);
  }

  private elevationAt(waypoint: RouteFollowWaypoint): number | null {
    const match = this.routePoints.find(point => point.latitude === waypoint.latitude && point.longitude === waypoint.longitude);
    if (isNumber(match?.elevation)) {
      return match.elevation;
    } else if (waypoint.kind === RouteWaypointKind.START) {
      return this.routePoints[0]?.elevation ?? null;
    } else {
      return this.routePoints[this.routePoints.length - 1]?.elevation ?? null;
    }
  }

  private refresh(): void {
    this.stats = routeElevationStats(this.routePoints);
    this.path = this.stats ? elevationSvgPath(this.stats, CHART_WIDTH, CHART_HEIGHT) : "";
    const startWaypoint = this.routeWaypoints.find(waypoint => waypoint.kind === RouteWaypointKind.START);
    const endWaypoint = this.routeWaypoints.find(waypoint => waypoint.kind === RouteWaypointKind.END);
    const first = this.routePoints[0];
    const last = this.routePoints[this.routePoints.length - 1];
    this.start = startWaypoint || (first ? {id: "route-start", latitude: first.latitude, longitude: first.longitude, label: "Start", kind: RouteWaypointKind.START} : null);
    this.finish = endWaypoint || (last ? {id: "route-finish", latitude: last.latitude, longitude: last.longitude, label: "Finish", kind: RouteWaypointKind.END} : null);
  }
}
