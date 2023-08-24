import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { LoginResponse } from "../../../models/member.model";
import { DisplayedWalk, Walk } from "../../../models/walk.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MeetupService } from "../../../services/meetup.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { WalksService } from "../../../services/walks/walks.service";
import { WalkDisplayService } from "../walk-display.service";

const SHOW_START_POINT = "show-start-point";
const SHOW_DRIVING_DIRECTIONS = "show-driving-directions";

@Component({
  selector: "app-walk-view",
  templateUrl: "./walk-view.html",
  styleUrls: ["./walk-view.sass"],
  changeDetection: ChangeDetectionStrategy.Default
})

export class WalkViewComponent implements OnInit, OnDestroy {

  @Input("displayedWalk")
  set init(displayedWalk: DisplayedWalk) {
    this.applyWalk(displayedWalk);
  }

  public walkIdOrPath: string;
  public pathContainsMongoId: boolean;
  public displayedWalk: DisplayedWalk;
  public displayLinks: boolean;
  fromPostcode = "";
  mapDisplay = SHOW_START_POINT;
  private logger: Logger;
  public allowWalkAdminEdits: boolean;
  public googleMapsUrl: SafeResourceUrl;
  public loggedIn: boolean;
  private subscriptions: Subscription[] = [];
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};

  constructor(
    private route: ActivatedRoute,
    private walksService: WalksService,
    public googleMapsService: GoogleMapsService,
    private authService: AuthService,
    private memberLoginService: MemberLoginService,
    public display: WalkDisplayService,
    private dateUtils: DateUtilsService,
    public meetupService: MeetupService,
    private urlService: UrlService,
    private notifierService: NotifierService,
    private changeDetectorRef: ChangeDetectorRef,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkViewComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.allowWalkAdminEdits = this.memberLoginService.allowWalkAdminEdits();
    this.refreshHomePostcode();
    this.pathContainsMongoId = this.urlService.pathContainsMongoId();
    this.walkIdOrPath = this.urlService.lastPathSegment();
    this.logger.debug("initialised with walk", this.displayedWalk, "pathContainsMongoId:", this.pathContainsMongoId, "walkIdOrPath:", this.walkIdOrPath);
    this.queryIfRequired();
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => {
      this.logger.debug("loginResponseObservable:", loginResponse);
      this.display.refreshCachedData();
      this.loggedIn = loginResponse.memberLoggedIn;
      this.allowWalkAdminEdits = this.memberLoginService.allowWalkAdminEdits();
      this.refreshHomePostcode();
    }));
    this.notify.success({
      title: "Single walk showing",
      message: " - "
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  queryIfRequired(): void {
    if (this.pathContainsMongoId) {
      this.walksService.getByIdIfPossible(this.walkIdOrPath)
        .then((walk: Walk) => {
          if (walk) {
            this.applyWalk(this.display.toDisplayedWalk(walk));
          } else {
            this.notify.warning({
              title: "Walk not found",
              message: "Content for this walk doesnt exist"
            });
          }
        });
    } else {
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
      this.googleMapsUrl = this.display.googleMapsUrl(this.displayedWalk?.walk,
        !this.drivingDirectionsDisabled() && this.mapDisplay === SHOW_DRIVING_DIRECTIONS, this.fromPostcode);
    }
  }

  refreshHomePostcode() {
    this.changeFromPostcode(this.memberLoginService.memberLoggedIn() ? this.memberLoginService.loggedInMember().postcode : "");
  }

  autoSelectMapDisplay() {
    const switchToShowStartPoint = this.drivingDirectionsDisabled() && this.mapDisplay === SHOW_DRIVING_DIRECTIONS;
    const switchToShowDrivingDirections = !this.drivingDirectionsDisabled() && this.mapDisplay === SHOW_START_POINT;
    if (switchToShowStartPoint) {
      this.mapDisplay = SHOW_START_POINT;
    } else if (switchToShowDrivingDirections) {
      this.mapDisplay = SHOW_DRIVING_DIRECTIONS;
    }
    this.logger.info("autoSelectMapDisplay:mapDisplay:", this.mapDisplay);
  }

  showDrivingDirections(): boolean {
    return this.mapDisplay === SHOW_DRIVING_DIRECTIONS;
  }

  drivingDirectionsDisabled() {
    return this.fromPostcode.length < 3;
  }

  durationInFutureFor(walk: Walk) {
    return walk && walk.walkDate === this.dateUtils.momentNowNoTime().valueOf() ? "today"
      : (this.dateUtils.asMoment(walk.walkDate).fromNow());
  }

  refreshView() {
    this.logger.debug("refreshing view");
    this.updateGoogleMap();
  }

  changeShowDrivingDirections(newValue: string) {
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
