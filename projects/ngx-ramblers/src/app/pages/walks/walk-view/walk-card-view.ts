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
import { SystemConfig } from "../../../models/system.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { faEnvelope, faEye, faPencil, faPhone } from "@fortawesome/free-solid-svg-icons";
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
import { EventLeaderContactLinkComponent } from "./event-leader-contact-link";
import { EventLeaderPhoneLinkComponent } from "./event-leader-phone-link";
import { WalkStatus } from "../../../models/ramblers-walks-manager";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-walk-card-view",
  template: `
    <div (click)="toggleView()">
      <app-card-image-or-map [displayedWalk]="displayedWalk" [notify]="notify" [maxColumns]="maxColumns"/>
      <div class="card-body">
        <h3 class="card-title">
          <a (click)="ignoreClicks($event)" [routerLink]="display.walkRouterLink(displayedWalk?.walk)" class="rams-text-decoration-pink active">
            {{ displayedWalk.walk?.groupEvent?.title || displayedWalk.latestEventType.description }}
          </a>
        </h3>
        @if (displayedWalk.walk?.groupEvent?.status === WalkStatus.CANCELLED) {
          <div class="alert alert-warning mb-2">
            <strong>This walk has been cancelled</strong>
            @if (displayedWalk.walk?.groupEvent?.cancellation_reason) {
              <p class="mb-0 mt-1">{{ displayedWalk.walk?.groupEvent?.cancellation_reason }}</p>
            }
          </div>
        }
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
            <dl (click)="ignoreClicks($event)" class="d-flex mb-1">
              <dt class="font-weight-bold me-2">Leader:</dt>
              <dd>
                <div class="row g-0">
                  @if (displayedWalk?.walk?.fields?.contactDetails?.email) {
                    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-6 nowrap">
                      <app-copy-icon [icon]="faEnvelope" title
                                     [disabled]="display.isContactUsContact(displayedWalk?.walk)"
                                     [value]="displayedWalk?.walk?.fields?.contactDetails?.email"
                                     [elementName]="'email address for '+ displayedWalk?.walk?.fields?.contactDetails?.displayName"/>
                      <div content>
                        <app-event-leader-contact-link [walk]="displayedWalk.walk" fallbackLabel="Contact Via Ramblers"/>
                      </div>
                    </div>
                  }
                  @if (display.walkContactDetailsPublic()) {
                    @if (displayedWalk?.walk?.fields?.contactDetails?.phone) {
                      <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                           class="col-sm-6 col-md-12">
                        <app-copy-icon [icon]="faPhone" title
                                       [value]="displayedWalk?.walk?.fields?.contactDetails?.phone"
                                       [elementName]="'mobile number for '+ displayedWalk?.walk?.fields?.contactDetails?.displayName "/>
                        <div content>
                          <app-event-leader-phone-link
                            [phone]="displayedWalk?.walk?.fields?.contactDetails?.phone"
                            [displayName]="displayedWalk?.walk?.fields?.contactDetails?.displayName"/>
                        </div>
                      </div>
                    } @else if (!displayedWalk?.walk?.fields?.contactDetails?.email) {
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
                </div>
              </dd>
            </dl>
          }
        }
        @if (display.walkPopulationLocal() && displayedWalk.status !== EventType.APPROVED) {
          <div id="{{displayedWalk?.walk?.id}}-status"
               class="badge event-badge sunset-badge ms-0">{{ displayedWalk?.latestEventType?.description }}
          </div>
        }
      </div>
    </div>`,
  styleUrls: ["./walk-view.sass", "../../../modules/common/card/image/card-image.sass"],
  styles: [`
    .card-body
      position: relative
      padding-bottom: 50px
  `],
  imports: [WalkGradingComponent, TooltipDirective, RelatedLinkComponent, FontAwesomeModule, CopyIconComponent, DisplayDatePipe, DisplayTimePipe, CardImageOrMap, RouterLink, EventLeaderContactLinkComponent, EventLeaderPhoneLinkComponent]
})

export class WalkCardViewComponent implements OnInit, OnDestroy {

  public notifyTarget: AlertTarget = {};
  private subscriptions: Subscription[] = [];
  public mediaQueryService: MediaQueryService = inject(MediaQueryService);
  public googleMapsService = inject(GoogleMapsService);
  protected memberLoginService = inject(MemberLoginService);
  public display = inject(WalkDisplayService);
  public meetupService = inject(MeetupService);
  protected stringUtils = inject(StringUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
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
  protected readonly faEye = faEye;
  protected readonly faPencil = faPencil;
  protected readonly EventType = EventType;
  protected readonly WalkStatus = WalkStatus;
  protected readonly faPersonWalking = faPersonWalking;

  ngOnInit() {
    this.logger.info("initialised with displayedWalk", this.displayedWalk, "cardImageClass:", this.cardImageClass);
    this.subscriptions.push(this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => {
      this.logger.debug("systemConfigService returned systemConfig:", systemConfig);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
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
