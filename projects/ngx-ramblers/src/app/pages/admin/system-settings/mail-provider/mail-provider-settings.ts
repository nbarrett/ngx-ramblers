import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { MailProvider, MailProviderStats, SystemConfig } from "../../../../models/system.model";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { enumKeyValues, KeyValue } from "../../../../functions/enums";
import { MemberService } from "../../../../services/member/member.service";
import { Member } from "../../../../models/member.model";
import { MailListUpdaterService } from "../../../../services/mail/mail-list-updater.service";
import { Subscription } from "rxjs";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { MailMessagingConfig } from "../../../../models/mail.model";
import { MailchimpListService } from "../../../../services/mailchimp/mailchimp-list.service";
import { MailchimpConfig } from "../../../../models/mailchimp.model";
import { MailchimpConfigService } from "../../../../services/mailchimp-config.service";
import first from "lodash-es/first";

@Component({
  selector: "app-mail-provider-settings",
  template: `
    <div *ngIf="this.config?.mailDefaults" class="row img-thumbnail thumbnail-2">
      <div class="thumbnail-heading">Mail</div>
      <div class="col-md-12" *ngIf="config.mailDefaults.mailProvider===MailProvider.MAILCHIMP">
        <div class="custom-control custom-checkbox">
          <input [(ngModel)]="config.mailDefaults.autoSubscribeNewMembers"
                 type="checkbox" class="custom-control-input" id="auto-subscribe-new-members">
          <label class="custom-control-label"
                 for="auto-subscribe-new-members">Auto-subscribe new members or initialised subscriptions
          </label>
        </div>
      </div>
      <div class="col-sm-12">
        <div class="row align-items-end">
          <div class="col-md-6">
            <div class="form-group">
              <label for="mail-provider">Mail Provider</label>
              <select [(ngModel)]="config.mailDefaults.mailProvider"
                      (ngModelChange)="changeMailProvider()"
                      class="form-control" id="mail-provider">
                <option *ngFor="let mailProvider of mailProviders"
                        [ngValue]="mailProvider.value">{{ stringUtils.asTitle(mailProvider.value) }}
                </option>
              </select>
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-group">
              <label for="mail-provider">List</label>
              <select [(ngModel)]="list"
                      (ngModelChange)="calculateMailProviderStats()"
                      class="form-control" id="list">
                <option *ngFor="let list of listKeyValues"
                        [ngValue]="list">{{ stringUtils.asTitle(list.key) }}
                </option>
              </select>
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-group">
              <app-brevo-button button *ngIf="config?.mailDefaults?.mailProvider===MailProvider.BREVO"
                                (click)="initialiseAllSubscriptions()"
                                title="Initialise All {{stringUtils.asTitle(config.mailDefaults.mailProvider)}} subscriptions"/>
              <app-mailchimp-button button *ngIf="config.mailDefaults.mailProvider===MailProvider.MAILCHIMP"
                                    (click)="initialiseAllSubscriptions()"
                                    title="Initialise All {{stringUtils.asTitle(config.mailDefaults.mailProvider)}} subscriptions"/>
            </div>
          </div>
          <div class="col-md-12"><label>Mail Provider Stats: {{ mailProviderStats }}</label></div>
        </div>
      </div>
    </div>`
})
export class MailProviderSettingsComponent implements OnInit, OnDestroy {

  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MailProviderSettingsComponent", NgxLoggerLevel.OFF);
  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  private memberService: MemberService = inject(MemberService);
  private mailchimpConfigService: MailchimpConfigService = inject(MailchimpConfigService);
  private mailchimpListService: MailchimpListService = inject(MailchimpListService);
  private mailListUpdaterService: MailListUpdaterService = inject(MailListUpdaterService);
  protected dateUtils: DateUtilsService = inject(DateUtilsService);
  private subscriptions: Subscription[] = [];
  public groupMembers: Member[] = [];
  public mailProviderStats = "";
  public mailProviders: KeyValue<string>[] = enumKeyValues(MailProvider);
  protected mailMessagingConfig: MailMessagingConfig;
  private mailchimpConfig: MailchimpConfig;
  public listKeyValues: KeyValue<any>[] = [];
  public list: KeyValue<any>;
  @Output() membersPendingSave: EventEmitter<Member[]> = new EventEmitter();
  @Input() config: SystemConfig;

