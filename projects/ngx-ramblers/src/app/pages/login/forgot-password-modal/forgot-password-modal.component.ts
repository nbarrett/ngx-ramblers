import { Component, OnDestroy, OnInit } from "@angular/core";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { MailchimpConfig } from "../../../models/mailchimp.model";
import { Member } from "../../../models/member.model";
import { Organisation } from "../../../models/system.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";
import { MailchimpCampaignService } from "../../../services/mailchimp/mailchimp-campaign.service";
import { MailchimpListSubscriptionService } from "../../../services/mailchimp/mailchimp-list-subscription.service";
import { MailchimpSegmentService } from "../../../services/mailchimp/mailchimp-segment.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { RouterHistoryService } from "../../../services/router-history.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-forgot-password-modal-component",
  templateUrl: "./forgot-password-modal.component.html",
  styleUrls: ["./forgot-password-modal.component.sass"]
})
export class ForgotPasswordModalComponent implements OnInit, OnDestroy {
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  public credentialTwo;
  public credentialOne;
  private subscriptions: Subscription[] = [];
  private campaignSendInitiated = false;
  private FORGOTTEN_PASSWORD_SEGMENT = "Forgotten Password";
  public readonly credentialOneLabel = "User name or email address";
  public readonly credentialTwoLabel = "Ramblers membership number or home postcode";
  private forgottenPasswordMember: Member;
  public group: Organisation;

  constructor(private authService: AuthService,
              private mailchimpCampaignService: MailchimpCampaignService,
              private mailchimpConfigService: MailchimpConfigService,
              private mailchimpListSubscriptionService: MailchimpListSubscriptionService,
              private mailchimpSegmentService: MailchimpSegmentService,
              private memberLoginService: MemberLoginService,
              private notifierService: NotifierService,
              private routerHistoryService: RouterHistoryService,
              private stringUtils: StringUtilsService,
              private urlService: UrlService,
              public bsModalRef: BsModalRef,
              private systemConfigService: SystemConfigService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("ForgotPasswordModalComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logger.info("subscribing to systemConfigService events");
    this.systemConfigService.events().subscribe(item => this.group = item.group);
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse) => {
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

  createOrSaveForgottenPasswordSegment(config: MailchimpConfig) {
    const segmentId = config?.segments?.general?.forgottenPasswordSegmentId;
    if (!segmentId) {
      return Promise.reject("Forgotten password email cannot be sent due to an unxpected system error");
    }
    return this.mailchimpSegmentService.saveSegment("general", {segmentId}, [{id: this.forgottenPasswordMember.id}], this.FORGOTTEN_PASSWORD_SEGMENT, [this.forgottenPasswordMember]);
  }

  sendForgottenPasswordCampaign(config: MailchimpConfig) {
    const member = this.forgottenPasswordMember.firstName + " " + this.forgottenPasswordMember.lastName;
    this.logger.debug("config.campaigns.forgottenPassword.campaignId", config.campaigns.forgottenPassword.campaignId);
    this.logger.debug("config.segments.general.forgottenPasswordSegmentId", config.segments.general.forgottenPasswordSegmentId);
    return this.mailchimpCampaignService.replicateAndSendWithOptions({
      campaignId: config.campaigns.forgottenPassword.campaignId,
      campaignName: `${this?.group?.shortName} website password reset instructions (${member})`,
      segmentId: config.segments.general.forgottenPasswordSegmentId
    });
  }

  updateGeneralList() {
    return this.mailchimpListSubscriptionService.createBatchSubscriptionForList("general", [this.forgottenPasswordMember]);
  }

  sendForgottenPasswordEmailToMember() {
    this.campaignSendInitiated = true;
    return Promise.resolve(this.notify.success("Sending forgotten password email"))
      .then(() => this.updateGeneralList())
      .then(() => this.mailchimpConfigService.getConfig()
        .then((config) => {
          return this.createOrSaveForgottenPasswordSegment(config)
            .then(() => this.sendForgottenPasswordCampaign(config));
        })
        .then(() => this.finalMessage())
        .then(() => this.notify.clearBusy())
        .catch((error) => this.handleSendError(error)));
  }

  handleSendError(errorResponse) {
    this.campaignSendInitiated = false;
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

  fieldPopulated(object) {
    return (object || "").length > 0;
  }

  submittable() {
    const credentialOnePopulated = this.fieldPopulated(this.credentialOne);
    const passwordPopulated = this.fieldPopulated(this.credentialTwo);
    return passwordPopulated && credentialOnePopulated && !this.notifyTarget.busy && !this.campaignSendInitiated;
  }

  close() {
    this.routerHistoryService.navigateBackToLastMainPage();
    this.bsModalRef.hide();
  }

}
