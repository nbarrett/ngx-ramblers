import {Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges} from "@angular/core";
import {isNumber} from "es-toolkit/compat";
import {NgxLoggerLevel} from "ngx-logger";
import {Member, MemberBulkLoadDateMap} from "../../models/member.model";
import {MemberSelection, NotificationConfig, WorkflowAction} from "../../models/mail.model";
import {PriorSendExclusion, RECIPIENT_PRE_FILTERS, RecipientPreFilter} from "../../models/email-composer.model";
import {LoggerFactory} from "../../services/logger-factory.service";
import {MemberEmailSendService} from "../../services/member-email-send/member-email-send.service";
import {EmailComposerRecipientResolutionService} from "../../services/email-composer/email-composer-recipient-resolution.service";

@Component({
  selector: "app-email-composer-member-filter",
  template: `
    @if (applicablePreFilters().length > 0) {
      <div class="mb-2">
        <div class="fw-semibold mb-1">Member filter</div>
        @for (filter of applicablePreFilters(); track filter.key) {
          <div class="form-check">
            <input class="form-check-input" type="radio"
                   [id]="'pre-filter-' + (filter.key ?? 'all-with-email')" name="member-pre-filter"
                   [checked]="activePreFilterKey === filter.key && !manualMode"
                   (click)="applyPreFilter(filter.key)">
            <label class="form-check-label" [for]="'pre-filter-' + (filter.key ?? 'all-with-email')">{{ labelFor(filter) }}</label>
          </div>
        }
      </div>
    }
  `
})
export class EmailComposerMemberFilterComponent implements OnChanges {
  private logger = inject(LoggerFactory).createLogger("EmailComposerMemberFilterComponent", NgxLoggerLevel.ERROR);
  private memberEmailSendService = inject(MemberEmailSendService);
  private resolution = inject(EmailComposerRecipientResolutionService);
  @Input() members: Member[] = [];
  @Input() selectedIds: string[] = [];
  @Input() preFilterKey: MemberSelection | null = null;
  @Input() notificationConfig: NotificationConfig | null = null;
  @Input() memberBulkLoadDateMap: MemberBulkLoadDateMap | null = null;
  @Input() requireConsent = false;
  @Input() respectBlocks = false;
  @Input() unsubscribedDates: Record<string, number> = {};
  @Input() includeAlreadySent = false;
  @Output() selectedIdsChange = new EventEmitter<string[]>();
  @Output() preFilterKeyChange = new EventEmitter<MemberSelection | null>();
  @Output() priorSendExclusionsChange = new EventEmitter<PriorSendExclusion[]>();
  protected activePreFilterKey: MemberSelection | null = null;
  protected manualMode = true;
  private priorSendExclusions: PriorSendExclusion[] = [];
  private priorSendDateMap: Record<string, number> = {};
  private priorSendFetchToken = 0;

