import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { DateTime } from "luxon";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { DateRange, DateRangeSlider } from "../../../components/date-range-slider/date-range-slider";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { faChevronDown, faChevronRight, faPaperPlane, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { Member } from "../../../models/member.model";
import {
  MemberSyncNotification,
  MemberSyncNotificationGroup,
  MemberSyncNotificationResolution,
  MemberSyncNotificationStatus
} from "../../../models/member-sync-notification.model";
import { AUDIT_FIELDS } from "../../../models/ramblers-insight-hub";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { MemberSyncNotificationService } from "../../../services/member/member-sync-notification.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageComponent } from "../../../page/page.component";
import { FullNamePipe } from "../../../pipes/full-name.pipe";
import { StringUtilsService } from "../../../services/string-utils.service";
import { StoredValue, StoredValueQueryParameters } from "../../../models/ui-actions";
import { UiActionsService } from "../../../services/ui-actions.service";
import { UIDateFormat } from "../../../models/date-format.model";

const FILTER_ALL = "all";

@Component({
  selector: "app-member-sync-notifications",
  imports: [PageComponent, FormsModule, FontAwesomeModule, DateRangeSlider, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective],
  providers: [FullNamePipe],
  templateUrl: "./member-sync-notifications.component.html"
})
export class MemberSyncNotificationsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberSyncNotificationsComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private memberSyncNotificationService = inject(MemberSyncNotificationService);
  private memberService = inject(MemberService);
  private fullNamePipe = inject(FullNamePipe);
  protected dateUtils = inject(DateUtilsService);
  protected stringUtils = inject(StringUtilsService);
  private uiActions = inject(UiActionsService);

  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly MemberSyncNotificationStatus = MemberSyncNotificationStatus;
  protected readonly MemberSyncNotificationResolution = MemberSyncNotificationResolution;
  protected readonly fieldNames: string[] = AUDIT_FIELDS.map(field => field.fieldName);

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private subscriptions: Subscription[] = [];

  private allNotifications: MemberSyncNotification[] = [];
  private membersById: Map<string, Member> = new Map();
  public groups: MemberSyncNotificationGroup[] = [];
  private expandedMemberIds = new Set<string>();

  public statusFilter: MemberSyncNotificationStatus | "" = MemberSyncNotificationStatus.PENDING;
  public fieldNameFilter = "";
  public nameSearch = "";
  public dateFilterMinDate: DateTime;
  public dateFilterMaxDate: DateTime;
  public dateFilterRange: DateRange | null = null;
  public datePreset = FILTER_ALL;
  public sending = false;
  private restored = false;

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    await this.refresh();
  }

  async refresh() {
    this.notify.setBusy();
    try {
      const [notifications, members] = await Promise.all([
        this.memberSyncNotificationService.all(),
        this.memberService.all()
      ]);
      this.allNotifications = notifications;
      this.membersById = new Map(members.map(member => [member.id, member]));
      this.initialiseDateFilter();
      if (!this.restored) {
        this.restoreFromQueryParams();
        this.restored = true;
      }
      this.applyFilters();
      this.notify.clearBusy();
    } catch (error) {
      this.logger.error("refresh:error", error);
      this.notify.error({title: "Could not load member sync notifications", message: error});
    }
  }

  private initialiseDateFilter() {
    const now = this.dateUtils.dateTimeNow();
    const earliest = this.allNotifications.length
      ? Math.min(...this.allNotifications.map(notification => notification.firstSeenAt))
      : now.minus({years: 1}).toMillis();
    const earliestDay = this.dateUtils.asDateTime(earliest).startOf("day");
    const presetFloor = now.minus({days: 365}).startOf("day");
    this.dateFilterMinDate = earliestDay < presetFloor ? earliestDay : presetFloor;
    this.dateFilterMaxDate = now;
    this.dateFilterRange = {from: this.dateFilterMinDate.toMillis(), to: this.dateFilterMaxDate.toMillis()};
  }

  onDateRangeChange(range: DateRange) {
    this.dateFilterRange = range;
    this.datePreset = "custom";
    this.applyFilters();
  }

  applyDatePreset(preset: string) {
    this.datePreset = preset;
    if (preset === FILTER_ALL) {
      this.dateFilterRange = {from: this.dateFilterMinDate.toMillis(), to: this.dateFilterMaxDate.toMillis()};
    } else if (preset !== "custom") {
      const from = this.dateUtils.dateTimeNow().minus({days: Number(preset)}).startOf("day");
      this.dateFilterRange = {from: Math.max(from.toMillis(), this.dateFilterMinDate.toMillis()), to: this.dateFilterMaxDate.toMillis()};
    }
    this.applyFilters();
  }

  applyFilters() {
    const from = this.dateFilterRange?.from ?? null;
    const to = this.dateFilterRange?.to ?? null;
    const search = this.nameSearch.trim().toLowerCase();
    const filtered = this.allNotifications.filter(notification => {
      const statusMatch = !this.statusFilter || notification.status === this.statusFilter;
      const fieldMatch = !this.fieldNameFilter || notification.fieldName === this.fieldNameFilter;
      const fromMatch = from === null || notification.firstSeenAt >= from;
      const toMatch = to === null || notification.firstSeenAt <= to + this.dateUtils.MILLISECONDS_IN_ONE_DAY;
      return statusMatch && fieldMatch && fromMatch && toMatch;
    });
    this.groups = this.groupByMember(filtered, search);
    this.syncQueryParams();
  }

  private restoreFromQueryParams() {
    const status = this.uiActions.queryParameter(StoredValue.STATUS);
    if (status !== null) {
      this.statusFilter = status === FILTER_ALL ? "" : status as MemberSyncNotificationStatus;
    }
    const field = this.uiActions.queryParameter(StoredValue.FIELD);
    if (field !== null) {
      this.fieldNameFilter = field;
    }
    const search = this.uiActions.queryParameter(StoredValue.SEARCH);
    if (search !== null) {
      this.nameSearch = search;
    }
    const preset = this.uiActions.queryParameter(StoredValue.DATE_RANGE_PRESET);
    if (preset !== null) {
      this.datePreset = preset;
    }
    const from = this.uiActions.queryParameter(StoredValue.DATE_FROM);
    const to = this.uiActions.queryParameter(StoredValue.DATE_TO);
    if (from !== null && to !== null) {
      this.dateFilterRange = {from: this.dayParamToMillis(from), to: this.dayParamToMillis(to)};
    }
    const expanded = this.uiActions.queryParameter(StoredValue.EXPANDED);
    if (expanded !== null) {
      this.expandedMemberIds = new Set(expanded.split(",").filter(memberId => memberId));
    }
  }

  private syncQueryParams() {
    const customRange = this.datePreset !== FILTER_ALL;
    const queryParams: StoredValueQueryParameters = {
      [StoredValue.STATUS]: this.statusFilter || FILTER_ALL,
      [StoredValue.FIELD]: this.fieldNameFilter || null,
      [StoredValue.SEARCH]: this.nameSearch.trim() || null,
      [StoredValue.DATE_RANGE_PRESET]: customRange ? this.datePreset : null,
      [StoredValue.DATE_FROM]: customRange ? this.millisToDayParam(this.dateFilterRange?.from) : null,
      [StoredValue.DATE_TO]: customRange ? this.millisToDayParam(this.dateFilterRange?.to) : null,
      [StoredValue.EXPANDED]: this.expandedMemberIds.size ? Array.from(this.expandedMemberIds).join(",") : null
    };
    this.uiActions.updateQueryParameters(queryParams);
  }

  private millisToDayParam(millis?: number): string | null {
    return millis == null ? null : this.dateUtils.asString(millis, undefined, UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
  }

  private dayParamToMillis(day: string): number {
    return this.dateUtils.asDateTime(day, UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES).startOf("day").toMillis();
  }

  private groupByMember(notifications: MemberSyncNotification[], search: string): MemberSyncNotificationGroup[] {
    const byMember = new Map<string, MemberSyncNotification[]>();
    notifications.forEach(notification => {
      const existing = byMember.get(notification.memberId) ?? [];
      existing.push(notification);
      byMember.set(notification.memberId, existing);
    });
    return Array.from(byMember.entries())
      .map(([memberId, rows]) => {
        const member = this.membersById.get(memberId);
        const fullName = member ? this.fullNamePipe.transform(member, "Unknown member") : "Unknown member";
        const email = member?.email ?? null;
        return {
          memberId,
          fullName,
          email,
          hasEmail: !!email,
          pendingCount: rows.filter(row => row.status === MemberSyncNotificationStatus.PENDING).length,
          notifications: rows
        };
      })
      .filter(group => !search || group.fullName.toLowerCase().includes(search) || (group.email ?? "").toLowerCase().includes(search))
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  toggleExpand(memberId: string) {
    if (this.expandedMemberIds.has(memberId)) {
      this.expandedMemberIds.delete(memberId);
    } else {
      this.expandedMemberIds.add(memberId);
    }
    this.syncQueryParams();
  }

  isExpanded(memberId: string): boolean {
    return this.expandedMemberIds.has(memberId);
  }

  resolutionLabel(resolution: MemberSyncNotificationResolution): string {
    return resolution === MemberSyncNotificationResolution.APPLIED_FROM_HEAD_OFFICE
      ? "Applied locally (from Head Office)"
      : "Kept (you may want to review)";
  }

  public selectedMemberIds = new Set<string>();

  isSelected(memberId: string): boolean {
    return this.selectedMemberIds.has(memberId);
  }

  toggleSelection(memberId: string) {
    if (this.selectedMemberIds.has(memberId)) {
      this.selectedMemberIds.delete(memberId);
    } else {
      this.selectedMemberIds.add(memberId);
    }
  }

  get allVisibleSelected(): boolean {
    return this.groups.length > 0 && this.groups.every(group => this.selectedMemberIds.has(group.memberId));
  }

  toggleSelectAll() {
    const selectAll = !this.allVisibleSelected;
    this.groups.forEach(group => selectAll ? this.selectedMemberIds.add(group.memberId) : this.selectedMemberIds.delete(group.memberId));
  }

  private sendableSelectedGroups(): MemberSyncNotificationGroup[] {
    return this.groups.filter(group => this.selectedMemberIds.has(group.memberId) && group.pendingCount > 0 && group.hasEmail);
  }

  get selectedSendableCount(): number {
    return this.sendableSelectedGroups().length;
  }

  private resendableSelectedGroups(): MemberSyncNotificationGroup[] {
    return this.groups.filter(group => this.selectedMemberIds.has(group.memberId) && group.hasEmail && group.notifications.length > 0);
  }

  get selectedResendableCount(): number {
    return this.resendableSelectedGroups().length;
  }

  async resendSelected() {
    const memberIds = this.resendableSelectedGroups().map(group => group.memberId);
    if (memberIds.length === 0) {
      this.notify.warning({title: "Nothing to resend", message: "No selected member with notifications and an email address on file."});
      return;
    }
    await this.send(memberIds, true);
  }

  async sendSelected() {
    const memberIds = this.sendableSelectedGroups().map(group => group.memberId);
    if (memberIds.length === 0) {
      this.notify.warning({title: "Nothing to send", message: "No selected member with a pending notification and an email address on file."});
      return;
    }
    await this.send(memberIds);
  }

  async sendAllPending() {
    const memberIds = this.groups.filter(group => group.pendingCount > 0 && group.hasEmail).map(group => group.memberId);
    if (memberIds.length === 0) {
      this.notify.warning({title: "Nothing to send", message: "No members with a pending notification and an email address on file."});
      return;
    }
    await this.send(memberIds);
  }

  private async send(memberIds: string[], resend = false) {
    this.sending = true;
    this.notify.setBusy();
    try {
      const result = await this.memberSyncNotificationService.send({memberIds, resend});
      this.notify.success({
        title: "Member sync notifications sent",
        message: `${result.sent} sent, ${result.skippedNoEmail} skipped (no email), ${result.failed} failed.`
      });
      await this.refresh();
    } catch (error) {
      this.logger.error("send:error", error);
      this.notify.error({title: "Could not send member sync notifications", message: error});
    } finally {
      this.sending = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
