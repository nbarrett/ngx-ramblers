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
import { CloudflareWebAnalyticsService } from "../../../../services/cloudflare/cloudflare-web-analytics.service";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { extractErrorMessage } from "../../../../functions/strings";
import { SectionToggle } from "../../../../shared/components/section-toggle";
import { DateRange, DateRangeSlider } from "../../../../components/date-range-slider/date-range-slider";
import { DateTime } from "luxon";

interface PresetRange {
  label: string;
  days: number;
}

@Component({
  selector: "app-cloudflare-web-analytics-dashboard",
  imports: [CommonModule, FormsModule, FontAwesomeModule, BaseChartDirective, SectionToggle, DateRangeSlider],
  styles: [`
    :host ::ng-deep .section-toggle
      margin-bottom: 0
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
                [selectedTab]="selectedPreset.label"
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
                    <div class="h3 mb-0">{{ summary.totals.pageviews | number }}</div>
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
                    <div class="mb-0">{{ fromDate }} &mdash; {{ toDate }}</div>
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
                <ng-container *ngTemplateOutlet="breakdownTable; context: {rows: summary.topPaths, label: 'Path'}"/>
              </div>
              <div class="col-md-6">
                <h5>Top countries</h5>
                <ng-container *ngTemplateOutlet="breakdownTable; context: {rows: summary.topCountries, label: 'Country'}"/>
              </div>
              <div class="col-md-6">
                <h5>Top referrers</h5>
                <ng-container *ngTemplateOutlet="breakdownTable; context: {rows: summary.topReferrers, label: 'Referrer'}"/>
              </div>
              <div class="col-md-6">
                <h5>Device types</h5>
                <ng-container *ngTemplateOutlet="breakdownTable; context: {rows: summary.deviceTypes, label: 'Device'}"/>
              </div>
              <div class="col-md-6">
                <h5>Browsers</h5>
                <ng-container *ngTemplateOutlet="breakdownTable; context: {rows: summary.browsers, label: 'Browser'}"/>
              </div>
              <div class="col-md-6">
                <h5>Core Web Vitals</h5>
                @if (summary.webVitals.length === 0) {
                  <div class="text-muted small">No web vitals reported in this range.</div>
                } @else {
                  <table class="table table-sm table-striped">
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
    </div>

    <ng-template #breakdownTable let-rows="rows" let-label="label">
      @if (!rows || rows.length === 0) {
        <div class="text-muted small">No data.</div>
      } @else {
        <table class="table table-sm table-striped">
          <thead>
          <tr>
            <th>{{ label }}</th>
            <th class="text-end">Page views</th>
            <th class="text-end">Visits</th>
          </tr>
          </thead>
          <tbody>
            @for (row of rows; track row.key) {
              <tr>
                <td class="text-break">{{ row.key }}</td>
                <td class="text-end">{{ row.pageviews | number }}</td>
                <td class="text-end">{{ row.visits | number }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </ng-template>`
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
  protected selectedPreset: PresetRange = this.presets[1];
  protected readonly presetLabels: string[] = this.presets.map(preset => preset.label);
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
    this.applyPreset(this.selectedPreset);
  }

  selectPreset(preset: PresetRange): void {
    this.selectedPreset = preset;
    this.applyPreset(preset);
    this.loadAnalytics();
  }

  selectPresetByLabel(label: string): void {
    const preset = this.presets.find(candidate => candidate.label === label);
    if (preset) {
      this.selectPreset(preset);
    }
  }

  private applyPreset(preset: PresetRange): void {
    const to = this.sliderMaxDate;
    const from = to.minus({days: preset.days});
    this.toDate = to.toFormat("yyyy-LL-dd");
    this.fromDate = from.toFormat("yyyy-LL-dd");
    this.sliderRange = {from: from.toMillis(), to: to.toMillis()};
  }

  onRangeChange(range: DateRange): void {
    this.fromDate = DateTime.fromMillis(range.from).toFormat("yyyy-LL-dd");
    this.toDate = DateTime.fromMillis(range.to).toFormat("yyyy-LL-dd");
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
    const labels = summary.timeseries.map(point => point.datetime);
    const pageviews = summary.timeseries.map(point => point.pageviews);
    const visits = summary.timeseries.map(point => point.visits);
    this.timeseriesChart = {
      labels,
      datasets: [
        {label: "Page views", data: pageviews, borderColor: "rgb(249,177,4)", backgroundColor: "rgba(249,177,4,0.2)", tension: 0.25, fill: true},
        {label: "Visits", data: visits, borderColor: "rgb(240,128,80)", backgroundColor: "rgba(240,128,80,0.15)", tension: 0.25, fill: true}
      ]
    };
  }

}
