import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { NgOptgroupTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { isNumber } from "es-toolkit/compat";
import { Member, MemberBulkLoadDateMap, MemberFilterSelection, MemberTerm, SORT_BY_NAME } from "../../../models/member.model";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MemberSelection, NotificationConfig } from "../../../models/mail.model";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { PriorSendExclusion, RECIPIENT_PRE_FILTERS, RecipientPreFilter } from "../../../models/email-composer.model";
import { MemberEmailSendService } from "../../../services/member-email-send/member-email-send.service";

@Component({
  selector: "app-member-multi-select",
  imports: [FormsModule, NgSelectComponent, NgOptgroupTemplateDirective],
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
                   [clearSearchOnAdd]="true"
                   (change)="onChange()"
                   [(ngModel)]="selectedIds">
          <ng-template ng-optgroup-tmp let-item="item">
            <span class="group-header">{{ groupLabel(item.name) }}</span>
            <span class="ms-1 badge bg-secondary badge-group">{{ item.total }}</span>
          </ng-template>
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

  private suppressionSuffix(member: Member): string | null {
    const unsubscribedAt = member.id ? this.unsubscribedDates[member.id] : undefined;
    if (isNumber(unsubscribedAt)) {
      return ` (unsubscribed ${this.dateUtils.displayDate(unsubscribedAt)})`;
    }
    if (member.emailBlock?.blockedAt) {
      return ` (blocked ${this.dateUtils.displayDate(member.emailBlock.blockedAt)})`;
    }
    return null;
  }

  private consentMissing(member: Member): boolean {
    return member.emailMarketingConsent === false;
  }

  private memberDisabled(member: Member): boolean {
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

  private wouldMatchByCriteria(member: Member, key: MemberSelection | null): boolean {
    if (!member.email) return false;
    if (!key) return true;
    switch (key) {
      case MemberSelection.RECENTLY_ADDED:
        return !!(member.groupMember && member.createdDate && member.createdDate >= this.filterDateMillis());
      case MemberSelection.EXPIRED_MEMBERS:
        return this.isExpiredMember(member);
      case MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS:
        return this.missingFromBulkLoad(member);
      default:
        return false;
    }
  }

  private isExpiredMember(member: Member): boolean {
    const memberStatus = member.memberStatus?.toLowerCase();
    const paymentPending = memberStatus === "payment pending";
    const lifeMember = member.memberTerm === MemberTerm.LIFE;
    const recentlyLoadedDate = this.dateUtils.dateTimeNowNoTime().minus({ months: 1 }).toMillis();
    const recentlyLoaded = !!member.createdDate && member.createdDate >= recentlyLoadedDate;
    if (!member.groupMember || !member.membershipExpiryDate || paymentPending || lifeMember || recentlyLoaded) return false;
    const expirationExceeded = member.membershipExpiryDate < this.filterDateMillis();
    const gracePeriodDate = recentlyLoadedDate;
    const recentlyCreated = !!member.createdDate && member.createdDate >= gracePeriodDate;
    const recentlyUpdated = !!member.updatedDate && member.updatedDate >= gracePeriodDate;
    return expirationExceeded && !recentlyCreated && !recentlyUpdated;
  }

  private missingFromBulkLoad(member: Member): boolean {
    if (!member.groupMember || !member.membershipNumber) {
      return false;
    }
    const lastBulkLoadDate = this.memberBulkLoadDateMap?.[member.membershipNumber];
    return !!lastBulkLoadDate && lastBulkLoadDate < this.filterDateMillis();
  }

  private priorSendDateFor(member: Member): number | undefined {
    return member.id ? this.priorSendDateMap[member.id] : undefined;
  }

  private monthsInPast(): number {
    const months = this.notificationConfig?.monthsInPast;
    return isNumber(months) ? months : 1;
  }

  private filterDateMillis(): number {
    return this.dateUtils.dateTimeNowNoTime().minus({ months: this.monthsInPast() }).toMillis();
  }

  protected labelFor(filter: RecipientPreFilter): string {
    const months = this.monthsInPast();
    switch (filter.key) {
      case MemberSelection.RECENTLY_ADDED:
        return `Added in last ${this.stringUtils.pluraliseWithCount(months, "month")}`;
      case MemberSelection.EXPIRED_MEMBERS:
        return `Expired (${this.stringUtils.pluraliseWithCount(months, "month")} past expiry)`;
      case MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS:
        return `Missing from bulk load (${this.stringUtils.pluraliseWithCount(months, "month")} or more)`;
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
    const memberInformation = `${this.fullNameWithAlias.transform(member)}${this.contextualSuffix(member, preFilterKey, memberGrouping)}`;
    return { id: member.id, member, memberInformation, memberGrouping, disabled };
  }

  private memberGroupingFor(noEmail: boolean, suppressed: boolean, consentMissing: boolean, expired: boolean): string {
    if (noEmail) return "no email address";
    if (suppressed) return "unsubscribed or blocked from email";
    if (consentMissing) return "members without Head Office consent";
    if (expired) return "expired members";
    return "active members with consent given";
  }

  private contextualSuffix(member: Member, preFilterKey: MemberSelection | null, memberGrouping: string): string {
    const suppressionSuffix = this.suppressionSuffix(member);
    if (suppressionSuffix) {
      return suppressionSuffix;
    }
    const priorSendDate = this.priorSendDateFor(member);
    if (priorSendDate) {
      return ` (already sent ${this.dateUtils.displayDate(priorSendDate)})`;
    }
    switch (preFilterKey) {
      case MemberSelection.RECENTLY_ADDED:
        return member.createdDate
          ? ` (created ${this.dateUtils.displayDate(member.createdDate)})`
          : ` (${memberGrouping})`;
      case MemberSelection.EXPIRED_MEMBERS:
        return member.membershipExpiryDate
          ? ` (expired ${this.dateUtils.displayDate(member.membershipExpiryDate)})`
          : ` (${memberGrouping})`;
      case MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS: {
        const lastBulkLoadDate = member.membershipNumber ? this.memberBulkLoadDateMap?.[member.membershipNumber] : null;
        return lastBulkLoadDate
          ? ` (last bulk load ${this.dateUtils.displayDate(lastBulkLoadDate)})`
          : ` (${memberGrouping})`;
      }
      default:
        return ` (${memberGrouping})`;
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
