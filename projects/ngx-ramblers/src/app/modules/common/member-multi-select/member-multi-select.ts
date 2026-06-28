import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { NgLabelTemplateDirective, NgOptgroupTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { isNumber, values } from "es-toolkit/compat";
import { Member, MemberBulkLoadDateMap, MemberFilterSelection, MemberTerm, SORT_BY_NAME } from "../../../models/member.model";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MemberSelection, NotificationConfig, WorkflowAction } from "../../../models/mail.model";
import { DateRangeUnit, NO_DATE_FILTER, NotificationTimeUnit } from "../../../models/search.model";
import { DurationLike } from "luxon";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { PriorSendExclusion, RECIPIENT_PRE_FILTERS, RecipientPreFilter } from "../../../models/email-composer.model";
import { MemberEmailSendService } from "../../../services/member-email-send/member-email-send.service";

@Component({
  selector: "app-member-multi-select",
  imports: [FormsModule, NgSelectComponent, NgOptgroupTemplateDirective, NgLabelTemplateDirective],
  styles: [`
    :host ::ng-deep .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value
      display: inline-flex
      align-items: center
      padding: 2px 8px 2px 14px
      background-color: #fff5f0
      border: 1px solid #f08050
      border-radius: 16px
      font-size: 13px
      color: #9b2c2c
      overflow: hidden
    :host ::ng-deep .ng-select.ng-select-multiple .ng-value .member-chip-name
      font-weight: 600
    :host ::ng-deep .ng-select.ng-select-multiple .ng-value .member-chip-qualifier
      margin-left: 7px
      font-size: 12.5px
      font-weight: 400
      color: #495057
    :host ::ng-deep .ng-select.ng-select-multiple .ng-value .member-chip-remove
      display: inline-flex
      align-items: center
      justify-content: center
      width: 18px
      height: 18px
      margin-left: 8px
      border-radius: 50%
      font-size: 16px
      line-height: 1
      color: #6c757d
      cursor: pointer
    :host ::ng-deep .ng-select.ng-select-multiple .ng-value .member-chip-remove:hover
      background-color: #f7ddcf
      color: #212529
    :host ::ng-deep .ng-select.ng-select-multiple .ng-value.ng-value-disabled .member-chip-remove
      display: none
  `],
  template: `
    @if (!lockedSelection) {
      <div class="mb-2">
        <label class="me-2">Pre-filter:</label>
        @for (filter of preFilters; track filter.key) {
          <div class="form-check form-check-inline">
            <input class="form-check-input"
                   type="radio"
                   [id]="'pre-filter-' + (filter.key ?? 'all-with-email')"
                   name="member-pre-filter"
                   [checked]="activePreFilterKey === filter.key && !manualMode"
                   (click)="applyPreFilter(filter.key)">
            <label class="form-check-label" [for]="'pre-filter-' + (filter.key ?? 'all-with-email')">{{ labelFor(filter) }}</label>
          </div>
        }
        <div class="form-check form-check-inline">
          <input class="form-check-input"
                 type="radio"
                 id="pre-filter-clear-manual"
                 name="member-pre-filter"
                 [checked]="manualMode"
                 (click)="clear()">
          <label class="form-check-label" for="pre-filter-clear-manual">Clear and choose manually{{ EM_DASH_WITH_SPACES }}<strong>{{ selectedCount() }} of {{ selectableMembers.length }} selected</strong></label>
        </div>
      </div>
    }
    <div class="row">
      <div class="col-sm-12">
        <ng-select [items]="selectableMembers"
                   bindLabel="memberInformation"
                   bindValue="id"
                   placeholder="Select one or more members"
                   dropdownPosition="bottom"
                   [groupBy]="groupBy"
                   [groupValue]="groupValue"
                   [multiple]="true"
                   [closeOnSelect]="false"
                   [clearSearchOnAdd]="false"
                   (change)="onChange()"
                   [(ngModel)]="selectedIds">
          <ng-template ng-optgroup-tmp let-item="item">
            <span class="group-header">{{ groupLabel(item.name) }}</span>
            <span class="ms-1 badge bg-secondary badge-group">{{ item.total }}</span>
          </ng-template>
          <ng-template ng-label-tmp let-item="item" let-clear="clear"><span class="member-chip-name">{{ item.memberName }}</span>@if (item.memberQualifier) {<span class="member-chip-qualifier">{{ item.memberQualifier }}</span>}<span class="member-chip-remove" role="button" aria-label="Remove" (click)="clear(item)">×</span></ng-template>
        </ng-select>
      </div>
    </div>`
})
export class MemberMultiSelect implements OnChanges {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberMultiSelect", NgxLoggerLevel.ERROR);
  protected fullNameWithAlias = inject(FullNameWithAliasPipe);
  private dateUtils = inject(DateUtilsService);
  private stringUtils = inject(StringUtilsService);
  private memberEmailSendService = inject(MemberEmailSendService);

