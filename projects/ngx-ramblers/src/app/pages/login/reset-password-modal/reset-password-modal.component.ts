import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { BsModalRef, BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { MailingPreferencesModalComponent } from "../../mailing-preferences/mailing-preferences-modal.component";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Organisation } from "../../../models/system.model";
import { NgClass } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";

@Component({
    selector: "app-reset-password-modal-component",
    templateUrl: "./reset-password-modal.component.html",
    styleUrls: ["./reset-password-modal.component.sass"],
    imports: [NgClass, FormsModule, FontAwesomeModule, ContactUsComponent]
})
export class ResetPasswordModalComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("ResetPasswordModalComponent", NgxLoggerLevel.ERROR);
  bsModalRef = inject(BsModalRef);
  private modalService = inject(BsModalService);
  private authService = inject(AuthService);
  private systemConfigService = inject(SystemConfigService);
  private memberLoginService = inject(MemberLoginService);
  private urlService = inject(UrlService);
  private notifierService = inject(NotifierService);
  private notify: AlertInstance;
  private subscriptions: Subscription[] = [];
  public newPassword: string;
  public newPasswordConfirm: string;
  public notifyTarget: AlertTarget = {};
  public userName: string;
  public invalidPasswordLink: boolean;
  public message: string;
  public group: Organisation;

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logger.debug("constructed");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    if (this.invalidPasswordLink) {
      this.notify.showContactUs(true);
      this.notify.error({
        title: "Reset password failed",
        message: "The password reset link you followed has either expired or is invalid. Click Restart Forgot Password to try again or "
      });
    } else if (this.message) {
      this.notify.showContactUs(false);
      this.notify.progress({
        title: "Reset password",
        message: this.message
      });
    }
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse) => {
      this.logger.debug("subscribe:reset password", loginResponse);
      if (loginResponse?.memberLoggedIn) {
        if (!this.memberLoginService.loggedInMember().profileSettingsConfirmed) {
          this.modalService.show(MailingPreferencesModalComponent, {
            class: "modal-xl",
            animated: false,
            show: true,
            initialState: {
              memberId: this.memberLoginService.loggedInMember().memberId
            }
          });
          this.bsModalRef.hide();
        } else {
          return this.urlService.navigateTo([]);
        }
        return true;
      } else {
        this.logger.debug("loginResponse", loginResponse);
        this.notify.showContactUs(true);
        this.notify.error({
          continue: true,
          title: "Reset password failed",
          message: loginResponse?.alertMessage
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
    const userNamePopulated = this.fieldPopulated(this.newPassword);
    const passwordPopulated = this.fieldPopulated(this.newPasswordConfirm);
    return !this.notifyTarget.busy && passwordPopulated && userNamePopulated && !this.invalidPasswordLink;
  }

  restartForgotPassword() {
    this.bsModalRef.hide();
    this.urlService.navigateTo([]).then(() => this.urlService.navigateTo(["/forgot-password"]));
  }

  close() {
    this.bsModalRef.hide();
    return this.urlService.navigateTo([]);
  }

  resetPassword() {
    this.notify.showContactUs(false);
    this.notify.setBusy();
    this.notify.progress({
      title: "Reset password",
      message: "Attempting reset of password for " + this.userName
    });
    this.authService.resetPassword(this.userName, this.newPassword, this.newPasswordConfirm)
      .then((response) => {
        this.logger.debug("reponse:", response);
        if (response?.showResetPassword) {
          this.notify.showContactUs(true);
          this.notify.error({
            title: "Reset password",
            message: response.alertMessage
          });
        } else {
          return this.close();
        }

      })
      .catch((error) => this.notify.error(error));
  }
}
