import { CommonModule, DatePipe } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { NgxLoggerLevel } from "ngx-logger";
import { DatePicker } from "../../../date-and-time/date-picker";
import { DateValue } from "../../../models/date.model";
import { AGMStatsResponse, ExtendedGroupEvent, LeaderStats, YearComparison } from "../../../models/group-event.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { StoredValue } from "../../../models/ui-actions";
import { AGMStatsService } from "../../../services/agm-stats.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentService } from "../../../services/page-content.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { SocialDisplayService } from "../../social/social-display.service";
import { UIDateFormat } from "../../../models/date-format.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { sortBy } from "../../../functions/arrays";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { isNumber, kebabCase } from "es-toolkit/compat";
import { AGMWalksTabComponent } from "./agm-walks-tab";
import { AGMSocialsTabComponent, SocialRow } from "./agm-socials-tab";
import { AGMExpensesTabComponent } from "./agm-expenses-tab";
import { AGMMembershipTabComponent } from "./agm-membership-tab";
import { PageComponent } from "../../../page/page.component";
import { SummaryRow } from "./agm-summary-table";

interface RankedLeaderRow extends LeaderStats {
  rank: number;
}

Chart.register(...registerables);

@Component({
  selector: "app-agm-stats",
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker, FontAwesomeModule, TabsetComponent, TabDirective, AGMWalksTabComponent, AGMSocialsTabComponent, AGMExpensesTabComponent, AGMMembershipTabComponent, PageComponent],
  styleUrls: ["./agm-stats.sass"],
  template: `
    <app-page autoTitle pageTitle="AGM Statistics Report">
      <div class="container-fluid">

        @if (error) {
          <div class="alert alert-danger">{{ error }}</div>
        }
        <tabset class="custom-tabset">
          <tab app-agm-walks-tab
               [active]="tabActive(AGMStatsTab.WALKS)"
               (selectTab)="selectTab(AGMStatsTab.WALKS)"
               [heading]="AGMStatsTab.WALKS"
               [dateRangeControls]="dateRangeControls"
               [walkChartData]="walkChartData"
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
               [unfilledSlotsList]="unfilledSlotsList()">
          </tab>

          <tab app-agm-socials-tab
               [active]="tabActive(AGMStatsTab.SOCIALS)"
               (selectTab)="selectTab(AGMStatsTab.SOCIALS)"
               [heading]="AGMStatsTab.SOCIALS"
               [dateRangeControls]="dateRangeControls"
               [years]="yearsInRange()"
               [socialSummaryRows]="socialSummaryRows()"
               [sortedRowsFn]="sortedRowsFn"
               [toggleSortFn]="toggleSortFn"
               [sortIconFn]="sortIconFn"
               [changeClassFn]="changeClassFn"
               [getYearLabelFn]="getYearLabelFn"
               [fromDate]="fromDate"
               [toDate]="toDate"
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
               [dateRangeControls]="dateRangeControls"
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
               [dateRangeControls]="dateRangeControls"
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
      </div>
      <ng-template #dateRangeControls>
        <div class="row align-items-end g-2">
          <div class="col-12 col-md-6 col-lg-3">
            <label for="preset" class="form-label">Date Range Preset</label>
            <select id="preset" class="form-select" [(ngModel)]="preset" (ngModelChange)="onPresetChange($event)">
              @for (option of presetOptions; track option.key) {
                <option [value]="option.value">{{ presetLabel(option.value) }}</option>
              }
            </select>
          </div>
          <div class="col-12 col-md-6 col-lg-2">
            <app-date-picker
              label="From Date"
              [value]="fromDate"
              (change)="onFromDateChange($event)">
            </app-date-picker>
          </div>
          <div class="col-12 col-md-6 col-lg-2">
            <app-date-picker
              label="To Date"
              [value]="toDate"
              (change)="onToDateChange($event)">
            </app-date-picker>
          </div>
          <div class="col-12 col-md-6 col-lg-2">
            <label for="chartType" class="form-label">Chart Type</label>
            <select id="chartType" class="form-select" [(ngModel)]="chartType"
                    (ngModelChange)="onChartTypeChange($event)">
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
            </select>
          </div>
          <div class="col-12 col-lg-3 d-flex align-items-end">
            <button class="btn btn-primary w-100" (click)="onRefresh()" [disabled]="loading">
              @if (loading) {
                <span class="spinner-border spinner-border-sm me-2"></span>
              }
              Load Stats
            </button>
          </div>
          @if (loading) {
            <div class="mt-3 alert alert-warning alert-dismissible fade show loading-alert" role="alert">
              <div class="d-flex align-items-center">
                <span class="spinner-border spinner-border-sm me-3"></span>
                <strong>Loading statistics...</strong>
              </div>
            </div>
          }
        </div>
      </ng-template>
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
  protected socialDisplayService = inject(SocialDisplayService);
  faChevronUp = faChevronUp;
  faChevronDown = faChevronDown;

  stats: AGMStatsResponse | null = null;
  loading = false;
  error: string | null = null;
  preset: PresetOption = PresetOption.LAST_2_YEARS;
  presetOptions: KeyValue<string>[] = enumKeyValues(PresetOption);
  private sortState: Record<string, { key: string; direction: "asc" | "desc" }> = {};
  protected readonly AGMStatsTab = AGMStatsTab;
  private tab: string;
  currencyMetrics = ["Total Cost", "Total Paid", "Total Unpaid"];

  fromDate: number;
  toDate: number;
  chartType: "bar" | "line" = "bar";

  walkChartData: ChartConfiguration["data"] = {
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
    if (this.preset === PresetOption.ALL_TIME) {
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
    const defaultTab = kebabCase(AGMStatsTab.WALKS);
    const tabParameter = this.route.snapshot.queryParamMap.get(this.stringUtils.kebabCase(StoredValue.TAB));
    this.tab = tabParameter || defaultTab;

    if (this.preset === PresetOption.ALL_TIME) {
      this.applyAllTimePreset();
    } else {
      this.loadStats();
    }
  }

  private initializeState() {
    this.loadFromStorage();
    this.loadFromQueryParams();
  }

  private loadFromStorage() {
    this.fromDate = this.parseDateInput(this.uiActions.initialValueFor(StoredValue.FROM_DATE, this.formatDateForParam(this.fromDate)), this.fromDate);
    this.toDate = this.parseDateInput(this.uiActions.initialValueFor(StoredValue.TO_DATE, this.formatDateForParam(this.toDate)), this.toDate);
    this.chartType = this.resolveChartType(this.uiActions.initialValueFor(StoredValue.CHART_TYPE, this.chartType), this.chartType);
  }

  private loadFromQueryParams() {
    const params = this.route.snapshot.queryParamMap;
    const chartTypeParam = params.get(this.stringUtils.kebabCase(StoredValue.CHART_TYPE));
    this.chartType = this.resolveChartType(chartTypeParam, this.chartType);
    const presetParam = params.get(this.stringUtils.kebabCase("preset"));
    if (presetParam && this.presetOptions.find(option => option.value === presetParam)) {
      this.preset = presetParam as PresetOption;
      if (this.preset === PresetOption.ALL_TIME) {
        const now = this.dateUtils.dateTimeNow();
        this.toDate = this.endOfDay(now).toMillis();
        this.fromDate = this.endOfDay(now).minus({years: 5}).toMillis();
      } else if (this.preset !== PresetOption.CUSTOM) {
        this.applyPresetDates(this.preset);
      } else {
        this.fromDate = this.parseDateInput(params.get(this.stringUtils.kebabCase(StoredValue.FROM_DATE)), this.fromDate);
        this.toDate = this.parseDateInput(params.get(this.stringUtils.kebabCase(StoredValue.TO_DATE)), this.toDate);
      }
    } else {
      this.fromDate = this.parseDateInput(params.get(this.stringUtils.kebabCase(StoredValue.FROM_DATE)), this.fromDate);
      this.toDate = this.parseDateInput(params.get(this.stringUtils.kebabCase(StoredValue.TO_DATE)), this.toDate);
    }
  }

  private parseDateInput(value: string | number | null, fallback: number): number {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (isNumber(value)) {
      return value > 0 ? value : fallback;
    }
    const parsedFromFormat = this.dateUtils.asValue(value, UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
    return parsedFromFormat > 0 ? parsedFromFormat : fallback;
  }

  private resolveChartType(value: string | null, fallback: "bar" | "line"): "bar" | "line" {
    return value === "bar" || value === "line" ? value : fallback;
  }

  private persistState() {
    this.uiActions.saveValueFor(StoredValue.FROM_DATE, this.formatDateForParam(this.fromDate));
    this.uiActions.saveValueFor(StoredValue.TO_DATE, this.formatDateForParam(this.toDate));
    this.uiActions.saveValueFor(StoredValue.CHART_TYPE, this.chartType);
    this.replaceQueryParams({
      [this.stringUtils.kebabCase(StoredValue.FROM_DATE)]: this.formatDateForParam(this.fromDate),
      [this.stringUtils.kebabCase(StoredValue.TO_DATE)]: this.formatDateForParam(this.toDate),
      [this.stringUtils.kebabCase(StoredValue.CHART_TYPE)]: this.chartType,
      [this.stringUtils.kebabCase("preset")]: this.preset
    });
  }

  private replaceQueryParams(params: Record<string, string | number>) {
    const queryParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: "merge" });
  }

  loadStats() {
    this.persistState();
    this.loading = true;
    this.error = null;

    this.logger.info("Loading AGM stats for:", { fromDate: this.fromDate, toDate: this.toDate });

    this.agmStatsService.agmStats(this.fromDate, this.toDate).subscribe({
      next: (response) => {
        this.stats = response;
        if (response.earliestDate && this.preset === PresetOption.ALL_TIME) {
          this.fromDate = response.earliestDate;
          this.persistState();
        } else if (response.earliestDate && this.fromDate < response.earliestDate) {
          this.fromDate = response.earliestDate;
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

  onFromDateChange(dateValue: DateValue) {
    if (dateValue) {
      this.fromDate = dateValue.value;
      this.preset = PresetOption.CUSTOM;
      this.loadStats();
    }
  }

  onToDateChange(dateValue: DateValue) {
    if (dateValue) {
      this.toDate = dateValue.value;
      this.preset = PresetOption.CUSTOM;
      this.loadStats();
    }
  }

  onChartTypeChange(type: "bar" | "line") {
    this.chartType = type;
    this.persistState();
  }

  onPresetChange(preset: PresetOption) {
    this.preset = preset;
    this.sortState = {};
    if (preset !== PresetOption.CUSTOM) {
      if (preset === PresetOption.ALL_TIME) {
        this.applyAllTimePreset();
      } else {
        this.applyPresetDates(preset);
        this.loadStats();
      }
    }
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
        this.persistState();
        this.loadStats();
      },
      error: (error) => {
        this.logger.error("Failed to fetch earliest date:", error);
        this.fromDate = this.endOfDay(now).minus({years: 5}).toMillis();
        this.persistState();
        this.loadStats();
      }
    });
  }

  private applyPresetDates(preset: PresetOption) {
    const now = this.dateUtils.dateTimeNow();
    switch (preset) {
      case PresetOption.LAST_2_YEARS:
        this.applyRange(now, 2);
        break;
      case PresetOption.LAST_3_YEARS:
        this.applyRange(now, 3);
        break;
      case PresetOption.LAST_4_YEARS:
        this.applyRange(now, 4);
        break;
      case PresetOption.LAST_5_YEARS:
        this.applyRange(now, 5);
        break;
      case PresetOption.LAST_1_YEAR:
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

  private endOfDay(dateTime: any) {
    return dateTime.set({hour: 23, minute: 59, second: 59, millisecond: 999});
  }

  private formatDateForParam(value: number): string {
    return this.dateUtils.yearMonthDayWithDashes(value);
  }

  sortedRows<T>(items: T[], table: string): T[] {
    const state = this.sortStateFor(table);
    const prefix = state.direction === "desc" ? "-" : "";
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
    ].filter(p => p !== null);
    const socialPeriods = [
      this.stats.twoYearsAgo ? { label: walkPeriods[0].label, data: this.stats.twoYearsAgo.socials } : null,
      this.stats.previousYear ? { label: walkPeriods[1].label, data: this.stats.previousYear.socials } : null,
      { label: walkPeriods[walkPeriods.length - 1].label, data: this.stats.currentYear.socials }
    ].filter(p => p !== null);
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
          label: "Total Walks",
          data: yearlyPeriods.length ? yearlyPeriods.map(period => period.walks.totalWalks) : walkPeriods.map(period => period.data.totalWalks),
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        },
        {
          label: "Confirmed Walks",
          data: yearlyPeriods.length ? yearlyPeriods.map(period => period.walks.confirmedWalks) : walkPeriods.map(period => period.data.confirmedWalks),
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
    this.loadStats();
  }

  yearsInRange(): string[] {
    if (!this.stats?.yearlyStats) {
      return [];
    }
    return [...this.stats.yearlyStats]
      .map(stat => this.formatPeriodLabel(stat.periodFrom, stat.periodTo));
  }

  private formatPeriodLabel(fromTimestamp: number, toTimestamp: number): string {
    const datePipe = new DatePipe("en-GB");
    const fromDate = this.dateUtils.asDateTime(fromTimestamp);
    const toDate = this.dateUtils.asDateTime(toTimestamp);
    const from = datePipe.transform(fromTimestamp, UIDateFormat.MONTH_YEAR_ABBREVIATED);

    if (fromDate.year === toDate.year) {
      const to = datePipe.transform(toTimestamp, UIDateFormat.MONTH_YEAR_ABBREVIATED);
      return `${from} - ${to}`;
    } else {
      return `${from} - ${toDate.year}`;
    }
  }

  periodValue(periodLabel: string, section: "walks" | "socials" | "expenses" | "membership", field: string): number {
    const index = this.yearsInRange().indexOf(periodLabel);
    if (index >= 0 && this.stats?.yearlyStats?.[index]) {
      return (this.stats.yearlyStats[index] as any)[section]?.[field] || 0;
    }
    return 0;
  }

  toggleSort(table: string, key: string) {
    const current = this.sortState[table];
    const direction = current && current.key === key && current.direction === "asc" ? "desc" : "asc";
    this.sortState[table] = { key, direction };
  }

  private sortStateFor(table: string): { key: string; direction: "asc" | "desc" } {
    const state = this.sortState[table];
    if (state) {
      return state;
    }
    if (table.startsWith("payees-")) {
      return {key: "totalCost", direction: "desc"};
    }
    switch (table) {
      case "expensesSummary":
        return {key: "order", direction: "asc"};
      case "aggregateLeaders":
        return {key: "walkCount", direction: "desc"};
      case "leaders":
        return {key: "rank", direction: "asc"};
      case "socialEvents":
        return {key: "date", direction: "asc"};
      case "organisers":
        return {key: "eventCount", direction: "desc"};
      default:
        return {key: "metric", direction: "asc"};
    }
  }

  walkSummaryRows(): SummaryRow[] {
    if (!this.stats) {
      return [];
    }
    const periods = this.yearsInRange();
    return [
      {metric: "Total Walks on Programme", values: periods.map(p => this.periodValue(p, "walks", "totalWalks"))},
      {metric: "Successfully Led Walks", values: periods.map(p => this.periodValue(p, "walks", "confirmedWalks"))},
      {metric: "Evening Walks", values: periods.map(p => this.periodValue(p, "walks", "eveningWalks"))},
      {metric: "Cancelled Walks", values: periods.map(p => this.periodValue(p, "walks", "cancelledWalks"))},
      {metric: "Walk Slots Not Filled", values: periods.map(p => this.periodValue(p, "walks", "unfilledSlots"))},
      {metric: "Total Miles Walked", values: periods.map(p => this.periodValue(p, "walks", "totalMiles"))},
      {metric: "Active Walk Leaders", values: periods.map(p => this.periodValue(p, "walks", "activeLeaders"))},
      {metric: "New Walk Leaders", values: periods.map(p => this.periodValue(p, "walks", "newLeaders"))}
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

  socialSummaryRows(): SummaryRow[] {
    if (!this.stats) {
      return [];
    }
    const periods = this.yearsInRange();
    return [
      {metric: "Total Social Events", values: periods.map(p => this.periodValue(p, "socials", "totalSocials"))},
      {metric: "Social Organisers", values: periods.map(p => this.periodValue(p, "socials", "uniqueOrganisers"))}
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
      {metric: "Total Claims", values: periods.map(p => this.periodValue(p, "expenses", "totalClaims")), order: 0},
      {metric: "Total Expense Items", values: periods.map(p => this.periodValue(p, "expenses", "totalItems")), order: 1},
      {metric: "Total Paid", values: periods.map(p => this.periodValue(p, "expenses", "totalCost")), order: 2},
      {metric: "Total Unpaid", values: periods.map(p => this.periodValue(p, "expenses", "totalUnpaidCost")), order: 3},
      {
        metric: "Total Cost",
        values: periods.map(p =>
          this.periodValue(p, "expenses", "totalCost") + this.periodValue(p, "expenses", "totalUnpaidCost")
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
      {metric: "Total Members", values: periods.map(p => this.periodValue(p, "membership", "totalMembers"))},
      {metric: "New Joiners", values: periods.map(p => this.periodValue(p, "membership", "newJoiners"))},
      {metric: "Leavers", values: periods.map(p => this.periodValue(p, "membership", "leavers"))},
      {metric: "Deletions (Period)", values: periods.map(p => this.periodValue(p, "membership", "deletions"))}
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
    return this.stats.currentYear.walks.allLeaders.map((leader, index) => ({
      ...leader,
      rank: index + 1
    }));
  }

  aggregateLeaderRows(): RankedLeaderRow[] {
    if (!this.stats) {
      return [];
    }
    const source: YearComparison[] = this.stats.yearlyStats?.length ? this.stats.yearlyStats : [this.stats.twoYearsAgo, this.stats.previousYear, this.stats.currentYear].filter(Boolean);
    this.logger.info(`aggregateLeaderRows: using ${source.length} periods, yearlyStats.length=${this.stats.yearlyStats?.length || 0}`);
    const leaders: LeaderStats[] = source.flatMap(year => year.walks.allLeaders);
    this.logger.info(`aggregateLeaderRows: total leader entries before aggregation: ${leaders.length}`);
    this.logger.info(`aggregateLeaderRows: sample leader entries:`, leaders.slice(0, 5));

    const aggregate = leaders.reduce((acc, leader) => {
      const normalizedName = leader.name?.trim().toLowerCase() || "";
      const normalizedEmail = leader.email?.trim().toLowerCase() || "";

      let matchedKey: string | null = null;
      for (const [existingKey, existingLeader] of Object.entries(acc)) {
        const existingName = existingLeader.name?.trim().toLowerCase() || "";
        const existingEmail = existingLeader.email?.trim().toLowerCase() || "";

        if ((normalizedEmail && normalizedEmail === existingEmail) ||
            (normalizedName && normalizedName === existingName)) {
          matchedKey = existingKey;
          break;
        }
      }

      if (matchedKey) {
        acc[matchedKey].walkCount += leader.walkCount || 0;
        acc[matchedKey].totalMiles += leader.totalMiles || 0;
      } else {
        const newKey = normalizedEmail || leader.id || normalizedName;
        acc[newKey] = {
          id: leader.id || "",
          name: leader.name || "",
          email: leader.email || "",
          walkCount: leader.walkCount || 0,
          totalMiles: leader.totalMiles || 0
        };
      }

      return acc;
    }, {} as Record<string, {id: string; name: string; email: string; walkCount: number; totalMiles: number}>);

    const result: RankedLeaderRow[] = Object.values(aggregate)
      .sort(sortBy("-walkCount", "-totalMiles"))
      .map((leader, index) => ({
        ...leader,
        rank: index + 1,
        totalMiles: Math.round(leader.totalMiles * 10) / 10
      }));

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
    return this.stats?.currentYear?.walks?.newLeadersList || [];
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

    return Object.values(aggregate).sort(sortBy("-eventCount", "name"));
  }

  aggregatedSocialEvents() {
    if (!this.stats) {
      return [];
    }
    const source = this.stats.yearlyStats?.length ? this.stats.yearlyStats : [this.stats.currentYear];
    const events = source.flatMap(year => year.socials.socialsList).map(event => {
      const link = event.link || (event.description ? `/social/${this.stringUtils.kebabCase(event.description)}` : null);
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
    const url = this.socialDisplayService.groupEventLink(extended, true);
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
    return state.direction === "asc" ? this.faChevronUp : this.faChevronDown;
  }

  presetLabel(option: string): string {
    switch (option) {
      case PresetOption.LAST_1_YEAR:
        return "Last 1 year";
      case PresetOption.LAST_2_YEARS:
        return "Last 2 years";
      case PresetOption.LAST_3_YEARS:
        return "Last 3 years";
      case PresetOption.LAST_4_YEARS:
        return "Last 4 years";
      case PresetOption.LAST_5_YEARS:
        return "Last 5 years";
      case PresetOption.ALL_TIME:
        return "All time";
      default:
        return "Custom";
    }
  }

  selectTab(tab: AGMStatsTab) {
    this.router.navigate([], {
      queryParams: {[this.stringUtils.kebabCase(StoredValue.TAB)]: kebabCase(tab)},
      queryParamsHandling: "merge"
    });
  }

  tabActive(tab: AGMStatsTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }
}

enum PresetOption {
  CUSTOM = "custom",
  LAST_1_YEAR = "last-1-year",
  LAST_2_YEARS = "last-2-years",
  LAST_3_YEARS = "last-3-years",
  LAST_4_YEARS = "last-4-years",
  LAST_5_YEARS = "last-5-years",
  ALL_TIME = "all-time"
}

enum AGMStatsTab {
  WALKS = "Walks",
  SOCIALS = "Socials",
  MEMBERSHIP = "Membership",
  EXPENSES = "Expenses"
}
