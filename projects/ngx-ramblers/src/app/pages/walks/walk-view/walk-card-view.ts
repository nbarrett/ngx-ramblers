import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DisplayedWalk, EventType, WalkViewMode } from "../../../models/walk.model";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MeetupService } from "../../../services/meetup.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Organisation, SystemConfig } from "../../../models/system.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { LoginModalComponent } from "../../login/login-modal/login-modal.component";
import { LoginResponse } from "../../../models/member.model";
import { AuthService } from "../../../auth/auth.service";
import { WalkGradingComponent } from "./walk-grading";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { DisplayTimePipe } from "../../../pipes/display-time.pipe";
import { AscentValidationService } from "../../../services/walks/ascent-validation.service";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { CardImageOrMap } from "../../../modules/common/card/image/card-image-or-map";
import { faPersonWalking } from "@fortawesome/free-solid-svg-icons/faPersonWalking";

@Component({
    selector: "app-walk-card-view",
    template: `
      <div (click)="toggleView()">
        <app-card-image-or-map [displayedWalk]="displayedWalk" [notify]="notify" [maxColumns]="maxColumns"/>
        <div class="card-body">
          <h3 class="card-title">
            <a [href]="displayedWalk.walkLink" class="rams-text-decoration-pink active"
               target="_self">{{ displayedWalk.walk?.groupEvent?.title || displayedWalk.latestEventType.description }}</a>
          </h3>
          <dl class="d-flex mb-2">
            <dt class="font-weight-bold me-2">Start:</dt>
            <time>{{ displayedWalk.walk?.groupEvent?.start_date_time | displayDate }} {{ displayedWalk.walk?.groupEvent?.start_date_time | displayTime }}</time>
          </dl>
          @if (display.notAwaitingLeader(displayedWalk.walk)) {
            @if (displayedWalk.walk?.groupEvent?.difficulty) {
              <dl class="d-flex mb-1">
                <dt class="font-weight-bold me-2">Difficulty:</dt>
                <dd>
                  <app-walk-grading [grading]="displayedWalk.walk?.groupEvent?.difficulty.code"/>
                </dd>
              </dl>
            }
            @if (displayedWalk.walk?.groupEvent?.distance_miles) {
              <dl class="d-flex mb-1">
                <dt class="font-weight-bold me-2">Distance:</dt>
                <dd>{{ distanceValidationService.walkDistances(displayedWalk.walk) }}</dd>
              </dl>
            }
            @if (displayedWalk?.walk?.groupEvent?.ascent_feet) {
              <dl class="d-flex mb-1">
                <dt class="font-weight-bold me-2">Ascent:</dt>
                <dd>{{ ascentValidationService.walkAscents(displayedWalk.walk) }}</dd>
              </dl>
            }
            @if (displayedWalk?.walk?.groupEvent?.start_location?.postcode) {
              <dl (click)="ignoreClicks($event)" class="d-flex mb-1">
                <dt class="font-weight-bold me-2">Postcode:</dt>
                <dd><a class="rams-text-decoration-pink"
                       tooltip="Click to locate postcode {{displayedWalk?.walk?.groupEvent?.start_location?.postcode}} on Google Maps"
                       [href]="googleMapsService.urlForPostcode(displayedWalk?.walk?.groupEvent?.start_location?.postcode)"
                       target="_blank">
                  {{ displayedWalk?.walk?.groupEvent?.start_location?.postcode }}</a></dd>
              </dl>
            }
            @if (display.hasWalkLeader(displayedWalk.walk)) {
              <dl class="d-flex mb-1">
                <dt class="font-weight-bold me-2">Leader:</dt>
                <dd>
                  <div class="row g-0">
                    @if (display.walkPopulationWalksManager()) {
                      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-6 nowrap">
                        <fa-icon title
                                 tooltip="contact walk leader {{displayedWalk?.walk?.fields?.contactDetails?.displayName}}"
                                 [icon]="faEnvelope"
                                 class="fa-icon me-1 pointer"/>
                        <a content
                           [href]="displayedWalk?.walk?.fields?.contactDetails?.email">{{ displayedWalk?.walk?.fields?.contactDetails?.displayName || "Contact Via Ramblers" }}</a>
                      </div>
                    }
                    @if (!display.walkPopulationWalksManager()) {
                      @if (displayedWalk?.walk?.fields?.contactDetails?.email) {
                        <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                             class="col-sm-6 col-md-12">
                          <app-copy-icon [disabled]="!loggedIn" [icon]="faEnvelope" title
                                         [value]="displayedWalk?.walk?.fields?.contactDetails?.email"
                                         [elementName]="'email address for '+ displayedWalk?.walk?.fields?.contactDetails?.displayName"/>
                          <div content>
                            @if (loggedIn) {
                              <a class="nowrap" [href]="'mailto:' + displayedWalk?.walk?.fields?.contactDetails?.email"
                                 tooltip="Click to email {{displayedWalk?.walk?.fields?.contactDetails?.displayName}}">
                                {{ displayedWalk?.walk?.fields?.contactDetails?.displayName }}
                              </a>
                            }
                            @if (!loggedIn) {
                              <div (click)="login()" class="tooltip-link span-margin"
                                   tooltip="Login as an {{group?.shortName}} member and send an email to {{displayedWalk?.walk?.fields?.contactDetails?.displayName}}">
                                {{ displayedWalk?.walk?.fields?.contactDetails?.displayName }}
                              </div>
                            }
                          </div>
                        </div>
                      }
                      @if (loggedIn) {
                        @if (displayedWalk?.walk?.fields?.contactDetails?.phone) {
                          <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                               class="col-sm-6  col-md-12">
                            <app-copy-icon [icon]="faPhone" title
                                           [value]="displayedWalk?.walk?.fields?.contactDetails?.phone"
                                           [elementName]="'mobile number for '+ displayedWalk?.walk?.fields?.contactDetails?.displayName "/>
                            <a content [href]="'tel:' + displayedWalk?.walk?.fields?.contactDetails?.phone"
                               class="nowrap"
                               tooltip="Click to ring {{displayedWalk?.walk?.fields?.contactDetails?.displayName}} on {{displayedWalk?.walk?.fields?.contactDetails?.phone}} (mobile devices only)">
                              {{ displayedWalk?.walk?.fields?.contactDetails?.phone }}
                            </a>
                          </div>
                        } @else if (display.hasWalkLeader(displayedWalk.walk)) {
                          <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                            <app-copy-icon [icon]="faPersonWalking" title
                                           [value]="displayedWalk?.walk?.fields?.contactDetails?.displayName"
                                           [elementName]="'walk leader '+ displayedWalk?.walk?.fields?.contactDetails?.displayName"/>
                            <div content>
                              {{ displayedWalk?.walk?.fields?.contactDetails?.displayName }}
                            </div>
                          </div>
                        }
                      }
                    }
                  </div>
                </dd>
              </dl>
            }
            @if (display.walkPopulationLocal() && displayedWalk.status !== EventType.APPROVED) {
              <div id="{{displayedWalk?.walk?.id}}-status"
                   class="badge event-badge sunset-badge ms-0">{{ displayedWalk?.latestEventType?.description }}
              </div>
            }
          }
        </div>
      </div>`,
  styleUrls: ["./walk-view.sass", "../../../modules/common/card/image/card-image.sass"],
    styles: [`
    .card-body
      position: relative
      padding-bottom: 50px
  `],
  imports: [WalkGradingComponent, TooltipDirective, RelatedLinkComponent, FontAwesomeModule, CopyIconComponent, DisplayDatePipe, DisplayTimePipe, CardImageOrMap]
})

