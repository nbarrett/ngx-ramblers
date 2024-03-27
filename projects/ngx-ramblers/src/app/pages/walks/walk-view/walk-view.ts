import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { ALERT_WARNING, AlertTarget } from "../../../models/alert-target.model";
import { LoginResponse } from "../../../models/member.model";
import { DisplayedWalk, MapDisplay, Walk } from "../../../models/walk.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MeetupService } from "../../../services/meetup.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { WalksService } from "../../../services/walks/walks.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { SystemConfig } from "../../../models/system.model";
import { WalksQueryService } from "../../../services/walks/walks-query.service";

@Component({
  selector: "app-walk-view",
  templateUrl: "./walk-view.html",
  styleUrls: ["./walk-view.sass"],
  changeDetection: ChangeDetectionStrategy.Default
})

export class WalkViewComponent implements OnInit, OnDestroy {

  @Input("displayedWalk") set init(displayedWalk: DisplayedWalk) {
    this.applyWalk(displayedWalk);
  }

  constructor(
    public walksQueryService: WalksQueryService,
    private walksService: WalksService,
    public googleMapsService: GoogleMapsService,
    private authService: AuthService,
    private memberLoginService: MemberLoginService,
    public display: WalkDisplayService,
    private dateUtils: DateUtilsService,
    public meetupService: MeetupService,
    private urlService: UrlService,
    private systemConfigService: SystemConfigService,
    private notifierService: NotifierService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkViewComponent", NgxLoggerLevel.OFF);
  }

  public walkIdOrPath: string;
  public pathContainsWalkId: boolean;
  public displayedWalk: DisplayedWalk;
  public displayLinks: boolean;
  public fromPostcode = "";
  public mapDisplay: MapDisplay = MapDisplay.SHOW_START_POINT;
  private logger: Logger;
  public allowWalkAdminEdits: boolean;
  public googleMapsUrl: SafeResourceUrl;
  public loggedIn: boolean;
  private subscriptions: Subscription[] = [];
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};

  protected readonly ALERT_WARNING = ALERT_WARNING;

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.allowWalkAdminEdits = this.memberLoginService.allowWalkAdminEdits();
    this.refreshHomePostcode();
    this.pathContainsWalkId = this.urlService.pathContainsWalkId();
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
      this.loggedIn = loginResponse.memberLoggedIn;
      this.allowWalkAdminEdits = this.memberLoginService.allowWalkAdminEdits();
      this.refreshHomePostcode();
      this.updateGoogleMap();
    }));
    this.googleMapsService.events().subscribe(config => {
      this.logger.info("event received:", config);
      this.updateGoogleMap();
    });
    this.notify.success({
      title: "Single walk showing",
      message: " - "
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  queryIfRequired(): void {
    if (this.pathContainsWalkId) {
      this.walksService.getByIdIfPossible(this.walkIdOrPath)
        .then((walk: Walk) => {
          if (walk) {
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
      this.updateGoogleMap();
    }
  }

  updateGoogleMap() {
    if (this.display.shouldShowFullDetails(this.displayedWalk)) {
      this.googleMapsUrl = this.display.googleMapsUrl(!this.drivingDirectionsDisabled() && this.showDrivingDirections(), this.fromPostcode, this.showEndPoint() ? this.displayedWalk?.walk.postcodeFinish : this.displayedWalk?.walk.postcode);
      this.logger.info("Should show details - rendering googleMapsUrl:", this.googleMapsUrl);
    } else {
      this.logger.warn("Should not show details for walk:", this.displayedWalk);
    }
  }

  refreshHomePostcode() {
    this.changeFromPostcode(this.memberLoginService.memberLoggedIn() ? this.memberLoginService.loggedInMember().postcode : "");
  }

  autoSelectMapDisplay() {
    const switchToShowStartPoint = this.drivingDirectionsDisabled() && this.showDrivingDirections();
    const switchToShowDrivingDirections = this.validFromPostcodeEntered() && !this.showDrivingDirections();
    this.logger.info("autoSelectMapDisplay on entering: drivingDirectionsDisabled:", this.drivingDirectionsDisabled(), "switchToShowStartPoint:", switchToShowStartPoint, "switchToShowDrivingDirections:", switchToShowDrivingDirections, "mapDisplay:", this.mapDisplay, "fromPostcode:", this.fromPostcode);
    if (switchToShowStartPoint) {
      this.mapDisplay = MapDisplay.SHOW_START_POINT;
    } else if (switchToShowDrivingDirections) {
      this.mapDisplay = MapDisplay.SHOW_DRIVING_DIRECTIONS;
    }
    this.logger.info("autoSelectMapDisplay:mapDisplay:", this.mapDisplay);
  }

  showDrivingDirections(): boolean {
    return this.mapDisplay === MapDisplay.SHOW_DRIVING_DIRECTIONS;
  }

  showEndPoint(): boolean {
    return this.mapDisplay === MapDisplay.SHOW_END_POINT;
  }

  drivingDirectionsDisabled() {
    return !this.validFromPostcodeEntered();
  }

  validFromPostcodeEntered() {
    return this.fromPostcode?.length >= 3;
  }

  durationInFutureFor(walk: Walk) {
    return walk && walk.walkDate === this.dateUtils.momentNowNoTime().valueOf() ? "today"
      : (this.dateUtils.asMoment(walk.walkDate).fromNow());
  }

  changeMapView(newValue: MapDisplay) {
    this.logger.info("changeShowDrivingDirections:", newValue);
    this.mapDisplay = newValue;
    this.updateGoogleMap();
  }

  changeFromPostcode(fromPostcode: string) {
    this.logger.info("changeFromPostcode:", fromPostcode);
    this.fromPostcode = fromPostcode;
    this.autoSelectMapDisplay();
    this.updateGoogleMap();
  }
}
