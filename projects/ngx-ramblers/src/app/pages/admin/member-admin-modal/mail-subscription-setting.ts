import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Member } from "../../../models/member.model";
import { MailConfig, MailListAudit, MailMessagingConfig, MailSubscription } from "../../../models/mail.model";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MailListAuditService } from "../../../services/mail/mail-list-audit.service";
import { AuditStatus } from "../../../models/audit";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";

@Component({
  selector: "app-mail-subscription-setting",
  template: `
    <div class="custom-control custom-checkbox">
      <input *ngIf="subscription"
             [(ngModel)]="subscription.subscribed"
             (ngModelChange)="subscriptionChange($event)"
             type="checkbox" class="custom-control-input" id="mail-list-{{subscription.id}}-subscription">
      <label class="custom-control-label"
             for="mail-list-{{subscription.id}}-subscription">{{ checkboxTitle() }}</label>
    </div>`
})
export class MailSubscriptionSettingComponent implements OnInit {

  public mailConfig: MailConfig;
  @Input() public subscription: MailSubscription;
  @Input() public member: Member;

  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  protected dateUtils: DateUtilsService = inject(DateUtilsService);
  private mailListAuditService: MailListAuditService = inject(MailListAuditService);
  private mailMessagingService: MailMessagingService = inject(MailMessagingService);
  private broadcastService: BroadcastService<MailListAudit> = inject(BroadcastService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MailSubscriptionSettingComponent", NgxLoggerLevel.OFF);
  private mailMessagingConfig: MailMessagingConfig;

  async ngOnInit() {
    this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.logger.info("ngOnInit:mailSubscription:", this.subscription, "listType:", this.listNameFor(this.subscription));
    });
  }

  listNameFor(subscription: MailSubscription) {
    return this.mailMessagingConfig?.brevo?.lists?.lists.find(list => list.id === subscription.id)?.name;
  }

  checkboxTitle() {
    return `Subscribe to ${this.listNameFor(this.subscription)} emails`;
  }

  subscriptionChange(subscriptionChangedState: any) {
    this.logger.info("subscriptionChanged:subscription", this.subscription, "subscriptionChangedState:", subscriptionChangedState);
    const mailListAudit: MailListAudit = this.mailListAuditService.createMailListAudit(`${subscriptionChangedState ? "Subscribed to" : "Unsubscribed from"} ${this.listNameFor(this.subscription)} list`, AuditStatus.info, this.member.id, this.subscription.id);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MAIL_SUBSCRIPTION_CHANGED, mailListAudit));
  }
}
