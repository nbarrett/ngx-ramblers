import { Component, OnDestroy, OnInit } from "@angular/core";
import { BsModalRef, BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { RouterHistoryService } from "../../../services/router-history.service";
import { UrlService } from "../../../services/url.service";
import { MailingPreferencesModalComponent } from "../../mailing-preferences/mailing-preferences-modal.component";
import { ForgotPasswordModalComponent } from "../forgot-password-modal/forgot-password-modal.component";
import { ResetPasswordModalComponent } from "../reset-password-modal/reset-password-modal.component";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Organisation } from "../../../models/system.model";

@Component({
  selector: "app-login-modal-component",
  templateUrl: "./login-modal.component.html",
  styleUrls: ["./login-modal.component.sass"]
})
export class LoginModalComponent implements OnInit, OnDestroy {
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  userName: string;
  password: string;
  private subscriptions: Subscription[] = [];
  public group: Organisation;

  constructor(public bsModalRef: BsModalRef,
              private modalService: BsModalService,
              private systemConfigService: SystemConfigService,
              private authService: AuthService,
              private memberLoginService: MemberLoginService,
              private urlService: UrlService,
              private routerHistoryService: RouterHistoryService,
              private notifierService: NotifierService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(LoginModalComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logger.debug("constructed");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse) => {
      this.logger.debug("subscribe:loginResponse", loginResponse);
      if (!loginResponse) {
        this.notify.error({
          continue: true,
          title: "Login failed",
          message: "Please try again"
        });
      } else if (loginResponse.memberLoggedIn) {
        if (!this.memberLoginService.loggedInMember().profileSettingsConfirmed) {
          this.modalService.show(MailingPreferencesModalComponent, {
            class: "modal-xl",
            animated: false,
            show: true,
            initialState: {
              memberId: this.memberLoginService.loggedInMember().memberId
            }
          });
        }
        this.bsModalRef.hide();
        return true;
      } else if (loginResponse.showResetPassword) {
        this.modalService.show(ResetPasswordModalComponent, {
          animated: false,
          initialState: {
            userName: this.userName,
            message: "Your password has expired, therefore you need to reset it to a new one before continuing."
          }
        });
        this.close();
      } else {
        this.logger.debug("loginResponse", loginResponse);
        this.notify.showContactUs(true);
        this.notify.error({
          continue: true,
          title: "Login failed",
          message: loginResponse.alertMessage
        });
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  fieldPopulated(object) {
    return (object || "").length > 0;
  }

  submittable() {
    const userNamePopulated = this.fieldPopulated(this.userName);
    const passwordPopulated = this.fieldPopulated(this.password);
    return passwordPopulated && userNamePopulated;
  }

  forgotPassword() {
    this.close();
    this.modalService.show(ForgotPasswordModalComponent, {
      animated: false
    });
  }

  close() {
    this.routerHistoryService.navigateBackToLastMainPage();
    this.bsModalRef.hide();
  }

  login() {
    this.notify.showContactUs(false);
    this.notify.setBusy();
    this.notify.progress({
      title: "Logging in",
      message: "using credentials for " + this.userName + " - please wait"
    });
    this.authService.login(this.userName, this.password);
  }
}
