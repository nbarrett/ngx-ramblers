import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { faBan, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
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
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">Subscriptions</div>
          <div class="col-sm-12">
          <p class="mb-2">Please select how {{ member | fullNameWithAlias }} wants to be <b>emailed</b>
            by using the subscription checkboxes below.</p>
          @if (member?.mail?.subscriptions && mailMessagingConfig) {
            <div class="row">
              @for (subscription of member.mail.subscriptions; track subscription.id) {
                <div class="col-sm-4">
                  <app-mail-subscription-setting [member]="member" [subscription]="subscription"/>
                </div>
              }
            </div>
            @if (notEmailableReason(); as reason) {
              <div class="alert alert-warning small mt-3 mb-0">
                <div class="d-flex align-items-center mb-1">
                  <fa-icon [icon]="faTriangleExclamation" class="me-2"></fa-icon>
                  <strong>Subscriptions do not guarantee delivery</strong>
                </div>
                <span>A ticked list above shows what {{ member | fullNameWithAlias }} has opted into - it does not mean they will be emailed. {{ reason }}.</span>
                @if (consentMissing()) {
                  <div class="mt-1">
                    <a href="javascript:void(0)" (click)="viewConsent($event)">View consent settings on the Ramblers Membership tab</a>
                  </div>
                }
              </div>
            }
          }
          </div>
        </div>
      }
        <div class="row mt-3">
          <div class="col col-sm-12 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <app-section-toggle
              [tabs]="subTabs"
              [selectedTab]="activeSubTab"
              (selectedTabChange)="onSubTabChange($event)"
              [queryParamKey]="subTabQueryParam"
              [fullWidth]="false"/>
            <app-brevo-button button [disabled]="!member?.mail?.id"
              (click)="viewBrevoContact(member?.mail?.id)"
              [title]="linkTitle()"/>
          </div>
        </div>
        <div class="row mt-3">
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
            @if (member?.email) {
              <div [class.d-none]="activeSubTab !== BrevoTabSubTab.ACTIVITY">
                <app-brevo-contact-view
                  [contactId]="member?.mail?.id ?? null"
                  [contactEmail]="member.email"
                  [mailMessagingConfig]="mailMessagingConfig"
                  (refreshed)="refreshRequested.emit()"/>
              </div>
            }
          </div>
        </div>
      </div>`,
    imports: [MailSubscriptionSettingComponent, BrevoButtonComponent, BrevoContactViewComponent, DisplayDateAndTimePipe, FullNameWithAliasPipe, MemberIdToFullNamePipe, FontAwesomeModule, SectionToggle, SortableTableComponent, SortableTableCellDirective]
})
export class MailSubscriptionSettingsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MailSubscriptionSettingsComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  mailLinkService = inject(MailLinkService);
  protected mailMessagingService = inject(MailMessagingService);
  protected dateUtils = inject(DateUtilsService);
  @Output() unsubscribesRequested = new EventEmitter<void>();
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() viewConsentRequested = new EventEmitter<void>();
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

  protected activeSubTab: BrevoTabSubTab = BrevoTabSubTab.ACTIVITY;
  protected readonly subTabQueryParam: string = BREVO_TAB_SUB_TAB_QUERY_PARAM;
  protected readonly subTabs: SectionToggleTab[] = [
    { value: BrevoTabSubTab.ACTIVITY, label: "Brevo activity" },
    { value: BrevoTabSubTab.AUDIT_LOG, label: "Subscription audit" }
  ];
  protected readonly auditColumns: SortableTableColumn<MailListAudit>[] = [
    { key: "time", label: "Time", sortKey: "timestamp" },
    { key: "createdBy", label: "Created By", sortKey: "createdBy" },
    { key: "audit", label: "Audit Message" }
  ];
  protected readonly BrevoTabSubTab = BrevoTabSubTab;
  protected readonly DESCENDING = DESCENDING;
  protected readonly faBan = faBan;
  protected readonly faTriangleExclamation = faTriangleExclamation;

  private respectsHeadOfficeConsent(): boolean {
    return this.mailMessagingConfig?.mailConfig?.respectHeadOfficeConsent !== false;
  }

  private respectsEmailBlocks(): boolean {
    return this.mailMessagingConfig?.mailConfig?.respectEmailBlocks === true;
  }

  blockExcludesFromSend(): boolean {
    return !!this.member?.emailBlock && this.respectsEmailBlocks();
  }

  notEmailableReason(): string | null {
    if (this.blockExcludesFromSend()) {
      return "They have unsubscribed or been blocked, so they are excluded from any send that respects blocks";
    }
    if (this.consentMissing()) {
      return "Head Office marketing consent has not been given, so they are excluded from any send that respects consent";
    }
    return null;
  }

  consentMissing(): boolean {
    return !!this.member && !this.member.emailMarketingConsent && this.respectsHeadOfficeConsent() && !this.blockExcludesFromSend();
  }

  viewConsent(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.viewConsentRequested.emit();
  }

  onSubTabChange(value: BrevoTabSubTab): void {
    this.activeSubTab = value;
  }

  ngOnInit() {
    this.activeSubTab = this.member?.mail?.id ? BrevoTabSubTab.ACTIVITY : BrevoTabSubTab.AUDIT_LOG;
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
