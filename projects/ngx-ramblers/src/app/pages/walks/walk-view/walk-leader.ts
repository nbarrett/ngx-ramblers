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
import { RelatedLinkComponent } from "../../../modules/common/related-link/related-link.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";

@Component({
    selector: "app-walk-leader",
    templateUrl: "./walk-leader.html",
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
