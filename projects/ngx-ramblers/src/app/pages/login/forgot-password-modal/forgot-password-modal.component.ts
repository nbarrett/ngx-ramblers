import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { ForgotPasswordIdentificationMethod } from "../../../models/mail.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { RouterHistoryService } from "../../../services/router-history.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MailService } from "../../../services/mail/mail.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";

@Component({
    selector: "app-forgot-password-modal-component",
    template: `
    @if (groupShortName) {
      <div class="modal-content">
        <div class="modal-header">
          <h4 class="modal-title">I've forgotten my <em>{{ groupShortName }}</em> password!</h4>
          <button type="button" (click)="close()" class="close" data-bs-dismiss="modal" aria-hidden="true">&times;</button>
        </div>
        <div class="modal-body">
          <form>
            <div class="row">
              <div class="col col-sm-12">
                <p>We can send you an email containing a secure link to reset your password.
                  Please tell us how you'd like to verify your identity:</p>
              </div>
            </div>
            <div class="row">
              <div class="col col-sm-12">
                <div class="form-check mb-2">
                  <input class="form-check-input" type="radio" name="identificationMethod" id="method-email"
                    [value]="emailOrUsernameMethod"
                    [(ngModel)]="identificationMethod"
                    [disabled]="notifyTarget.busy || requestCompleted">
                  <label class="form-check-label" for="method-email">I know my email address or username</label>
                </div>
                <div class="form-check mb-3">
                  <input class="form-check-input" type="radio" name="identificationMethod" id="method-membership"
                    [value]="membershipDetailsMethod"
                    [(ngModel)]="identificationMethod"
                    [disabled]="notifyTarget.busy || requestCompleted">
                  <label class="form-check-label" for="method-membership">I don't know my email or username</label>
                </div>
                @if (identificationMethod === emailOrUsernameMethod) {
                  <div class="form-group">
                    <label for="email">Email address or username</label>
                    <input [disabled]="notifyTarget.busy || requestCompleted" [(ngModel)]="emailOrUsername"
                      type="text"
                      (keyup.enter)="submit()"
                      class="form-control input-sm" id="email" name="email"
                      placeholder="Enter your email address or username">
                  </div>
                } @else {
                  <div class="form-group">
                    <label for="membership-number">Ramblers membership number</label>
                    <input [disabled]="notifyTarget.busy || requestCompleted" [(ngModel)]="membershipNumber"
                      type="text"
                      class="form-control input-sm" id="membership-number" name="membershipNumber"
                      placeholder="Enter your Ramblers membership number">
                  </div>
                  <div class="form-group">
                    <label for="postcode">Home postcode</label>
                    <input [disabled]="notifyTarget.busy || requestCompleted" [(ngModel)]="postcode"
                      type="text"
                      (keyup.enter)="submit()"
                      class="form-control input-sm" id="postcode" name="postcode"
                      placeholder="Enter your home postcode">
                  </div>
                }
                @if (notifyTarget.showAlert) {
                  <div class="row mb-2">
                    <div class="col col-sm-12">
                      <div class="alert {{notifyTarget.alertClass}}">
                        <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                        @if (notifyTarget.alertTitle) {
                          <strong>
                          {{ notifyTarget.alertTitle }}: </strong>
                          } {{ notifyTarget.alertMessage }}
                          @if (notifyTarget.showContactUs) {
                            <span> contact our <app-contact-us class="alert-link"
                              [roles]="'membership'"
                            text="Membership Administrator"></app-contact-us>.
                          </span>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer flex-nowrap gap-1">
            <input type="submit"
              value="Submit"
              [disabled]="!submittable()"
              (keyup.enter)="submit()"
              (click)="submit()" title="Submit"
              class="btn btn-primary btn-sm">
            <input type="submit" [disabled]="notifyTarget.busy" value="Close"
              (click)="close()"
              title="Close forgotten password request"
              class="btn btn-secondary btn-sm">
        </div>
      </div>
    }
    `,
    imports: [FormsModule, FontAwesomeModule, ContactUsComponent]
})
export class ForgotPasswordModalComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("ForgotPasswordModalComponent", NgxLoggerLevel.ERROR);
  private mailService = inject(MailService);
  private notifierService = inject(NotifierService);
  private systemConfigService = inject(SystemConfigService);
  private routerHistoryService = inject(RouterHistoryService);
  private stringUtils = inject(StringUtilsService);
  bsModalRef = inject(BsModalRef);
  public groupShortName: string;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public emailOrUsername: string;
  public membershipNumber: string;
  public postcode: string;
  public identificationMethod: ForgotPasswordIdentificationMethod = ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME;
  public emailOrUsernameMethod = ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME;
  public membershipDetailsMethod = ForgotPasswordIdentificationMethod.MEMBERSHIP_DETAILS;
  private subscriptions: Subscription[] = [];
  private submitInProgress = false;
  public requestCompleted = false;

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.groupShortName = systemConfig?.group?.shortName;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async submit() {
    if (!this.submittable()) {
      const requiredFields = this.identificationMethod === ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME
        ? "your email address or username"
        : "your membership number and postcode";
      this.notify.error({
        continue: true,
        title: "Incorrect information entered",
        message: `Please enter ${requiredFields}`
      });
    } else {
      this.notify.setBusy();
      this.notify.showContactUs(false);
      this.notify.progress({title: "Forgot password", message: "Checking our records..."});
      this.submitInProgress = true;
      try {
        const response = await this.mailService.sendForgotPasswordRequest({
          identificationMethod: this.identificationMethod,
          emailOrUsername: this.emailOrUsername,
          membershipNumber: this.membershipNumber,
          postcode: this.postcode
        });
        this.logger.info("sendForgotPasswordRequest response:", response);
        this.requestCompleted = true;
        this.notify.success({
          title: "Request processed",
          message: response?.message || "Thanks! If those details match one of our members, a password reset email will be on its way shortly"
        });
      } catch (errorResponse) {
        this.logger.error("sendForgotPasswordRequest error:", errorResponse);
        this.notify.showContactUs(true);
        this.notify.error({
          continue: true,
          title: "Your request could not be processed",
          message: (errorResponse.message || errorResponse) + (errorResponse.error ? (". Error was: " + this.stringUtils.stringify(errorResponse.error)) : "")
        });
      } finally {
        this.submitInProgress = false;
        this.notify.clearBusy();
      }
    }
  }

  fieldPopulated(object: any) {
    return object?.length > 0;
  }

  submittable() {
    if (this.notifyTarget.busy || this.submitInProgress || this.requestCompleted) {
      return false;
    }
    if (this.identificationMethod === ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME) {
      return this.fieldPopulated(this.emailOrUsername);
    } else {
      return this.fieldPopulated(this.membershipNumber) && this.fieldPopulated(this.postcode);
    }
  }

  close() {
    this.routerHistoryService.navigateBackToLastMainPage();
    this.bsModalRef.hide();
  }

}
