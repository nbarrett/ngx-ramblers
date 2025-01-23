import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { ALERT_WARNING, AlertTarget } from "../../../models/alert-target.model";
import { LoginResponse } from "../../../models/member.model";
import { DisplayedWalk, MapDisplay, Walk } from "../../../models/walk.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MeetupService } from "../../../services/meetup.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { WalksService } from "../../../services/walks/walks.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { SystemConfig } from "../../../models/system.model";
import { WalksQueryService } from "../../../services/walks/walks-query.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { WalkPanelExpanderComponent } from "../../../panel-expander/walk-panel-expander";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MarkdownComponent } from "ngx-markdown";
import { WalkLeaderComponent } from "./walk-leader";
import { WalkFeaturesComponent } from "./walk-features";
import { RelatedLinkComponent } from "../../../modules/common/related-link/related-link.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { RouterLink } from "@angular/router";
import { WalkImagesComponent } from "./walk-images";
import { MapEditComponent } from "../walk-edit/map-edit";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { WalkDetailsComponent } from "./walk-details";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";
import { VenueIconPipe } from "../../../pipes/venue-icon.pipe";

@Component({
    selector: "app-walk-view",
    template: `
    @if (displayedWalk) {
      <div class="event-thumbnail card shadow tabset-container">
        <app-walk-panel-expander [walk]="displayedWalk.walk" [expandable]="allowWalkAdminEdits"
          [collapsable]="true" [collapseAction]="'collapse'">
        </app-walk-panel-expander>
        <div class="row">
          <div class="col-sm-12 col-lg-6 rounded">
            <h1
            id="{{displayedWalk.walk.id}}-briefDescriptionAndStartPoint">{{ displayedWalk.walk.briefDescriptionAndStartPoint || displayedWalk.latestEventType.description }}</h1>
            <h2 id="{{displayedWalk.walk.id}}-walkDate">{{ displayedWalk.walk.walkDate | displayDay }}
              <div id="{{displayedWalk.walk.id}}-durationInFuture"
                class="badge event-badge blue-badge">{{ durationInFutureFor(displayedWalk.walk) }}
              </div>
              @if (display.isNextWalk(displayedWalk.walk)) {
                <div
                  class="badge event-badge next-event-badge"> Our next walk
                </div>
              }
            </h2>
            @if (displayedWalk.walk.startTime) {
              <h2>
              Start Time: {{ displayedWalk.walk.startTime }}</h2>
            }
            @if (displayedWalk?.walkAccessMode?.walkWritable) {
              <input type="submit"
                [value]="displayedWalk?.walkAccessMode?.caption"
                (click)="display.edit(displayedWalk)"
                [tooltip]="displayedWalk?.walkAccessMode?.caption + ' this walk'"
                class="btn btn-primary button-form-edit-event smr-2">
            }
            @if (displayedWalk?.walk?.longerDescription) {
              <div class="event-description">
                <p class="list-arrow" markdown [data]="displayedWalk?.walk?.longerDescription"></p>
              </div>
            }
            <app-walk-leader [displayedWalk]="displayedWalk"/>
            @if (displayedWalk.walk?.features?.length>0) {
              <app-walk-features [features]="displayedWalk.walk?.features"/>
            }
            @if (displayLinks) {
              <div
                class="event-panel rounded event-panel-inner">
                <h1>Related Links</h1>
                <div class="row">
                  @if (displayedWalk.walk.meetupEventUrl) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                      class="col-sm-12">
                      <img title class="related-links-image"
                        src="/assets/images/local/meetup.ico"
                        alt="View {{meetupService.meetupPublishedStatus(displayedWalk)}} event on Meetup"/>
                      <a content target="_blank" tooltip="Click to view the route for This Walk on Meetup"
                        [href]="displayedWalk.walk.meetupEventUrl">View {{ meetupService.meetupPublishedStatus(displayedWalk) }}
                      event on Meetup</a>
                    </div>
                  }
                  @if (displayedWalk.walk.ramblersWalkId) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                      class="col-sm-12">
                      <img title class="related-links-ramblers-image"
                        src="favicon.ico"
                        alt="On Ramblers"/>
                      <a content tooltip="Click to view on Ramblers Walks and Events Manager" target="_blank"
                      [href]="displayedWalk.ramblersLink">On Ramblers</a>
                    </div>
                  }
                  @if (displayedWalk.walk.osMapsRoute) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                      class="col-sm-12">
                      <img title class="related-links-image"
                        src="/assets/images/local/ordnance-survey-untitled.png"
                        alt="View map on OS Maps"/>
                      <a content tooltip="Click to view the route for This Walk on Ordnance Survey Maps"
                        target="_blank"
                        [href]="displayedWalk.walk.osMapsRoute">
                        View map on OS Maps
                      </a>
                    </div>
                  }
                  @if (displayedWalk.walk.startLocationW3w) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                      class="col-sm-12">
                      <img title class="w3w-image"
                        src="/assets/images/local/w3w.png"
                        alt="View start location in what3words"/>
                      <a content tooltip="Click to view the start location in what3words"
                        target="_blank"
                        [href]="'https://what3words.com/'+displayedWalk.walk.startLocationW3w">
                        View start location in what3words
                      </a>
                    </div>
                  }
                  @if (displayedWalk?.walk?.venue?.venuePublish && (displayedWalk?.walk?.venue?.url||displayedWalk?.walk?.venue?.postcode)) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                      class="col-sm-12">
                      <fa-icon title [icon]="displayedWalk.walk.venue.type | toVenueIcon" class="fa-icon"></fa-icon>
                      <a content tooltip="Click to visit {{displayedWalk.walk.venue.name}}"
                        [href]="displayedWalk.walk.venue.url || googleMapsService.urlForPostcode(displayedWalk.walk.venue.postcode)"
                        target="_blank">
                        {{ displayedWalk.walk.venue.type }}: {{ displayedWalk.walk.venue.name }}
                      </a>
                    </div>
                  }
                  @if (displayedWalk.walkLink) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                      class="col-sm-12">
                      <app-copy-icon title [value]="displayedWalk.walkLink"
                      elementName="This {{display.eventTypeTitle(displayedWalk.walk)}}"></app-copy-icon>
                      <div content>
                        <a [href]="displayedWalk.walkLink "
                        target="_blank">This {{ display.eventTypeTitle(displayedWalk.walk) }}</a>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
            @if (pathContainsWalkId) {
              <div>
                @if (notifyTarget.showAlert) {
                  <div class="col-12 alert {{notifyTarget.alertClass}} mt-3">
                    <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                    <strong class="ml-2">{{ notifyTarget.alertTitle }}</strong>
                    {{ notifyTarget.alertMessage }} <a [routerLink]="'/walks'" type="button"
                  class="rams-text-decoration-pink">Switch to Walks Programme</a>
                </div>
              }
            </div>
          }
          @if (display.walkLeaderOrAdmin(displayedWalk.walk) && (display.walkPopulationLocal() && !walksQueryService.approvedWalk(displayedWalk.walk))) {
            <div
              >
              @if (notifyTarget.showAlert) {
                <div class="col-12 alert {{ALERT_WARNING.class}} mt-3">
                  <fa-icon [icon]="ALERT_WARNING.icon"></fa-icon>
                  <strong class="ml-2">Walk Status</strong>
                  <div class="ml-1">This walk is not approved by {{ display.walksCoordinatorName() }}</div>
                </div>
              }
            </div>
          }
        </div>
        <div class="col-sm-12 col-lg-6 rounded">
          @if (displayedWalk?.walk?.media?.length>0) {
            <div class="row">
              <div class="col-sm-12">
                <app-walk-images [displayedWalk]="displayedWalk"/>
              </div>
            </div>
          }
          @if (display.displayMap(displayedWalk.walk)) {
            <div class="row">
              <div class="col-sm-12">
                @if (display.mapViewReady(googleMapsUrl) && showGoogleMapsView) {
                  <iframe allowfullscreen class="map-walk-view map-walk-view-google"
                    style="border:0;border-radius: 10px;"
                  [src]="googleMapsUrl"></iframe>
                }
                @if (!showGoogleMapsView) {
                  <div app-map-edit class="map-walk-view" readonly
                    [locationDetails]="mapDisplay==MapDisplay.SHOW_START_POINT? displayedWalk?.walk?.start_location:displayedWalk?.walk?.end_location"
                  [notify]="notify"></div>
                }
              </div>
            </div>
            <form class="rounded img-thumbnail map-radio-frame">
              <label class="ml-2 mr-2 font-weight-bold">Show Map As
                <div class="custom-control custom-radio custom-control-inline ml-2">
                  <input class="custom-control-input" type="radio" name="mapView" [(ngModel)]="showGoogleMapsView"
                    id="{{displayedWalk.walk.id}}-pin-view-mode-start"
                    [value]="false" (ngModelChange)="configureMapDisplay()">
                  <label class="custom-control-label" for="{{displayedWalk.walk.id}}-pin-view-mode-start">
                  Pin Location View</label>
                </div>
                <div class="custom-control custom-radio custom-control-inline">
                  <input class="custom-control-input" type="radio" name="mapView" [(ngModel)]="showGoogleMapsView"
                    id="{{displayedWalk.walk.id}}-google-maps-mode-start"
                    [value]="true" (ngModelChange)="configureMapDisplay()">
                  <label class="custom-control-label" for="{{displayedWalk.walk.id}}-google-maps-mode-start">
                  Google Maps</label>
                </div>
              </label>
              <div class="col-sm-12 ml-2 mr-2">
                <div class="custom-control custom-radio custom-control-inline">
                  <input class="custom-control-input" id="{{displayedWalk.walk.id}}-show-start-point"
                    type="radio"
                    [ngModel]="mapDisplay" name="mapDisplay"
                    (ngModelChange)="changeMapView($event)"
                    [value]="MapDisplay.SHOW_START_POINT"/>
                  <label class="custom-control-label" for="{{displayedWalk.walk.id}}-show-start-point">
                  At start point {{ displayedWalk?.walk?.start_location?.postcode }}</label>
                </div>
                @if (displayedWalk?.walk?.end_location?.postcode) {
                  <div
                    class="custom-control custom-radio custom-control-inline">
                    <input class="custom-control-input" id="{{displayedWalk.walk.id}}-show-end-point"
                      type="radio"
                      [ngModel]="mapDisplay" name="mapDisplay"
                      (ngModelChange)="changeMapView($event)"
                      [value]="MapDisplay.SHOW_END_POINT"/>
                    <label class="custom-control-label" for="{{displayedWalk.walk.id}}-show-end-point">
                    At finish point {{ displayedWalk?.walk?.end_location?.postcode }}</label>
                  </div>
                }
                @if (this.showGoogleMapsView) {
                  <div class="custom-control custom-radio custom-control-inline">
                    <input id="{{displayedWalk.walk.id}}-show-driving-directions"
                      type="radio"
                      class="custom-control-input align-middle"
                      (ngModelChange)="changeMapView($event)"
                      [ngModel]="mapDisplay" name="mapDisplay"
                      [value]="MapDisplay.SHOW_DRIVING_DIRECTIONS"/>
                    <label class="custom-control-label text-nowrap align-middle"
                      [ngClass]="{'postcode-label-second-line' : displayedWalk?.walk?.end_location?.postcode}"
                      for="{{displayedWalk.walk.id}}-show-driving-directions">
                    Driving from</label>
                    <input class="form-control input-sm text-uppercase ml-2 postcode-input align-middle"
                      [ngClass]="{'postcode-input-second-line' : displayedWalk?.walk?.end_location?.postcode}"
                      [ngModel]="fromPostcode" name="fromPostcode"
                      (ngModelChange)="changeFromPostcode($event)"
                      type="text">
                  </div>
                }
              </div>
            </form>
            <app-walk-details [displayedWalk]="displayedWalk"></app-walk-details>
          }
        </div>
      </div>
    </div>
    }`,
    styleUrls: ["./walk-view.sass"],
    imports: [WalkPanelExpanderComponent, TooltipDirective, MarkdownComponent, WalkLeaderComponent, WalkFeaturesComponent, RelatedLinkComponent, FontAwesomeModule, CopyIconComponent, RouterLink, WalkImagesComponent, MapEditComponent, FormsModule, NgClass, WalkDetailsComponent, DisplayDayPipe, VenueIconPipe]
})

