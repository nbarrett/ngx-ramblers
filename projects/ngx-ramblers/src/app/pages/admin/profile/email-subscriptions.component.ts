import { Component, OnDestroy, OnInit } from "@angular/core";
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
import { MailListAudit } from "../../../models/mail.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { MailListAuditService } from "../../../services/mail/mail-list-audit.service";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";

@Component({
  selector: "app-email-subscriptions",
  template: `
    <app-page autoTitle>
      @if (member) {
        <div class="row">
          <div class="col-sm-3">
            <div class="item-panel-heading">
              <fa-icon [icon]="faEnvelopeOpenText" class="fa-5x ramblers"></fa-icon>
            </div>
          </div>
          <div class="col-sm-9">
            <div class="row">
              <div class="col-sm-12 mt-2">
                <p>You can change your emailing preferences at any time using the subscription checkboxes
                below:</p>
                @if (systemConfig?.mailDefaults?.mailProvider === MailProvider.MAILCHIMP) {
                  <app-email-subscriptions-mailchimp [member]="member"
                  />
                }
                @if (systemConfig?.mailDefaults?.mailProvider === MailProvider.BREVO) {
                  @for (subscription of mailMessagingService.memberSubscribableSubscriptions(member.mail.subscriptions); track subscription) {
                    <div class="col-sm-12">
                      <app-mail-subscription-setting [member]="member" [subscription]="subscription"/>
                    </div>
                  }
                }
                <p>If you have any other queries about your mailing preferences, please email our
                  <app-contact-us roles="membership"
                                  text="Membership Secretary"></app-contact-us>
                </p>
              </div>
            </div>
          </div>
        </div>
      }
      <div class="row">
        <div class="col-sm-12">
          <input type="submit" [disabled]="false" value="Back to admin" (click)="profileService.backToAdmin()"
                 class="button-form button-form-left">
          <input type="submit" [disabled]="!member || notifyTarget.busy" value="Save Changes"
                 (click)="saveContactPreferences()"
                 [ngClass]="member && !notifyTarget.busy? 'button-form button-form-left': 'disabled-button-form button-form-left'">
          <input type="submit" [disabled]="!member || notifyTarget.busy" value="Undo Changes"
                 (click)="undoContactPreferences()"
                 [ngClass]="member && !notifyTarget.busy? 'button-form button-form-left': 'disabled-button-form button-form-left'">
        </div>
      </div>
      <div class="row">
        <div class="col-sm-12">
          @if (notifyTarget.showAlert) {
            <div class="alert {{notifyTarget.alertClass}} mt-3">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              @if (notifyTarget.alertTitle) {
                <strong>
                  {{ notifyTarget.alertTitle }}: </strong>
              } {{ notifyTarget.alertMessage }}
              @if (notifyTarget.showContactUs) {
                <div> contact our
                  <app-contact-us class="alert-link" roles="membership"
                                  text="Membership Administrator"></app-contact-us>
                  .
                </div>
              }
            </div>
          }
        </div>
      </div>
    </app-page>`,
  styleUrls: ["../admin/admin.component.sass"],
  standalone: false
})
export class EmailSubscriptionsComponent implements OnInit, OnDestroy {

  constructor(private notifierService: NotifierService,
              private profileConfirmationService: ProfileConfirmationService,
              private broadcastService: BroadcastService<MailListAudit>,
              private systemConfigService: SystemConfigService,
              private mailListAuditService: MailListAuditService,
              protected mailMessagingService: MailMessagingService,
              public profileService: ProfileService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(EmailSubscriptionsComponent, NgxLoggerLevel.ERROR);
  }

  public pendingMailListAudits: MailListAudit[] = [];
  public member: Member;
  private subscriptions: Subscription[] = [];
  faEnvelopeOpenText = faEnvelopeOpenText;
  public systemConfig: SystemConfig;

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  public mailchimpConfig: MailchimpConfig;

  protected readonly MailProvider = MailProvider;

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
    this.subscriptions.push(
      this.broadcastService.on(NamedEventType.MAIL_SUBSCRIPTION_CHANGED, (namedEvent: NamedEvent<MailListAudit>) => {
        this.pendingMailListAudits = this.pendingMailListAudits.filter(item => item.listId !== namedEvent.data.listId).concat(namedEvent.data);
        this.logger.info("event received:", namedEvent, "pendingMailListAudits:", this.pendingMailListAudits);
      }));
  }

  undoContactPreferences() {
    this.profileService.undoChangesTo(this.notify, ProfileUpdateType.CONTACT_PREFERENCES, this.member).then(member => {
      this.member = member;
    });
  }

  saveContactPreferences() {
    this.profileConfirmationService.confirmProfile(this.member);
    this.profileService.saveMemberDetails(this.notify, ProfileUpdateType.CONTACT_PREFERENCES, this.member).then(member => {
      this.mailListAuditService.createOrUpdateAll(this.pendingMailListAudits);
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
