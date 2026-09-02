import { DatePipe } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { NgxLoggerLevel } from "ngx-logger";
import { DateTime } from "luxon";
import { dateRangeSliderBounds, DateRange, DateRangeSlider } from "../../../components/date-range-slider/date-range-slider";
import { AGMStatsResponse, ExtendedGroupEvent, LeaderStats, YearComparison } from "../../../models/group-event.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { StoredValue } from "../../../models/ui-actions";
import { AGMStatsService } from "../../../services/agm-stats.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentService } from "../../../services/page-content.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GroupEventDisplayService } from "../../group-events/group-event-display.service";
import { UIDateFormat } from "../../../models/date-format.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp, faCircleCheck, faCircleExclamation, faFileExcel, faPaperPlane, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { aggregateLeaderStats, asLeaderStats } from "../../../functions/agm-leader-stats";
import { sortBy } from "../../../functions/arrays";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { isNull, isNumber, isUndefined, kebabCase, values } from "es-toolkit/compat";
import { AGMWalksTabComponent } from "./agm-walks-tab";
import { AGMSocialsTabComponent } from "./agm-socials-tab";
import { AGMExpensesTabComponent } from "./agm-expenses-tab";
import { AGMMembershipTabComponent } from "./agm-membership-tab";
import { PageComponent } from "../../../page/page.component";
import { AGM_STATS_DATE_RANGE_PRESETS, AGM_STATS_EMAIL_SECTION_OPTIONS, AGMStatsTab, AgmChartType, AgmStatsEmailData, AgmStatsEmailSection, AgmStatsPreset, AgmStatsSection, CommitteeStatisticsEvent, RankedLeaderRow, SocialRow, SummaryRow } from "../../../models/agm-stats.model";
import { DateRangeSliderPreset } from "../../../models/date.model";
import { SortDirection } from "../../../models/sort.model";
import { entries } from "../../../functions/object-utils";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import { firstValueFrom } from "rxjs";
import { take } from "rxjs/operators";
import { committeeEventComparisonPeriods, committeeStatisticsEvents } from "../../../functions/committee-statistics-events";
import { CommitteeRoleMultiSelectComponent } from "../../../committee/role-multi-select/committee-role-multi-select";
import { AlertPanelComponent } from "../../../modules/common/alert-panel/alert-panel";
import { EmailPreviewComponent } from "../../../modules/common/email-preview/email-preview.component";
import { AlertPanelVariant } from "../../../models/alert-panel.model";
import { AddresseeType, BrandingMode } from "../../../models/email-composer.model";
import { EmailComposerSendService } from "../../../services/email-composer/email-composer-send.service";
import { CommitteeMember, CommitteeRolesChangeEvent, roleRecipientMemberIds } from "../../../models/committee.model";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { agmStatisticsEmailHtml } from "../../../functions/agm-statistics-email";
import { extractErrorMessage } from "../../../functions/strings";
import { downloadBlob } from "../../../functions/file-download";

Chart.register(...registerables);