export class WalkViewComponent implements OnInit, OnDestroy {


  @Input("displayedWalk") set init(displayedWalk: DisplayedWalk) {
    this.applyWalk(displayedWalk);
  }
  public walkIdOrPath: string;
  public pathContainsWalkId: boolean;
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
  public walksQueryService = inject(WalksQueryService);
  private walksService = inject(WalksService);
  public googleMapsService = inject(GoogleMapsService);
  private authService = inject(AuthService);
  private memberLoginService = inject(MemberLoginService);
  public display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  public meetupService = inject(MeetupService);
  private urlService = inject(UrlService);
  protected stringUtils = inject(StringUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  private logger = inject(LoggerFactory).createLogger("WalkViewComponent", NgxLoggerLevel.ERROR);
  protected notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  public showGoogleMapsView = false;
  protected readonly MapDisplay = MapDisplay;

  ngOnInit() {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.allowWalkAdminEdits = this.display.walkPopulationLocal() && this.memberLoginService.allowWalkAdminEdits();
    this.refreshHomePostcode();
    this.pathContainsWalkId = this.urlService.pathContainsEventId();
    this.walkIdOrPath = this.urlService.lastPathSegment();
    this.logger.info("initialised with walk", this.displayedWalk, "pathContainsWalkId:", this.pathContainsWalkId, "walkIdOrPath:", this.walkIdOrPath);
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
    this.updateGoogleMapIfApplicable();
  }

  queryIfRequired(): void {
    if (this.pathContainsWalkId) {
      this.walksService.getByIdIfPossible(this.walkIdOrPath)
        .then((walk: Walk) => {
          if (walk) {
            this.logger.info("Walk found:", walk);
            this.applyWalk(this.display.toDisplayedWalk(walk));
          } else {
            this.logger.warn("Walk not found:", this.walkIdOrPath)
            this.notify.warning({
              title: "Walk not found",
              message: "Content for this walk doesnt exist"
            });
          }
        });
    }
  }

  private applyWalk(displayedWalk: DisplayedWalk) {
    if (displayedWalk) {
      this.displayedWalk = displayedWalk;
      this.displayLinks = !!(this.displayedWalk.walk.meetupEventUrl || this.displayedWalk.walk.osMapsRoute || this.displayedWalk.walk.osMapsRoute || this.displayedWalk.walk.ramblersWalkId || this.displayedWalk.walkLink);
      this.configureMapDisplay();
    }
    this.notify.success({
      title: `Single ${this.display.eventTypeTitle(this.displayedWalk?.walk)} showing`,
      message: " - "
    });
  }

  updateGoogleMapIfApplicable() {
    if (this.showGoogleMapsView) {
      if (this.display.shouldShowFullDetails(this.displayedWalk)) {
      this.googleMapsUrl = this.display.googleMapsUrl(!this.drivingDirectionsDisabled() && this.showDrivingDirections(), this.fromPostcode, this.showEndPoint() ? this.displayedWalk?.walk?.end_location?.postcode : this.displayedWalk?.walk?.start_location?.postcode);
      this.logger.info("updateGoogleMap:Should show details - rendering googleMapsUrl:", this.googleMapsUrl);
        this.toggleGoogleOrLeafletMapViewAndBack();
    } else {
      this.logger.warn("updateGoogleMap:Should not show details for walk:", this.displayedWalk);
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

  durationInFutureFor(walk: Walk) {
    return walk?.walkDate === this.dateUtils.momentNowNoTime().valueOf() ? "today"
      : (this.dateUtils.asMoment(this.dateUtils.startTime(walk)).fromNow());
  }

  changeMapView(newValue: MapDisplay) {
    this.logger.info("changeShowDrivingDirections:", newValue);
    this.mapDisplay = newValue;
    this.updateGoogleMapIfApplicable();
  }

  changeFromPostcode(fromPostcode: string) {
    this.logger.info("changeFromPostcode:", fromPostcode);
    this.fromPostcode = fromPostcode;
    this.autoSelectMapDisplay();
    this.updateGoogleMapIfApplicable();
  }
}
