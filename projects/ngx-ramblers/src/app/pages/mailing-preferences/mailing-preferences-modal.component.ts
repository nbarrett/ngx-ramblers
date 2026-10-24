import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../models/alert-target.model";
import { Member } from "../../models/member.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberService } from "../../services/member/member.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { ViewAsService } from "../../services/member/view-as.service";
import { AlertInstance, NotifierService } from "../../services/notifier.service";
import { ProfileConfirmationService } from "../../services/profile-confirmation.service";
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
import { PageComponent } from "../../page/page.component";
import { UrlService } from "../../services/url.service";
import { faCheck, faForward } from "@fortawesome/free-solid-svg-icons";

@Component({
    selector: "app-mailing-preferences-modal-component",
    imports: [EmailSubscriptionsMailchimpComponent, MailSubscriptionSettingComponent, PhotoVideoOptOutComponent, FormsModule, FontAwesomeModule, ContactUsComponent, PageComponent],
    template: `
      <app-page [pageTitle]="'Your ' + (systemConfig?.group?.shortName || '') + ' profile'">
        @if (member) {
          <div class="thumbnail-heading-frame">
            <div class="thumbnail-heading">Mailing preferences</div>
            <p>In order to comply with the EU General Data Protection Regulation (GDPR), we need to confirm some details with you. Please make any changes you need and then click <b>Confirm these changes</b> below. If you click <b>Continue without confirming</b>, you'll get prompted each time you login.</p>
            <div class="well-subscriptions-confirmation">
              <p class="well-heading">Please select how you want to be <b>emailed</b> by us using the following subscription checkboxes below:</p>
              @if (marketingConsentBlocksSubscribe()) {
                <div class="alert alert-warning small mb-2">
                  <strong>Head office marketing consent is not given.</strong>
                  While this site respects that consent, you cannot turn list subscriptions on. You can still turn off any list you are already subscribed to.
                </div>
              } @else if (member?.emailMarketingConsent === false) {
                <div class="alert alert-warning small mb-2">
                  <strong>Head office marketing consent is not given.</strong>
                  Lists that require that consent cannot be turned on. Other lists may still be available. You can turn off any list you are already subscribed to.
                </div>
              }
              @if (systemConfig?.mailDefaults?.mailProvider === MailProvider.MAILCHIMP) {
                <app-email-subscriptions-mailchimp [member]="member"/>
              }
              @if (systemConfig?.mailDefaults?.mailProvider === MailProvider.BREVO) {
                @for (subscription of mailMessagingService.memberSubscribableSubscriptions(member); track subscription.id) {
                  <div>
                    <app-mail-subscription-setting [member]="member" [subscription]="subscription"/>
                  </div>
                }
              }
            </div>
            <div class="well well-subscriptions-confirmation">
              <p class="well-heading">Photographs and video</p>
              <app-photo-video-opt-out [member]="member"/>
            </div>
            <div class="well well-subscriptions-confirmation">
              <p class="well-heading">Please confirm the following <b>contact details</b> we hold for you. We'll use these when we need to contact you:</p>
              <div class="row">
                <div class="col col-sm-6">
                  <div class="form-group">
                    <label for="first-name">First Name</label>
                    <input [(ngModel)]="member.firstName" type="text" class="form-control input-sm" id="first-name" placeholder="Enter First Name here">
                  </div>
                </div>
                <div class="col col-sm-6">
                  <div class="form-group">
                    <label for="last-name">Last Name</label>
                    <input [(ngModel)]="member.lastName" type="text" required class="form-control input-sm" id="last-name" placeholder="Enter Last Name here">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col col-sm-6">
                  <div class="form-group">
                    <label for="mobile-number">Mobile Number</label>
                    <input [(ngModel)]="member.mobileNumber" type="text" required class="form-control input-sm" id="mobile-number" placeholder="Enter mobile number here">
                  </div>
                </div>
                <div class="col col-sm-6">
                  <div class="form-group">
                    <label for="contact-email">Contact Email</label>
                    <input [(ngModel)]="member.email" type="text" required class="form-control input-sm" id="contact-email" placeholder="Enter contact email here">
                  </div>
                </div>
              </div>
            </div>
            @if (notifyTarget.showAlert) {
              <div class="alert {{notifyTarget.alertClass}} mt-3">
                <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                @if (notifyTarget.alertTitle) {
                  <strong>{{ notifyTarget.alertTitle }}: </strong>
                } {{ notifyTarget.alertMessage }}
                @if (notifyTarget.showContactUs) {
                  <span> or contact our
                    <app-contact-us class="alert-link"></app-contact-us>.
                  </span>
                }
              </div>
            }
            <div class="d-flex flex-wrap gap-2 mt-3">
              <button type="button" class="btn btn-primary" (click)="save()" [disabled]="!member || notifyTarget.busy">
                <fa-icon [icon]="faCheck" class="me-2"/>Confirm these changes
              </button>
              <button type="button" class="btn btn-quiet" (click)="goHome()" [disabled]="notifyTarget.busy">
                <fa-icon [icon]="faForward" class="me-2"/>Continue without confirming
              </button>
            </div>
          </div>
        }
      </app-page>
    `
})
export class MailingPreferencesModalComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MailingPreferencesModalComponent", NgxLoggerLevel.ERROR);
  private memberService = inject(MemberService);
  private memberLoginService = inject(MemberLoginService);
  private viewAsService = inject(ViewAsService);
  private systemConfigService = inject(SystemConfigService);
  private profileConfirmationService = inject(ProfileConfirmationService);
  private notifierService = inject(NotifierService);
  private urlService = inject(UrlService);
  protected mailMessagingService = inject(MailMessagingService);
  private mailListUpdaterService = inject(MailListUpdaterService);
  public mailMessagingConfig: MailMessagingConfig;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public memberId: string;
  public member: Member;
  private subscriptions: Subscription[] = [];
  public systemConfig: SystemConfig;
  protected readonly MailProvider = MailProvider;
  protected readonly faCheck = faCheck;
  protected readonly faForward = faForward;

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
        .then(() => this.goHome())
        .catch((error) => this.saveOrUpdateUnsuccessful(error));
    }
  }

  goHome() {
    this.notify.clearBusy();
    this.urlService.navigateTo([]);
  }
}