  @Input() members: Member[] = [];
  @Input() selectedIds: string[] = [];
  @Input() preFilterKey: MemberSelection | null = null;
  @Input() notificationConfig: NotificationConfig | null = null;
  @Input() memberBulkLoadDateMap: MemberBulkLoadDateMap | null = null;
  @Input() requireConsent: boolean = false;
  @Input() respectBlocks: boolean = false;
  @Input() unsubscribedDates: Record<string, number> = {};
  @Input() autoFill: boolean = true;
  @Input() lockedSelection: boolean = false;
  @Input() includeAlreadySent: boolean = false;
  @Output() selectedIdsChange = new EventEmitter<string[]>();
  @Output() preFilterKeyChange = new EventEmitter<MemberSelection | null>();
  @Output() priorSendExclusionsChange = new EventEmitter<PriorSendExclusion[]>();

  protected selectableMembers: MemberFilterSelection[] = [];
  protected priorSendExclusions: PriorSendExclusion[] = [];
  protected activePreFilterKey: MemberSelection | null = null;
  protected manualMode: boolean = false;
  protected priorSendDateMap: Record<string, number> = {};
  private priorSendFetchToken: number = 0;
  protected readonly preFilters: RecipientPreFilter[] = RECIPIENT_PRE_FILTERS;
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["members"] || changes["preFilterKey"] || changes["requireConsent"] || changes["respectBlocks"] || changes["unsubscribedDates"] || changes["notificationConfig"] || changes["memberBulkLoadDateMap"]) {
      this.activePreFilterKey = this.preFilterKey;
      this.manualMode = !this.autoFill;
      this.rebuildSelections();
      this.dropSelectedIdsNotInSelectablePool();
      if (this.autoFill && (!this.selectedIds || this.selectedIds.length === 0)) {
        this.applyAutoSelection();
      }
      if (changes["notificationConfig"]) {
        void this.refreshPriorSendMap();
      }
    }
    if (changes["includeAlreadySent"] && !changes["includeAlreadySent"].firstChange && !this.manualMode) {
      this.applyAutoSelection();
    }
  }

  private async refreshPriorSendMap(): Promise<void> {
    const token = ++this.priorSendFetchToken;
    const configId = this.notificationConfig?.id ?? null;
    if (!configId) {
      this.priorSendDateMap = {};
      return;
    }
    try {
      const sends = await this.memberEmailSendService.list(configId);
      if (token !== this.priorSendFetchToken) return;
      this.priorSendDateMap = sends.reduce((map, send) => {
        const existing = map[send.memberId];
        if (!existing || send.sentAt > existing) {
          map[send.memberId] = send.sentAt;
        }
        return map;
      }, {} as Record<string, number>);
    } catch (error) {
      if (token !== this.priorSendFetchToken) return;
      this.logger.warn("could not load prior send map:", error);
      this.priorSendDateMap = {};
    }
    this.rebuildSelections();
    if (this.autoFill && !this.manualMode) {
      this.applyAutoSelection();
    }
  }

  private dropSelectedIdsNotInSelectablePool(): void {
    if (!this.selectedIds || this.selectedIds.length === 0) return;
    const enabledIdSet = new Set(this.selectableMembers.filter(item => !item.disabled).map(item => item.id));
    const trimmed = this.selectedIds.filter(id => enabledIdSet.has(id));
    if (trimmed.length !== this.selectedIds.length) {
      this.selectedIds = trimmed;
      this.selectedIdsChange.emit(this.selectedIds);
    }
  }

  applyPreFilter(key: MemberSelection | null): void {
    this.activePreFilterKey = key;
    this.manualMode = false;
    this.preFilterKeyChange.emit(key);
    this.rebuildSelections();
    this.applyAutoSelection();
  }

  clear(): void {
    this.activePreFilterKey = null;
    this.manualMode = true;
    this.preFilterKeyChange.emit(null);
    this.selectedIds = [];
    this.selectedIdsChange.emit(this.selectedIds);
    this.rebuildSelections();
  }

  private priorSendExclusionApplies(): boolean {
    const configuredSelection = this.notificationConfig?.defaultMemberSelection;
    return !!configuredSelection && this.preFilters.some(filter => filter.key === configuredSelection);
  }

  private rebuildSelections(): void {
    const newExclusions: PriorSendExclusion[] = (this.manualMode || !this.priorSendExclusionApplies())
      ? []
      : this.members
        .filter(member => !this.memberDisabled(member))
        .filter(member => this.wouldMatchByCriteria(member, this.activePreFilterKey))
        .map(member => ({ member, sentAt: this.priorSendDateFor(member) }))
        .filter((entry): entry is PriorSendExclusion => isNumber(entry.sentAt) && entry.sentAt > 0)
        .sort((a, b) => b.sentAt - a.sentAt);
    const exclusionsChanged = newExclusions.length !== this.priorSendExclusions.length
      || newExclusions.some((entry, index) => entry.member.id !== this.priorSendExclusions[index]?.member.id);
    this.priorSendExclusions = newExclusions;
    if (exclusionsChanged) {
      this.priorSendExclusionsChange.emit(this.priorSendExclusions);
    }
    this.selectableMembers = this.members
      .map(member => this.toFilterSelection(member, this.activePreFilterKey))
      .sort(SORT_BY_NAME);
  }

  private applyAutoSelection(): void {
    const selected = this.selectableMembers
      .filter(item => !item.disabled)
      .filter(item => this.matchesPreFilter(item.member, this.activePreFilterKey))
      .map(item => item.id);
    this.selectedIds = selected;
    this.selectedIdsChange.emit(this.selectedIds);
  }

  private isBlocked(member: Member): boolean {
    return !!member.emailBlock;
  }

  private isUnsubscribed(member: Member): boolean {
    return !!member.id && isNumber(this.unsubscribedDates[member.id]);
  }

  private suppressionQualifier(member: Member): string | null {
    const unsubscribedAt = member.id ? this.unsubscribedDates[member.id] : undefined;
    if (isNumber(unsubscribedAt)) {
      return `unsubscribed ${this.dateUtils.displayDate(unsubscribedAt)}`;
    }
    if (member.emailBlock?.blockedAt) {
      return `blocked ${this.dateUtils.displayDate(member.emailBlock.blockedAt)}`;
    }
    return null;
  }

  private consentMissing(member: Member): boolean {
    return member.emailMarketingConsent === false;
  }

  private memberDisabled(member: Member): boolean {
    if (this.deliverabilityOptional(this.activePreFilterKey)) return false;
    if (!member.email) return true;
    if ((this.isBlocked(member) || this.isUnsubscribed(member)) && this.respectBlocks) return true;
    if (this.consentMissing(member) && this.requireConsent) return true;
    return false;
  }

  private matchesPreFilter(member: Member, key: MemberSelection | null): boolean {
    if (!this.wouldMatchByCriteria(member, key)) return false;
    if (this.includeAlreadySent || !this.priorSendExclusionApplies()) return true;
    return !this.priorSendDateFor(member);
  }

  private deliverabilityOptional(key: MemberSelection | null): boolean {
    return key === MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS || this.workflowRemovesRecipients();
  }

  private workflowRemovesRecipients(): boolean {
    const postSendActions = this.notificationConfig?.postSendActions ?? [];
    return postSendActions.includes(WorkflowAction.BULK_DELETE_GROUP_MEMBER) || postSendActions.includes(WorkflowAction.DISABLE_GROUP_MEMBER);
  }

  private wouldMatchByCriteria(member: Member, key: MemberSelection | null): boolean {
    if (!this.deliverabilityOptional(key) && !member.email) return false;
    if (!key) return true;
    switch (key) {
      case MemberSelection.RECENTLY_ADDED:
        return !!(member.groupMember && member.createdDate && (this.noDateFilter() || member.createdDate >= this.filterDateMillis()));
      case MemberSelection.EXPIRED_MEMBERS:
        return this.isExpiredMember(member);
      case MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS:
        return this.missingFromBulkLoad(member);
      case MemberSelection.ADDED_IN_LAST_BULK_LOAD_MEMBERS:
        return this.addedInLastBulkLoad(member);
      default:
        return false;
    }
  }

  private isExpiredMember(member: Member): boolean {
    const memberStatus = member.memberStatus?.toLowerCase();
    const paymentPending = memberStatus === "payment pending";
    const lifeMember = member.memberTerm === MemberTerm.LIFE;
    if (!member.groupMember || !member.membershipExpiryDate || paymentPending || lifeMember) return false;
    if (this.noDateFilter()) return member.membershipExpiryDate < this.dateUtils.dateTimeNowNoTime().toMillis();
    const recentlyLoadedDate = this.dateUtils.dateTimeNowNoTime().minus(this.windowDurationSpec()).toMillis();
    const recentlyLoaded = !!member.createdDate && member.createdDate >= recentlyLoadedDate;
    if (recentlyLoaded) return false;
    const expirationExceeded = member.membershipExpiryDate < this.filterDateMillis();
    const recentlyCreated = !!member.createdDate && member.createdDate >= recentlyLoadedDate;
    const recentlyUpdated = !!member.updatedDate && member.updatedDate >= recentlyLoadedDate;
    return expirationExceeded && !recentlyCreated && !recentlyUpdated;
  }

  private missingFromBulkLoad(member: Member): boolean {
    if (!member.groupMember || !member.membershipNumber) {
      return false;
    }
    const lastBulkLoadDate = this.memberBulkLoadDateMap?.[member.membershipNumber];
    return !!lastBulkLoadDate && (this.noDateFilter() || lastBulkLoadDate < this.filterDateMillis());
  }

  private latestBulkLoadDateMillis(): number | undefined {
    const dates = values(this.memberBulkLoadDateMap ?? {});
    return dates.length ? Math.max(...dates) : undefined;
  }

  private addedInLastBulkLoad(member: Member): boolean {
    if (!member.groupMember || !member.membershipNumber) return false;
    const latestBulkLoadDate = this.latestBulkLoadDateMillis();
    const memberBulkLoadDate = this.memberBulkLoadDateMap?.[member.membershipNumber];
    return !!latestBulkLoadDate && memberBulkLoadDate === latestBulkLoadDate && !!member.createdDate && member.createdDate >= latestBulkLoadDate;
  }

  private priorSendDateFor(member: Member): number | undefined {
    return member.id ? this.priorSendDateMap[member.id] : undefined;
  }

  private amountInPast(): number {
    const amount = this.notificationConfig?.monthsInPast;
    return isNumber(amount) ? amount : 1;
  }

  private timeUnit(): NotificationTimeUnit {
    return this.notificationConfig?.timeUnit ?? DateRangeUnit.MONTHS;
  }

  private noDateFilter(): boolean {
    return this.timeUnit() === NO_DATE_FILTER;
  }

  private unitSingular(): string {
    return this.timeUnit().replace(/s$/, "");
  }

  private windowDurationSpec(): DurationLike {
    return { [this.timeUnit()]: this.amountInPast() } as DurationLike;
  }

  private filterDateMillis(): number {
    return this.dateUtils.dateTimeNowNoTime().minus(this.windowDurationSpec()).toMillis();
  }

  protected labelFor(filter: RecipientPreFilter): string {
    const amount = this.amountInPast();
    const unit = this.unitSingular();
    const noSuffix = this.noDateFilter() || amount === 0;
    switch (filter.key) {
      case MemberSelection.RECENTLY_ADDED:
        return noSuffix ? "Added recently" : `Added in last ${this.stringUtils.pluraliseWithCount(amount, unit)}`;
      case MemberSelection.EXPIRED_MEMBERS:
        return noSuffix ? "Expired" : `Expired (${this.stringUtils.pluraliseWithCount(amount, unit)} past expiry)`;
      case MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS:
        return noSuffix ? "Missing from bulk load" : `Missing from bulk load (${this.stringUtils.pluraliseWithCount(amount, unit)} or more)`;
      default:
        return filter.label;
    }
  }

  private toFilterSelection(member: Member, preFilterKey: MemberSelection | null): MemberFilterSelection {
    const noEmail = !member.email;
    const suppressed = !noEmail && (this.isBlocked(member) || this.isUnsubscribed(member));
    const consentMissing = !noEmail && !suppressed && this.consentMissing(member);
    const disabled = this.memberDisabled(member);
    const today = this.dateUtils.dateTimeNowNoTime().toMillis();
    const expired = !noEmail && !suppressed && !!member.membershipExpiryDate && member.membershipExpiryDate < today;
    const memberGrouping = this.memberGroupingFor(noEmail, suppressed, consentMissing, expired);
    const memberName = this.fullNameWithAlias.transform(member);
    const statusQualifier = noEmail ? "no email address" : consentMissing ? "without Head Office consent" : null;
    const contextualLabel = this.qualifierLabel(this.contextualQualifier(member, preFilterKey, memberGrouping));
    const memberQualifier = [statusQualifier, contextualLabel].filter(Boolean).join(", ");
    const memberInformation = memberQualifier ? `${memberName} (${memberQualifier})` : memberName;
    return { id: member.id, member, memberInformation, memberName, memberQualifier, memberGrouping, disabled };
  }

  private qualifierLabel(qualifier: string): string {
    if (qualifier === "active members with consent given") {
      return "with Head Office consent";
    }
    if (qualifier === "members without Head Office consent") {
      return "without Head Office consent";
    }
    return qualifier;
  }

  private memberGroupingFor(noEmail: boolean, suppressed: boolean, consentMissing: boolean, expired: boolean): string {
    if (noEmail) return "no email address";
    if (suppressed) return "unsubscribed or blocked from email";
    if (consentMissing) return "members without Head Office consent";
    if (expired) return "expired members";
    return "active members with consent given";
  }

  private contextualQualifier(member: Member, preFilterKey: MemberSelection | null, memberGrouping: string): string {
    const suppressionQualifier = this.suppressionQualifier(member);
    if (suppressionQualifier) {
      return suppressionQualifier;
    }
    const priorSendDate = this.priorSendDateFor(member);
    if (priorSendDate) {
      return `already sent ${this.dateUtils.displayDate(priorSendDate)}`;
    }
    switch (preFilterKey) {
      case MemberSelection.RECENTLY_ADDED:
        return member.createdDate
          ? `created ${this.dateUtils.displayDate(member.createdDate)}`
          : memberGrouping;
      case MemberSelection.EXPIRED_MEMBERS:
        if (!member.membershipExpiryDate) {
          return memberGrouping;
        }
        return member.membershipExpiryDate < this.dateUtils.dateTimeNowNoTime().toMillis()
          ? `expired ${this.dateUtils.displayDate(member.membershipExpiryDate)}`
          : `expires ${this.dateUtils.displayDate(member.membershipExpiryDate)}`;
      case MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS: {
        const lastBulkLoadDate = member.membershipNumber ? this.memberBulkLoadDateMap?.[member.membershipNumber] : null;
        return lastBulkLoadDate
          ? `last bulk load ${this.dateUtils.displayDate(lastBulkLoadDate)}`
          : memberGrouping;
      }
      case MemberSelection.ADDED_IN_LAST_BULK_LOAD_MEMBERS: {
        const memberBulkLoadDate = member.membershipNumber ? this.memberBulkLoadDateMap?.[member.membershipNumber] : null;
        return memberBulkLoadDate
          ? `added in bulk load ${this.dateUtils.displayDate(memberBulkLoadDate)}`
          : memberGrouping;
      }
      default:
        return memberGrouping;
    }
  }

  groupBy(member: MemberFilterSelection): string {
    return member.memberGrouping;
  }

  groupValue(_: string, children: any[]): { name: string; total: number; children: any[] } {
    return { name: children[0]?.memberGrouping || "members", total: children?.length || 0, children };
  }

  groupLabel(name: string): string {
    return name?.includes("members") ? name : `${name} members`;
  }

  onChange(): void {
    this.logger.info("selection changed:", this.stringUtils.pluraliseWithCount(this.selectedIds.length, "member"));
    this.selectedIdsChange.emit(this.selectedIds);
  }

  selectedCount(): number {
    return this.selectedIds?.length ?? 0;
  }
}
