import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { WalksConfig } from "../../../models/walks-config.model";
import { FormsModule } from "@angular/forms";
import { PageContentRow } from "../../../models/content-text.model";
import { GroupEvent } from "../../../models/group-event.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { Difficulty, LocationDetails } from "../../../models/ramblers-walks-manager";
import { LocationType } from "../../../models/map.model";
import { FeatureCategory } from "../../../models/walk-feature.model";
import { ROUTE_EXCLUDED_FEATURES, RouteDetailsPart, RouteGuideData } from "../../../models/route-follow.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { EventDistanceEdit } from "../../../pages/walks/walk-edit/event-distance-edit";
import { WalkLocationEditComponent } from "../../../pages/walks/walk-edit/walk-location-edit";
import { WalkFeatureListComponent } from "../../../pages/walks/walk-edit/walk-edit-feature-category";
import { TiptapMarkdownEditor } from "../tiptap-editor/tiptap-markdown-editor";

@Component({
  selector: "app-route-details-edit",
  template: `
    @if (routeGuide) {
      @if (showAbout) {
        <div class="row gy-3">
          <div class="col-md-8">
            <label class="form-label" [for]="'route-title-' + id">Title</label>
            <input class="form-control" [id]="'route-title-' + id" [(ngModel)]="routeGuide.title" (ngModelChange)="changed()" placeholder="Barham and Four Churches">
          </div>
          <div class="col-md-4">
            <label class="form-label" [for]="'route-difficulty-' + id">Difficulty</label>
            <select class="form-control" [id]="'route-difficulty-' + id" [compareWith]="difficultyComparer" [(ngModel)]="routeGuide.difficulty" (ngModelChange)="changed()">
              <option [ngValue]="null">Not set</option>
              @for (difficulty of difficulties; track difficulty.code) {
                <option [ngValue]="difficulty">{{ difficulty.description }}</option>
              }
            </select>
          </div>
          <div class="col-md-4" app-event-distance-edit label="Distance" [groupEvent]="asGroupEvent" [id]="'route-' + id" (change)="distanceChanged()"></div>
          <div class="col-md-2">
            <label class="form-label" [for]="'route-mph-' + id">Avg mph</label>
            <input class="form-control" type="number" step="0.25" min="0.5" [id]="'route-mph-' + id" [ngModel]="routeGuide.milesPerHour" (ngModelChange)="setMilesPerHour($event)" [placeholder]="defaultMilesPerHour">
          </div>
          <div class="col-md-6">
            <label class="form-label" [for]="'route-hours-' + id">Time to walk it</label>
            <div class="d-flex align-items-center gap-2">
              <input class="form-control" type="number" min="0" step="1" [id]="'route-hours-' + id" [ngModel]="hours" (ngModelChange)="setDuration($event, minutes)" [disabled]="estimating">
              <span class="text-nowrap">hours</span>
              <input class="form-control" type="number" min="0" max="59" step="5" [id]="'route-minutes-' + id" [ngModel]="minutes" (ngModelChange)="setDuration(hours, $event)" [disabled]="estimating">
              <span class="text-nowrap">minutes</span>
            </div>
            <div class="form-check mt-2">
              <input class="form-check-input" type="checkbox" [id]="'route-estimate-' + id" [ngModel]="estimating" (ngModelChange)="setEstimating($event)">
              <label class="form-check-label" [for]="'route-estimate-' + id">Work it out from the distance and pace</label>
            </div>
          </div>
          <div class="col-12">
            <label class="form-label">Summary</label>
            <app-tiptap-markdown-editor [value]="routeGuide.summary || ''" (valueChange)="routeGuide.summary = $event; changed()" placeholder="A sentence or two about the walk"/>
          </div>
          <div class="col-12">
            <label class="form-label">Features</label>
            <div class="row">
              <div class="col-md-6">
                <app-walk-edit-feature-category [featureCategory]="FeatureCategory.FACILITIES" [displayedWalk]="displayedWalk" [excludedFeatures]="excludedFeatures"/>
                <app-walk-edit-feature-category [featureCategory]="FeatureCategory.TRANSPORT" [displayedWalk]="displayedWalk" [excludedFeatures]="excludedFeatures"/>
              </div>
              <div class="col-md-6">
                <app-walk-edit-feature-category [featureCategory]="FeatureCategory.ACCESSIBILITY" [displayedWalk]="displayedWalk" [excludedFeatures]="excludedFeatures"/>
              </div>
            </div>
          </div>
        </div>
      }
      @if (showStart) {
        <div [class.mt-3]="showAbout">
          <app-walk-location-edit [locationType]="LocationType.STARTING" [locationDetails]="routeGuide.start_location"/>
        </div>
      }
    }
  `,
  imports: [FormsModule, EventDistanceEdit, WalkLocationEditComponent, WalkFeatureListComponent, TiptapMarkdownEditor]
})
export class RouteDetailsEdit implements OnInit, OnDestroy {
  ngOnInit(): void {
    this.subscriptions.push(this.walksConfigService.events().subscribe(walksConfig => {
      this.walksConfig = walksConfig;
      this.applyEstimate();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private broadcastService = inject(BroadcastService);
  private actions = inject(PageContentActionsService);
  private display = inject(WalkDisplayService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private walksConfigService = inject(WalksConfigService);
  private walksConfig: WalksConfig;
  private subscriptions: Subscription[] = [];
  protected readonly LocationType = LocationType;
  protected readonly FeatureCategory = FeatureCategory;
  protected readonly excludedFeatures = ROUTE_EXCLUDED_FEATURES;
  protected difficulties: Difficulty[] = this.display.difficulties();
  protected displayedWalk: DisplayedWalk;
  @Input() id = "route";
  @Input() part: RouteDetailsPart = RouteDetailsPart.ALL;
  private routeRow: PageContentRow;

  @Input() set row(value: PageContentRow) {
    this.routeRow = value;
    if (this.routeRow) {
      this.actions.ensureRouteGuide(this.routeRow);
      this.routeRow.routeGuide.start_location = this.routeRow.routeGuide.start_location || this.emptyLocation();
      this.displayedWalk = {walk: {groupEvent: this.routeRow.routeGuide as GroupEvent}} as DisplayedWalk;
    }
  }

  get row(): PageContentRow {
    return this.routeRow;
  }

  get routeGuide(): RouteGuideData {
    return this.routeRow?.routeGuide;
  }

  get asGroupEvent(): GroupEvent {
    return this.routeGuide as GroupEvent;
  }

  get showAbout(): boolean {
    return this.part !== RouteDetailsPart.START;
  }

  get showStart(): boolean {
    return this.part !== RouteDetailsPart.ABOUT;
  }

  get estimating(): boolean {
    return this.routeGuide?.estimateDuration !== false;
  }

  get defaultMilesPerHour(): number {
    return this.walksConfig?.milesPerHour;
  }

  setEstimating(value: boolean): void {
    this.routeGuide.estimateDuration = value;
    this.applyEstimate();
    this.changed();
  }

  setMilesPerHour(value: number): void {
    this.routeGuide.milesPerHour = value || null;
    this.applyEstimate();
    this.changed();
  }

  distanceChanged(): void {
    this.applyEstimate();
    this.changed();
  }

  private applyEstimate(): void {
    const pace = this.routeGuide?.milesPerHour || this.defaultMilesPerHour;
    if (this.estimating && this.routeGuide?.distance_miles && pace) {
      this.routeGuide.durationMinutes = this.ramblersWalksAndEventsService.walkDurationMinutes(this.routeGuide.distance_miles, pace);
    }
  }

  get hours(): number {
    return Math.floor((this.routeGuide?.durationMinutes || 0) / 60);
  }

  get minutes(): number {
    return (this.routeGuide?.durationMinutes || 0) % 60;
  }

  setDuration(hours: number, minutes: number): void {
    const total = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    this.routeGuide.durationMinutes = total > 0 ? total : null;
    this.changed();
  }

  difficultyComparer(item1: Difficulty, item2: Difficulty): boolean {
    return item1?.code === item2?.code;
  }

  changed(): void {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_CHANGED, this.routeRow));
  }

  private emptyLocation(): LocationDetails {
    return {latitude: null, longitude: null, grid_reference_6: "", grid_reference_8: "", grid_reference_10: "", postcode: "", description: "", w3w: ""};
  }
}
