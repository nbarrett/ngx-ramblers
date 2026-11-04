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
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";
import { SecretInputComponent } from "../../../modules/common/secret-input/secret-input.component";
import { InputSize } from "../../../models/ui-size.model";
import { FormSaveActionsComponent } from "../../../modules/common/form-save-actions/form-save-actions";
import { FormSaveActions } from "../../../models/form-save-actions.model";
const pleaseTryAgain = " - please try again";

@Component({
    selector: "app-change-password",
    templateUrl: "./change-password.component.html",
    styleUrls: ["../admin/admin.component.sass"],
    imports: [PageComponent, FontAwesomeModule, FormsModule, ContactUsComponent, SecretInputComponent, FormSaveActionsComponent]
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
  protected readonly InputSize = InputSize;
  faUnlockAlt = faUnlockAlt;
  private subscriptions: Subscription[] = [];
  public formSaveActions: FormSaveActions = {
    save: () => this.saveLoginDetails(),
    saveAndExit: () => this.saveAndExit(),
    undo: () => this.undoLoginDetails(),
    cancel: () => this.profileService.backToAdmin()
  };

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

  private processResetPasswordResponse(loginResponse: LoginResponse): LoginResponse {
    if (loginResponse.showResetPassword) {
      this.notify.showContactUs(true);
      throw new Error(loginResponse.alertMessage || "Reset password failed");
    } else {
      delete this.enteredMemberCredentials.newPassword;
      delete this.enteredMemberCredentials.newPasswordConfirm;
      this.notify.success({title: "Password changed", message: loginResponse.alertMessage});
      return loginResponse;
    }
  }

  undoLoginDetails(): Promise<void> {
    return this.profileService.undoChangesTo(this.notify, ProfileUpdateType.LOGIN_DETAILS, this.member).then(member => {
      this.member = member;
      this.enteredMemberCredentials.userName = member.userName;
      delete this.enteredMemberCredentials.newPassword;
      delete this.enteredMemberCredentials.newPasswordConfirm;
    });
  }

  async validateUserNameExistence(): Promise<void> {
    if (this.enteredMemberCredentials.userName !== this.member.userName) {
      try {
        const existing = await this.memberService.getMemberForUserName(this.enteredMemberCredentials.userName);
        if (existing.id !== this.member.id) {
          throw new Error(`The user name ${this.enteredMemberCredentials.userName} is already used by another member${pleaseTryAgain}`);
        }
      } catch (error) {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.logger.debug("User name is available");
        } else {
          throw error;
        }
      }
    }
  }

  async resetPassword(): Promise<void> {
    if (this.enteredMemberCredentials.newPassword || this.enteredMemberCredentials.newPasswordConfirm) {
      this.notify.progress({title: "Change password", message: "Saving your new password"});
      const response = await this.authService.resetPassword(this.member.userName, this.enteredMemberCredentials.newPassword, this.enteredMemberCredentials.newPasswordConfirm);
      this.processResetPasswordResponse(response);
    }
  }

  async saveLoginDetails(): Promise<void> {
    this.notify.hide();
    this.notify.showContactUs(false);
    this.notify.setBusy();
    const saved = {userName: false};
    try {
      this.enteredMemberCredentials.userName = (this.enteredMemberCredentials.userName || "").trim().toLowerCase();
      if (!this.enteredMemberCredentials.userName) {
        throw new Error("The new user name cannot be blank.");
      } else {
        await this.validateUserNameExistence();
        const passwordChanged = !!(this.enteredMemberCredentials.newPassword || this.enteredMemberCredentials.newPasswordConfirm);
        if (this.enteredMemberCredentials.userName !== this.member.userName) {
          const updatedMember = {...this.member, userName: this.enteredMemberCredentials.userName};
          await this.profileService.saveMemberDetails(this.notify, ProfileUpdateType.LOGIN_DETAILS, updatedMember);
          this.member = updatedMember;
          saved.userName = true;
        }
        await this.resetPassword();
        if (!saved.userName && !passwordChanged) {
          this.notify.success({title: "Login details", message: "There are no changes to save."});
        }
      }
    } catch (error) {
      const message = error instanceof HttpErrorResponse ? error.error?.message || error.message : error instanceof Error ? error.message : String(error);
      this.notify.error({
        title: saved.userName ? "User name saved, password not changed" : "Login details not saved",
        message: saved.userName ? `Your user name was saved successfully. The password change failed: ${message}` : message
      });
      throw error;
    } finally {
      this.notify.clearBusy();
    }
  }

  saveAndExit(): Promise<void> {
    return this.saveLoginDetails().then(() => this.profileService.backToAdmin());
  }
}
