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
    template: `
    <div [ngClass]="{'busy': notifyTarget.busy}" id="reset-password-dialog" tabindex="-1" role="dialog"
         data-backdrop="false" aria-labelledby="modal-label">
      <div class="modal-header">
        <h4 class="modal-title">Reset my <em>{{group?.shortName}}</em> password</h4>
        <button (click)="bsModalRef.hide()" type="button" class="close" data-bs-dismiss="modal" aria-hidden="true">&times;</button>
      </div>
      <div class="modal-body">
        @if (!invalidPasswordLink) {
          <div>
            <div class="row">
              <div class="col col-sm-12">
                <div class="form-group">
                  <label for="reset-password-user-name">Email address or username</label>
                  <input [disabled]="true" [(ngModel)]="userName" type="text" class="form-control input-sm"
                         id="reset-password-user-name" placeholder="Enter username">
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col col-sm-6">
                <div class="form-group">
                  <label for="new-reset-password">New Password</label>
                  <input [(ngModel)]="newPassword" type="password" class="form-control input-sm" id="new-reset-password"
                         placeholder="Enter new password">
                </div>
              </div>
              <div class="col col-sm-6">
                <div class="form-group">
                  <label for="new-reset-password-confirm">Confirm New Password</label>
                  <input [(ngModel)]="newPasswordConfirm" type="password" class="form-control input-sm"
                         id="new-reset-password-confirm"
                         placeholder="Confirm new password">
                </div>
              </div>
            </div>
          </div>
        }
        @if (notifyTarget.showAlert) {
          <div class="row">
            <div class="col col-sm-12">
              <div class="alert {{notifyTarget.alertClass}}">
                <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                @if (notifyTarget.alertTitle) {
                  <strong>
                    {{ notifyTarget.alertTitle }}: </strong>
                } {{ notifyTarget.alertMessage }}
                @if (notifyTarget.showContactUs) {
                  <span> contact our <app-contact-us class="alert-link" roles="membership"
                                                     text="Membership Administrator"></app-contact-us>.
                  </span>
                }
              </div>
            </div>
          </div>
        }
      </div>
      <div class="modal-footer flex-nowrap gap-1">
          <input type="submit" [disabled]="!submittable()" value="Confirm Reset" (click)="resetPassword()"
                 (keyup.enter)="resetPassword()"
                 class="btn btn-primary btn-sm">
          <input type="reset" value="Cancel" (click)="close()" title="Cancel reset password"
                 [disabled]="notifyTarget.busy" class="btn btn-secondary btn-sm">
          <input type="reset" value="Start Over" (click)="restartForgotPassword()"
                 title="Restart the forgot password process"
                 [disabled]="notifyTarget.busy" class="btn btn-secondary btn-sm">
      </div>
    </div>
    `,
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
