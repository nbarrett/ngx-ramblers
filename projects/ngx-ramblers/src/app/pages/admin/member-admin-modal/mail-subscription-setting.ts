import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { Member } from "../../../models/member.model";
import { MailConfig, MailMessagingConfig, MailSubscription } from "../../../models/mail.model";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-mail-subscription-setting",
    styles: [`
      :host
        display: block
    `],
    template: `
    @if (subscription && this.mailMessagingConfig) {
      <div class="form-check">
        <input [(ngModel)]="subscription.subscribed"
          (ngModelChange)="subscriptionChange($event)"
          [disabled]="subscribeLocked()"
          type="checkbox" class="form-check-input" id="mail-list-{{subscription.id}}-subscription"
          [attr.title]="subscribeLocked() ? subscribeLockedTitle() : null">
        <label class="form-check-label"
        for="mail-list-{{subscription.id}}-subscription">{{ checkboxTitle() }}</label>
      </div>
    }`,
    imports: [FormsModule]
})
export class MailSubscriptionSettingComponent implements OnInit {

  public mailConfig: MailConfig;
  @Input() public subscription: MailSubscription;
  @Input() public member: Member;

  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  private mailListUpdaterService: MailListUpdaterService = inject(MailListUpdaterService);
  private mailMessagingService: MailMessagingService = inject(MailMessagingService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MailSubscriptionSettingComponent", NgxLoggerLevel.ERROR);
  protected mailMessagingConfig: MailMessagingConfig;

  async ngOnInit() {
    this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.logger.info("ngOnInit:mail subscription:", this.subscription, "list name:", this.listNameFor(this.subscription));
    });
  }

  listNameFor(subscription: MailSubscription) {
    return this.mailMessagingConfig?.brevo?.lists?.lists.find(list => list.id === subscription.id)?.name;
  }

  checkboxTitle() {
    return `Subscribe to ${this.listNameFor(this.subscription)} emails`;
  }

  subscribeLocked(): boolean {
    return !this.subscription?.subscribed
      && this.mailListUpdaterService.marketingConsentBlocksSubscribeToList(this.member, this.subscription?.id);
  }

  subscribeLockedTitle(): string {
    return this.mailListUpdaterService.marketingConsentBlocksSubscribe(this.member)
      ? "Cannot subscribe while Head office marketing consent is withheld and the site respects that consent. You can still unsubscribe if already subscribed."
      : "Cannot subscribe to this list while Head office marketing consent is withheld, because this list requires that consent. You can still unsubscribe if already subscribed.";
  }

  subscriptionChange(subscriptionChangedState: boolean) {
    if (subscriptionChangedState && this.mailListUpdaterService.marketingConsentBlocksSubscribeToList(this.member, this.subscription?.id)) {
      this.subscription.subscribed = false;
      this.logger.info("subscriptionChange blocked: marketing consent withholds subscribe for", this.subscription);
    } else {
      this.mailListUpdaterService.setSubscription(this.member, this.subscription.id, subscriptionChangedState);
      this.logger.info("subscriptionChanged:subscription", this.subscription, "subscriptionChangedState:", subscriptionChangedState);
    }
  }
}
