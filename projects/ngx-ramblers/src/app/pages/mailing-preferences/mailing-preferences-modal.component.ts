import { Component, OnInit } from "@angular/core";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../auth/auth.service";
import { AlertTarget } from "../../models/alert-target.model";
import { Member } from "../../models/member.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MailchimpListSubscriptionService } from "../../services/mailchimp/mailchimp-list-subscription.service";
import { MailchimpSegmentService } from "../../services/mailchimp/mailchimp-segment.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { MemberService } from "../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../services/notifier.service";
import { ProfileConfirmationService } from "../../services/profile-confirmation.service";
import { RouterHistoryService } from "../../services/router-history.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { UrlService } from "../../services/url.service";

@Component({
  selector: "app-mailing-preferences-modal-component",
  templateUrl: "./mailing-preferences-modal.component.html",
})
export class MailingPreferencesModalComponent implements OnInit {
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  public memberId: string;
  public member: Member;

  constructor(private authService: AuthService,
              private memberService: MemberService,
              private profileConfirmationService: ProfileConfirmationService,
              private mailchimpListSubscriptionService: MailchimpListSubscriptionService,
              private mailchimpSegmentService: MailchimpSegmentService,
              private memberLoginService: MemberLoginService,
              private notifierService: NotifierService,
              private stringUtils: StringUtilsService,
              private routerHistoryService: RouterHistoryService,
              private urlService: UrlService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MailingPreferencesModalComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logger.debug("constructed");
    this.memberService.getById(this.memberId)
      .then(member => {
        this.logger.debug("memberId ->", this.memberId, "member ->", member);
        this.member = member;
      });

  }

  saveOrUpdateUnsuccessful(message) {
    this.notify.showContactUs(true);
    this.notify.error({
      continue: true,
      title: "Error in saving mailing preferences",
      message: "Changes to your mailing preferences could not be saved. " + (message || "Please try again later.")
    });
  }

  save() {
    this.profileConfirmationService.confirmProfile(this.member);
    this.memberService.update(this.member)
      .then(() => this.close())
      .catch((error) => this.saveOrUpdateUnsuccessful(error));
  }

  close() {
    this.routerHistoryService.navigateBackToLastMainPage();
    this.bsModalRef.hide();
  }
}
