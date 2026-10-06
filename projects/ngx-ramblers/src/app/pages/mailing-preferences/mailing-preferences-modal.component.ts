import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../models/alert-target.model";
import { Member } from "../../models/member.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberService } from "../../services/member/member.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { ViewAsService } from "../../services/member/view-as.service";
import { AlertInstance, NotifierService } from "../../services/notifier.service";
import { ProfileConfirmationService } from "../../services/profile-confirmation.service";
import { RouterHistoryService } from "../../services/router-history.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { MailProvider, SystemConfig } from "../../models/system.model";
import { Subscription } from "rxjs";
import { MailMessagingConfig } from "../../models/mail.model";
import { MailMessagingService } from "../../services/mail/mail-messaging.service";
import { MailListUpdaterService } from "../../services/mail/mail-list-updater.service";
import { EmailSubscriptionsMailchimpComponent } from "../admin/profile/email-subscriptions-mailchimp.component";
import { MailSubscriptionSettingComponent } from "../admin/member-admin-modal/mail-subscription-setting";
import { PhotoVideoOptOutComponent } from "../admin/profile/photo-video-opt-out";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ContactUsComponent } from "../../committee/contact-us/contact-us";

@Component({
    selector: "app-mailing-preferences-modal-component",
    templateUrl: "./mailing-preferences-modal.component.html",
    imports: [EmailSubscriptionsMailchimpComponent, MailSubscriptionSettingComponent, PhotoVideoOptOutComponent, FormsModule, FontAwesomeModule, ContactUsComponent]
})
export class MailingPreferencesModalComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MailingPreferencesModalComponent", NgxLoggerLevel.ERROR);
  private memberService = inject(MemberService);
  private memberLoginService = inject(MemberLoginService);
  private viewAsService = inject(ViewAsService);
  private systemConfigService = inject(SystemConfigService);
  private profileConfirmationService = inject(ProfileConfirmationService);
  private notifierService = inject(NotifierService);
  private routerHistoryService = inject(RouterHistoryService);
  protected mailMessagingService = inject(MailMessagingService);
  private mailListUpdaterService = inject(MailListUpdaterService);
  protected bsModalRef = inject(BsModalRef, {optional: true});
  public mailMessagingConfig: MailMessagingConfig;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public memberId: string;
  public member: Member;
  private subscriptions: Subscription[] = [];
  public systemConfig: SystemConfig;
  protected readonly MailProvider = MailProvider;

  marketingConsentBlocksSubscribe(): boolean {
    return this.mailListUpdaterService.marketingConsentBlocksSubscribe(this.member);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logger.debug("constructed");
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => this.systemConfig = systemConfig));
    this.subscriptions.push(this.mailMessagingService.events()
      .subscribe((mailMessagingConfig: MailMessagingConfig) => {
        this.mailMessagingConfig = mailMessagingConfig;
        this.logger.info("retrieved MailMessagingConfig event:", mailMessagingConfig?.mailConfig);
      }));

    this.resolveAndLoadMember();
  }

  private resolveAndLoadMember() {
    if (this.memberId) {
      this.loadMember(this.memberId);
    } else {
      this.viewAsService.hydrateFromLocation().then(() => {
        const memberId = this.memberLoginService.loggedInMember()?.memberId;
        if (memberId) {
          this.memberId = memberId;
          this.loadMember(memberId);
        } else {
          this.notify.error({title: "Error retrieving member preferences", message: "No member found"});
        }
      });
    }
  }

  private loadMember(memberId: string) {
    this.memberService.getById(memberId)
      .then(member => {
        this.logger.debug("memberId ->", memberId, "member ->", member);
        this.member = member;
      });
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
    if (this.member && !this.notifyTarget.busy) {
      this.notify.setBusy();
      this.profileConfirmationService.confirmProfile(this.member);
      this.memberService.update(this.member)
        .then(() => this.close())
        .catch((error) => this.saveOrUpdateUnsuccessful(error));
    }
  }

  close() {
    this.routerHistoryService.navigateBackToLastMainPage();
    if (this.bsModalRef) {
      this.bsModalRef.hide();
    }
  }


}
