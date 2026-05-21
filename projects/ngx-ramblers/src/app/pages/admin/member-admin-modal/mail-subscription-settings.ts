import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { faBan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Member, MemberEmailBlock } from "../../../models/member.model";
import {
  BLOCKED_CONTACT_REASON_LABELS,
  ListInfo,
  ListSetting,
  MailListAudit,
  MailMessagingConfig,
  MailSubscription
} from "../../../models/mail.model";
import { MailLinkService } from "../../../services/mail/mail-link.service";
import { cloneDeep } from "es-toolkit/compat";
import { SystemConfig } from "../../../models/system.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { MailSubscriptionSettingComponent } from "./mail-subscription-setting";
import { BrevoButtonComponent } from "../../../modules/common/third-parties/brevo-button";
import { BrevoContactViewComponent } from "./brevo-contact-view";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { MemberIdToFullNamePipe } from "../../../pipes/member-id-to-full-name.pipe";
import { SectionToggle, SectionToggleTab } from "../../../shared/components/section-toggle";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn } from "../../../modules/common/sortable-table/sortable-table.model";
import { BREVO_TAB_SUB_TAB_QUERY_PARAM, BrevoTabSubTab } from "../../../models/mail.model";
import { DESCENDING } from "../../../models/table-filtering.model";

