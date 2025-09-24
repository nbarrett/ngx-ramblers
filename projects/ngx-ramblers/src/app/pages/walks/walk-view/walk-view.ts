import { Component, ElementRef, inject, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { ALERT_WARNING, AlertTarget } from "../../../models/alert-target.model";
import { LoginResponse } from "../../../models/member.model";
import { DisplayedWalk, EventType, MapDisplay } from "../../../models/walk.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MeetupService } from "../../../services/meetup.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { SystemConfig } from "../../../models/system.model";
import { ExtendedGroupEventQueryService } from "../../../services/walks-and-events/extended-group-event-query.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { WalkPanelExpanderComponent } from "../../../panel-expander/walk-panel-expander";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MarkdownComponent } from "ngx-markdown";
import { WalkLeaderComponent } from "./walk-leader";
import { WalkFeaturesComponent } from "./walk-features";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { RouterLink } from "@angular/router";
import { GroupEventImages } from "./group-event-images";
import { MapEditComponent } from "../walk-edit/map-edit";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { FormsModule } from "@angular/forms";
import { WalkDetailsComponent } from "./walk-details";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";
import { RelatedLinksComponent } from "../../../modules/common/related-links/related-links";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { DisplayTimePipe } from "../../../pipes/display-time.pipe";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { EventsMigrationService } from "../../../services/migration/events-migration.service";
import { PageService } from "../../../services/page.service";

@Component({
  selector: "app-walk-view",
  template: `
    @if (displayedWalk) {
      <div class="event-thumbnail card shadow tabset-container">
        @if (showPanelExpander) {
          <app-walk-panel-expander [walk]="displayedWalk.walk" [expandable]="allowWalkAdminEdits"
                                   (collapsed)="navigateToArea()"
                                   collapsable [collapseAction]="'collapse'"/>
        }
        <div class="row">
          <div class="col-sm-12 col-lg-6 rounded">
            @if (displayedWalk?.walk?.groupEvent?.title) {
              <h1 id="{{displayedWalk?.walk?.id}}-title">
                {{ displayedWalk.walk?.groupEvent?.title }}</h1>
            }
            <h2
              id="{{displayedWalk?.walk?.id}}-walkDate">{{ displayedWalk.walk?.groupEvent?.start_date_time | displayDay }}
              @if (display.walkPopulationLocal() && displayedWalk?.status !== EventType.APPROVED) {
                <div id="{{displayedWalk?.walk?.id}}-status"
                     class="badge event-badge sunset-badge">{{ displayedWalk?.latestEventType?.description }}
                </div>
              }
              <div id="{{displayedWalk?.walk?.id}}-durationInFuture"
                   class="badge event-badge blue-badge">{{ durationInFutureFor(displayedWalk?.walk) }}
              </div>
              @if (display.isNextWalk(displayedWalk?.walk)) {
                <div
                  class="badge event-badge next-event-badge"> Our next walk
                </div>
              }
            </h2>
            @if (displayedWalk?.walk?.groupEvent?.start_date_time) {
              <h2>Start
                Time: {{ displayedWalk?.walk?.groupEvent?.start_date_time | displayTime }}{{ EM_DASH_WITH_SPACES }}
                Estimated Finish Time: {{ displayedWalk?.walk?.groupEvent?.end_date_time | displayTime }}</h2>
            }
            @if (displayedWalk?.walk?.groupEvent?.description) {
              <div class="event-description">
                @if (displayedWalk?.walkAccessMode?.walkWritable) {
                  <input type="submit"
                         [value]="displayedWalk?.walkAccessMode?.caption"
                         (click)="display.edit(displayedWalk)"
                         [tooltip]="displayedWalk?.walkAccessMode?.caption + ' this walk'"
                         class="btn btn-primary float-end ms-2 mb-2">
                }
                <p class="list-arrow" markdown [data]="displayedWalk?.walk?.groupEvent?.description"></p>
              </div>
            }
            <app-walk-leader [displayedWalk]="displayedWalk"/>
            @if (displayedWalk?.hasFeatures) {
              <app-walk-features [extendedGroupEvent]="displayedWalk?.walk"/>
            }
            @if (displayLinks) {
              <div class="event-panel rounded event-panel-inner">
                <h1>Related Links</h1>
                <div class="row">
                  <app-related-links [displayedWalk]="displayedWalk"/>
                </div>
              </div>
            }
            @if (urlService.pathContainsEventIdOrSlug()) {
              @if (notifyTarget.showAlert) {
                <div class="col-12 alert {{notifyTarget.alertClass}} mt-3">
                  <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                  <strong class="ms-2">{{ notifyTarget.alertTitle }}</strong>
                  {{ notifyTarget.alertMessage }} <a [routerLink]="'/walks'" type="button"
                                                     class="rams-text-decoration-pink">Switch to Walks Programme</a>
                </div>
              }
            }
            @if (display.walkLeaderOrAdmin(displayedWalk?.walk) && (display.walkPopulationLocal() && !extendedGroupEventQueryService.approvedWalk(displayedWalk?.walk))) {
              @if (notifyTarget.showAlert) {
                <div class="col-12 alert {{ALERT_WARNING.class}} mt-3">
                  <fa-icon [icon]="ALERT_WARNING.icon"></fa-icon>
                  <strong class="ms-2">Walk Status</strong>
                  <div class="ms-1">This walk is not approved by {{ display.walksCoordinatorName() }}</div>
                </div>
              }
            }
          </div>
          <div class="col-sm-12 col-lg-6 rounded">
            @if (!display.displayMap(displayedWalk?.walk) || displayedWalk?.walk?.groupEvent?.media?.length > 0) {
              <div class="row">
                <div class="col-sm-12">
                  <app-group-event-images [extendedGroupEvent]="displayedWalk?.walk"/>
                </div>
              </div>
            }
            @if (display.displayMap(displayedWalk?.walk)) {
              <div class="row">
                <div class="col-sm-12">
                  @if (display.mapViewReady(googleMapsUrl) && showGoogleMapsView) {
                    <iframe allowfullscreen class="map-walk-view map-walk-view-google"
                            style="border:0;border-radius: 10px;"
                            [src]="googleMapsUrl"></iframe>
                  }
                  @if (!showGoogleMapsView) {
                    <div app-map-edit class="map-walk-view" readonly
                         [locationDetails]="mapDisplay==MapDisplay.SHOW_START_POINT? displayedWalk?.walk?.groupEvent?.start_location:displayedWalk?.walk?.groupEvent?.end_location"
                         [notify]="notify"></div>
                  }
                </div>
              </div>
              <form class="rounded img-thumbnail map-radio-frame">
                <div class="ms-2 me-2 d-flex align-items-center flex-wrap">
                  <span class="me-2 fw-bold">Show Map As</span>
                  <div class="form-check form-check-inline ms-2">
                    <input class="form-check-input" type="radio" [name]="'mapView-' + index"
                           [(ngModel)]="showGoogleMapsView" [ngModelOptions]="{standalone: true}"
                           id="{{index}}-pin-view-mode-start"
                           [value]="false" (ngModelChange)="configureMapDisplay()">
                    <label class="form-check-label" for="{{index}}-pin-view-mode-start">
                      {{ mapViewLabel }}</label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" [name]="'mapView-' + index"
                           [(ngModel)]="showGoogleMapsView" [ngModelOptions]="{standalone: true}"
                           id="{{index}}-google-maps-mode-start"
                           [value]="true" (ngModelChange)="configureMapDisplay()">
                    <label class="form-check-label" for="{{index}}-google-maps-mode-start">
                      Google Maps</label>
                  </div>
                </div>
                <div class="col-sm-12 ms-2 me-2 mt-2">
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" id="{{index}}-show-start-point"
                           type="radio"
                           [ngModel]="mapDisplay" [ngModelOptions]="{standalone: true}" [name]="'mapDisplay-' + index"
                           (ngModelChange)="changeMapView($event)"
                           [value]="MapDisplay.SHOW_START_POINT"/>
                    <label class="form-check-label" for="{{index}}-show-start-point">
                      At start point {{ displayedWalk?.walk?.groupEvent?.start_location?.postcode }}</label>
                  </div>
                  @if (displayedWalk?.walk?.groupEvent?.end_location?.postcode) {
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" id="{{index}}-show-end-point"
                             type="radio"
                             [ngModel]="mapDisplay" [ngModelOptions]="{standalone: true}" [name]="'mapDisplay-' + index"
                             (ngModelChange)="changeMapView($event)"
                             [value]="MapDisplay.SHOW_END_POINT"/>
                      <label class="form-check-label" for="{{index}}-show-end-point">
                        At finish point {{ displayedWalk?.walk?.groupEvent?.end_location?.postcode }}</label>
                    </div>
                  }
                </div>
                @if (showGoogleMapsView) {
                  <div class="col-sm-12 ms-2 me-2 mt-2">
                    <div class="form-check">
                      <div class="d-flex align-items-center flex-wrap">
                        <input id="{{index}}-show-driving-directions"
                               type="radio"
                               class="form-check-input align-middle"
                               (ngModelChange)="changeMapView($event)"
                               [ngModel]="mapDisplay" [ngModelOptions]="{standalone: true}" [name]="'mapDisplay-' + index"
                               [value]="MapDisplay.SHOW_DRIVING_DIRECTIONS"/>
                        <label class="form-check-label text-nowrap align-middle ms-2"
                               for="{{index}}-show-driving-directions">
                          Driving from</label>
                        <input class="form-control input-sm text-uppercase ms-2 postcode-input align-middle"
                               [ngModel]="fromPostcode" name="fromPostcode"
                               (ngModelChange)="changeFromPostcode($event)"
                               type="text" #fromPostcodeInput>
                      </div>
                    </div>
                  </div>
                }
              </form>
              <app-walk-details [displayedWalk]="displayedWalk"/>
            }
          </div>
        </div>
      </div>
    } @else if (notifyTarget.showAlert) {
      <div class="alert {{notifyTarget.alertClass}} table-pointer mt-3">
        <fa-icon [icon]="notifyTarget.alert.icon"/>
        <strong class="ms-1">{{ notifyTarget.alertTitle }}</strong>
        <span class="p-2">{{ notify.alertTarget.alertMessage }}. <a [href]="area"
                                                                    class="rams-text-decoration-pink"
                                                                    type="button"> Go Back to {{ area }}
          page</a></span>
      </div>
    }`,
  styleUrls: ["./walk-view.sass"],
  imports: [WalkPanelExpanderComponent, TooltipDirective, MarkdownComponent, WalkLeaderComponent, WalkFeaturesComponent, FontAwesomeModule, RouterLink, GroupEventImages, MapEditComponent, FormsModule, WalkDetailsComponent, DisplayDayPipe, RelatedLinksComponent, DisplayTimePipe]
})

export class WalkViewComponent implements OnInit, OnDestroy {
  private logger = inject(LoggerFactory).createLogger("WalkViewComponent", NgxLoggerLevel.ERROR);
  public walkInjected = false;
  public walkIdOrPath: string;
  public displayedWalk: DisplayedWalk;
  public displayLinks: boolean;
  public fromPostcode = "";
  public mapDisplay: MapDisplay = MapDisplay.SHOW_START_POINT;
  public allowWalkAdminEdits: boolean;
  public googleMapsUrl: SafeResourceUrl;
  public loggedIn: boolean;
  private subscriptions: Subscription[] = [];
  public notifyTarget: AlertTarget = {};
  protected readonly ALERT_WARNING = ALERT_WARNING;
  private pageService = inject(PageService);
  public extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private walksAndEventsService = inject(WalksAndEventsService);
  public googleMapsService = inject(GoogleMapsService);
  private authService = inject(AuthService);
  private memberLoginService = inject(MemberLoginService);
  public display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  public meetupService = inject(MeetupService);
  protected urlService = inject(UrlService);
  protected stringUtils = inject(StringUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  private mapTiles = inject(MapTilesService);
  protected eventsMigrationService = inject(EventsMigrationService);
  protected notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  public area = this.urlService.area();
  public showGoogleMapsView = false;
  public suppressMapToggle = false;
  protected readonly MapDisplay = MapDisplay;
  protected readonly EventType = EventType;
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;
  @Input() showPanelExpander: boolean = true;

  get hasOsApiKey(): boolean {
    return this.mapTiles.hasOsApiKey();
  }

  get mapViewLabel(): string {
    return this.hasOsApiKey ? "OS Maps" : "Pin Location View";
  }
  @ViewChild("fromPostcodeInput") fromPostcodeInput: ElementRef<HTMLInputElement>;
  @Input() index: number;

  @Input("displayedWalk") set init(displayedWalk: DisplayedWalk) {
    this.applyWalk(displayedWalk);
  }

  ngOnInit() {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.allowWalkAdminEdits = this.display.walkPopulationLocal() && this.memberLoginService.allowWalkAdminEdits();
    this.refreshHomePostcode();
    this.walkIdOrPath = this.urlService.lastPathSegment();
    this.logger.info("initialised with walk", this.displayedWalk, "pathContainsWalkId:", this.urlService.pathContainsEventIdOrSlug(), "walkIdOrPath:", this.walkIdOrPath);
    if (this.systemConfigService.systemConfig()) {
      this.queryIfRequired();
    } else {
      this.logger.info("not querying as systemConfig not yet cached");
    }
    this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => {
      this.logger.info("systemConfigService returned systemConfig:", systemConfig);
      this.queryIfRequired();
    });
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => {
      this.logger.info("loginResponseObservable:", loginResponse);
      this.display.refreshCachedData();
      this.loggedIn = loginResponse?.memberLoggedIn;
      this.allowWalkAdminEdits = this.display.walkPopulationLocal() && this.memberLoginService.allowWalkAdminEdits();
      this.refreshHomePostcode();
      this.updateGoogleMapIfApplicable();
    }));
    this.googleMapsService.events().subscribe(config => {
      this.logger.info("event received:", config);
      this.updateGoogleMapIfApplicable();
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  toggleGoogleOrLeafletMapViewAndBack() {
    this.showGoogleMapsView = !this.showGoogleMapsView;
    setTimeout(() => {
      this.showGoogleMapsView = !this.showGoogleMapsView;
    }, 0);
  }

  configureMapDisplay() {
    this.logger.info("configureMapDisplay:showGoogleMapsView:", this.showGoogleMapsView, "mapDisplay initial value:", this.mapDisplay);
    if (!this.showGoogleMapsView && this.mapDisplay === MapDisplay.SHOW_DRIVING_DIRECTIONS) {
      this.mapDisplay = MapDisplay.SHOW_START_POINT;
      this.logger.info("configureMapDisplay:mapDisplay changed to:", this.mapDisplay);
    }
    if (this.showGoogleMapsView && this.validFromPostcodeEntered() && !this.showDrivingDirections()) {
      this.changeMapView(MapDisplay.SHOW_DRIVING_DIRECTIONS);
    } else {
      this.suppressMapToggle = true;
      this.updateGoogleMapIfApplicable();
      if (this.showGoogleMapsView) {
        this.focusFromPostcodeInput();
      }
    }
  }

  async queryIfRequired(): Promise<void> {
    if (this.queryIsRequired()) {
      this.logger.info("Querying Walk:", this.walkIdOrPath);
      const walk: ExtendedGroupEvent = await this.walksAndEventsService.queryById(this.walkIdOrPath);
      if (walk) {
        this.logger.info("Walk found:", walk);
        this.applyWalk(this.display.toDisplayedWalk(walk));
      } else {
        this.logger.warn("Walk not found:", this.walkIdOrPath);
        this.notify.warning({
          title: "Walk not found",
          message: "Content for this walk doesnt exist"
        });
      }
    } else {
      this.logger.info("queryIfRequired:No query required for walkIdOrPath:", this.walkIdOrPath, "displayedWalk:", this.displayedWalk);
    }
  }

  private applyWalk(displayedWalk: DisplayedWalk) {
    if (displayedWalk) {
      this.walkInjected = true;
      this.logger.info("applyWalk:", displayedWalk);
      this.displayedWalk = displayedWalk;
      this.pageService.setTitle();
      this.displayLinks = displayedWalk?.walk?.fields?.links?.length > 0;
      if (this.systemConfigService.systemConfig()?.enableMigration?.events) {
        this.logger.info("remigrateForComparison", displayedWalk?.walk?.fields?.migratedFromId);
        this.eventsMigrationService.migrateOneWalk(displayedWalk?.walk?.fields?.migratedFromId);
      } else {
        this.logger.info("remigrateForComparison:false");
      }
      this.configureMapDisplay();
    }
    this.notify.success({
      title: `Single ${this.display.eventTypeTitle(this.displayedWalk?.walk)} showing`,
      message: " - "
    });
  }

  updateGoogleMapIfApplicable() {
    if (this.showGoogleMapsView) {
      this.googleMapsUrl = this.display.googleMapsUrl(!this.drivingDirectionsDisabled() && this.showDrivingDirections(), this.fromPostcode, this.showEndPoint() ? this.displayedWalk?.walk?.groupEvent?.end_location?.postcode : this.displayedWalk?.walk?.groupEvent?.start_location?.postcode);
      this.logger.info("updateGoogleMap:Should show details - rendering googleMapsUrl:", this.googleMapsUrl);
      if (!this.suppressMapToggle) {
        this.toggleGoogleOrLeafletMapViewAndBack();
      } else {
        this.suppressMapToggle = false;
      }
    } else {
      this.logger.info("updateGoogleMap:not performed as:this.showGoogleMapsView", this.showGoogleMapsView);
    }
  }

  refreshHomePostcode() {
    this.changeFromPostcode(this.memberLoginService.memberLoggedIn() ? this.memberLoginService.loggedInMember().postcode : "");
  }

  autoSelectMapDisplay() {
    const switchToShowStartPoint = this.drivingDirectionsDisabled() && this.showDrivingDirections();
    const switchToShowDrivingDirections = this.validFromPostcodeEntered() && !this.showDrivingDirections() && this.showGoogleMapsView;
    this.logger.info("autoSelectMapDisplay on entering: drivingDirectionsDisabled:", this.drivingDirectionsDisabled(), "switchToShowStartPoint:", switchToShowStartPoint, "switchToShowDrivingDirections:", switchToShowDrivingDirections, "mapDisplay:", this.mapDisplay, "fromPostcode:", this.fromPostcode);
    if (switchToShowStartPoint) {
      this.mapDisplay = MapDisplay.SHOW_START_POINT;
    } else if (switchToShowDrivingDirections) {
      this.mapDisplay = MapDisplay.SHOW_DRIVING_DIRECTIONS;
    }
    this.logger.info("autoSelectMapDisplay:mapDisplay:", this.mapDisplay, "showGoogleMapsView:", this.showGoogleMapsView);
  }

  showDrivingDirections(): boolean {
    return this.mapDisplay === MapDisplay.SHOW_DRIVING_DIRECTIONS;
  }

  showEndPoint(): boolean {
    return this.mapDisplay === MapDisplay.SHOW_END_POINT;
  }

  drivingDirectionsDisabled() {
    return !this.validFromPostcodeEntered() || !this.showGoogleMapsView;
  }

  validFromPostcodeEntered() {
    return this.fromPostcode?.length >= 3;
  }

  durationInFutureFor(walk: ExtendedGroupEvent) {
    return this.dateUtils.asValueNoTime(walk?.groupEvent?.start_date_time) === this.dateUtils.dateTimeNowNoTime().toMillis() ? "today"
      : (this.dateUtils.asDateTime(this.dateUtils.startTimeAsValue(walk)).toRelative());
  }

  changeMapView(newValue: MapDisplay) {
    this.logger.info("changeShowDrivingDirections:", newValue);
    this.mapDisplay = newValue;
    if (this.showGoogleMapsView && newValue === MapDisplay.SHOW_DRIVING_DIRECTIONS) {
      this.suppressMapToggle = true;
      this.updateGoogleMapIfApplicable();
      this.focusFromPostcodeInput();
    } else {
      this.updateGoogleMapIfApplicable();
    }
  }

  changeFromPostcode(fromPostcode: string) {
    this.logger.info("changeFromPostcode:", fromPostcode);
    this.fromPostcode = fromPostcode;
    this.autoSelectMapDisplay();
    this.suppressMapToggle = true;
    this.updateGoogleMapIfApplicable();
  }

  private queryIsRequired(): boolean {
    if (this.walkInjected) {
      this.logger.info("queryIsRequired:walkInjected:", this.walkInjected, " queryIsRequired:", false);
      return false;
    } else {
      const walkId: string = this.urlService.lastPathSegment();
      const extendedGroupEvent = this.displayedWalk?.walk;
      const matchableIds: string[] = [extendedGroupEvent?.id, extendedGroupEvent?.groupEvent?.id];
      const matchesUrl = extendedGroupEvent?.groupEvent?.url?.includes(walkId);
      const queryIsRequired = this?.systemConfigService.systemConfig()?.group && (matchableIds.includes(walkId) ? false : !matchesUrl);
      this.logger.info("queryIsRequired:walkId:", walkId, "matchableIds:", matchableIds, "matchesUrl:", matchesUrl, "displayedWalk:", this.displayedWalk, "queryIsRequired:", queryIsRequired);
      return queryIsRequired;
    }
  }

  navigateToArea() {
    this.urlService.navigateTo([this.area]);
  }

  private focusFromPostcodeInput() {
    setTimeout(() => this.fromPostcodeInput?.nativeElement?.focus(), 0);
  }
}
