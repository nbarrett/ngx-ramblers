import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { LoginResponse } from "../../../models/member.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Organisation } from "../../../models/system.model";
import { LoginModalComponent } from "../../login/login-modal/login-modal.component";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { WalkGroupComponent } from "./walk-group";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { JsonPipe } from "@angular/common";

@Component({
    selector: "app-walk-leader",
    template: `
      <div class="event-panel rounded event-panel-inner">
        <app-walk-group [displayedWalk]="displayedWalk"/>
        <h1>{{ display.isWalk(displayedWalk.walk) ? 'Walk Leader' : (display.eventTypeTitle(displayedWalk.walk) + " Organiser") }}</h1>
        <div>
          <div class="row">
            @if (display.walkPopulationWalksManager()) {
              <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                <fa-icon title
                         tooltip="contact walk leader {{displayedWalk?.walk?.fields?.contactDetails?.displayName}}"
                         [icon]="faEnvelope"
                         class="fa-icon mr-1 pointer"></fa-icon>
                <a content
                   [href]="displayedWalk?.walk?.fields?.contactDetails?.email">{{ displayedWalk?.walk?.fields?.contactDetails?.displayName || "Contact Via Ramblers" }}</a>
              </div>
            }
            @if (!display.walkPopulationWalksManager()) {
              @if (displayedWalk?.walk?.fields?.contactDetails?.email) {
                <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth"
                     class="col-sm-12">
                  <app-copy-icon [disabled]="!loggedIn" [icon]="faEnvelope" title
                                 [value]="displayedWalk?.walk?.fields?.contactDetails?.email"
                                 [elementName]="'email address for '+ displayedWalk?.walk?.fields?.contactDetails?.displayName"></app-copy-icon>
                  <div content>
                    @if (loggedIn) {
                      <a [href]="'mailto:' + displayedWalk?.walk?.fields?.contactDetails?.email"
                         tooltip="Click to email {{displayedWalk?.walk?.fields?.contactDetails?.displayName}}">
                        {{ displayedWalk?.walk?.fields?.contactDetails?.displayName }}
                      </a>
                    }
                    @if (!loggedIn) {
                      <span (click)="login()" class="tooltip-link span-margin"
                            trigger="mouseenter"
                            tooltip="Login as an {{group?.shortName}} member and send an email to {{displayedWalk?.walk?.fields?.contactDetails?.displayName}}">
                    {{ displayedWalk?.walk?.fields?.contactDetails?.displayName }}</span>
                    }</div>
                </div>
              }
              @if (loggedIn) {
                <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                  <app-copy-icon [icon]="faPhone" title [value]="displayedWalk?.walk?.fields?.contactDetails?.phone"
                                 [elementName]="'mobile number for '+ displayedWalk?.walk?.fields?.contactDetails?.displayName "></app-copy-icon>
                  <a content [href]="'tel:' + displayedWalk?.walk?.fields?.contactDetails?.phone"
                     tooltip="Click to ring {{displayedWalk?.walk?.fields?.contactDetails?.displayName}} on {{displayedWalk?.walk?.fields?.contactDetails?.phone}} (mobile devices only)">
                    {{ displayedWalk?.walk?.fields?.contactDetails?.phone }}
                  </a>
                </div>
              }
            }
          </div>
        </div>
      </div>`,
  imports: [WalkGroupComponent, RelatedLinkComponent, FontAwesomeModule, TooltipDirective, CopyIconComponent]
})

export class WalkLeaderComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkLeaderComponent", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private modalService = inject(BsModalService);
  private systemConfigService = inject(SystemConfigService);
  private authService = inject(AuthService);
  display = inject(WalkDisplayService);
  faEnvelope = faEnvelope;
  faPhone = faPhone;
  public loggedIn: boolean;
  private subscriptions: Subscription[] = [];

  @Input()
  public displayedWalk: DisplayedWalk;
  public group: Organisation;
  public config: ModalOptions = {
    animated: false,
    initialState: {}
  };

  ngOnInit(): void {
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.debug("initialised with walk", this.displayedWalk, "loggedIn:", this.loggedIn);
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => {
      this.logger.debug("loginResponseObservable:", loginResponse);
      this.display.refreshCachedData();
      this.loggedIn = loginResponse?.memberLoggedIn;
    }));
  }

  login() {
    this.modalService.show(LoginModalComponent, this.config);
  }


  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
