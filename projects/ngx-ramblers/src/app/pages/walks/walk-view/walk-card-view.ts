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

@Component({
  selector: "app-walk-card-view",
  template: `
    <div (click)="toggleView()">
      <input
        *ngIf="display.walkPopulationLocal() && memberLoginService.memberLoggedIn() && displayedWalk?.walkAccessMode?.walkWritable"
        id="walkAction-{{displayedWalk.walk.id}}" type="submit"
        value="{{displayedWalk?.walkAccessMode?.caption}}"
        (click)="display.edit(displayedWalk)"
        class="btn btn-primary button-container">
      <div *ngIf="display.displayMapAsImageFallback(displayedWalk.walk)" app-map-edit
           readonly
           class="map-card-image"
           [locationDetails]="displayedWalk.walk.start_location"
           [notify]="notify"></div>
      <img *ngIf="display.displayImage(displayedWalk.walk)"
           src="{{mediaQueryService.imageSourceWithFallback(displayedWalk.walk).url}}"
           alt="{{mediaQueryService.imageSourceWithFallback(displayedWalk.walk).alt}}" height="150"
           class="card-img-top"/>
      <div class="card-body">
        <h3 class="card-title">
          <a [href]="displayedWalk.walkLink" class="rams-text-decoration-pink active"
             target="_self">{{ displayedWalk.walk.briefDescriptionAndStartPoint || displayedWalk.latestEventType.description }}</a>
        </h3>
        <dl class="d-flex mb-2">
          <dt class="font-weight-bold mr-2">Start:</dt>
          <time>{{ displayedWalk.walk.walkDate | displayDate }} {{ displayedWalk.walk.startTime }}</time>
        </dl>
        <ng-container *ngIf="display.notAwaitingLeader(displayedWalk.walk)">
          <dl *ngIf="displayedWalk.walk?.grade" class="d-flex mb-1">
            <dt class="font-weight-bold mr-2">Difficulty:</dt>
            <dd>
              <app-walk-grading [grading]="displayedWalk.walk.grade"/>
            </dd>
          </dl>
          <dl *ngIf="displayedWalk.walk?.distance" class="d-flex mb-1">
            <dt class="font-weight-bold mr-2">Distance:</dt>
            <dd>{{ displayedWalk.walk.distance }}</dd>
          </dl>
          <dl *ngIf="displayedWalk?.walk?.start_location?.postcode" (click)="ignoreClicks($event)" class="d-flex mb-1">
            <dt class="font-weight-bold mr-2">Postcode:</dt>
            <dd><a class="rams-text-decoration-pink"
                   tooltip="Click to locate postcode {{displayedWalk?.walk?.start_location?.postcode}} on Google Maps"
                   [href]="googleMapsService.urlForPostcode(displayedWalk?.walk?.start_location?.postcode)"
                   target="_blank">
              {{ displayedWalk?.walk?.start_location?.postcode }}</a></dd>
          </dl>
          <dl class="d-flex mb-1">
            <dt class="font-weight-bold mr-2">Leader:</dt>
            <dd>
              <div class="row no-gutters">
                <ng-container *ngIf="display.walkPopulationWalksManager()">
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-6 nowrap">
                    <fa-icon title tooltip="contact walk leader {{displayedWalk?.walk?.displayName}}"
                             [icon]="faEnvelope"
                             class="fa-icon mr-1 pointer"/>
                    <a content
                       [href]="displayedWalk?.walk?.contactEmail">{{ displayedWalk?.walk?.displayName || "Contact Via Ramblers" }}</a>
                  </div>
                </ng-container>
                <ng-container *ngIf="!display.walkPopulationWalksManager()">
                  <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                       *ngIf="displayedWalk?.walk?.contactEmail" class="col-sm-6 col-md-12">
                    <app-copy-icon [disabled]="!loggedIn" [icon]="faEnvelope" title
                                   [value]="displayedWalk?.walk?.contactEmail"
                                   [elementName]="'email address for '+ displayedWalk?.walk?.displayName"/>
                    <div content>
                      <a *ngIf="loggedIn" class="nowrap" [href]="'mailto:' + displayedWalk?.walk?.contactEmail"
                         tooltip="Click to email {{displayedWalk?.walk?.displayName}}">
                        {{ displayedWalk?.walk?.displayName }}
                      </a>
                      <div (click)="login()" *ngIf="!loggedIn" class="tooltip-link span-margin"
                           trigger="mouseenter"
                           tooltip="Login as an {{group?.shortName}} member and send an email to {{displayedWalk?.walk?.displayName}}">
                        {{ displayedWalk?.walk?.displayName }}
                      </div>
                    </div>
                  </div>
                  <div *ngIf="loggedIn" app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                       class="col-sm-6  col-md-12">
                    <app-copy-icon [icon]="faPhone" title [value]="displayedWalk?.walk?.contactPhone"
                                   [elementName]="'mobile number for '+ displayedWalk?.walk?.displayName "/>
                    <a content [href]="'tel:' + displayedWalk?.walk?.contactPhone" class="nowrap"
                       tooltip="Click to ring {{displayedWalk?.walk?.displayName}} on {{displayedWalk?.walk?.contactPhone}} (mobile devices only)">
                      {{ displayedWalk?.walk?.contactPhone }}
                    </a>
                  </div>
                </ng-container>
              </div>
            </dd>
          </dl>
        </ng-container>
      </div>
    </div>`,
  styleUrls: ["./walk-view.sass"],
  styles: [`
    .button-container
      position: absolute
      top: 10px
      right: 10px
      z-index: 10000

    .card-body
      position: relative
      padding-bottom: 50px
  `],
  standalone: false
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
  private logger = inject(LoggerFactory).createLogger("WalkCardViewComponent", NgxLoggerLevel.ERROR);
  protected notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  @Input() displayedWalk!: DisplayedWalk;
  @Input() index!: number;
  protected readonly faPhone = faPhone;
  protected readonly faEnvelope = faEnvelope;
  protected readonly EventType = EventType;

  ngOnInit() {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.debug("initialised with currentPageWalks", this.displayedWalk);
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
