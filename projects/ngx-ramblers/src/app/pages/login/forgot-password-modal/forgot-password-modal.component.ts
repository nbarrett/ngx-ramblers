import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { Member } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { RouterHistoryService } from "../../../services/router-history.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MailService } from "../../../services/mail/mail.service";
import { MailMessagingConfig, NotificationConfig, SendSmtpEmailRequest } from "../../../models/mail.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { NotificationDirective } from "../../../notifications/common/notification.directive";

@Component({
  selector: "app-forgot-password-modal-component",
  template: `
    <div *ngIf="mailMessagingConfig" class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title">I've forgotten my <em>{{ mailMessagingConfig?.group?.shortName }}</em> password!</h4>
        <button type="button" (click)="close()" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
      </div>
      <div class="modal-body">
        <form>
          <div class="row">
            <div class="col col-sm-12">
              <p>If you are unable to login due to a forgotten or expired password, we can send you an
                email containing a secure link that will allow you to reset your
                existing password yourself, and then choose another one.</p>
              <p>In order to do this, please enter the following information so that we can identify you
                as one of our members:</p>
            </div>
          </div>
          <div class="row">
            <div class="col col-sm-12">
              <div class="form-group">
                <label for="credential-one">{{ credentialOneLabel }}</label>
                <input [disabled]="notifyTarget.busy" [(ngModel)]="credentialOne"
                       type="text"
                       class="form-control input-sm" id="credential-one" name="credentialOne"
                       placeholder="Enter the username that was given to you in your original {{mailMessagingConfig?.group?.shortName}} welcome email or email address">
              </div>
              <div class="form-group">
                <label for="credential-two">{{ credentialTwoLabel }}</label>
                <input [disabled]="notifyTarget.busy" [(ngModel)]="credentialTwo"
                       type="text"
                       (keyup.enter)="submit()"
                       class="form-control input-sm" id="credential-two" name="credentialTwo"
                       placeholder="Enter your Ramblers membership number or home postcode">
              </div>
              <div *ngIf="notifyTarget.showAlert" class="row mb-2">
                <div class="col col-sm-12">
                  <div class="alert {{notifyTarget.alertClass}}">
                    <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                    <strong *ngIf="notifyTarget.alertTitle">
                      {{ notifyTarget.alertTitle }}: </strong> {{ notifyTarget.alertMessage }}
                    <span *ngIf="notifyTarget.showContactUs"> contact our <app-contact-us class="alert-link"
                                                                                          [roles]="'membership'"
                                                                                          text="Membership Administrator"></app-contact-us>.
                  </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <div class="row col-sm-12">
          <input type="submit"
                 value="Submit"
                 [disabled]="!submittable()"
                 (keyup.enter)="submit()"
                 (click)="submit()" title="Submit"
                 [ngClass]="submittable() ? 'button-form button-form-left': 'disabled-button-form button-form-left'">
          <input type="submit" [disabled]="notifyTarget.busy" value="Close"
                 (click)="close()"
                 title="Close forgotten password request"
                 [ngClass]="notifyTarget.busy ? 'disabled-button-form button-form-left': 'button-form button-form-left'">
        </div>
      </div>
    </div>
    <div class="d-none">
      <ng-template app-notification-directive/>
    </div>
  `
})
export class ForgotPasswordModalComponent implements OnInit, OnDestroy {
  public mailMessagingConfig: MailMessagingConfig;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public emailRequest: SendSmtpEmailRequest;
  private logger: Logger;
  public credentialTwo;
  public credentialOne;
  private subscriptions: Subscription[] = [];
  private mailSendInitiated = false;
  public readonly credentialOneLabel = "User name or email address";
  public readonly credentialTwoLabel = "Ramblers membership number or home postcode";
  private forgottenPasswordMember: Member;
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;
  public notificationConfig: NotificationConfig;
  constructor(private authService: AuthService,
              private mailService: MailService,
              private notifierService: NotifierService,
              private mailMessagingService: MailMessagingService,
              private routerHistoryService: RouterHistoryService,
              private stringUtils: StringUtilsService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("ForgotPasswordModalComponent", NgxLoggerLevel.OFF);
  }

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.notificationConfig = mailMessagingConfig.notificationConfigs.find(item => item.id === mailMessagingConfig.mailConfig.forgotPasswordNotificationConfigId);
      this.logger.info("initialising with notificationConfig:", this.notificationConfig);
    });
    this.subscriptions.push(this.authService.authResponse().subscribe(async (loginResponse) => {
      this.logger.debug("subscribe:forgot password", loginResponse);
      if (loginResponse.member) {
        this.forgottenPasswordMember = loginResponse.member as Member;
        this.sendForgottenPasswordEmailToMember();
      } else {
        this.logger.debug("loginResponse", loginResponse);
        this.notify.showContactUs(true);
        this.notify.error({
          continue: true,
          title: "Forgot password request failed",
          message: loginResponse.alertMessage
        });
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  submit() {
    const userDetails = `${this.credentialOneLabel} as ${this.credentialOne} and ${this.credentialTwoLabel} as ${this.credentialTwo}`;
    this.notify.progress({title: "Forgot password", message: `Checking our records for ${userDetails}`});
    if (!this.submittable()) {
      this.notify.error({
        continue: true,
        title: "Incorrect information entered",
        message: `Please enter ${this.credentialOneLabel} and ${this.credentialTwoLabel}`
      });
    } else {
      this.notify.setBusy();
      this.notify.showContactUs(false);
      this.authService.forgotPassword(this.credentialOne, this.credentialTwo, userDetails);
    }
  }

  sendForgottenPasswordEmailToMember() {
    this.mailSendInitiated = true;
    this.emailRequest = this.mailMessagingService.createEmailRequest({
      member: this.forgottenPasswordMember,
      notificationConfig: this.notificationConfig,
      notificationDirective: this.notificationDirective
    });
    this.logger.info("sendForgottenPasswordEmailToMember:emailRequest:", this.emailRequest);
    return Promise.resolve(this.notify.success("Sending forgotten password email"))
      .then(() => this.mailService.sendTransactionalMessage(this.emailRequest))
      .then(() => this.finalMessage())
      .then(() => this.notify.clearBusy())
      .catch((error) => this.handleSendError(error));
  }

  handleSendError(errorResponse) {
    this.mailSendInitiated = false;
    this.notify.error({
      continue: true,
      title: "Your email could not be sent",
      message: (errorResponse.message || errorResponse) + (errorResponse.error ? (". Error was: " + this.stringUtils.stringify(errorResponse.error)) : "")
    });
  }

  finalMessage() {
    return this.notify.success({
      title: "Message sent",
      message: "We've sent a message to the email address we have for you. Please check your inbox and follow the instructions in the message."
    });
  }

  fieldPopulated(object: any) {
    return object?.length > 0;
  }

  submittable() {
    const credentialOnePopulated = this.fieldPopulated(this.credentialOne);
    const passwordPopulated = this.fieldPopulated(this.credentialTwo);
    return passwordPopulated && credentialOnePopulated && !this.notifyTarget.busy && !this.mailSendInitiated;
  }

  close() {
    this.routerHistoryService.navigateBackToLastMainPage();
    this.bsModalRef.hide();
  }

}
