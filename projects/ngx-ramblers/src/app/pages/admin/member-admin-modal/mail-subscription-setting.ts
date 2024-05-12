import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Member } from "../../../models/member.model";
import { MailConfig, MailListAudit, MailSubscription } from "../../../models/mail.model";
import { KeyValue } from "../../../services/enums";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MailConfigService } from "../../../services/mail/mail-config.service";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { MailListAuditService } from "../../../services/mail/mail-list-audit.service";
import { AuditStatus } from "../../../models/audit";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";

@Component({
  selector: "app-mail-subscription-setting",
  template: `
    <div class="row">
      <div class="col-sm-5">
        <div class="custom-control custom-checkbox">
          <input *ngIf="subscription"
                 [(ngModel)]="subscription.subscribed"
                 (ngModelChange)="subscriptionChange($event)"
                 type="checkbox" class="custom-control-input" id="mail-list-{{subscription.id}}-subscription">
          <label class="custom-control-label"
                 for="mail-list-{{subscription.id}}-subscription">{{ checkboxTitle() }}</label>
        </div>
      </div>
    </div>`
})
export class MailSubscriptionSettingComponent implements OnInit {

  public mailConfig: MailConfig;
  @Input() public subscription: MailSubscription;
  @Input() public member: Member;
  private lists: KeyValue<number>[] = [];

  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  protected dateUtils: DateUtilsService = inject(DateUtilsService);
  private mailConfigService: MailConfigService = inject(MailConfigService);
  private mailListAuditService: MailListAuditService = inject(MailListAuditService);
  private mailListUpdaterService: MailListUpdaterService = inject(MailListUpdaterService);
  private broadcastService: BroadcastService<MailListAudit> = inject(BroadcastService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MailSubscriptionSettingComponent", NgxLoggerLevel.OFF);

  async ngOnInit() {
    this.mailConfig = await this.mailConfigService.queryConfig();
    this.lists = this.mailListUpdaterService.mapToKeyValues(this.mailConfig?.lists);
    this.logger.info("ngOnInit:mailSubscription:", this.subscription, "listType:", this.listTypeFor(this.subscription));
  }

  listTypeFor(subscription: MailSubscription) {
    return this.lists.find(list => list.value === subscription.id)?.key;
  }

  checkboxTitle() {
    return `Subscribe to ${this.listTypeFor(this.subscription)} emails`;
  }

  subscriptionChange(subscriptionChangedState: any) {
    this.logger.info("subscriptionChanged:subscription", this.subscription, "subscriptionChangedState:", subscriptionChangedState);
    const mailListAudit: MailListAudit = this.mailListAuditService.createMailListAudit(`${subscriptionChangedState ? "Subscribed to" : "Unsubscribed from"} ${this.listTypeFor(this.subscription)} list`, AuditStatus.info, this.member.id, this.subscription.id);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MAIL_SUBSCRIPTION_CHANGED, mailListAudit));
  }
}
