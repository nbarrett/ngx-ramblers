import { Component, OnDestroy, OnInit } from "@angular/core";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../auth/auth.service";
import { Organisation } from "../models/system.model";
import { ForgotPasswordModalComponent } from "../pages/login/forgot-password-modal/forgot-password-modal.component";
import { LoginModalComponent } from "../pages/login/login-modal/login-modal.component";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { MemberLoginService } from "../services/member/member-login.service";
import { RouterHistoryService } from "../services/router-history.service";
import { SystemConfigService } from "../services/system/system-config.service";
import { UrlService } from "../services/url.service";

@Component({
  selector: "app-login-panel",
  templateUrl: "./login-panel.component.html",
  styleUrls: ["./login-panel.component.sass"]
})
export class LoginPanelComponent implements OnInit, OnDestroy {
  private logger: Logger;
  private group: Organisation;
  private subscriptions: Subscription[] = [];
  config: ModalOptions = {
    animated: false,
    initialState: {}
  };

  constructor(private memberLoginService: MemberLoginService,
              private authService: AuthService,
              private modalService: BsModalService,
              private systemConfigService: SystemConfigService,
              private urlService: UrlService,
              private routerHistoryService: RouterHistoryService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("LoginPanelComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit(): void {
    this.subscriptions.push(this.authService.authResponse().subscribe(() => this.routerHistoryService.navigateBackToLastMainPage()));
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.logger.info("received:", item);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  memberLoginStatus() {
    if (this.memberLoginService.memberLoggedIn()) {
      const loggedInMember = this.memberLoginService.loggedInMember();
      return `Logout ${loggedInMember.firstName} ${loggedInMember.lastName}`;
    } else {
      return `Login to ${this?.group?.shortName} Site`;
    }
  }

  loginOrLogout() {
    if (this.memberLoginService.memberLoggedIn()) {
      this.authService.logout();
    } else {
      this.modalService.show(LoginModalComponent, this.config);
    }
  }

  allowEdits() {
    return this.memberLoginService.allowContentEdits();
  }

  forgotPassword() {
    this.modalService.show(ForgotPasswordModalComponent, this.config);
  }

  memberLoggedIn() {
    return this.memberLoginService.memberLoggedIn();
  }
}