@Component({
  selector: "app-agm-stats",
  imports: [FormsModule, DateRangeSlider, FontAwesomeModule, TabsetComponent, TabDirective, AGMWalksTabComponent, AGMSocialsTabComponent, AGMExpensesTabComponent, AGMMembershipTabComponent, PageComponent, CommitteeRoleMultiSelectComponent, AlertPanelComponent, EmailPreviewComponent],
  styleUrls: ["./agm-stats.sass"],
  template: `
    <app-page autoTitle pageTitle="AGM Statistics Report">
      <div class="container-fluid">

        @if (error) {
          <div class="alert alert-danger">{{ error }}</div>
        }
        @if (emailNotice) {
          <app-alert-panel class="mb-3" title="Statistics email queued" [variant]="AlertPanelVariant.SUCCESS" [icon]="faCircleCheck">
            {{ emailNotice }}
          </app-alert-panel>
        }
        @if (composingStatisticsEmail) {
          <div class="thumbnail-heading-frame mb-3">
            <div class="thumbnail-heading">Email statistics</div>
            <div class="rsm-toolbar mb-3">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="form-label mb-0 text-muted text-nowrap">Report areas</span>
                @for (option of emailSectionOptions; track option.key) {
                  <div class="form-check form-check-inline mb-0">
                    <input class="form-check-input" type="checkbox" [id]="'email-statistics-' + option.key"
                           [checked]="emailSectionSelected(option.key)" (change)="toggleEmailSection(option.key, $event)">
                    <label class="form-check-label" [for]="'email-statistics-' + option.key">{{ option.label }}</label>
                  </div>
                }
              </div>
              <div class="d-flex align-items-center gap-2 rsm-toolbar-grow">
                <label class="form-label mb-0 text-muted text-nowrap">Send to</label>
                <div class="flex-grow-1">
                  <app-committee-role-multi-select [roles]="selectedEmailRecipientRoles"
                                                   showRoleSelectionAs="nameAndDescription"
                                                   (rolesChange)="onEmailRecipientsChange($event)"/>
                </div>
              </div>
            </div>
            @if (emailError) {
              <app-alert-panel class="mb-3" title="Statistics email not sent" [variant]="AlertPanelVariant.DANGER">
                {{ emailError }}
              </app-alert-panel>
            }
            <p class="text-muted mb-2">To {{ emailRecipientDescription() }}.</p>
            <div class="statistics-email-preview">
              <app-email-preview [html]="statisticsEmailPreviewHtml"/>
            </div>
            <div class="d-flex flex-wrap gap-2 mt-3">
              <button type="button" class="btn btn-quiet" [disabled]="emailSending" (click)="closeStatisticsEmail()">Back to report</button>
              <button type="button" class="btn btn-primary" [disabled]="!canRequestStatisticsEmail()" (click)="sendStatisticsEmail()">
                <fa-icon [icon]="emailSending ? faSpinner : faPaperPlane" [animation]="emailSending ? 'spin' : null" class="me-2"/>
                {{ emailSending ? "Sending..." : "Send" }}
              </button>
            </div>
          </div>
        } @else {
        <div class="mb-3">
          <app-date-range-slider class="w-100"
                                 showPresets
                                 [presets]="dateRangePresets"
                                 [selectedPreset]="selectedSliderPreset"
                                 [minDate]="sliderMinDate"
                                 [maxDate]="sliderMaxDate"
                                 [range]="sliderRange"
                                 [disabled]="eventPresetSelected()"
                                 (presetChange)="onSliderPresetChange($event)"
                                 (rangeChange)="onDateRangeChange($event)"/>
          @if (preset === AgmStatsPreset.SINCE_COMMITTEE_EVENT) {
            <div class="mt-2">
              <label for="fromCommitteeEvent" class="form-label">From Committee Event</label>
              <select id="fromCommitteeEvent" class="form-select" [(ngModel)]="fromCommitteeEventDate"
                      (ngModelChange)="onCommitteeEventChange()" [disabled]="committeeEventsLoading">
                @for (event of committeeEvents; track event.date) {
                  <option [ngValue]="event.date">{{ event.label }}</option>
                }
              </select>
            </div>
          }
          @if (preset === AgmStatsPreset.BETWEEN_COMMITTEE_EVENTS) {
            <div class="mt-2">
              <label for="fromCommitteeEvent" class="form-label">From Committee Event</label>
              <select id="fromCommitteeEvent" class="form-select" [(ngModel)]="fromCommitteeEventDate"
                      (ngModelChange)="onCommitteeEventChange()" [disabled]="committeeEventsLoading">
                @for (event of committeeEvents; track event.date) {
                  <option [ngValue]="event.date">{{ event.label }}</option>
                }
              </select>
            </div>
            <div class="mt-2">
              <label for="toCommitteeEvent" class="form-label">To Committee Event</label>
              <select id="toCommitteeEvent" class="form-select" [(ngModel)]="toCommitteeEventDate"
                      (ngModelChange)="onCommitteeEventChange()" [disabled]="committeeEventsLoading">
                @for (event of committeeEvents; track event.date) {
                  <option [ngValue]="event.date">{{ event.label }}</option>
                }
              </select>
            </div>
          }
          @if (eventPresetSelected() && !committeeEventsLoading && committeeEvents.length === 0) {
            <div class="mt-2 alert alert-warning d-flex align-items-start" role="alert">
              <fa-icon [icon]="faCircleExclamation" class="me-2"></fa-icon>
              <div><strong>No committee events found</strong><div>Add a dated committee meeting or AGM before using this reporting period.</div></div>
            </div>
          }
          <div class="d-flex align-items-end gap-2 mt-2 flex-nowrap">
            <div class="flex-grow-1 min-w-0">
              <label for="chartType" class="form-label">Chart Type</label>
              <select id="chartType" class="form-select" [(ngModel)]="chartType"
                      (ngModelChange)="onChartTypeChange($event)">
                <option [ngValue]="AgmChartType.BAR">Bar Chart</option>
                <option [ngValue]="AgmChartType.LINE">Line Chart</option>
              </select>
            </div>
            <button type="button" class="btn btn-primary text-nowrap" (click)="onRefresh()" [disabled]="loading">
              @if (loading) {
                <span class="spinner-border spinner-border-sm me-2"></span>
              }
              Load Stats
            </button>
            <button type="button" class="btn btn-quiet text-nowrap" [disabled]="!stats || loading"
                    (click)="openStatisticsEmail()">
              <fa-icon [icon]="faPaperPlane" class="me-2"/>
              Email statistics
            </button>
            <button type="button" class="btn btn-quiet text-nowrap" [disabled]="!stats || loading || excelExporting"
                    (click)="saveStatisticsExcel()">
              <fa-icon [icon]="excelExporting ? faSpinner : faFileExcel" [animation]="excelExporting ? 'spin' : null" class="me-2"/>
              Save to Excel
            </button>
          </div>
        </div>
        <tabset class="custom-tabset">
          <tab app-agm-walks-tab
               [active]="tabActive(AGMStatsTab.WALKS)"
               (selectTab)="selectTab(AGMStatsTab.WALKS)"
               [heading]="AGMStatsTab.WALKS"
               [walkChartData]="walkChartData"
               [leaderChartData]="leaderChartData"
               [chartOptions]="chartOptions"
               [chartType]="chartType"
               [years]="yearsInRange()"
               [walkSummaryRows]="walkSummaryRows()"
               [sortedRowsFn]="sortedRowsFn"
               [toggleSortFn]="toggleSortFn"
               [sortIconFn]="sortIconFn"
               [changeClassFn]="changeClassFn"
               [getYearLabelFn]="getYearLabelFn"
               [currentLeaders]="leaderRows()"
               [newLeadersList]="newLeadersList()"
               [aggregateLeaders]="aggregateLeaderRows()"
               [aggregateYearsLabel]="aggregateYearsLabel()"
               [cancelledWalksList]="cancelledWalksList()"
               [eveningWalksList]="eveningWalksList()"
               [unfilledSlotsList]="unfilledSlotsList()"
               [morningWalksList]="morningWalksList()">
          </tab>

          <tab app-agm-socials-tab
               [active]="tabActive(AGMStatsTab.SOCIALS)"
               (selectTab)="selectTab(AGMStatsTab.SOCIALS)"
               [heading]="AGMStatsTab.SOCIALS"
               [years]="yearsInRange()"
               [socialSummaryRows]="socialSummaryRows()"
               [sortedRowsFn]="sortedRowsFn"
               [toggleSortFn]="toggleSortFn"
               [sortIconFn]="sortIconFn"
               [changeClassFn]="changeClassFn"
               [getYearLabelFn]="getYearLabelFn"
               [fromDate]="currentYearFrom()"
               [toDate]="currentYearTo()"
               [socialChartData]="socialChartData"
               [chartOptions]="chartOptions"
               [chartType]="chartType"
               [aggregatedSocialEvents]="aggregatedSocialEvents()"
               [organisers]="aggregateOrganisers()"
               [socialLinkFn]="socialLinkFn">
          </tab>

          <tab app-agm-membership-tab
               [active]="tabActive(AGMStatsTab.MEMBERSHIP)"
               (selectTab)="selectTab(AGMStatsTab.MEMBERSHIP)"
               [heading]="AGMStatsTab.MEMBERSHIP"
               [membershipChartData]="membershipChartData"
               [chartOptions]="chartOptions"
               [chartType]="chartType"
               [years]="yearsInRange()"
               [membershipSummaryRows]="membershipSummaryRows()"
               [sortedRowsFn]="sortedRowsFn"
               [toggleSortFn]="toggleSortFn"
               [sortIconFn]="sortIconFn"
               [changeClassFn]="changeClassFn"
               [getYearLabelFn]="getYearLabelFn">
          </tab>

          <tab app-agm-expenses-tab
               [active]="tabActive(AGMStatsTab.EXPENSES)"
               (selectTab)="selectTab(AGMStatsTab.EXPENSES)"
               [heading]="AGMStatsTab.EXPENSES"
               [years]="yearsInRange()"
               [expenseSummaryRows]="expenseSummaryRows()"
               [sortedRowsFn]="sortedRowsFn"
               [toggleSortFn]="toggleSortFn"
               [sortIconFn]="sortIconFn"
               [changeClassFn]="changeClassFn"
               [getYearLabelFn]="getYearLabelFn"
               [yearlyStats]="yearlyStatsReversed()"
               [unpaidExpenses]="unpaidExpenses()"
               [currencyMetrics]="currencyMetrics">
          </tab>
        </tabset>
        }
      </div>
    </app-page>
  `
})
export class AGMStatsComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("AGMStatsComponent", NgxLoggerLevel.ERROR);
  private agmStatsService = inject(AGMStatsService);
  private pageContentService = inject(PageContentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private uiActions = inject(UiActionsService);
  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private committeeFileService = inject(CommitteeFileService);
  private committeeConfigService = inject(CommitteeConfigService);
  private memberLoginService = inject(MemberLoginService);
  private emailSendService = inject(EmailComposerSendService);
  protected groupEventDisplayService = inject(GroupEventDisplayService);
  faChevronUp = faChevronUp;
  faChevronDown = faChevronDown;
  faCircleExclamation = faCircleExclamation;
  faCircleCheck = faCircleCheck;
  faPaperPlane = faPaperPlane;
  faFileExcel = faFileExcel;
  faSpinner = faSpinner;

  stats: AGMStatsResponse | null = null;
  loading = false;
  error: string | null = null;
  preset: AgmStatsPreset = AgmStatsPreset.LAST_2_YEARS;
  dateRangePresets = AGM_STATS_DATE_RANGE_PRESETS;
  selectedSliderPreset: DateRangeSliderPreset = null;
  private applyingSliderPreset = false;
  private sortState: Record<string, { key: string; direction: SortDirection }> = {};
  protected readonly AGMStatsTab = AGMStatsTab;
  protected readonly AgmChartType = AgmChartType;
  protected readonly AgmStatsPreset = AgmStatsPreset;
  private tab: string;
  currencyMetrics = ["Total Cost", "Total Paid", "Total Unpaid"];

  fromDate: number;
  toDate: number;
  sliderMinDate: DateTime | null = null;
  sliderMaxDate: DateTime | null = null;
  sliderRange: DateRange | null = null;
  private statsRequestFrom: number | null = null;
  private statsRequestTo: number | null = null;
  private statsRequestPeriodsKey: string | null = null;
  chartType: AgmChartType = AgmChartType.BAR;
  committeeEvents: CommitteeStatisticsEvent[] = [];
  committeeEventsLoading = true;
  fromCommitteeEventDate: number | null = null;
  toCommitteeEventDate: number | null = null;
  private datesRestoredFromUrl = false;
  selectedEmailSections: AgmStatsEmailSection[] = [AgmStatsEmailSection.WALKS];
  selectedEmailRecipientRoles: string[] = [];
  emailSending = false;
  excelExporting = false;
  composingStatisticsEmail = false;
  statisticsEmailPreviewHtml: string | null = null;
  statisticsEmailPreviewSubject: string | null = null;
  emailNotice: string | null = null;
  emailError: string | null = null;
  private committeeRoles: CommitteeMember[] = [];
  protected readonly emailSectionOptions = AGM_STATS_EMAIL_SECTION_OPTIONS;
  protected readonly AlertPanelVariant = AlertPanelVariant;

  walkChartData: ChartConfiguration["data"] = {
    labels: [],
    datasets: []
  };

  leaderChartData: ChartConfiguration["data"] = {
    labels: [],
    datasets: []
  };

  socialChartData: ChartConfiguration["data"] = {
    labels: [],
    datasets: []
  };

  membershipChartData: ChartConfiguration["data"] = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartConfiguration["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top"
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  private setInitialDates() {
    if (this.preset === AgmStatsPreset.ALL_TIME) {
      const now = this.dateUtils.dateTimeNow();
      this.toDate = this.endOfDay(now).toMillis();
      this.fromDate = this.endOfDay(now).minus({years: 5}).toMillis();
    } else {
      this.applyPresetDates(this.preset);
    }
  }
  sortedRowsFn = <T>(rows: T[], key: string) => this.sortedRows(rows, key);
  toggleSortFn = (listKey: string, column: string) => this.toggleSort(listKey, column);
  sortIconFn = (listKey: string, column: string) => this.sortIcon(listKey, column);
  changeClassFn = (current: number, previous: number) => this.changeClass(current, previous);
  getYearLabelFn = (periodLabel: string) => this.yearLabel(periodLabel);
  socialLinkFn = (event: SocialRow) => this.socialLink(event);

  ngOnInit() {
    this.setInitialDates();
    this.pageContentService.findByPath(this.route.snapshot.url.map(segment => segment.path).join("/"));
    this.initializeState();
    this.selectedSliderPreset = this.sliderPresetMatching(this.preset);
    this.rescaleSliderToCurrentDates();
    const defaultTab = kebabCase(AGMStatsTab.WALKS);
    const tabParameter = this.route.snapshot.queryParamMap.get(StoredValue.TAB);
    this.tab = tabParameter || defaultTab;
    this.persistState();
    this.loadCommitteeEvents();

    if (this.preset === AgmStatsPreset.ALL_TIME) {
      this.applyAllTimePreset();
    } else if (!this.eventPresetSelected()) {
      this.loadStats();
    }
  }

  private async loadCommitteeEvents() {
    try {
      const config = await firstValueFrom(this.committeeConfigService.committeeConfigEvents().pipe(take(1)));
      this.committeeRoles = config.roles || [];
      const senderRole = this.statisticsEmailSenderRole();
      this.selectedEmailRecipientRoles = senderRole ? [senderRole.type] : [];
      const files = await this.committeeFileService.all({sort: {eventDate: -1}});
      this.committeeEvents = committeeStatisticsEvents(files, config.fileTypes, this.dateUtils.dateTimeNow().toMillis(), value => this.dateUtils.asString(value, null, UIDateFormat.DISPLAY_DATE_AT_TIME));
      this.fromCommitteeEventDate = this.committeeEventMatching(this.fromDate)?.date
        || (this.datesRestoredFromUrl ? this.fromDate : this.committeeEvents[0]?.date)
        || null;
      this.toCommitteeEventDate = this.committeeEventMatching(this.toDate)?.date
        || (this.datesRestoredFromUrl ? this.toDate : this.committeeEvents[0]?.date)
        || null;
      if (!this.datesRestoredFromUrl && this.preset === AgmStatsPreset.BETWEEN_COMMITTEE_EVENTS && this.fromCommitteeEventDate === this.toCommitteeEventDate) {
        this.fromCommitteeEventDate = this.committeeEvents[1]?.date || this.fromCommitteeEventDate;
      }
      if (this.eventPresetSelected() && !this.datesRestoredFromUrl) {
        this.applyCommitteeEventDates();
      } else {
        this.rescaleSliderToCurrentDates();
        this.persistState();
        if (this.eventPresetSelected()) {
          this.loadStats(true);
        }
      }
    } catch (error) {
      this.logger.error("Failed to load committee events:", error);
      if (this.eventPresetSelected()) {
        this.loadStats(true);
      }
    } finally {
      this.committeeEventsLoading = false;
    }
  }

  emailSectionSelected(section: AgmStatsEmailSection): boolean {
    return this.selectedEmailSections.includes(section);
  }

  toggleEmailSection(section: AgmStatsEmailSection, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedEmailSections = checked
      ? [...this.selectedEmailSections, section]
      : this.selectedEmailSections.filter(selected => selected !== section);
    this.emailError = null;
    this.refreshStatisticsEmailPreview();
  }

  onEmailRecipientsChange(change: CommitteeRolesChangeEvent): void {
    this.selectedEmailRecipientRoles = change.roles;
    this.emailError = null;
  }

  canRequestStatisticsEmail(): boolean {
    return !!this.stats && this.selectedEmailSections.length > 0 && this.statisticsEmailMemberIds().length > 0 && !this.emailSending;
  }

  openStatisticsEmail(): void {
    if (this.stats) {
      this.emailNotice = null;
      this.emailError = null;
      this.composingStatisticsEmail = true;
      this.refreshStatisticsEmailPreview();
    }
  }

  async saveStatisticsExcel(): Promise<void> {
    if (this.stats && !this.excelExporting) {
      this.excelExporting = true;
      this.error = null;
      try {
        const fileName = `committee-statistics-${this.dateUtils.asString(this.dateUtils.dateTimeNow(), undefined, UIDateFormat.FILE_TIMESTAMP_COMPACT)}.xlsx`;
        const blob = await firstValueFrom(this.agmStatsService.excelExport({
          fileName,
          data: this.statisticsEmailData()
        }));
        downloadBlob(blob, fileName);
      } catch (error) {
        this.logger.error("Failed to save committee statistics to Excel:", error);
        this.error = extractErrorMessage(error) || "The statistics could not be saved to Excel.";
      } finally {
        this.excelExporting = false;
      }
    }
  }

  closeStatisticsEmail(): void {
    this.composingStatisticsEmail = false;
    this.statisticsEmailPreviewHtml = null;
    this.statisticsEmailPreviewSubject = null;
    this.emailError = null;
  }

  private refreshStatisticsEmailPreview(): void {
    this.statisticsEmailPreviewSubject = this.statisticsEmailSubject();
    if (this.selectedEmailSections.length === 0) {
      this.statisticsEmailPreviewHtml = this.statisticsEmailPreviewDocument("<p style=\"font-family:'Assistant',Arial,sans-serif;color:#6c757d;\">Choose at least one report area.</p>");
    } else {
      this.statisticsEmailPreviewHtml = this.statisticsEmailPreviewDocument(
        agmStatisticsEmailHtml(this.selectedEmailSections, this.statisticsEmailData())
      );
    }
  }

  private statisticsEmailPreviewDocument(inner: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:20px 24px;background:#ffffff;">${inner}</body></html>`;
  }

  async sendStatisticsEmail(): Promise<void> {
    const senderRole = this.statisticsEmailSenderRole();
    const memberIds = this.statisticsEmailMemberIds();
    if (!senderRole || memberIds.length === 0 || this.selectedEmailSections.length === 0) {
      this.emailError = "The sender, recipients and report areas must be selected before sending.";
    } else {
      this.emailSending = true;
      this.emailError = null;
      try {
        const htmlBody = agmStatisticsEmailHtml(this.selectedEmailSections, this.statisticsEmailData());
        const start = await this.emailSendService.startBatch({
          bannerId: null,
          subject: this.statisticsEmailSubject(),
          addresseeType: AddresseeType.NONE,
          signoffRoles: [],
          htmlBody,
          htmlBodyTop: htmlBody,
          htmlBodyBottom: "",
          memberIds,
          attachments: [],
          brandingMode: BrandingMode.UNBRANDED,
          unbrandedSenderRoleType: senderRole.type,
          useCommitteeRoleAddresses: true
        });
        this.emailNotice = `The statistics are being sent to ${this.stringUtils.pluraliseWithCount(start.totalRecipients, "recipient")}.`;
        this.closeStatisticsEmail();
      } catch (error) {
        this.logger.error("Failed to send committee statistics:", error);
        this.emailError = extractErrorMessage(error) || "The statistics email could not be sent.";
      } finally {
        this.emailSending = false;
      }
    }
  }

  emailRecipientDescription(): string {
    const names = this.selectedEmailRecipientRoles
      .map(type => this.committeeRoles.find(role => role.type === type)?.nameAndDescription)
      .filter(Boolean);
    return names.join(", ") || "the selected committee members";
  }

  private statisticsEmailSenderRole(): CommitteeMember | null {
    const memberId = this.memberLoginService.loggedInMember()?.memberId;
    return this.committeeRoles.find(role => role.memberId === memberId && !!role.email) || null;
  }

  private statisticsEmailMemberIds(): string[] {
    const selectedRoles = this.committeeRoles.filter(role => this.selectedEmailRecipientRoles.includes(role.type));
    return [...new Set(selectedRoles.flatMap(role => roleRecipientMemberIds(role)))];
  }

  private statisticsEmailSubject(): string {
    return `Committee statistics: ${this.statisticsDateLabel(this.fromDate)} to ${this.statisticsDateLabel(this.toDate)}`;
  }

  private statisticsEmailData(): AgmStatsEmailData {
    return {
      fromDateLabel: this.statisticsDateLabel(this.fromDate),
      toDateLabel: this.statisticsDateLabel(this.toDate),
      periodLabels: this.yearsInRange(),
      summaries: {
        [AgmStatsEmailSection.WALKS]: this.walkSummaryRows(),
        [AgmStatsEmailSection.SOCIALS]: this.socialSummaryRows(),
        [AgmStatsEmailSection.MEMBERSHIP]: this.membershipSummaryRows(),
        [AgmStatsEmailSection.EXPENSES]: this.expenseSummaryRows()
      }
    };
  }

  private statisticsDateLabel(value: number): string {
    return this.dateUtils.asString(value, null, UIDateFormat.DISPLAY_DATE_NO_DAY);
  }

  private initializeState() {
    this.loadFromStorage();
    this.loadFromQueryParams();
  }

  private loadFromStorage() {
    this.fromDate = this.parseDateInput(this.uiActions.initialValueFor(StoredValue.DATE_FROM, this.formatDateForParam(this.fromDate)), this.fromDate);
    this.toDate = this.parseDateInput(this.uiActions.initialValueFor(StoredValue.DATE_TO, this.formatDateForParam(this.toDate)), this.toDate);
    this.chartType = this.resolveChartType(this.uiActions.initialValueFor(StoredValue.CHART_TYPE, this.chartType), this.chartType);
    const storedPreset = this.resolvePreset(this.uiActions.initialValueFor(StoredValue.DATE_RANGE_PRESET, this.preset));
    if (storedPreset) {
      this.preset = storedPreset;
    }
  }

  private loadFromQueryParams() {
    const params = this.route.snapshot.queryParamMap;
    this.chartType = this.resolveChartType(params.get(StoredValue.CHART_TYPE), this.chartType);
    const resolvedPreset = this.resolvePreset(params.get(StoredValue.DATE_RANGE_PRESET) || params.get("preset"));
    if (resolvedPreset) {
      this.preset = resolvedPreset;
    }
    const fromParam = params.get(StoredValue.DATE_FROM);
    const toParam = params.get(StoredValue.DATE_TO);
    if (fromParam && toParam) {
      this.fromDate = this.parseDateInput(fromParam, this.fromDate);
      this.toDate = this.parseDateInput(toParam, this.toDate);
      this.datesRestoredFromUrl = true;
    } else if (this.preset === AgmStatsPreset.ALL_TIME) {
      const now = this.dateUtils.dateTimeNow();
      this.toDate = this.endOfDay(now).toMillis();
      this.fromDate = this.endOfDay(now).minus({years: 5}).toMillis();
    } else if (this.preset !== AgmStatsPreset.CUSTOM && !this.eventPresetSelected()) {
      this.applyPresetDates(this.preset);
    }
  }

  private resolvePreset(value: string | null): AgmStatsPreset | null {
    if (!value) {
      return null;
    } else if (value === AgmStatsPreset.CUSTOM) {
      return AgmStatsPreset.CUSTOM;
    } else if (this.dateRangePresets.some(option => option.id === value)) {
      return value as AgmStatsPreset;
    } else {
      return null;
    }
  }

  private parseDateInput(value: string | number | null, fallback: number): number {
    if (isNull(value) || isUndefined(value)) {
      return fallback;
    }
    if (isNumber(value)) {
      return value > 0 ? value : fallback;
    }
    const parsedFromFormat = this.dateUtils.asValue(value, UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
    return parsedFromFormat > 0 ? parsedFromFormat : fallback;
  }

  private resolveChartType(value: string | null, fallback: AgmChartType): AgmChartType {
    return value === AgmChartType.BAR || value === AgmChartType.LINE ? value : fallback;
  }

  private persistState() {
    const dateFrom = this.formatDateForParam(this.fromDate);
    const dateTo = this.formatDateForParam(this.toDate);
    this.uiActions.saveValueFor(StoredValue.DATE_FROM, dateFrom);
    this.uiActions.saveValueFor(StoredValue.DATE_TO, dateTo);
    this.uiActions.saveValueFor(StoredValue.CHART_TYPE, this.chartType);
    this.uiActions.saveValueFor(StoredValue.DATE_RANGE_PRESET, this.preset);
    this.replaceQueryParams({
      [StoredValue.DATE_FROM]: dateFrom,
      [StoredValue.DATE_TO]: dateTo,
      [StoredValue.CHART_TYPE]: this.chartType,
      [StoredValue.DATE_RANGE_PRESET]: this.preset,
      [StoredValue.TAB]: this.tab || kebabCase(AGMStatsTab.WALKS),
      preset: null
    });
  }

  private replaceQueryParams(params: Record<string, string | number | null>) {
    const queryParams = Object.fromEntries(entries(params).filter(([, value]) => !isUndefined(value)));
    const current = this.route.snapshot.queryParamMap;
    const changed = entries(queryParams).some(([key, value]) => {
      if (value === null) {
        return current.get(key) !== null;
      } else {
        return current.get(key) !== String(value);
      }
    });
    if (changed) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams,
        queryParamsHandling: "merge",
        replaceUrl: true
      });
    }
  }

  private comparisonPeriods() {
    if (this.eventPresetSelected()) {
      const selectedFrom = this.fromCommitteeEventDate || this.fromDate;
      const selectedTo = this.preset === AgmStatsPreset.BETWEEN_COMMITTEE_EVENTS && this.toCommitteeEventDate
        ? this.toCommitteeEventDate
        : this.toDate;
      return committeeEventComparisonPeriods(
        selectedFrom,
        selectedTo,
        this.committeeEvents,
        value => this.dateUtils.asValueNoTime(value)
      );
    } else {
      return null;
    }
  }

  loadStats(force = false) {
    const fromKey = this.startOfDayMillis(this.fromDate);
    const toKey = this.startOfDayMillis(this.toDate);
    const periods = this.comparisonPeriods();
    const periodsKey = (periods || []).map(period => `${period.fromDate}:${period.toDate}`).join("|");
    if (force || this.statsRequestFrom !== fromKey || this.statsRequestTo !== toKey || this.statsRequestPeriodsKey !== periodsKey) {
      this.statsRequestFrom = fromKey;
      this.statsRequestTo = toKey;
      this.statsRequestPeriodsKey = periodsKey;
      this.closeStatisticsEmail();
      this.persistState();
      this.loading = true;
      this.error = null;

      this.logger.info("Loading AGM stats for:", { fromDate: this.fromDate, toDate: this.toDate, periods });

      this.agmStatsService.agmStats(this.fromDate, this.toDate, periods).subscribe({
        next: (response) => {
          this.stats = response;
          if (response.earliestDate && this.preset === AgmStatsPreset.ALL_TIME) {
            this.fromDate = response.earliestDate;
            this.statsRequestFrom = this.startOfDayMillis(this.fromDate);
            this.rescaleSliderToCurrentDates();
            this.persistState();
          } else if (response.earliestDate && this.fromDate < response.earliestDate) {
            this.fromDate = response.earliestDate;
            this.statsRequestFrom = this.startOfDayMillis(this.fromDate);
            this.rescaleSliderToCurrentDates();
            this.persistState();
          }
          this.prepareChartData();
          this.loading = false;
          this.logger.info("AGM stats loaded:", response);
        },
        error: (err) => {
          this.error = err.message || "Failed to load AGM stats";
          this.loading = false;
          this.logger.error("Error loading AGM stats:", err);
        }
      });
    }
  }

  onDateRangeChange(range: DateRange) {
    const from = this.startOfDayMillis(range.from);
    const to = this.endOfDay(this.dateUtils.asDateTime(range.to)).toMillis();
    const sameFrom = this.startOfDayMillis(this.fromDate) === from;
    const sameTo = this.startOfDayMillis(this.toDate) === this.startOfDayMillis(range.to);
    if (!sameFrom || !sameTo) {
      this.fromDate = from;
      this.toDate = to;
      if (this.applyingSliderPreset) {
        this.applyingSliderPreset = false;
        this.rescaleSliderToCurrentDates();
      } else {
        this.preset = AgmStatsPreset.CUSTOM;
        this.selectedSliderPreset = null;
      }
      this.loadStats();
    }
  }

  onSliderPresetChange(preset: DateRangeSliderPreset) {
    this.selectedSliderPreset = preset;
    this.preset = (preset?.id as AgmStatsPreset) || AgmStatsPreset.CUSTOM;
    this.datesRestoredFromUrl = false;
    this.sortState = {};
    this.applyingSliderPreset = !!preset?.relativeDateRange;
    if (this.preset === AgmStatsPreset.ALL_TIME) {
      this.applyAllTimePreset();
    } else if (this.eventPresetSelected()) {
      if (this.preset === AgmStatsPreset.BETWEEN_COMMITTEE_EVENTS && this.fromCommitteeEventDate === this.toCommitteeEventDate) {
        this.fromCommitteeEventDate = this.committeeEvents[1]?.date || this.fromCommitteeEventDate;
      }
      this.applyCommitteeEventDates();
    } else {
      this.persistState();
    }
  }

  onChartTypeChange(type: AgmChartType) {
    this.chartType = type;
    this.persistState();
  }

  eventPresetSelected(): boolean {
    return this.preset === AgmStatsPreset.SINCE_COMMITTEE_EVENT || this.preset === AgmStatsPreset.BETWEEN_COMMITTEE_EVENTS;
  }

  onCommitteeEventChange() {
    this.datesRestoredFromUrl = false;
    this.applyCommitteeEventDates();
  }

  private applyCommitteeEventDates() {
    if (this.fromCommitteeEventDate) {
      const selectedToDate = this.preset === AgmStatsPreset.BETWEEN_COMMITTEE_EVENTS && this.toCommitteeEventDate
        ? this.toCommitteeEventDate
        : this.dateUtils.dateTimeNow().toMillis();
      this.fromDate = Math.min(this.fromCommitteeEventDate, selectedToDate);
      this.toDate = this.endOfDay(this.dateUtils.asDateTime(Math.max(this.fromCommitteeEventDate, selectedToDate))).toMillis();
      this.rescaleSliderToCurrentDates();
      this.loadStats();
    }
  }

  private committeeEventMatching(value: number): CommitteeStatisticsEvent | null {
    const formattedValue = this.formatDateForParam(value);
    return this.committeeEvents.find(event => this.formatDateForParam(event.date) === formattedValue) || null;
  }

  private applyAllTimePreset() {
    const now = this.dateUtils.dateTimeNow();
    this.toDate = this.endOfDay(now).toMillis();
    this.agmStatsService.earliestDate().subscribe({
      next: (response) => {
        if (response.earliestDate) {
          this.fromDate = response.earliestDate;
        } else {
          this.fromDate = this.endOfDay(now).minus({years: 5}).toMillis();
        }
        this.rescaleSliderToCurrentDates();
        this.persistState();
        this.loadStats();
      },
      error: (error) => {
        this.logger.error("Failed to fetch earliest date:", error);
        this.fromDate = this.endOfDay(now).minus({years: 5}).toMillis();
        this.rescaleSliderToCurrentDates();
        this.persistState();
        this.loadStats();
      }
    });
  }

  private applyPresetDates(preset: AgmStatsPreset) {
    const now = this.dateUtils.dateTimeNow();
    switch (preset) {
      case AgmStatsPreset.LAST_2_YEARS:
        this.applyRange(now, 2);
        break;
      case AgmStatsPreset.LAST_3_YEARS:
        this.applyRange(now, 3);
        break;
      case AgmStatsPreset.LAST_4_YEARS:
        this.applyRange(now, 4);
        break;
      case AgmStatsPreset.LAST_5_YEARS:
        this.applyRange(now, 5);
        break;
      case AgmStatsPreset.LAST_1_YEAR:
        this.applyRange(now, 1, true);
        break;
    }
  }

  private applyRange(now: any, years: number, shiftForwardOneDay = false) {
    const end = this.endOfDay(now);
    const start = end.minus({years}).plus(shiftForwardOneDay ? {days: 1} : {}).set({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0
    });
    this.fromDate = start.toMillis();
    this.toDate = end.toMillis();
  }

  private rescaleSliderToCurrentDates() {
    if (this.fromDate && this.toDate) {
      const from = this.dateUtils.asDateTime(this.fromDate).startOf("day");
      const to = this.dateUtils.asDateTime(this.toDate).startOf("day");
      const bounds = dateRangeSliderBounds(from, to);
      if (!this.sliderMinDate?.hasSame(bounds.minDate, "day")) {
        this.sliderMinDate = bounds.minDate;
      }
      if (!this.sliderMaxDate?.hasSame(bounds.maxDate, "day")) {
        this.sliderMaxDate = bounds.maxDate;
      }
      this.sliderRange = {from: from.toMillis(), to: to.toMillis()};
    }
  }

  private sliderPresetMatching(preset: AgmStatsPreset): DateRangeSliderPreset {
    return this.dateRangePresets.find(option => option.id === preset) || null;
  }

  private startOfDayMillis(value: number): number {
    return this.dateUtils.asDateTime(value).startOf("day").toMillis();
  }

  private endOfDay(dateTime: any) {
    return dateTime.set({hour: 23, minute: 59, second: 59, millisecond: 999});
  }

  private formatDateForParam(value: number): string {
    return this.dateUtils.yearMonthDayWithDashes(value);
  }

  sortedRows<T>(items: T[], table: string): T[] {
    const state = this.sortStateFor(table);
    const prefix = state.direction === SortDirection.DESC ? "-" : "";
    return [...items].sort(sortBy(prefix + state.key));
  }

  prepareChartData() {
    if (!this.stats) {
      return;
    }

    const datePipe = new DatePipe("en-GB");

    const formatDateRange = (fromTimestamp: number, toTimestamp: number): string => {
      const from = datePipe.transform(fromTimestamp, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED);
      const to = datePipe.transform(toTimestamp, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED);
      return `${from} - ${to}`;
    };

    const formatCompactDateRange = (fromTimestamp: number, toTimestamp: number): string => {
      const from = datePipe.transform(fromTimestamp, UIDateFormat.MONTH_YEAR_ABBREVIATED);
      const to = datePipe.transform(toTimestamp, UIDateFormat.MONTH_YEAR_ABBREVIATED);
      return `${from} - ${to}`;
    };

    const effectiveFrom = this.stats.earliestDate ? Math.max(this.fromDate, this.stats.earliestDate) : this.fromDate;
    const totalRange = this.toDate - this.fromDate;
    const periodLength = totalRange / 3;
    const period3To = this.toDate;
    const period3From = this.toDate - periodLength;
    const period2To = period3From;
    const period2From = period2To - periodLength;
    const period1To = period2From;
    const period1From = this.fromDate;
    const walkPeriods = [
      this.stats.twoYearsAgo ? { label: formatDateRange(period1From, period1To), data: this.stats.twoYearsAgo.walks } : null,
      this.stats.previousYear ? { label: formatDateRange(period2From, period2To), data: this.stats.previousYear.walks } : null,
      { label: formatDateRange(period3From, period3To), data: this.stats.currentYear.walks }
    ].filter(p => !isNull(p));
    const socialPeriods = [
      this.stats.twoYearsAgo ? { label: walkPeriods[0].label, data: this.stats.twoYearsAgo.socials } : null,
      this.stats.previousYear ? { label: walkPeriods[1].label, data: this.stats.previousYear.socials } : null,
      { label: walkPeriods[walkPeriods.length - 1].label, data: this.stats.currentYear.socials }
    ].filter(p => !isNull(p));
    const yearlyPeriods = this.stats.yearlyStats?.filter(yearStat => yearStat.year >= this.dateUtils.asDateTime(effectiveFrom).year && yearStat.year <= this.dateUtils.asDateTime(this.toDate).year)
      .map(yearStat => ({
        label: formatCompactDateRange(yearStat.periodFrom, yearStat.periodTo),
        walks: yearStat.walks,
        socials: yearStat.socials,
        membership: yearStat.membership
      })) || [];
    const labels = yearlyPeriods.length ? yearlyPeriods.map(period => period.label) : walkPeriods.map(period => period.label);

    this.walkChartData = {
      labels,
      datasets: [
        {
          label: "Walk Slots Not Filled",
          data: yearlyPeriods.length ? yearlyPeriods.map(period => period.walks.unfilledSlots || 0) : walkPeriods.map(period => period.data.unfilledSlots || 0),
          backgroundColor: "rgba(255, 159, 64, 0.5)",
          borderColor: "rgba(255, 159, 64, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        },
        {
          label: "Morning Walks",
          data: yearlyPeriods.length ? yearlyPeriods.map(period => period.walks.morningWalks || 0) : walkPeriods.map(period => period.data.morningWalks || 0),
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        },
        {
          label: "Cancelled Walks",
          data: yearlyPeriods.length ? yearlyPeriods.map(period => period.walks.cancelledWalks) : walkPeriods.map(period => period.data.cancelledWalks),
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        },
        {
          label: "Evening Walks",
          data: yearlyPeriods.length ? yearlyPeriods.map(period => period.walks.eveningWalks || 0) : walkPeriods.map(period => period.data.eveningWalks || 0),
          backgroundColor: "rgba(255, 206, 86, 0.5)",
          borderColor: "rgba(255, 206, 86, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        },
        {
          label: "Total Walks on Programme",
          data: yearlyPeriods.length ? yearlyPeriods.map(period => period.walks.totalWalks) : walkPeriods.map(period => period.data.totalWalks),
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        }
      ]
    };

    this.leaderChartData = {
      labels,
      datasets: [
        {
          label: "Active Walk Leaders",
          data: yearlyPeriods.length ? yearlyPeriods.map(period => period.walks.activeLeaders || 0) : walkPeriods.map(period => period.data.activeLeaders || 0),
          backgroundColor: "rgba(153, 102, 255, 0.5)",
          borderColor: "rgba(153, 102, 255, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        }
      ]
    };

    this.socialChartData = {
      labels,
      datasets: [
        {
          label: "Total Social Events",
          data: yearlyPeriods.length ? yearlyPeriods.map(period => period.socials.totalSocials) : socialPeriods.map(period => period.data.totalSocials),
          backgroundColor: "rgba(153, 102, 255, 0.5)",
          borderColor: "rgba(153, 102, 255, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        },
        {
          label: "Social Organisers",
          data: yearlyPeriods.length ? yearlyPeriods.map(period => period.socials.uniqueOrganisers) : socialPeriods.map(period => period.data.uniqueOrganisers),
          backgroundColor: "rgba(255, 159, 64, 0.5)",
          borderColor: "rgba(255, 159, 64, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        }
      ]
    };

    this.membershipChartData = {
      labels,
      datasets: [
        {
          label: "Total Members",
          data: yearlyPeriods.map(period => period.membership.totalMembers),
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        },
        {
          label: "New Joiners",
          data: yearlyPeriods.map(period => period.membership.newJoiners),
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        },
        {
          label: "Leavers",
          data: yearlyPeriods.map(period => period.membership.leavers),
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        }
      ]
    };
  }

  onRefresh() {
    this.loadStats(true);
  }

  yearsInRange(): string[] {
    if (!this.stats?.yearlyStats) {
      return [];
    }
    return [...this.stats.yearlyStats]
      .map(stat => this.formatPeriodLabel(stat.periodFrom, stat.periodTo));
  }

  private formatPeriodLabel(fromTimestamp: number, toTimestamp: number): string {
    const from = this.dateUtils.asString(fromTimestamp, null, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED);
    const to = this.dateUtils.asString(toTimestamp, null, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED);
    return `${from} - ${to}`;
  }

  periodValue(_periodLabel: string, section: AgmStatsSection, field: string, index?: number): number {
    const periodIndex = isNumber(index) ? index : this.yearsInRange().indexOf(_periodLabel);
    if (periodIndex >= 0 && this.stats?.yearlyStats?.[periodIndex]) {
      return (this.stats.yearlyStats[periodIndex] as any)[section]?.[field] || 0;
    } else {
      return 0;
    }
  }

  toggleSort(table: string, key: string) {
    const current = this.sortState[table];
    const direction = current && current.key === key && current.direction === SortDirection.ASC
      ? SortDirection.DESC
      : SortDirection.ASC;
    this.sortState[table] = { key, direction };
  }

  private sortStateFor(table: string): { key: string; direction: SortDirection } {
    const state = this.sortState[table];
    if (state) {
      return state;
    }
    if (table.startsWith("payees-")) {
      return {key: "totalCost", direction: SortDirection.DESC};
    }
    switch (table) {
      case "expensesSummary":
        return {key: "order", direction: SortDirection.ASC};
      case "walkSummary":
        return {key: "order", direction: SortDirection.ASC};
      case "aggregateLeaders":
        return {key: "walkCount", direction: SortDirection.DESC};
      case "leaders":
        return {key: "rank", direction: SortDirection.ASC};
      case "socialEvents":
        return {key: "date", direction: SortDirection.ASC};
      case "organisers":
        return {key: "eventCount", direction: SortDirection.DESC};
      default:
        return {key: "metric", direction: SortDirection.ASC};
    }
  }

  walkSummaryRows(): SummaryRow[] {
    if (!this.stats) {
      return [];
    }
    const periods = this.yearsInRange();
    const rows: {metric: string; values: number[]; order: number}[] = [
      {metric: "New Walk Leaders", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.WALKS, "newLeaders", index)), order: 0},
      {metric: "Active Walk Leaders", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.WALKS, "activeLeaders", index)), order: 1},
      {metric: "Walk Slots Not Filled", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.WALKS, "unfilledSlots", index)), order: 2},
      {metric: "Morning Walks", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.WALKS, "morningWalks", index)), order: 3},
      {metric: "Cancelled Walks", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.WALKS, "cancelledWalks", index)), order: 4},
      {metric: "Evening Walks", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.WALKS, "eveningWalks", index)), order: 5},
      {metric: "Total Walks on Programme", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.WALKS, "totalWalks", index)), order: 6},
      {metric: "Total Miles Walked", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.WALKS, "totalMiles", index)), order: 7}
    ];

    return rows.map(row => {
      const previous = row.values[row.values.length - 2] ?? 0;
      const current = row.values[row.values.length - 1] ?? 0;
      return {
        ...row,
        previous,
        current,
        changeValue: current - previous,
        changeDisplay: this.percentageChange(current, previous)
      };
    });
  }

  socialSummaryRows(): SummaryRow[] {
    if (!this.stats) {
      return [];
    }
    const periods = this.yearsInRange();
    return [
      {metric: "Total Social Events", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.SOCIALS, "totalSocials", index))},
      {metric: "Social Organisers", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.SOCIALS, "uniqueOrganisers", index))}
    ].map(row => {
      const previous = row.values[row.values.length - 2] ?? 0;
      const current = row.values[row.values.length - 1] ?? 0;
      return {
        ...row,
        previous,
        current,
        changeValue: current - previous,
        changeDisplay: this.percentageChange(current, previous)
      };
    });
  }

  expenseSummaryRows(): SummaryRow[] {
    if (!this.stats) {
      return [];
    }
    const periods = this.yearsInRange();
    const toCurrency = (v: number) => v === 0 ? 0 : v;
    const isCurrencyMetric = (metric: string) =>
      metric === "Total Cost" || metric === "Total Paid" || metric === "Total Unpaid";

    const rows: {metric: string; values: number[]; order: number}[] = [
      {metric: "Total Claims", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.EXPENSES, "totalClaims", index)), order: 0},
      {metric: "Total Expense Items", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.EXPENSES, "totalItems", index)), order: 1},
      {metric: "Total Paid", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.EXPENSES, "totalCost", index)), order: 2},
      {metric: "Total Unpaid", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.EXPENSES, "totalUnpaidCost", index)), order: 3},
      {
        metric: "Total Cost",
        values: periods.map((p, index) =>
          this.periodValue(p, AgmStatsSection.EXPENSES, "totalCost", index) + this.periodValue(p, AgmStatsSection.EXPENSES, "totalUnpaidCost", index)
        ),
        order: 4
      }
    ];

    return rows.map(row => {
      const previous = row.values[row.values.length - 2] ?? 0;
      const current = row.values[row.values.length - 1] ?? 0;
      const total = row.values.reduce((sum, val) => sum + (val ?? 0), 0);
      return {
        ...row,
        previous,
        current,
        changeValue: current - previous,
        displayValues: isCurrencyMetric(row.metric) ? row.values.map(toCurrency) : row.values,
        totalForPeriod: isCurrencyMetric(row.metric) ? toCurrency(total) : total,
        changeDisplay: this.percentageChange(current, previous)
      };
    });
  }

  membershipSummaryRows(): SummaryRow[] {
    if (!this.stats) {
      return [];
    }
    const periods = this.yearsInRange();
    return [
      {metric: "Total Members", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.MEMBERSHIP, "totalMembers", index))},
      {metric: "New Joiners", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.MEMBERSHIP, "newJoiners", index))},
      {metric: "Leavers", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.MEMBERSHIP, "leavers", index))},
      {metric: "Deletions (Period)", values: periods.map((p, index) => this.periodValue(p, AgmStatsSection.MEMBERSHIP, "deletions", index))}
    ].map(row => {
      const previous = row.values[row.values.length - 2] ?? 0;
      const current = row.values[row.values.length - 1] ?? 0;
      return {
        ...row,
        previous,
        current,
        changeValue: current - previous,
        changeDisplay: this.percentageChange(current, previous)
      };
    });
  }

  leaderRows(): RankedLeaderRow[] {
    if (!this.stats?.currentYear) {
      return [];
    }
    return (this.stats.currentYear.walks?.allLeaders || []).map((leader, index) => ({
      ...asLeaderStats(leader),
      rank: index + 1
    }));
  }

  aggregateLeaderRows(): RankedLeaderRow[] {
    if (!this.stats) {
      return [];
    }
    const source: YearComparison[] = this.stats.yearlyStats?.length ? this.stats.yearlyStats : [this.stats.twoYearsAgo, this.stats.previousYear, this.stats.currentYear].filter(Boolean);
    this.logger.info(`aggregateLeaderRows: using ${source.length} periods, yearlyStats.length=${this.stats.yearlyStats?.length || 0}`);
    const leaders: LeaderStats[] = source.flatMap(year => year.walks?.allLeaders || []);
    this.logger.info(`aggregateLeaderRows: total leader entries before aggregation: ${leaders.length}`);
    this.logger.info(`aggregateLeaderRows: sample leader entries:`, leaders.slice(0, 5));

    const result: RankedLeaderRow[] = aggregateLeaderStats(leaders);

    this.logger.warn(`aggregateLeaderRows: final aggregated leaders count: ${result.length}`);
    this.logger.warn(`aggregateLeaderRows: top 5 leaders:`, result.slice(0, 5));

    return result;
  }

  aggregateYearsLabel(): string {
    if (!this.stats) {
      return "All Years";
    }
    const source: YearComparison[] = this.stats.yearlyStats?.length ? this.stats.yearlyStats : [this.stats.twoYearsAgo, this.stats.previousYear, this.stats.currentYear].filter(Boolean);
    return this.stringUtils.pluraliseWithCount(source.length, "year");
  }

  newLeadersList() {
    return aggregateLeaderStats(this.stats?.currentYear?.walks?.newLeadersList || []);
  }

  cancelledWalksList() {
    return this.stats?.currentYear?.walks?.cancelledWalksList || [];
  }

  eveningWalksList() {
    return this.stats?.currentYear?.walks?.eveningWalksList || [];
  }

  unfilledSlotsList() {
    return this.stats?.currentYear?.walks?.unfilledSlotsList || [];
  }

  morningWalksList() {
    return this.stats?.currentYear?.walks?.morningWalksList || [];
  }

  currentYearFrom() {
    return this.stats?.currentYear?.periodFrom || this.fromDate;
  }

  currentYearTo() {
    return this.stats?.currentYear?.periodTo || this.toDate;
  }

  aggregateOrganisers() {
    if (!this.stats) {
      return [];
    }
    const source = this.stats.yearlyStats?.length ? this.stats.yearlyStats : [this.stats.twoYearsAgo, this.stats.previousYear, this.stats.currentYear].filter(Boolean);

    const organisers = source.flatMap(year => year.socials.organisersList);

    const aggregate = organisers.reduce((acc, org) => {
      const key = org.id || org.name;
      if (!acc[key]) {
        acc[key] = {id: org.id, name: org.name, eventCount: 0};
      }
      acc[key].eventCount += org.eventCount || 0;
      return acc;
    }, {} as Record<string, {id: string; name: string; eventCount: number}>);

    return values(aggregate).sort(sortBy("-eventCount", "name"));
  }

  aggregatedSocialEvents() {
    if (!this.stats) {
      return [];
    }
    const source = this.stats.currentYear ? [this.stats.currentYear] : [];
    const events = source.flatMap(year => year.socials.socialsList).map(event => {
      const link = event.link || (event.description ? `/${this.groupEventDisplayService.groupEventArea()}/${this.stringUtils.kebabCase(event.description)}` : null);
      const id = (event as any).id || this.stringUtils.kebabCase(event.description);
      return {
        ...event,
        id,
        link,
        linkTitle: event.linkTitle || event.description || "Link"
      };
    });
    return events.sort((a, b) => (a.date || 0) - (b.date || 0));
  }

  socialLink(event: SocialRow): string {
    const extended = this.toExtendedSocialEvent(event);
    const url = this.groupEventDisplayService.groupEventLink(extended, true);
    this.logger.off("socialLink:event:", event, "extended:", extended, "url:", url);
    return url;
  }

  private toExtendedSocialEvent(event: SocialRow): ExtendedGroupEvent {
    const id = event.id || this.stringUtils.kebabCase(event.description);
    const url = event.groupEvent?.url || id;
    return {
      groupEvent: {
        url,
        external_url: event.link || event.groupEvent?.external_url,
        title: event.groupEvent?.title || event.description,
        description: event.groupEvent?.description || event.description,
        item_type: event.groupEvent?.item_type || RamblersEventType.GROUP_EVENT,
        id
      }
    } as unknown as ExtendedGroupEvent;
  }

  yearlyStatsReversed() {
    if (!this.stats?.yearlyStats) {
      return [];
    }
    return [...this.stats.yearlyStats].reverse();
  }

  unpaidExpenses() {
    if (!this.stats?.currentYear?.expenses?.unpaidExpenses) {
      return [];
    }
    return this.stats.currentYear.expenses.unpaidExpenses;
  }

  yearLabel(periodLabel: string): string {
    return periodLabel;
  }

  percentageChange(current: number, previous: number): string {
    if (previous === 0) {
      return "N/A";
    }
    const change = ((current - previous) / previous) * 100;
    return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  }

  changeClass(current: number, previous: number): string {
    if (current > previous) {
      return "text-success";
    }
    if (current < previous) {
      return "text-danger";
    }
    return "";
  }

  sortIcon(table: string, key: string) {
    const state = this.sortStateFor(table);
    if (state.key !== key) {
      return null;
    }
    return state.direction === SortDirection.ASC ? this.faChevronUp : this.faChevronDown;
  }

  selectTab(tab: AGMStatsTab) {
    const next = kebabCase(tab);
    if (this.tab !== next) {
      this.tab = next;
      this.replaceQueryParams({[StoredValue.TAB]: next});
    }
  }

  tabActive(tab: AGMStatsTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }
}
