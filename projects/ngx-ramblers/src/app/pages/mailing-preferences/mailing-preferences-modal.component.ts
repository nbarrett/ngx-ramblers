import { Component, OnDestroy, OnInit } from "@angular/core";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../models/alert-target.model";
import { Member } from "../../models/member.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberService } from "../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../services/notifier.service";
import { ProfileConfirmationService } from "../../services/profile-confirmation.service";
import { RouterHistoryService } from "../../services/router-history.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { MailProvider, SystemConfig } from "../../models/system.model";
import { Subscription } from "rxjs";
import { MailMessagingConfig } from "../../models/mail.model";
import { MailMessagingService } from "../../services/mail/mail-messaging.service";
import { EmailSubscriptionsMailchimpComponent } from "../admin/profile/email-subscriptions-mailchimp.component";
import { MailSubscriptionSettingComponent } from "../admin/member-admin-modal/mail-subscription-setting";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ContactUsComponent } from "../../committee/contact-us/contact-us";
import { NgClass } from "@angular/common";

@Component({
    selector: "app-mailing-preferences-modal-component",
    templateUrl: "./mailing-preferences-modal.component.html",
    imports: [EmailSubscriptionsMailchimpComponent, MailSubscriptionSettingComponent, FormsModule, FontAwesomeModule, ContactUsComponent, NgClass]
})
export class MailingPreferencesModalComponent implements OnInit, OnDestroy {

  constructor(private memberService: MemberService,
              private systemConfigService: SystemConfigService,
              private profileConfirmationService: ProfileConfirmationService,
              private notifierService: NotifierService,
              private routerHistoryService: RouterHistoryService,
              protected mailMessagingService: MailMessagingService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MailingPreferencesModalComponent, NgxLoggerLevel.ERROR);
  }
  public mailMessagingConfig: MailMessagingConfig;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  public memberId: string;
  public member: Member;
  private subscriptions: Subscription[] = [];
  public systemConfig: SystemConfig;

  protected readonly MailProvider = MailProvider;

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logger.debug("constructed");
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => this.systemConfig = systemConfig));
    this.subscriptions.push(this.mailMessagingService.events()
      .subscribe((mailMessagingConfig: MailMessagingConfig) => {
        this.mailMessagingConfig = mailMessagingConfig;
        this.logger.info("retrieved MailMessagingConfig event:", mailMessagingConfig?.mailConfig);
      }));

    if (this.memberId) {
      this.memberService.getById(this.memberId)
        .then(member => {
          this.logger.debug("memberId ->", this.memberId, "member ->", member);
          this.member = member;
        });
    } else {
      this.notify.error({title: "Error retrieving member preferences", message: "No member found"});
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
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
