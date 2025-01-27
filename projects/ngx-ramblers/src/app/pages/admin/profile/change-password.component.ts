import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faUnlockAlt } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { EnteredMemberCredentials, LoginResponse, Member, ProfileUpdateType } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { ProfileService } from "./profile.service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";

const pleaseTryAgain = " - please try again";

@Component({
    selector: "app-change-password",
    templateUrl: "./change-password.component.html",
    styleUrls: ["../admin/admin.component.sass"],
    imports: [PageComponent, FontAwesomeModule, FormsModule, NgClass, ContactUsComponent]
})
export class ChangePasswordComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("ChangePasswordComponent", NgxLoggerLevel.ERROR);
  private authService = inject(AuthService);
  private memberService = inject(MemberService);
  private notifierService = inject(NotifierService);
  profileService = inject(ProfileService);

  public member: Member;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public enteredMemberCredentials: EnteredMemberCredentials = {};
  faUnlockAlt = faUnlockAlt;
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.profileService.queryMember(this.notify, ProfileUpdateType.LOGIN_DETAILS).then(member => {
      this.member = member;
      this.enteredMemberCredentials.userName = this.member.userName;
      this.notify.clearBusy();
    });
    this.subscriptions.push(this.profileService.subscribeToLogout(this.logger));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private processResetPasswordResponse(loginResponse: LoginResponse) {
    this.logger.debug("processResetPasswordResponse:", loginResponse);
    this.notify.clearBusy();
    delete this.enteredMemberCredentials.newPassword;
    delete this.enteredMemberCredentials.newPasswordConfirm;
    if (loginResponse.showResetPassword) {
      this.logger.debug("reset password failed", loginResponse);
      this.notify.showContactUs(true);
      this.notify.error({
        continue: true,
        title: "Reset password failed",
        message: loginResponse.alertMessage
      });
    } else {
      this.logger.debug("reset password success", loginResponse);
      this.notify.success({
        title: "Reset password success",
        message: loginResponse.alertMessage
      });
    }
  }

  undoLoginDetails() {
    this.profileService.undoChangesTo(this.notify, ProfileUpdateType.LOGIN_DETAILS, this.member).then(member => {
      this.enteredMemberCredentials.userName = member.userName;
      delete this.enteredMemberCredentials.newPassword;
      delete this.enteredMemberCredentials.newPasswordConfirm;
    });
  }

  validateUserNameExistence(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.enteredMemberCredentials.userName !== this.member.userName) {
        this.memberService.getMemberForUserName(this.enteredMemberCredentials.userName)
          .then(member => {
            const reason = `The user name ${this.enteredMemberCredentials.userName} is already used by another member${pleaseTryAgain}`;
            this.enteredMemberCredentials.userName = this.member.userName;
            reject(reason);
          })
          .catch(error => {
            if (error instanceof HttpErrorResponse && error.status === 404) {
              resolve(this.logger.debug("validateUserNameExistence:", this.enteredMemberCredentials.userName, "available"));
            }
          });
      } else {
        resolve(this.logger.debug("validateUserNameExistence:", this.enteredMemberCredentials.userName, "no changes"));
      }
    });
  }

  resetPassword(): Promise<any> {
    if (this.enteredMemberCredentials.newPassword || this.enteredMemberCredentials.newPasswordConfirm) {
      this.notify.showContactUs(false);
      this.notify.setBusy();
      this.notify.progress({
        title: "Reset password",
        message: "Attempting reset of password for " + this.enteredMemberCredentials.userName
      });
      return this.authService.resetPassword(this.enteredMemberCredentials.userName, this.enteredMemberCredentials.newPassword, this.enteredMemberCredentials.newPasswordConfirm)
        .then(loginResponse => this.processResetPasswordResponse(loginResponse));
    } else {
      return Promise.resolve(this.logger.debug("resetPassword:no changes"));
    }
  }

  validateUserName(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.enteredMemberCredentials.userName !== this.member.userName) {
        this.enteredMemberCredentials.userName = this.enteredMemberCredentials.userName.trim();
        if (this.enteredMemberCredentials.userName.length === 0) {
          reject("The new user name cannot be blank.");
        } else {
          this.member.userName = this.enteredMemberCredentials.userName;
          resolve(true);
        }
      } else {
        resolve(this.logger.debug("validateUserName:no changes"));
      }
    });
  }

  saveLoginDetails() {
    this.logger.debug("saveLoginDetails");
    this.notify.hide();
    this.validateUserNameExistence()
      .then(() => this.resetPassword())
      .catch(response => {
        this.notify.error({title: "Profile", message: response});
      });
  }
}
