import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { NgOptgroupTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { Member, MemberFilterSelection, SORT_BY_NAME } from "../../../models/member.model";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { RECIPIENT_PRE_FILTERS, RecipientFilterDecision, RecipientPreFilter, RecipientPreFilterKey } from "../../../models/email-composer.model";

@Component({
  selector: "app-member-multi-select",
  imports: [FormsModule, NgSelectComponent, NgOptgroupTemplateDirective],
  template: `
    <div class="row mb-2 align-items-center">
      <div class="col">
        <label class="me-2">Pre-filter:</label>
        @for (filter of preFilters; track filter.key) {
          <div class="form-check form-check-inline">
            <input class="form-check-input"
                   type="radio"
                   [id]="'pre-filter-' + filter.key"
                   name="member-pre-filter"
                   [checked]="activePreFilterKey === filter.key"
                   (click)="applyPreFilter(filter.key)">
            <label class="form-check-label" [for]="'pre-filter-' + filter.key">{{ filter.label }}</label>
          </div>
        }
        <div class="form-check form-check-inline">
          <input class="form-check-input"
                 type="radio"
                 id="pre-filter-clear"
                 name="member-pre-filter"
                 [checked]="!activePreFilterKey"
                 (click)="clear()">
          <label class="form-check-label" for="pre-filter-clear">Clear and choose manually</label>
        </div>
      </div>
      <div class="col-auto">
        <span class="text-muted small">{{ selectedCount() }} of {{ selectableMembers.length }} selected</span>
      </div>
    </div>
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
                   (change)="onChange()"
                   [(ngModel)]="selectedIds">
          <ng-template ng-optgroup-tmp let-item="item">
            <span class="group-header">{{ groupLabel(item.name) }}</span>
            <span class="ms-1 badge bg-secondary badge-group">{{ item.total }}</span>
          </ng-template>
        </ng-select>
      </div>
    </div>
    @if (false && filteredOutDecisions?.length > 0) {
      <div class="alert alert-warning mt-2">
        <strong>{{ filteredOutDecisions.length }} member(s) excluded:</strong>
        <ul class="mb-0">
          @for (decision of filteredOutDecisions.slice(0, 5); track decision.member.id) {
            <li>{{ fullNameWithAlias.transform(decision.member) }} - {{ decision.reason }}</li>
          }
          @if (filteredOutDecisions.length > 5) {
            <li>and {{ filteredOutDecisions.length - 5 }} more</li>
          }
        </ul>
      </div>
    }`
})
export class MemberMultiSelect implements OnChanges {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberMultiSelect", NgxLoggerLevel.ERROR);
  protected fullNameWithAlias = inject(FullNameWithAliasPipe);
  private dateUtils = inject(DateUtilsService);
  private stringUtils = inject(StringUtilsService);

  @Input() members: Member[] = [];
  @Input() selectedIds: string[] = [];
  @Input() preFilterKey: RecipientPreFilterKey | null = null;
  @Input() requireConsent: boolean = false;
  @Output() selectedIdsChange = new EventEmitter<string[]>();
  @Output() preFilterKeyChange = new EventEmitter<RecipientPreFilterKey | null>();

  protected selectableMembers: MemberFilterSelection[] = [];
  protected filteredOutDecisions: RecipientFilterDecision[] = [];
  protected activePreFilterKey: RecipientPreFilterKey | null = null;
  protected readonly preFilters: RecipientPreFilter[] = RECIPIENT_PRE_FILTERS;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["members"] || changes["preFilterKey"] || changes["requireConsent"]) {
      this.activePreFilterKey = this.preFilterKey;
      this.rebuildSelections();
      this.dropSelectedIdsNotInSelectablePool();
      if (this.activePreFilterKey && (!this.selectedIds || this.selectedIds.length === 0)) {
        this.applyAutoSelection();
      }
    }
  }

  private dropSelectedIdsNotInSelectablePool(): void {
    if (!this.selectedIds || this.selectedIds.length === 0) return;
    const selectableIdSet = new Set(this.selectableMembers.map(item => item.id));
    const trimmed = this.selectedIds.filter(id => selectableIdSet.has(id));
    if (trimmed.length !== this.selectedIds.length) {
      this.selectedIds = trimmed;
      this.selectedIdsChange.emit(this.selectedIds);
    }
  }

  applyPreFilter(key: RecipientPreFilterKey): void {
    this.activePreFilterKey = key;
    this.preFilterKeyChange.emit(key);
    this.rebuildSelections();
    this.applyAutoSelection();
  }

  clear(): void {
    this.activePreFilterKey = null;
    this.preFilterKeyChange.emit(null);
    this.selectedIds = [];
    this.selectedIdsChange.emit(this.selectedIds);
    this.rebuildSelections();
  }

  private rebuildSelections(): void {
    const decisions = this.members.map(member => this.evaluateMember(member));
    this.filteredOutDecisions = decisions.filter(decision => decision.filteredOut);
    this.selectableMembers = decisions
      .filter(decision => !decision.filteredOut)
      .map(decision => this.toFilterSelection(decision.member, this.activePreFilterKey))
      .sort(SORT_BY_NAME);
  }

  private applyAutoSelection(): void {
    if (!this.activePreFilterKey) return;
    const selected = this.selectableMembers
      .filter(item => this.matchesPreFilter(item.member, this.activePreFilterKey))
      .map(item => item.id);
    this.selectedIds = selected;
    this.selectedIdsChange.emit(this.selectedIds);
  }

  private evaluateMember(member: Member): RecipientFilterDecision {
    if (!member.email) {
      return { member, filteredOut: false };
    }
    if (member.emailBlock) {
      return { member, filteredOut: true, reason: "blocked from email" };
    }
    if (this.requireConsent && member.emailMarketingConsent === false) {
      return { member, filteredOut: true, reason: "marketing consent not given" };
    }
    return { member, filteredOut: false };
  }

  private matchesPreFilter(member: Member, key: RecipientPreFilterKey | null): boolean {
    if (!key) return false;
    if (!member.email) return false;
    switch (key) {
      case RecipientPreFilterKey.ALL_WITH_EMAIL:
        return !!member.email;
      case RecipientPreFilterKey.RECENTLY_ADDED: {
        const threeMonthsAgo = this.dateUtils.dateTimeNowNoTime().minus({ months: 3 }).toMillis();
        return !!member.createdDate && member.createdDate >= threeMonthsAgo;
      }
      case RecipientPreFilterKey.EXPIRING_SOON: {
        const now = this.dateUtils.dateTimeNowNoTime().toMillis();
        const inOneMonth = this.dateUtils.dateTimeNowNoTime().plus({ months: 1 }).toMillis();
        return !!member.membershipExpiryDate && member.membershipExpiryDate >= now && member.membershipExpiryDate <= inOneMonth;
      }
      case RecipientPreFilterKey.WALK_LEADERS:
        return !!member.walkAdmin;
      default:
        return false;
    }
  }

  private toFilterSelection(member: Member, preFilterKey: RecipientPreFilterKey | null): MemberFilterSelection {
    const disabled = !member.email;
    const today = this.dateUtils.dateTimeNowNoTime().toMillis();
    const expired = !disabled && !!member.membershipExpiryDate && member.membershipExpiryDate < today;
    const memberGrouping = this.memberGroupingFor(member, disabled, expired);
    const memberInformation = `${this.fullNameWithAlias.transform(member)}${this.contextualSuffix(member, preFilterKey, memberGrouping)}`;
    return { id: member.id, member, memberInformation, memberGrouping, disabled };
  }

  private memberGroupingFor(member: Member, disabled: boolean, expired: boolean): string {
    if (disabled) return "no email address";
    if (expired) return "expired members";
    const consentLabel = member.emailMarketingConsent === false ? "no consent" : "consent given";
    return `active members, ${consentLabel}`;
  }

  private contextualSuffix(member: Member, preFilterKey: RecipientPreFilterKey | null, memberGrouping: string): string {
    switch (preFilterKey) {
      case RecipientPreFilterKey.RECENTLY_ADDED:
        return member.createdDate
          ? ` (created ${this.dateUtils.displayDate(member.createdDate)})`
          : ` (${memberGrouping})`;
      case RecipientPreFilterKey.EXPIRING_SOON:
        return member.membershipExpiryDate
          ? ` (expires ${this.dateUtils.displayDate(member.membershipExpiryDate)})`
          : ` (${memberGrouping})`;
      case RecipientPreFilterKey.WALK_LEADERS:
        return ` (walk admin)`;
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