  protected applicablePreFilters(): RecipientPreFilter[] {
    const selection = this.notificationConfig?.defaultMemberSelection;
    return selection ? RECIPIENT_PRE_FILTERS.filter(filter => filter.key === selection) : RECIPIENT_PRE_FILTERS;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["members"] || changes["preFilterKey"] || changes["requireConsent"] || changes["respectBlocks"]
      || changes["unsubscribedDates"] || changes["notificationConfig"] || changes["memberBulkLoadDateMap"]) {
      if (changes["notificationConfig"]) {
        this.priorSendDateMap = {};
      }
      this.activePreFilterKey = this.preFilterKey;
      this.manualMode = !this.preFilterKey;
      this.refreshExclusions();
      this.dropUnavailableSelectedIds();
      if (changes["notificationConfig"]) {
        void this.refreshPriorSendMap();
      }
    }
    if (changes["includeAlreadySent"] && !changes["includeAlreadySent"].firstChange && !this.manualMode) {
      this.applySelection();
    }
  }

  applyPreFilter(key: MemberSelection | null): void {
    this.activePreFilterKey = key;
    this.manualMode = false;
    this.preFilterKeyChange.emit(key);
    this.refreshExclusions();
    this.applySelection();
  }

  private async refreshPriorSendMap(): Promise<void> {
    const token = ++this.priorSendFetchToken;
    const configId = this.notificationConfig?.id ?? null;
    if (!configId) {
      this.priorSendDateMap = {};
    } else {
      try {
        const sends = await this.memberEmailSendService.list(configId);
        if (token === this.priorSendFetchToken) {
          this.priorSendDateMap = sends.reduce((dates, send) => ({
            ...dates,
            [send.memberId]: Math.max(dates[send.memberId] ?? 0, send.sentAt)
          }), {} as Record<string, number>);
        }
      } catch (error) {
        if (token === this.priorSendFetchToken) {
          this.logger.warn("Could not load prior sends:", error);
          this.priorSendDateMap = {};
        }
      }
      if (token === this.priorSendFetchToken) {
        this.refreshExclusions();
        if (!this.manualMode) {
          this.applySelection();
        }
      }
    }
  }

  private dropUnavailableSelectedIds(): void {
    const availableIds = new Set(this.members.filter(member => !this.memberDisabled(member)).map(member => member.id));
    const selected = this.selectedIds.filter(id => availableIds.has(id));
    if (selected.length !== this.selectedIds.length) {
      this.selectedIds = selected;
      this.selectedIdsChange.emit(selected);
    }
  }

  private priorSendExclusionApplies(): boolean {
    const selection = this.notificationConfig?.defaultMemberSelection;
    return !!selection && this.activePreFilterKey === selection && RECIPIENT_PRE_FILTERS.some(filter => filter.key === selection);
  }

  private refreshExclusions(): void {
    const exclusions = this.manualMode || !this.priorSendExclusionApplies() ? [] : this.members
      .filter(member => !this.memberDisabled(member) && this.matchesCriteria(member))
      .map(member => ({member, sentAt: this.priorSendDateFor(member)}))
      .filter((entry): entry is PriorSendExclusion => isNumber(entry.sentAt) && entry.sentAt > 0)
      .sort((a, b) => b.sentAt - a.sentAt);
    const changed = exclusions.length !== this.priorSendExclusions.length
      || exclusions.some((entry, index) => entry.member.id !== this.priorSendExclusions[index]?.member.id || entry.sentAt !== this.priorSendExclusions[index]?.sentAt);
    this.priorSendExclusions = exclusions;
    if (changed) {
      this.priorSendExclusionsChange.emit(exclusions);
    }
  }

  private applySelection(): void {
    this.selectedIds = this.members
      .filter(member => !this.memberDisabled(member) && this.matchesCriteria(member))
      .filter(member => this.includeAlreadySent || !this.priorSendExclusionApplies() || !this.priorSendDateFor(member))
      .map(member => member.id);
    this.selectedIdsChange.emit(this.selectedIds);
  }

  private memberDisabled(member: Member): boolean {
    const unsubscribed = !!member.id && isNumber(this.unsubscribedDates[member.id]);
    return !this.deliverabilityOptional() && (!member.email
      || (this.respectBlocks && (!!member.emailBlock || unsubscribed))
      || (this.requireConsent && member.emailMarketingConsent === false));
  }

  private deliverabilityOptional(): boolean {
    const actions = this.notificationConfig?.postSendActions ?? [];
    return this.activePreFilterKey === MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS
      || actions.includes(WorkflowAction.BULK_DELETE_GROUP_MEMBER) || actions.includes(WorkflowAction.DISABLE_GROUP_MEMBER);
  }

  private matchesCriteria(member: Member): boolean {
    return (this.deliverabilityOptional() || !!member.email)
      && (!this.activePreFilterKey || this.resolution.memberMatchesPreFilter(member, this.activePreFilterKey));
  }

  private priorSendDateFor(member: Member): number | null {
    return member.id ? this.priorSendDateMap[member.id] ?? null : null;
  }

  protected labelFor(filter: RecipientPreFilter): string {
    return filter.key ? this.resolution.memberSelectionChipLabel(filter.key) : filter.label;
  }
}
