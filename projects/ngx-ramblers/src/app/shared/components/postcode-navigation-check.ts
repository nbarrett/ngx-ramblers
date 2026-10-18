import { Component, EventEmitter, inject, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faMapLocationDot, faMapPin, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { ReplaySubject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged, switchMap } from "rxjs/operators";
import { LocationDetails } from "../../models/ramblers-walks-manager";
import { AlertPanelVariant } from "../../models/alert-panel.model";
import { PostcodeNavigationCheck, PostcodeNavigationStatus, PostcodeRoadCheckStatus } from "../../models/postcode-navigation.model";
import { StoredValue } from "../../models/ui-actions";
import { DistanceUnit } from "../../models/walk.model";
import { locatePagePath } from "../../functions/locate";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { MemberLoginService } from "../../services/member/member-login.service";
import { PostcodeNavigationService } from "../../services/maps/postcode-navigation.service";
import { RouteFollowService } from "../../services/maps/route-follow.service";
import { UiActionsService } from "../../services/ui-actions.service";

@Component({
  selector: "app-postcode-navigation-check",
  imports: [FontAwesomeModule, AlertPanelComponent],
  styles: [`
    .btn
      width: auto
      flex: 0 0 auto
      white-space: nowrap
  `],
  template: `
    @if (pending && !result) {
      <div class="small text-muted my-2" role="status"><fa-icon [icon]="faSpinner" [animation]="'spin'" class="me-2"/>Checking postcode destination…</div>
    }
    @if (result && warning) {
      <app-alert-panel class="my-2" [title]="title" [icon]="faCircleExclamation"
                       [variant]="AlertPanelVariant.WARNING">
        <div>{{ message }}</div>
        @if (result.roadStatus === PostcodeRoadCheckStatus.CHECKING) {
          <div class="small mt-1"><fa-icon [icon]="faSpinner" [animation]="'spin'" class="me-1"/>Checking the driving route from the postcode to the pin…</div>
        } @else if (result.roadStatus === PostcodeRoadCheckStatus.FOUND) {
          <div class="small mt-1">Mapped driving distance from the postcode to the pin: {{ distance(result.drivingMetres) }}. The route may end on the nearest mapped road; this does not confirm the entrance.</div>
        } @else if (result.roadStatus === PostcodeRoadCheckStatus.UNAVAILABLE) {
          <div class="small mt-1">A driving route could not be verified. This does not prove there is no road access.</div>
        }
        <div class="small mt-1">Directions use the exact pin coordinates. The postcode does not move the pin.</div>
        @if (comparisonActive) {
          <div class="small mt-1">The extra pin shows where this postcode would send someone. It is a preview only and will not be saved with this walk.</div>
        }
        <div alertActions class="d-flex flex-nowrap gap-2">
          @if (comparisonUrl) {
            @if (compareInPlace) {
              @if (comparisonActive) {
                <button type="button" class="btn btn-quiet text-nowrap" (click)="clearComparison.emit()"><fa-icon [icon]="faMapPin" class="me-2"/>Show walk pin only</button>
              } @else {
                <button type="button" class="btn btn-primary text-nowrap" (click)="compare.emit(result)"><fa-icon [icon]="faMapLocationDot" class="me-2"/>Show both points on map</button>
              }
            } @else {
              <a class="btn btn-primary text-nowrap" [href]="comparisonUrl" target="_blank" rel="noopener"><fa-icon [icon]="faMapLocationDot" class="me-2"/>Compare pin and postcode</a>
            }
          }
        </div>
      </app-alert-panel>
    }
  `
})
export class PostcodeNavigationCheckComponent implements OnInit, OnChanges, OnDestroy {
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() postcode: string | null = null;
  @Input() compareInPlace = false;
  @Input() comparisonActive = false;
  @Output() compare = new EventEmitter<PostcodeNavigationCheck>();
  @Output() clearComparison = new EventEmitter<void>();
  private navigation = inject(PostcodeNavigationService);
  private login = inject(MemberLoginService);
  private followService = inject(RouteFollowService);
  private uiActions = inject(UiActionsService);
  private locations = new ReplaySubject<LocationDetails>(1);
  private subscriptions: Subscription[] = [];
  result: PostcodeNavigationCheck | null = null;
  pending = false;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faSpinner = faSpinner;
  protected readonly faMapLocationDot = faMapLocationDot;
  protected readonly faMapPin = faMapPin;
  protected readonly PostcodeRoadCheckStatus = PostcodeRoadCheckStatus;
  protected readonly AlertPanelVariant = AlertPanelVariant;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["latitude"] || changes["longitude"] || changes["postcode"]) {
      this.pending = Number.isFinite(this.latitude) && Number.isFinite(this.longitude);
      this.locations.next({latitude: this.latitude, longitude: this.longitude, postcode: this.postcode,
        description: null, grid_reference_6: null, grid_reference_8: null, grid_reference_10: null, w3w: null});
    }
  }

  ngOnInit(): void {
    this.subscriptions.push(this.locations.pipe(
      distinctUntilChanged((previous, current) => previous.latitude === current.latitude && previous.longitude === current.longitude && previous.postcode === current.postcode),
      debounceTime(400),
      switchMap(location => this.navigation.check(location, this.login.memberLoggedIn()))
    ).subscribe(result => {
      if (!result || (result.location.latitude === this.latitude && result.location.longitude === this.longitude && result.location.postcode === this.postcode)) {
        this.result = result;
        this.pending = false;
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.locations.complete();
  }

  get warning(): boolean {
    return this.result?.status !== PostcodeNavigationStatus.CLOSE;
  }

  get title(): string {
    switch (this.result?.status) {
      case PostcodeNavigationStatus.CLOSE: return "Postcode destination is close to the pin";
      case PostcodeNavigationStatus.DETOUR: return "Direct postcode navigation would guide to a different location";
      case PostcodeNavigationStatus.SEPARATED: return "Postcode directions alone are inaccurate";
      case PostcodeNavigationStatus.INVALID: return "Postcode format needs correcting";
      case PostcodeNavigationStatus.MISSING: return "Use the exact pin for directions";
      default: return "Postcode destination could not be checked";
    }
  }

  get message(): string {
    switch (this.result?.status) {
      case PostcodeNavigationStatus.CLOSE:
      case PostcodeNavigationStatus.DETOUR:
      case PostcodeNavigationStatus.SEPARATED:
        return `Entering ${this.result.postcode} alone places the destination ${this.distance(this.result.separationMetres)} from the pin in a straight line. ${this.warning ? "Use the exact-pin directions rather than relying on this postcode alone." : "A close postcode does not confirm road access."}`;
      case PostcodeNavigationStatus.INVALID: return "Enter a complete UK postcode. Walks Manager needs a postcode as well as the pin.";
      case PostcodeNavigationStatus.MISSING: return "No postcode is set. The pin and grid reference still identify the precise location; add approach directions for people using postcode-only sat-navs.";
      default: return "The pin is unchanged. Use the exact-pin directions; the postcode destination has not been verified.";
    }
  }

  distance(metres: number): string {
    const stored = this.uiActions.initialValueFor(StoredValue.DISTANCE_UNIT, DistanceUnit.MILES);
    const unit = stored === DistanceUnit.KILOMETRES ? DistanceUnit.KILOMETRES : DistanceUnit.MILES;
    return this.followService.formatDistance(metres, unit);
  }

  get comparisonUrl(): string | null {
    const point = this.result?.postcodePoint;
    const location = this.result?.location;
    const query = point && location && this.warning ? new URLSearchParams({
      [StoredValue.LAT]: String(location.latitude),
      [StoredValue.LON]: String(location.longitude),
      [StoredValue.POSTCODE]: this.result.postcode,
      [StoredValue.LOCATE_MAXIMISE]: "true",
      [StoredValue.LOCATE_POINTS]: JSON.stringify([
        [location.latitude, location.longitude, "Meeting point", 1],
        [point.lat, point.lng, `Postcode ${this.result.postcode}`, 2]
      ])
    }).toString() : null;
    return query ? `${locatePagePath({})}?${query}` : null;
  }
}