  protected readonly MailProvider = MailProvider;


  async ngOnInit() {
    this.logger.info("constructed with:config:", this.config);
    this.subscriptions.push(this.mailMessagingService.events().subscribe(async mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.groupMembers = (await this.memberService.all()).filter(this.memberService.filterFor.GROUP_MEMBERS);
      this.mailchimpConfig = await this.mailchimpConfigService.getConfig();
      this.calculateListKeyValues();
      this.list = first(this.listKeyValues);
      this.calculateMailProviderStats();
    }));
  }
  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  initialiseAllSubscriptions() {
    switch (this.config?.mailDefaults?.mailProvider) {
      case MailProvider.BREVO:
        this.membersPendingSave.emit(this.groupMembers.map(member => {
          this.mailListUpdaterService.initialiseMailSubscriptionsFromListIds(member, this.mailMessagingConfig);
          return member;
        }));
        this.calculateMailProviderStats();
        break;
      case MailProvider.MAILCHIMP:
        const configuredKeys = this.listKeyValues.filter(item => item.value).map(item => item.key);
        this.logger.info("clearAllSubscriptions:for configuredKeys:", configuredKeys);
        this.groupMembers.forEach(member => configuredKeys.forEach(listType => this.mailchimpListService.initialiseSubscription(member, listType, this.config?.mailDefaults.autoSubscribeNewMembers)));
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
        const mailProviderStats = this.mailListUpdaterService.mailProviderStats(this.groupMembers, this.list.value);
        this.updateMailProviderStatsWith(mailProviderStats);
        break;
      case MailProvider.MAILCHIMP:
        const mailchimpProviderStats = this.mailchimpListService.mailProviderStats(this.groupMembers, "general");
        this.updateMailProviderStatsWith(mailchimpProviderStats);
        break;
      default:
        this.mailProviderStats = "No mail provider stats available";
        break;
    }
  }

  calculateListKeyValues() {
    switch (this.config?.mailDefaults?.mailProvider) {
      case MailProvider.BREVO:
        this.listKeyValues = this.mailMessagingConfig?.brevo?.lists?.lists.map(item => ({
          key: item.name,
          value: item.id
        }));
        break;
      case MailProvider.MAILCHIMP:
        this.listKeyValues = this.mailchimpConfigService.configuredListTypes(this.mailchimpConfig);
        break;
      default:
        this.listKeyValues = [];
        break;
    }
  }

  private updateMailProviderStatsWith(mailProviderStats: MailProviderStats) {
    this.logger.info("calculateMailProviderStats:for:", this.config?.mailDefaults?.mailProvider, "pendingIds:", mailProviderStats.pendingIds, "validIds:", mailProviderStats.validIds, "invalidIds:", mailProviderStats.invalidIds, "hasNoMailSubscription:", mailProviderStats.hasNoMailSubscription);
    this.mailProviderStats = `Out of total of ${this.stringUtils.pluraliseWithCount(this.groupMembers.length, "member")}, ${this.stringUtils.pluraliseWithCount(mailProviderStats.hasMailSubscription, "has", "have")} a mail subscription (${mailProviderStats.validIds} valid, ${mailProviderStats.pendingIds} pending, ${mailProviderStats.invalidIds} invalid), ${this.stringUtils.pluraliseWithCount(mailProviderStats.hasNoMailSubscription, "has", "have")} no mail subscription.`;
  }

  changeMailProvider() {
    this.calculateListKeyValues();
    this.calculateMailProviderStats();
  }
}
