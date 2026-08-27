import { Component, inject, OnDestroy, OnInit, viewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { MailchimpConfig } from "../../../models/mailchimp.model";
import { Member, ProfileUpdateType } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { ProfileConfirmationService } from "../../../services/profile-confirmation.service";
import { ProfileService } from "./profile.service";
import { faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MailProvider, SystemConfig } from "../../../models/system.model";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { EmailSubscriptionsMailchimpComponent } from "./email-subscriptions-mailchimp.component";
import { MailSubscriptionSettingComponent } from "../member-admin-modal/mail-subscription-setting";
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";
import { ProfileInboxNotificationsComponent } from "./profile-inbox-notifications";
import { FormSaveActionsComponent } from "../../../modules/common/form-save-actions/form-save-actions";
import { FormSaveActions } from "../../../models/form-save-actions.model";

@Component({
    selector: "app-email-subscriptions",
    template: `
    <app-page autoTitle>
      @if (member) {
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">Email subscriptions</div>
          <div class="col-12">
            <div class="row align-items-start">
              <div class="col-sm-3 text-center">
                <fa-icon [icon]="faEnvelopeOpenText" class="fa-5x admin-icon"></fa-icon>
              </div>
              <div class="col-sm-9">
                <p class="text-muted mb-2">You can change your emailing preferences at any time using the subscription checkboxes below.</p>
                <p class="text-muted mb-0">If you have any other queries about your mailing preferences, please contact our
                  <app-contact-us [subject]="'Mailing preferences enquiry'"></app-contact-us>.
                </p>
                <div class="border-top">
                  @if (marketingConsentBlocksSubscribe()) {
                    <div class="alert alert-warning small mb-3">
                      <strong>Head office marketing consent is not given.</strong>
                      While this site respects that consent, you cannot turn list subscriptions on. You can still turn off any list you are already subscribed to.
                    </div>
                  } @else if (member?.emailMarketingConsent === false) {
                    <div class="alert alert-warning small mb-3">
                      <strong>Head office marketing consent is not given.</strong>
                      Lists that require that consent cannot be turned on. Other lists may still be available. You can turn off any list you are already subscribed to.
                    </div>
                  }
                  @if (systemConfig?.mailDefaults?.mailProvider === MailProvider.MAILCHIMP) {
                    <app-email-subscriptions-mailchimp [member]="member"/>
                  }
                  @if (systemConfig?.mailDefaults?.mailProvider === MailProvider.BREVO) {
                    @for (subscription of mailMessagingService.memberSubscribableSubscriptions(member.mail.subscriptions); track subscription.id) {
                      <div>
                        <app-mail-subscription-setting [member]="member" [subscription]="subscription"/>
                      </div>
                    }
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
        <app-profile-inbox-notifications/>
        <div class="mt-3">
          <app-form-save-actions
            [disabled]="!member || notifyTarget.busy"
            [actions]="formSaveActions"/>
        </div>
      }
      @if (notifyTarget.showAlert) {
        <div class="alert {{notifyTarget.alertClass}} mt-3">
          <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
          @if (notifyTarget.alertTitle) {
            <strong>
              {{ notifyTarget.alertTitle }}: </strong>
          } {{ notifyTarget.alertMessage }}
          @if (notifyTarget.showContactUs) {
            <div> contact our
              <app-contact-us class="alert-link"></app-contact-us>.
            </div>
          }
        </div>
      }
    </app-page>`,
    styleUrls: ["../admin/admin.component.sass"],
    imports: [PageComponent, FontAwesomeModule, EmailSubscriptionsMailchimpComponent, MailSubscriptionSettingComponent, ContactUsComponent, ProfileInboxNotificationsComponent, FormSaveActionsComponent]
})
export class EmailSubscriptionsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("EmailSubscriptionsComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private profileConfirmationService = inject(ProfileConfirmationService);
  private systemConfigService = inject(SystemConfigService);
  private mailListUpdaterService = inject(MailListUpdaterService);
  protected mailMessagingService = inject(MailMessagingService);
  profileService = inject(ProfileService);
  private inboxNotifications = viewChild(ProfileInboxNotificationsComponent);
  public member: Member;
  private subscriptions: Subscription[] = [];
  faEnvelopeOpenText = faEnvelopeOpenText;
  public systemConfig: SystemConfig;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public mailchimpConfig: MailchimpConfig;
  public formSaveActions: FormSaveActions = {
    save: () => this.saveContactPreferences(),
    saveAndExit: () => this.saveAndExit(),
    undo: () => this.undoContactPreferences(),
    cancel: () => this.profileService.backToAdmin()
  };

  protected readonly MailProvider = MailProvider;

  marketingConsentBlocksSubscribe(): boolean {
    return this.mailListUpdaterService.marketingConsentBlocksSubscribe(this.member);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.subscriptions.push(this.profileService.subscribeToLogout(this.logger));
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.logger.info("subscribing to systemConfigService events:", systemConfig);
      this.systemConfig = systemConfig;
    }));
    this.profileService.queryMember(this.notify, ProfileUpdateType.CONTACT_PREFERENCES).then(member => {
      this.member = member;
      this.notify.clearBusy();
    });
  }

  undoContactPreferences() {
    return this.profileService.undoChangesTo(this.notify, ProfileUpdateType.CONTACT_PREFERENCES, this.member).then(member => {
      this.member = member;
      this.inboxNotifications()?.undo();
    });
  }

  saveContactPreferences(): Promise<void> {
    this.profileConfirmationService.confirmProfile(this.member);
    return this.profileService.saveMemberDetails(this.notify, ProfileUpdateType.CONTACT_PREFERENCES, this.member)
      .then(() => this.inboxNotifications()?.save() ?? Promise.resolve())
      .then(() => this.mailListUpdaterService.syncChangedMembersToBrevo(this.notify, [this.member])
        .catch(error => {
          this.logger.warn("Brevo sync after subscription save failed; will reconcile on next send", error);
        }));
  }

  saveAndExit(): Promise<void> {
    return this.saveContactPreferences().then(() => {
      this.profileService.backToAdmin();
    }).catch(() => null);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