export class WalkCardViewComponent implements OnInit, OnDestroy {

  public config: ModalOptions = {
    animated: false,
    initialState: {}
  };
  public group: Organisation;
  public loggedIn: boolean;
  private subscriptions: Subscription[] = [];
  public notifyTarget: AlertTarget = {};
  public mediaQueryService: MediaQueryService = inject(MediaQueryService);
  private modalService: BsModalService = inject(BsModalService);
  public googleMapsService = inject(GoogleMapsService);
  protected memberLoginService = inject(MemberLoginService);
  public display = inject(WalkDisplayService);
  public meetupService = inject(MeetupService);
  protected stringUtils = inject(StringUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  private authService = inject(AuthService);
  public ascentValidationService = inject(AscentValidationService);
  public distanceValidationService = inject(DistanceValidationService);
  private logger = inject(LoggerFactory).createLogger("WalkCardViewComponent", NgxLoggerLevel.ERROR);
  protected notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  @Input() displayedWalk!: DisplayedWalk;
  @Input() index!: number;
  @Input() cardImageClass: string;
  @Input() mapClass: string;
  @Input() maxColumns!: number;
  protected readonly faPhone = faPhone;
  protected readonly faEnvelope = faEnvelope;
  protected readonly EventType = EventType;
  protected readonly faPersonWalking = faPersonWalking;

  ngOnInit() {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.info("initialised with displayedWalk", this.displayedWalk, "cardImageClass:", this.cardImageClass);
    this.subscriptions.push(this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => {
      this.logger.debug("systemConfigService returned systemConfig:", systemConfig);
      this.group = systemConfig.group;
    }));
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => {
      this.logger.debug("loginResponseObservable:", loginResponse);
      this.loggedIn = loginResponse?.memberLoggedIn;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  login() {
    this.modalService.show(LoginModalComponent, this.config);
  }

  toggleView() {
    const viewMode: WalkViewMode = this.display.walkMode(this.displayedWalk.walk);
    this.logger.info("toggling walk from current mode", viewMode);
    const toggleTo = viewMode === WalkViewMode.LIST ? this.display.awaitingLeader(this.displayedWalk.walk) ? WalkViewMode.LIST : WalkViewMode.VIEW_SINGLE : WalkViewMode.LIST;
    this.display.toggleExpandedViewFor(this.displayedWalk.walk, toggleTo);
  }


  ignoreClicks($event: MouseEvent) {
    $event.stopPropagation();
  }
}
