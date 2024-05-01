import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { MailProvider, MailProviderStats, SystemConfig } from "../../../../models/system.model";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { enumKeyValues, KeyValue } from "../../../../services/enums";
import { MemberService } from "../../../../services/member/member.service";
import { Member } from "../../../../models/member.model";
import { MailListUpdaterService } from "../../../../services/mail/mail-list-updater.service";
import { Subscription } from "rxjs";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { MailMessagingConfig } from "../../../../models/mail.model";

@Component({
  selector: "app-mail-provider-settings",
  template: `
    <div *ngIf="this.config?.mailDefaults" class="row img-thumbnail thumbnail-2">
      <div class="thumbnail-heading">Mail</div>
      <div class="col-sm-12">
        <div class="row align-items-end">
          <div class="col-md-6">
            <div class="form-group">
              <label for="mail-provider">Mail Provider</label>
              <select [(ngModel)]="config.mailDefaults.mailProvider"
                      (ngModelChange)="calculateMailProviderStats()"
                      class="form-control" id="mail-provider">
                <option *ngFor="let mailProvider of mailProviders"
                        [ngValue]="mailProvider.value">{{ stringUtils.asTitle(mailProvider.value) }}
                </option>
              </select>
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-group">
              <app-brevo-button button *ngIf="config?.mailDefaults?.mailProvider===MailProvider.BREVO"
                                (click)="clearAllSubscriptions()"
                                title="Clear All {{stringUtils.asTitle(config.mailDefaults.mailProvider)}} subscriptions"/>
              <app-mailchimp-button button *ngIf="config.mailDefaults.mailProvider===MailProvider.MAILCHIMP"
                                    (click)="clearAllSubscriptions()"
                                    title="Clear All {{stringUtils.asTitle(config.mailDefaults.mailProvider)}} subscriptions"/>
            </div>
          </div>
          <div class="col-md-12"><label>Mail Provider Stats: {{ mailProviderStats }}</label></div>
          <div class="col-md-12">
            <div class="custom-control custom-checkbox">
              <input [(ngModel)]="config.mailDefaults.autoSubscribeNewMembers"
                     type="checkbox" class="custom-control-input" id="auto-subscribe-new-members">
              <label class="custom-control-label"
                     for="auto-subscribe-new-members">Auto-subscribe new members
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>`
})
export class MailProviderSettingsComponent implements OnInit, OnDestroy {

  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MailProviderSettingsComponent", NgxLoggerLevel.INFO);
  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  private memberService: MemberService = inject(MemberService);
  private mailListUpdaterService: MailListUpdaterService = inject(MailListUpdaterService);
  protected dateUtils: DateUtilsService = inject(DateUtilsService);
  private subscriptions: Subscription[] = [];
  public groupMembers: Member[] = [];
  public mailProviderStats = "";
  public mailProviders: KeyValue<string>[] = enumKeyValues(MailProvider);
  private mailMessagingConfig: MailMessagingConfig;
  @Output() membersPendingSave: EventEmitter<Member[]> = new EventEmitter();
  @Input() config: SystemConfig;

  protected readonly MailProvider = MailProvider;


  async ngOnInit() {
    this.logger.info("constructed with:config:", this.config);
    this.subscriptions.push(this.mailMessagingService.events().subscribe(async mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.groupMembers = (await this.memberService.all()).filter(this.memberService.filterFor.GROUP_MEMBERS);
      this.calculateMailProviderStats();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  clearAllSubscriptions() {
    switch (this.config?.mailDefaults?.mailProvider) {
      case MailProvider.BREVO:
        this.membersPendingSave.emit(this.groupMembers.map(member => {
          this.mailListUpdaterService.initialiseMailSubscriptionsFromListIds(member, this.mailMessagingConfig.mailConfig.lists, this.config?.mailDefaults.autoSubscribeNewMembers);
          return member;
        }));
        this.calculateMailProviderStats();
        break;
      case MailProvider.MAILCHIMP:
        this.groupMembers.forEach(member => this.mailListUpdaterService.initialiseMailSubscriptionsFromListIds(member, this.mailMessagingConfig.mailConfig.lists, this.config?.mailDefaults.autoSubscribeNewMembers));
        this.calculateMailProviderStats();
        break;
    }
  }

  async calculateMailProviderStats() {
    if (!this.config?.mailDefaults?.mailProvider) {
      this.config.mailDefaults = this.systemConfigService.mailDefaults();
    }
    switch (this.config?.mailDefaults?.mailProvider) {
      case MailProvider.BREVO:
        const {
          hasMailSubscription,
          pendingIds,
          validIds,
          invalidIds,
          hasNoMailSubscription
        } = this.mailListUpdaterService.mailProviderStats(this.groupMembers);
        this.logger.info("calculateMailProviderStats:for:", this.config?.mailDefaults?.mailProvider, "pendingIds:", pendingIds, "validIds:", validIds, "invalidIds:", invalidIds, "hasNoMailSubscription:", hasNoMailSubscription);
        this.mailProviderStats = `Out of total of ${this.stringUtils.pluraliseWithCount(this.groupMembers.length, "member")}, ${this.stringUtils.pluraliseWithCount(hasMailSubscription, "has", "have")} a mail subscription (${validIds} valid, ${pendingIds} pending, ${invalidIds} invalid), ${this.stringUtils.pluraliseWithCount(hasNoMailSubscription, "has", "have")} no mail subscription.`;
        break;
      case MailProvider.MAILCHIMP:
        const hasMailchimpSubscription = this.groupMembers.filter(member => member?.mailchimpLists);
        const hasNoMailchimpSubscription = this.groupMembers.length - hasMailchimpSubscription.length;
        this.mailProviderStats = `Out of total of ${this.stringUtils.pluraliseWithCount(this.groupMembers.length, "member")}, ${this.stringUtils.pluraliseWithCount(hasMailchimpSubscription.length, "has", "have")} a mail subscription, ${this.stringUtils.pluraliseWithCount(hasNoMailchimpSubscription, "has", "have")} no mail subscription.`;
        break;
      default:
        this.mailProviderStats = "No mail provider stats available";
        break;
    }
  }

  private mailProviderStatsForMailchimp(groupMembers: Member[]): MailProviderStats {
    const hasMailSubscription = groupMembers.filter(member => this.mailListUpdaterService.memberSubscribed(member));
    const configuredIds: number[] = this.mailListUpdaterService.mapToKeyValues(this.mailMessagingConfig.mailConfig.lists).map(item => item.value);
    const pendingIds: number = hasMailSubscription.filter((member: Member) => !member?.mail.id)?.length;
    const validIds: number = hasMailSubscription.filter((member: Member) => {
      const subscribedMemberIds = member?.mail.subscriptions.filter(item => item.subscribed && item?.id).map(sub => sub.id);
      const invalidMemberIds = subscribedMemberIds?.filter(item => !configuredIds.includes(item));
      const match = member?.mail.id && invalidMemberIds?.length === 0;
      this.logger.info("calculateMailProviderStats:for:", this.config?.mailDefaults?.mailProvider, "member:", member, "configuredIds:", configuredIds, "subscribedMemberIds:", subscribedMemberIds, "invalidMemberIds:", invalidMemberIds, "match:", match);
      return match;
    })?.length;
    const invalidIds: number = hasMailSubscription.length - validIds - pendingIds;
    const hasNoMailSubscription = this.groupMembers.length - hasMailSubscription.length;
    return {
      hasMailSubscription: hasMailSubscription.length,
      pendingIds,
      validIds,
      invalidIds,
      hasNoMailSubscription
    };
  }
}