@Component({
    selector: "[app-mail-subscription-settings]",
    template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      @if (member?.emailBlock; as block) {
        <div class="alert alert-warning small mb-3 d-flex align-items-center">
          <fa-icon [icon]="faBan" class="me-2"></fa-icon>
          <span>
            <strong>{{ blockedTitle() }}</strong> &mdash; {{ blockReasonLabel(block) }}, {{ formatBlockDate(block.blockedAt) }}.
            Re-enable via <a href="javascript:void(0)" (click)="goToUnsubscribes($event)">Mail Settings &rarr; Unsubscribes</a>.
          </span>
        </div>
      }
      @if (member) {
        <div class="row">
          <div class="col-sm-12">
            <p>Please select how {{ member | fullNameWithAlias }} wants to be <b>emailed</b>
          by using the subscription checkboxes below.</p>
        </div>
        <div class="col-sm-12">
          @if (member.emailMarketingConsent) {
            <p>Email Marketing Consent was provided
              by {{ member | fullNameWithAlias }} @if (member.emailPermissionLastUpdated) {
              <span
                >via <a href="https://www.ramblers.org.uk/my-account">The Ramblers Website</a> on {{ member.emailPermissionLastUpdated | displayDate }}</span>
                }.
              </p>
            }
            @if (!member.emailMarketingConsent) {
              <p>Email Marketing Consent has not been given by {{ member | fullNameWithAlias }}.
                @if (member.emailPermissionLastUpdated) {
                  <span> This was last updated via <a href="https://www.ramblers.org.uk/my-account">The Ramblers Website</a> on {{ member.emailPermissionLastUpdated | displayDate }}.</span>
                }</p>
              }
              @if (hasGranularConsent()) {
                <p class="mb-1"><strong>Granular consent (Salesforce):</strong></p>
                <ul class="mb-2">
                  @if (member.groupMarketingConsent !== undefined) {
                    <li>Local group emails: {{ member.groupMarketingConsent ? "opted in" : "opted out" }}</li>
                  }
                  @if (member.areaMarketingConsent !== undefined) {
                    <li>Area emails: {{ member.areaMarketingConsent ? "opted in" : "opted out" }}</li>
                  }
                  @if (member.otherMarketingConsent !== undefined) {
                    <li>Other groups' emails: {{ member.otherMarketingConsent ? "opted in" : "opted out" }}</li>
                  }
                </ul>
              }
            </div>
            <div class="col-sm-12 mb-3">
              @if (member?.mail?.subscriptions && mailMessagingConfig) {
                <div class="row">
                  @for (subscription of member.mail.subscriptions; track subscription.id) {
                    <div class="col-sm-4">
                      <app-mail-subscription-setting [member]="member" [subscription]="subscription"/>
                    </div>
                  }
                  <div class="col">
                    <app-brevo-button button [disabled]="!member?.mail?.id"
                      (click)="viewBrevoContact(member?.mail?.id)"
                      [title]="linkTitle()"/>
                  </div>
                </div>
              }
            </div>
          </div>
        }
        <div class="row mt-2">
          <div class="col col-sm-12">
            <app-section-toggle
              [tabs]="subTabs"
              [selectedTab]="activeSubTab"
              (selectedTabChange)="onSubTabChange($event)"
              [queryParamKey]="subTabQueryParam"
              [fullWidth]="false"/>
          </div>
        </div>
        <div class="row mt-2">
          <div class="col col-sm-12">
            <div [class.d-none]="activeSubTab !== BrevoTabSubTab.AUDIT_LOG">
              <app-sortable-table
                [columns]="auditColumns"
                [rows]="mailListAudits || []"
                [defaultSortKey]="'timestamp'"
                [defaultSortDirection]="DESCENDING"
                emptyMessage="No mail list audit entries">
                <ng-template appSortableTableCell="time" let-row>{{ row.timestamp | displayDateAndTime }}</ng-template>
                <ng-template appSortableTableCell="createdBy" let-row>{{ row.createdBy | memberIdToFullName : members }}</ng-template>
                <ng-template appSortableTableCell="audit" let-row>{{ stringUtils.stringifyObject(row.audit) }}</ng-template>
              </app-sortable-table>
            </div>
            @if (member?.mail?.id) {
              <div [class.d-none]="activeSubTab !== BrevoTabSubTab.ACTIVITY">
                <app-brevo-contact-view
                  [contactId]="member.mail.id"
                  [contactEmail]="member.email"
                  [mailMessagingConfig]="mailMessagingConfig"/>
              </div>
            }
          </div>
        </div>
      </div>`,
    imports: [MailSubscriptionSettingComponent, BrevoButtonComponent, BrevoContactViewComponent, DisplayDateAndTimePipe, DisplayDatePipe, FullNameWithAliasPipe, MemberIdToFullNamePipe, FontAwesomeModule, SectionToggle, SortableTableComponent, SortableTableCellDirective]
})
export class MailSubscriptionSettingsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MailSubscriptionSettingsComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  mailLinkService = inject(MailLinkService);
  protected mailMessagingService = inject(MailMessagingService);
  protected dateUtils = inject(DateUtilsService);
  @Output() unsubscribesRequested = new EventEmitter<void>();
  public member: Member;
  public systemConfig: SystemConfig;
  public mailMessagingConfig: MailMessagingConfig;
  @Input("systemConfig") set systemConfigValue(systemConfig: SystemConfig) {
    this.systemConfig = systemConfig;
    this.initialiseSubscriptions();
  }

  @Input("mailMessagingConfig") set mailMessagingConfigValue(mailMessagingConfig: MailMessagingConfig) {
    this.mailMessagingConfig = mailMessagingConfig;
    this.initialiseSubscriptions();
  }

  @Input("member") set memberValue(member: Member) {
    this.member = member;
  }

  @Input() public mailListAudits: MailListAudit[];
  @Input() public members: Member[];

  protected activeSubTab: BrevoTabSubTab = BrevoTabSubTab.AUDIT_LOG;
  protected readonly subTabQueryParam: string = BREVO_TAB_SUB_TAB_QUERY_PARAM;
  protected readonly subTabs: SectionToggleTab[] = [
    { value: BrevoTabSubTab.AUDIT_LOG, label: "Subscription audit" },
    { value: BrevoTabSubTab.ACTIVITY, label: "Brevo activity" }
  ];
  protected readonly auditColumns: SortableTableColumn<MailListAudit>[] = [
    { key: "time", label: "Time", sortKey: "timestamp" },
    { key: "createdBy", label: "Created By", sortKey: "createdBy" },
    { key: "audit", label: "Audit Message" }
  ];
  protected readonly BrevoTabSubTab = BrevoTabSubTab;
  protected readonly DESCENDING = DESCENDING;
  protected readonly faBan = faBan;

  onSubTabChange(value: BrevoTabSubTab): void {
    this.activeSubTab = value;
  }

  ngOnInit() {
    this.initialiseSubscriptions();
  }

  viewBrevoContact(id: number) {
    return id ? window.open(`${this.mailLinkService.contactView(id)}`) : null;
  }

  blockReasonLabel(block: MemberEmailBlock): string {
    if (!block?.reasonCode) return "Unknown reason";
    return BLOCKED_CONTACT_REASON_LABELS[block.reasonCode] || block.reasonCode;
  }

  blockedTitle(): string {
    return this.member?.mail?.id ? "Blocked in Brevo" : "Blocked locally";
  }

  goToUnsubscribes(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.unsubscribesRequested.emit();
  }

  formatBlockDate(timestamp: number | undefined): string {
    if (!timestamp) return "unknown date";
    return this.dateUtils.displayDateAbbreviatedTime(timestamp) || "unknown date";
  }

  linkTitle() {
    return this.member?.mail?.id ? "View contact details In Brevo" : "Contact not yet created in Brevo";
  }

  hasGranularConsent(): boolean {
    return this.member?.groupMarketingConsent !== undefined
      || this.member?.areaMarketingConsent !== undefined
      || this.member?.otherMarketingConsent !== undefined;
  }

  private listSetting(list: ListInfo): ListSetting {
    return this.mailMessagingConfig?.mailConfig?.listSettings?.find(item => item.id === list.id);
  }

  private initialiseListSubscription(list: ListInfo) {
    this.logger.info("constructed with:member:", this.member, "mailMessagingConfig:", this.mailMessagingConfig, "list:", list);
    if (this.mailMessagingConfig && list && this.member && !this.member.mail?.subscriptions?.find(mailSubscription => mailSubscription?.id === list.id)) {
      const listSetting: ListSetting = this.listSetting(list);
      const subscription: MailSubscription = {
        subscribed: this.mailMessagingService.subscribed(listSetting, this.member),
        id: list.id
      };
      if (!this.member?.mail?.subscriptions) {
        this.logger.info("mail subscription doesn't exist - creating default value:", subscription);
        this.member.mail = {...this.member.mail, subscriptions: [subscription]};
      } else if (!this.member?.mail.subscriptions?.find(mailSubscription => mailSubscription?.id === list.id)) {
        this.logger.info("mail subscription exists as", cloneDeep(this.member.mail.subscriptions), "but missing value for", list, "- adding value:", subscription);
        this.member.mail.subscriptions.push(subscription);
      }
    }
  }

  private initialiseSubscriptions() {
    if (this.mailMessagingConfig && this.systemConfig && this.member) {
      this.logger.info("constructed with:member:", this.member, "mailMessagingConfig:", this.mailMessagingConfig,);
      this.mailMessagingConfig?.brevo?.lists?.lists.forEach((list: ListInfo) => this.initialiseListSubscription(list));
      this.removeInvalidSubscriptions();
    } else {
      this.logger.info("initialiseSubscriptions:missing:member:", this.member, "mailMessagingConfig:", this.mailMessagingConfig, "systemConfig:", this.systemConfig);
    }
  }

  private removeInvalidSubscriptions() {
    this.logger.info("removeInvalidSubscriptions:before:", cloneDeep(this.member.mail.subscriptions));
    const validIds: number[] = this.mailMessagingConfig.brevo.lists.lists.map(list => list.id);
    this.member.mail.subscriptions = this.member.mail.subscriptions.filter(item => validIds.includes(item.id));
    this.logger.info("removeInvalidSubscriptions:after:", this.member.mail.subscriptions, "applying validIds:", validIds);
  }
}
