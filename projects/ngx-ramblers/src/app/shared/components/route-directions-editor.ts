import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faDiamondTurnRight } from "@fortawesome/free-solid-svg-icons";
import { FileNameData, ServerFileNameData } from "../../models/aws-object.model";
import { MapMarker, RouteGuideEntry } from "../../models/content-text.model";
import { RouteDirectionsChrome, RouteFollowPoint, RouteFollowWaypoint, RouteTurnStepKind, RouteWayNamesSource } from "../../models/route-follow.model";
import { RootFolder } from "../../models/system.model";
import { generateUid } from "../../functions/numbers";
import { attachNarrative } from "../../functions/route-turns";
import { guideEntriesFor, replacingTurns, renumberedSteps, stepAfter, turnWaypointsFromSteps } from "../../functions/route-guide-edit";
import { RouteGuideEditSession } from "../../services/maps/route-guide-edit-session";
import { RouteTurnsService } from "../../services/maps/route-turns.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { RouteGuidePanel } from "./route-guide-panel";
import { RouteStepControls } from "./route-step-controls";

@Component({
  selector: "app-route-directions-editor",
  providers: [RouteGuideEditSession],
  imports: [FormsModule, FontAwesomeModule, RouteGuidePanel, RouteStepControls],
  host: {
    "[class.route-directions-fullscreen]": "fullscreen"
  },
  styles: [`
    :host
      display: block
      min-width: 0

    :host.route-directions-fullscreen
      display: flex
      flex-direction: column
      height: 100%
      min-height: 0

    .route-directions-toolbar
      flex: 0 0 auto

    :host.route-directions-fullscreen .route-directions-toolbar
      display: none

    .route-directions-layout
      min-width: 0

    .route-directions-layout:has([routeDirectionsMap])
      display: flex
      flex-wrap: wrap
      gap: 1rem
      min-width: 0

    .route-directions-layout:has([routeDirectionsMap]) > .map-section,
    .route-directions-layout:has([routeDirectionsMap]) > .route-guide-panel
      flex: 1 1 18rem
      min-width: 0

    .route-directions-layout .map-section:not(:has([routeDirectionsMap]))
      display: none

    :host.route-directions-fullscreen .route-directions-layout
      flex: 1 1 auto
      min-height: 0

    .route-directions-toolbar
      display: flex
      flex-direction: column
      gap: 8px
      width: 100%

    .route-directions-generate
      width: 100%
      margin-left: 0 !important
      border-radius: 999px

    .route-alert-copy
      min-width: 0
      flex: 1 1 auto
      overflow-wrap: anywhere
  `],
  template: `
    <div [class.thumbnail-heading-frame]="framed" [class.thumbnail-heading-frame-compact]="framed">
      @if (framed) {
        <div class="thumbnail-heading">Directions</div>
      }
      @if (showToolbar) {
        <div class="route-directions-toolbar mb-2">
          <button type="button" class="btn btn-primary route-directions-generate" [disabled]="disabled || generating || !canGenerate" (click)="generate()">
            @if (generating) {
              <span class="spinner-border spinner-border-sm me-2"></span>
            } @else {
              <fa-icon class="me-2" [icon]="faDiamondTurnRight"/>
            }
            {{ generateCaption }}
          </button>
          @if (showPanel && entries.length > 0) {
            <app-route-step-controls compact [activeIndex]="activeIndex" [count]="entries.length" [id]="listId"
                                     [canEdit]="!disabled" [editing]="editing" [canUndo]="session.canUndo"
                                     [fullScreenAvailable]="fullScreenAvailable && !fullscreen"
                                     (toggleEdit)="toggleEdit()" (undo)="undo()" (discard)="discard()"
                                     (previous)="previous()" (next)="next()" (first)="first()" (fullScreen)="fullScreen.emit()"/>
          }
        </div>
      }
      @if (message && showPanel) {
        <p class="text-muted small d-block mb-2">{{ message }}</p>
      }
      @if (showToolbar && !canGenerate) {
        <div class="alert alert-warning d-flex align-items-start mb-0">
          <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1 me-2"/>
          <div class="route-alert-copy">
            <strong class="d-block">{{ missingTitle }}</strong>
            <p class="mb-0">{{ missingBody }}</p>
          </div>
        </div>
      } @else if (showPanel) {
        <div class="route-directions-layout" [class.route-fullscreen-shell]="fullscreen" [class.is-fullscreen]="fullscreen" [class.is-editing]="editing">
          <div class="map-section">
            <ng-content select="[routeDirectionsMap]"/>
          </div>
          @if (entries.length > 0) {
            <app-route-guide-panel class="route-guide-panel" heading="How to follow this route"
                                   [class.thumbnail-heading-frame]="fullscreen"
                                   [class.thumbnail-heading-frame-compact]="!fullscreen"
                                   [entries]="entries" [activeMarker]="activeMarker" [markerColour]="markerColour"
                                   [listId]="listId" [height]="fullscreen ? null : panelHeight" [resizable]="false"
                                   [fullscreen]="fullscreen"
                                   [fullScreenAvailable]="fullScreenAvailable && !fullscreen"
                                   [editing]="editing" [editingNow]="editing"
                                   (guideEdit)="beginEdit()" (guideTextChange)="onTextChange()" (addStep)="addAfter($event)" (removeStep)="remove($event)"
                                   (stepSelect)="select($event)" (previous)="previous()" (next)="next()" (fullScreen)="fullScreen.emit()"/>
          } @else if (chrome === RouteDirectionsChrome.VIEW) {
            <div class="alert alert-warning d-flex align-items-start mb-0">
              <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1 me-2"/>
              <div class="route-alert-copy">
                <strong class="d-block">{{ emptyTitle }}</strong>
                <p class="mb-0">{{ emptyBody }}</p>
              </div>
            </div>
          } @else if (!generating && showToolbar) {
            <div class="alert alert-warning d-flex align-items-start mb-0">
              <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1 me-2"/>
              <div class="route-alert-copy">
                <strong class="d-block">No directions yet</strong>
                <p class="mb-0">Generate directions reads the shape of the route to find every turn and names the roads and paths where OpenStreetMap knows them. Each direction is a draft to check here, then save {{ saveLabel }} to keep them.</p>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class RouteDirectionsEditor {
  private routeTurns = inject(RouteTurnsService);
  private stringUtils = inject(StringUtilsService);
  protected session = inject(RouteGuideEditSession);
  @Input() waypoints: RouteFollowWaypoint[] = [];
  @Input() points: RouteFollowPoint[] = [];
  @Input() gpxFile: FileNameData | null = null;
  @Input() disabled = false;
  @Input() listId = "route-directions";
  @Input() markerColour = "#453C90";
  @Input() generateCaption = "Generate directions";
  @Input() saveLabel = "the route";
  @Input() missingTitle = "Save the route first";
  @Input() missingBody = "Directions are generated from the saved GPX file, then kept on this route.";
  @Input() emptyTitle = "No directions yet";
  @Input() emptyBody = "Choose Edit, then Generate directions.";
  @Input() writtenDirections: string[] = [];
  @Input() chrome: RouteDirectionsChrome = RouteDirectionsChrome.PANEL;
  @Input() panelHeight = 280;
  @Output() waypointsChange = new EventEmitter<RouteFollowWaypoint[]>();
  @Output() stepSelect = new EventEmitter<RouteFollowWaypoint>();
  @Output() fullScreen = new EventEmitter<void>();
  @Output() statusChange = new EventEmitter<string | null>();
  protected generating = false;
  protected message: string | null = null;
  activeId: string | null = null;
  protected readonly faDiamondTurnRight = faDiamondTurnRight;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly RouteDirectionsChrome = RouteDirectionsChrome;
  private framedValue = true;
  private fullScreenAvailableValue = false;
  private detailedResultValue = false;
  private fullscreenValue = false;

  @Input() set framed(value: boolean) {
    this.framedValue = coerceBooleanProperty(value);
  }

  get framed(): boolean {
    return this.framedValue;
  }

  @Input() set fullScreenAvailable(value: boolean) {
    this.fullScreenAvailableValue = coerceBooleanProperty(value);
  }

  get fullScreenAvailable(): boolean {
    return this.fullScreenAvailableValue;
  }

  @Input() set detailedResult(value: boolean) {
    this.detailedResultValue = coerceBooleanProperty(value);
  }

  get detailedResult(): boolean {
    return this.detailedResultValue;
  }

  @Input() set fullscreen(value: boolean) {
    this.fullscreenValue = coerceBooleanProperty(value);
  }

  get fullscreen(): boolean {
    return this.fullscreenValue;
  }

  get showToolbar(): boolean {
    return this.chrome !== RouteDirectionsChrome.VIEW;
  }

  get showPanel(): boolean {
    return this.chrome === RouteDirectionsChrome.PANEL || this.chrome === RouteDirectionsChrome.VIEW;
  }

  get editing(): boolean {
    return this.session.editing;
  }

  get canGenerate(): boolean {
    return !!this.gpxFile?.awsFileName;
  }

  get entries(): RouteGuideEntry[] {
    return guideEntriesFor(this.waypoints as MapMarker[], this.points, this.session.editing);
  }

  get activeIndex(): number {
    return this.entries.findIndex(entry => entry.marker.id === this.activeId);
  }

  get activeMarker(): MapMarker | null {
    return this.entries.find(entry => entry.marker.id === this.activeId)?.marker || null;
  }

  async generate(): Promise<void> {
    if (!this.gpxFile?.awsFileName) {
      this.setMessage("Save the route first, then generate directions.");
    } else {
      this.generating = true;
      this.setMessage("Reading the route and looking up the way names…");
      try {
        const directions = this.writtenDirections.filter(item => !!item?.trim());
        const response = await this.routeTurns.turnSteps({
          gpxFile: {rootFolder: (this.gpxFile as Partial<ServerFileNameData>).rootFolder || RootFolder.gpxRoutes, awsFileName: this.gpxFile.awsFileName},
          ...(directions.length > 0 ? {directions} : {})
        });
        const generated = turnWaypointsFromSteps(response.steps, generateUid);
        if (directions.length > 1) {
          const notes = response.notes?.length === generated.length ? response.notes : attachNarrative(directions, generated);
          generated.forEach((waypoint, index) => {
            if (notes[index]) {
              waypoint.note = notes[index];
            }
          });
        }
        this.emitWaypoints(replacingTurns(this.waypoints, generated));
        this.activeId = null;
        const turns = response.steps.filter(step => step.kind === RouteTurnStepKind.TURN).length;
        this.setMessage(this.resultMessage(turns, response));
      } catch (error) {
        this.setMessage(`Could not generate directions: ${(error as {error?: {message?: string}; message?: string})?.error?.message || (error as Error)?.message || "the server did not respond"}`);
      }
      this.generating = false;
    }
  }

  private resultMessage(turns: number, response: {namesSource?: RouteWayNamesSource; namedPointCount?: number; pointCount?: number; placesTried?: number; placesLocated?: number; trackCount?: number}): string {
    const found = `Found ${this.stringUtils.pluraliseWithCount(turns, "direction")} on the route`;
    if (!this.detailedResult) {
      return `${found}. Check them below, then save ${this.saveLabel} to keep them.`;
    } else {
      const naming = response.namesSource === RouteWayNamesSource.VALHALLA
        ? `OpenStreetMap knew the way for ${response.namedPointCount} of ${response.pointCount} points on the route`
        : "the way-name lookup was unavailable, so the directions have no road or path names";
      const places = response.placesTried ? `; ${response.placesLocated} of ${response.placesTried} place names in the directions were found on the map and used to place the notes` : "";
      const tracks = (response.trackCount || 1) > 1 ? ` The GPX holds ${response.trackCount} tracks: the steps follow the first, and the others are drawn on the map as alternatives.` : "";
      return `${found}; ${naming}${places}. Check each one, drag any that sit wrongly, then save ${this.saveLabel}.${tracks}`;
    }
  }

  private setMessage(message: string | null): void {
    this.message = message;
    this.statusChange.emit(message);
  }

  toggleEdit(): void {
    if (this.session.editing) {
      this.session.end();
    } else {
      this.session.begin(this.waypoints as MapMarker[]);
    }
  }

  undo(): void {
    const snapshot = this.session.undo();
    if (snapshot) {
      this.emitWaypoints(snapshot as RouteFollowWaypoint[]);
    }
  }

  discard(): void {
    const snapshot = this.session.discard();
    if (snapshot) {
      this.emitWaypoints(snapshot as RouteFollowWaypoint[]);
    }
    this.session.end();
  }

  beginEdit(): void {
    this.session.record(this.waypoints as MapMarker[]);
  }

  onTextChange(): void {
    this.emitWaypoints([...this.waypoints]);
  }

  addAfter(entry: RouteGuideEntry): void {
    if (this.points.length > 1) {
      this.session.record(this.waypoints as MapMarker[]);
      const marker = stepAfter(this.points, this.entries, entry, generateUid());
      this.emitWaypoints([...this.waypoints, marker as RouteFollowWaypoint]);
      this.activeId = marker.id;
    }
  }

  remove(entry: RouteGuideEntry): void {
    this.session.record(this.waypoints as MapMarker[]);
    this.emitWaypoints(this.waypoints.filter(waypoint => waypoint !== entry.marker && waypoint.id !== entry.marker.id));
  }

  select(entry: RouteGuideEntry): void {
    this.activeId = entry.marker.id;
    const waypoint = this.waypoints.find(item => item.id === entry.marker.id);
    if (waypoint) {
      this.stepSelect.emit(waypoint);
    }
  }

  selectById(id: string): void {
    const entry = this.entries.find(item => item.marker.id === id);
    if (entry) {
      this.select(entry);
    } else {
      this.activeId = id;
    }
  }

  get turnWaypoints(): RouteFollowWaypoint[] {
    return this.waypoints.filter(waypoint => this.entries.some(entry => entry.marker === waypoint || entry.marker.id === waypoint.id));
  }

  moveWaypoint(moved: RouteFollowWaypoint): void {
    const target = this.waypoints.find(waypoint => waypoint.id === moved.id);
    if (target) {
      this.session.record(this.waypoints as MapMarker[]);
      this.emitWaypoints(this.waypoints.map(waypoint => waypoint.id === moved.id
        ? {...waypoint, latitude: moved.latitude, longitude: moved.longitude}
        : waypoint));
    }
  }

  previous(): void {
    this.moveActive(-1);
  }

  next(): void {
    this.moveActive(1);
  }

  first(): void {
    if (this.entries[0]) {
      this.select(this.entries[0]);
    }
  }

  private moveActive(delta: number): void {
    const index = this.activeIndex;
    const next = index < 0 ? 0 : index + delta;
    if (next >= 0 && next < this.entries.length) {
      this.select(this.entries[next]);
    }
  }

  private emitWaypoints(waypoints: RouteFollowWaypoint[]): void {
    this.waypointsChange.emit(renumberedSteps(waypoints as MapMarker[], this.points) as RouteFollowWaypoint[]);
  }
}
