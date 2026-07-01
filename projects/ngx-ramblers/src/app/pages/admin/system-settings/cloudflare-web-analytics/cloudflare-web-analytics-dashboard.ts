import { Component, inject, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { NgxLoggerLevel } from "ngx-logger";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faExclamationTriangle, faRotate } from "@fortawesome/free-solid-svg-icons";
import {
  CloudflareWebAnalyticsSummary
} from "../../../../models/cloudflare-web-analytics.model";
import { UIDateFormat } from "../../../../models/date-format.model";
import { CloudflareWebAnalyticsService } from "../../../../services/cloudflare/cloudflare-web-analytics.service";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { extractErrorMessage } from "../../../../functions/strings";
import { SectionToggle } from "../../../../shared/components/section-toggle";
import { DateRange, DateRangeSlider } from "../../../../components/date-range-slider/date-range-slider";
import { AnalyticsBreakdownTable } from "./analytics-breakdown-table";
import { DateTime } from "luxon";

interface PresetRange {
  label: string;
  days: number;
}

const CUSTOM_RANGE_LABEL = "Custom";

@Component({
  selector: "app-cloudflare-web-analytics-dashboard",
  imports: [CommonModule, FormsModule, FontAwesomeModule, BaseChartDirective, SectionToggle, DateRangeSlider, AnalyticsBreakdownTable],
  styles: [`
    :host ::ng-deep .section-toggle
      margin-bottom: 0

    .analytics-table-frame
      border: 1px solid var(--rsm-border)
      border-radius: 6px
      overflow: hidden

    .analytics-table
      width: 100%
      border-collapse: collapse
      font-size: 0.88rem

    .analytics-table thead th
      background-color: var(--rsm-table-header-bg)
      color: var(--rsm-table-header-text)
      font-weight: 600
      padding: 10px 16px
      white-space: nowrap

    .analytics-table tbody td
      padding: 10px 16px
      border-top: 1px solid var(--rsm-border)

    .analytics-table tbody tr:nth-child(odd)
      background-color: var(--rsm-panel-bg)

    .analytics-table tbody tr:nth-child(even)
      background-color: var(--rsm-row-stripe)
  `],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Cloudflare Web Analytics Dashboard</div>
      <div class="col-sm-12">
        @if (!siteTag) {
          <div class="alert alert-warning" role="alert">
            <fa-icon [icon]="faExclamationTriangle" class="me-2"/>
            <strong>Site Tag required:</strong> Configure a Cloudflare Web Analytics Site Tag above to enable the dashboard.
          </div>
        } @else {
          <div class="d-flex flex-wrap align-items-end gap-3 mb-3">
            <div class="form-group">
              <label class="d-block">Range</label>
              <app-section-toggle
                [tabs]="presetLabels"
                [selectedTab]="selectedPresetLabel"
                [queryParamKey]="'analytics-range'"
                (selectedTabChange)="selectPresetByLabel($event)"/>
            </div>
            <div class="form-group flex-grow-1">
              <app-date-range-slider
                [minDate]="sliderMinDate"
                [maxDate]="sliderMaxDate"
                [range]="sliderRange"
                (rangeChange)="onRangeChange($event)"/>
            </div>
            <div class="form-group">
              <button type="button" class="btn btn-primary"
                      [disabled]="busy"
                      (click)="loadAnalytics()">
                <fa-icon [icon]="faRotate" class="me-1"/>Refresh
              </button>
            </div>
          </div>

          @if (errorMessage) {
            <div class="alert alert-danger" role="alert">
              <fa-icon [icon]="faExclamationTriangle" class="me-2"/>
              <strong>Error:</strong> {{ errorMessage }}
            </div>
          }

          @if (summary) {
            <div class="row g-3 mb-3">
              <div class="col-md-4">
                <div class="card h-100">
                  <div class="card-body">
                    <h6 class="text-muted text-uppercase small mb-1">Page views</h6>
                    <div class="h3 mb-0">{{ summary.totals.pageViews | number }}</div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card h-100">
                  <div class="card-body">
                    <h6 class="text-muted text-uppercase small mb-1">Visits</h6>
                    <div class="h3 mb-0">{{ summary.totals.visits | number }}</div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card h-100">
                  <div class="card-body">
                    <h6 class="text-muted text-uppercase small mb-1">Date range</h6>
                    <div class="mb-0">{{ fromDateDisplay }} &mdash; {{ toDateDisplay }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12">
                <div class="chart-container" style="position: relative; height: 280px;">
                  @if (timeseriesChart.datasets[0].data.length) {
                    <canvas baseChart
                            [data]="timeseriesChart"
                            [options]="timeseriesOptions"
                            type="line">
                    </canvas>
                  } @else {
                    <div class="d-flex justify-content-center align-items-center h-100">
                      <span class="text-muted">No page view data in this range yet.</span>
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="row g-3">
              <div class="col-md-6">
                <h5>Top paths</h5>
                <app-analytics-breakdown-table [rows]="summary.topPaths" label="Path"/>
              </div>
              <div class="col-md-6">
                <h5>Top countries</h5>
                <app-analytics-breakdown-table [rows]="summary.topCountries" label="Country"/>
              </div>
              <div class="col-md-6">
                <h5>Top referrers</h5>
                <app-analytics-breakdown-table [rows]="summary.topReferrers" label="Referrer"/>
              </div>
              <div class="col-md-6">
                <h5>Device types</h5>
                <app-analytics-breakdown-table [rows]="summary.deviceTypes" label="Device"/>
              </div>
              <div class="col-md-6">
                <h5>Browsers</h5>
                <app-analytics-breakdown-table [rows]="summary.browsers" label="Browser"/>
              </div>
              <div class="col-md-6">
                <h5>Core Web Vitals</h5>
                @if (summary.webVitals.length === 0) {
                  <div class="text-muted small">No web vitals reported in this range.</div>
                } @else {
                  <div class="analytics-table-frame">
                    <table class="analytics-table">
                      <thead>
                      <tr>
                        <th>Metric</th>
                        <th class="text-end">Good</th>
                        <th class="text-end">Needs improvement</th>
                        <th class="text-end">Poor</th>
                      </tr>
                      </thead>
                      <tbody>
                        @for (row of summary.webVitals; track row.metric) {
                          <tr>
                            <td>{{ row.metric }}</td>
                            <td class="text-end">{{ row.good | number }}</td>
                            <td class="text-end">{{ row.needsImprovement | number }}</td>
                            <td class="text-end">{{ row.poor | number }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            </div>
          } @else if (busy) {
            <div class="d-flex align-items-center gap-2">
              <div class="spinner-border spinner-border-sm" role="status"></div>
              <span>Loading analytics&hellip;</span>
            </div>
          }
        }
      </div>
    </div>`
})
export class CloudflareWebAnalyticsDashboard {

  private cloudflareService = inject(CloudflareWebAnalyticsService);
  private dateUtils = inject(DateUtilsService);
  private logger = inject(LoggerFactory).createLogger("CloudflareWebAnalyticsDashboard", NgxLoggerLevel.ERROR);

  private siteTagInternal: string = null;

  @Input({alias: "siteTag"}) set siteTagValue(value: string) {
    const changed = value !== this.siteTagInternal;
    this.siteTagInternal = value;
    if (!value) {
      this.summary = null;
    } else if (changed) {
      this.loadAnalytics().catch(err => this.logger.info("Auto-load on siteTag change failed:", err));
    }
  }

  get siteTag(): string {
    return this.siteTagInternal;
  }

  get fromDateDisplay(): string {
    return this.formatDisplayDate(this.fromDate);
  }

  get toDateDisplay(): string {
    return this.formatDisplayDate(this.toDate);
  }

  protected summary: CloudflareWebAnalyticsSummary = null;
  protected fromDate: string;
  protected toDate: string;
  protected busy = false;
  protected errorMessage: string = null;
  protected readonly faRotate = faRotate;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly presets: PresetRange[] = [
    {label: "24h", days: 1},
    {label: "7d", days: 7},
    {label: "30d", days: 30},
    {label: "90d", days: 90}
  ];
  protected selectedPresetLabel: string = this.presets[1].label;
  protected readonly presetLabels: string[] = [...this.presets.map(preset => preset.label), CUSTOM_RANGE_LABEL];
  protected sliderMinDate: DateTime;
  protected sliderMaxDate: DateTime;
  protected sliderRange: DateRange;

  protected timeseriesChart: ChartConfiguration<"line">["data"] = {
    labels: [],
    datasets: [
      {label: "Page views", data: [], borderColor: "rgb(249,177,4)", backgroundColor: "rgba(249,177,4,0.2)", tension: 0.25, fill: true},
      {label: "Visits", data: [], borderColor: "rgb(240,128,80)", backgroundColor: "rgba(240,128,80,0.15)", tension: 0.25, fill: true}
    ]
  };

  protected timeseriesOptions: ChartConfiguration<"line">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {display: true, position: "top"}
    },
    scales: {
      y: {beginAtZero: true, ticks: {precision: 0}}
    }
  };

  constructor() {
    Chart.register(...registerables);
    this.sliderMaxDate = this.dateUtils.dateTimeNow().startOf("day");
    this.sliderMinDate = this.sliderMaxDate.minus({days: 90});
    this.applyPreset(this.presets[1]);
  }

  selectPreset(preset: PresetRange): void {
    this.selectedPresetLabel = preset.label;
    this.applyPreset(preset);
    this.loadAnalytics();
  }

  selectPresetByLabel(label: string): void {
    const preset = this.presets.find(candidate => candidate.label === label);
    if (preset) {
      this.selectPreset(preset);
    } else {
      this.selectedPresetLabel = this.presetLabelForRange(this.sliderRange);
    }
  }

  private presetLabelForRange(range: DateRange | undefined): string {
    if (!range) {
      return CUSTOM_RANGE_LABEL;
    }
    const toleranceMillis = 12 * 60 * 60 * 1000;
    const windowContains = (preset: PresetRange): boolean => {
      const presetFrom = this.sliderMaxDate.minus({days: preset.days}).toMillis();
      const presetTo = this.sliderMaxDate.toMillis();
      return range.from >= presetFrom - toleranceMillis && range.to <= presetTo + toleranceMillis;
    };
    const current = this.presets.find(preset => preset.label === this.selectedPresetLabel);
    if (current && windowContains(current)) {
      return current.label;
    }
    const containing = this.presets.find(preset => windowContains(preset));
    return containing ? containing.label : CUSTOM_RANGE_LABEL;
  }

  private applyPreset(preset: PresetRange): void {
    const to = this.sliderMaxDate;
    const from = to.minus({days: preset.days});
    this.toDate = to.toFormat(UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
    this.fromDate = from.toFormat(UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
    this.sliderRange = {from: from.toMillis(), to: to.toMillis()};
  }

  onRangeChange(range: DateRange): void {
    this.selectedPresetLabel = this.presetLabelForRange(range);
    this.fromDate = this.dateUtils.asDateTime(range.from).toFormat(UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
    this.toDate = this.dateUtils.asDateTime(range.to).toFormat(UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
    this.sliderRange = range;
    this.loadAnalytics();
  }

  async loadAnalytics(): Promise<void> {
    if (!this.siteTag) {
      return;
    }
    this.busy = true;
    this.errorMessage = null;
    try {
      const summary = await this.cloudflareService.queryAnalytics({
        siteTag: this.siteTag,
        startDate: `${this.fromDate}T00:00:00Z`,
        endDate: `${this.toDate}T23:59:59Z`,
        limit: 10
      });
      this.summary = summary;
      this.populateTimeseries(summary);
    } catch (err) {
      this.logger.error("Failed to load web analytics:", err);
      this.errorMessage = extractErrorMessage(err);
      this.summary = null;
    } finally {
      this.busy = false;
    }
  }

  private populateTimeseries(summary: CloudflareWebAnalyticsSummary): void {
    const labels = summary.timeseries.map(point => this.formatTimeseriesLabel(point.datetime));
    const pageViews = summary.timeseries.map(point => point.pageViews);
    const visits = summary.timeseries.map(point => point.visits);
    this.timeseriesChart = {
      labels,
      datasets: [
        {label: "Page views", data: pageViews, borderColor: "rgb(249,177,4)", backgroundColor: "rgba(249,177,4,0.2)", tension: 0.25, fill: true},
        {label: "Visits", data: visits, borderColor: "rgb(240,128,80)", backgroundColor: "rgba(240,128,80,0.15)", tension: 0.25, fill: true}
      ]
    };
  }

  private formatDisplayDate(value: string): string {
    return value ? this.dateUtils.asString(value, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED) : "";
  }

  private formatTimeseriesLabel(datetime: string): string {
    const format = datetime?.includes("T")
      ? UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED_TIME
      : UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED;
    return datetime ? this.dateUtils.asString(datetime, undefined, format) : "";
  }

}
