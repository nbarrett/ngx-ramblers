import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faExternalLinkAlt, faRefresh, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { isBoolean } from "es-toolkit/compat";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import {
  FlyHistoryPreset,
  FlyMachineStats,
  FlyMetricHistory,
  FlyMetricTab,
  flyTargetApp,
  FlyTargetApp
} from "../../../../models/health.model";
import { UIDateFormat } from "../../../../models/date-format.model";
import { SectionToggle } from "../../../../shared/components/section-toggle";
import { StoredValue } from "../../../../models/ui-actions";
import { flyAppMetricsUrl } from "../../../../functions/fly-app-url";

@Component({
  selector: "app-fly-machine-history",
  imports: [FontAwesomeModule, BaseChartDirective, SectionToggle],
  styles: [`
    .history-refresh
      margin-bottom: 0.75rem
  `],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Fly Machine History</div>
      <div class="col-sm-12">
        <p>{{ headingCopy }}</p>
        <div class="row mb-3">
          <div class="col-12">
            <div class="d-flex flex-wrap align-items-end gap-3 mb-3">
              @if (showTargetToggle) {
                <div class="form-group">
                  <label class="d-block">App</label>
                  <app-section-toggle [tabs]="visibleTargetLabels" [selectedTab]="selectedTargetLabel"
                                      [queryParamKey]="StoredValue.APP"
                                      (selectedTabChange)="selectTarget($event)"/>
                </div>
              }
              <div class="form-group">
                <label class="d-block">Metric</label>
                <app-section-toggle [tabs]="metricTabLabels" [selectedTab]="selectedMetricLabel"
                                    [queryParamKey]="StoredValue.METRIC"
                                    (selectedTabChange)="selectMetric($event)"/>
              </div>
              <div class="form-group">
                <label class="d-block">Range</label>
                <app-section-toggle [tabs]="historyPresetLabels" [selectedTab]="selectedHistoryPreset"
                                    [queryParamKey]="StoredValue.RANGE"
                                    (selectedTabChange)="selectHistoryPreset($event)"/>
              </div>
              <div class="form-group">
                <button type="button" class="btn btn-primary history-refresh" [disabled]="historyLoading" (click)="loadFlyHistory()">
                  <fa-icon [icon]="historyLoading ? faSpinner : faRefresh" [animation]="historyLoading ? 'spin' : null"/>
                  Refresh
                </button>
              </div>
              @if (metricsUrl) {
                <div class="form-group">
                  <a [href]="metricsUrl" target="_blank" rel="noopener" class="btn btn-quiet history-refresh">
                    <fa-icon [icon]="faExternalLinkAlt"/>
                    Fly metrics
                  </a>
                </div>
              }
            </div>
            @if (historyError) {
              <div class="small text-muted">Fly machine history unavailable: {{ historyError }}</div>
            } @else {
              <div class="chart-container" style="position: relative; height: 280px;">
                @if (historyChart.datasets.length && historyChart.datasets[0].data.length) {
                  <canvas baseChart
                          [data]="historyChart"
                          [options]="historyOptions"
                          type="line">
                  </canvas>
                } @else {
                  <div class="d-flex justify-content-center align-items-center h-100">
                    <span class="text-muted">No data in this range yet.</span>
                  </div>
                }
              </div>
            }
            @if (showLiveStats && flyStats?.available) {
              <table class="table table-sm mt-3">
                <caption>Latest host-level figures from Fly for {{ flyStats.appName }}</caption>
                <tbody>
                  <tr><th>App</th><td>{{ flyStats.appName }}</td></tr>
                  <tr><th>Machine</th><td>{{ flyStats.machineId }}</td></tr>
                  <tr><th>Memory used</th><td><strong>{{ flyStats.memoryUsedMb }} MB</strong></td></tr>
                  <tr><th>Memory total</th><td>{{ flyStats.memoryTotalMb }} MB</td></tr>
                </tbody>
              </table>
            } @else if (showLiveStats && flyStats) {
              <div class="small text-muted mt-3">Fly stats unavailable: {{ flyStats.error }}</div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class FlyMachineHistoryComponent implements OnInit, OnChanges {
  private logger: Logger = inject(LoggerFactory).createLogger("FlyMachineHistory", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private dateUtils = inject(DateUtilsService);

  @Input() environmentName: string | null = null;
  @Input() showLiveStats = true;
  @Output() targetQueryChange = new EventEmitter<string>();

  protected flyStats: FlyMachineStats | null = null;
  protected historyError: string | null = null;
  protected historyLoading = false;
  protected readonly StoredValue = StoredValue;
  protected readonly historyPresets: FlyHistoryPreset[] = [
    {label: "15m", minutes: 15},
    {label: "30m", minutes: 30},
    {label: "1h", minutes: 60},
    {label: "6h", minutes: 360},
    {label: "24h", minutes: 1440},
    {label: "3d", minutes: 4320},
    {label: "7d", minutes: 10080}
  ];
  protected readonly historyPresetLabels: string[] = this.historyPresets.map(preset => preset.label);
  protected selectedHistoryPreset = "24h";
  protected readonly targetTabs: FlyMetricTab[] = [
    {label: "Website", key: FlyTargetApp.ENVIRONMENT},
    {label: "Integration worker", key: FlyTargetApp.WORKER},
    {label: "Video meetings", key: FlyTargetApp.JITSI}
  ];
  protected selectedTargetLabel = "Website";
  protected integrationWorkerAvailable = false;
  protected jitsiAvailable = false;
  protected readonly metricTabs: FlyMetricTab[] = [
    {label: "Memory", key: "memory"},
    {label: "CPU", key: "cpu"},
    {label: "Load average", key: "loadAverage"},
    {label: "Network", key: "network"},
    {label: "HTTP responses", key: "httpResponses"}
  ];
  protected readonly metricTabLabels: string[] = this.metricTabs.map(tab => tab.label);
  protected selectedMetricLabel = "Memory";
  private readonly seriesColours = ["249,177,4", "240,128,80", "59,110,143", "118,184,42"];
  protected historyChart: ChartConfiguration<"line">["data"] = {labels: [], datasets: []};
  protected historyOptions: ChartConfiguration<"line">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {display: true, position: "top"}
    },
    scales: {
      y: {beginAtZero: true, title: {display: true, text: "MB"}}
    }
  };
  protected readonly faRefresh = faRefresh;
  protected readonly faSpinner = faSpinner;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.emitTargetQuery();
    this.refreshFlyStats();
    this.loadFlyHistory();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["environmentName"] && !changes["environmentName"].firstChange) {
      this.refreshFlyStats();
      this.loadFlyHistory();
    }
  }

  get showTargetToggle(): boolean {
    return this.integrationWorkerAvailable || this.jitsiAvailable;
  }

  get visibleTargetLabels(): string[] {
    return this.targetTabs
      .filter(tab => tab.key === FlyTargetApp.ENVIRONMENT
        || (tab.key === FlyTargetApp.WORKER && this.integrationWorkerAvailable)
        || (tab.key === FlyTargetApp.JITSI && this.jitsiAvailable))
      .map(tab => tab.label);
  }

  get headingCopy(): string {
    if (this.environmentName) {
      return `Host-level metrics from Fly for ${this.environmentName}, the integration worker, or video meetings. Pick an app, metric and time range, then refresh.`;
    } else {
      return "Host-level metrics from Fly for this environment's machines, over a selectable time range. Use this to spot memory creep, CPU saturation or traffic spikes, and to watch the effect of a restart or a big job as it happens. Pick a metric and time range, then refresh to pull the latest samples.";
    }
  }

  get metricsUrl(): string {
    return flyAppMetricsUrl(this.flyStats?.appName || "");
  }

  selectHistoryPreset(label: string): void {
    this.selectedHistoryPreset = label;
    this.loadFlyHistory();
  }

  selectMetric(label: string): void {
    this.selectedMetricLabel = label;
    this.loadFlyHistory();
  }

  selectTarget(label: string): void {
    this.selectedTargetLabel = label;
    this.emitTargetQuery();
    this.refreshFlyStats();
    this.loadFlyHistory();
  }

  targetQuery(): string {
    const target = this.selectedTarget();
    const params = new URLSearchParams();
    if (target !== FlyTargetApp.ENVIRONMENT) {
      params.set("app", target);
    }
    if (this.environmentName && target === FlyTargetApp.ENVIRONMENT) {
      params.set("environment", this.environmentName);
    }
    const encoded = params.toString();
    return encoded ? `${encoded}&` : "";
  }

  private selectedTarget(): FlyTargetApp {
    const tab = this.targetTabs.find(candidate => candidate.label === this.selectedTargetLabel) || this.targetTabs[0];
    return flyTargetApp(tab.key);
  }

  private emitTargetQuery(): void {
    this.targetQueryChange.emit(this.targetQuery());
  }

  async loadFlyHistory(): Promise<void> {
    try {
      this.historyLoading = true;
      this.historyError = null;
      const preset = this.historyPresets.find(candidate => candidate.label === this.selectedHistoryPreset)
        || this.historyPresets.find(candidate => candidate.label === "24h");
      const metric = this.metricTabs.find(candidate => candidate.label === this.selectedMetricLabel) || this.metricTabs[0];
      const history = await firstValueFrom(this.http.get<FlyMetricHistory>(
        `/api/health/memory/fly-history?${this.targetQuery()}metric=${metric.key}&minutes=${preset.minutes}`));
      if (!history.available) {
        this.historyError = history.error || "Failed to read Fly machine history";
        this.historyChart = {labels: [], datasets: []};
      } else {
        const labelFormat = preset.minutes <= 1440 ? UIDateFormat.RAMBLERS_TIME : UIDateFormat.DAY_MONTH_ABBREVIATED_TIME;
        const longestSeries = history.series.reduce(
          (longest, candidate) => candidate.samples.length > longest.samples.length ? candidate : longest,
          history.series[0]);
        const solidSeriesCount = history.series.filter(series => !series.dashed).length;
        this.historyOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {display: true, position: "top"}
          },
          scales: {
            y: {beginAtZero: true, title: {display: true, text: history.unit}}
          }
        };
        this.historyChart = {
          labels: longestSeries.samples.map(sample => this.dateUtils.asDateTime(sample.time).toFormat(labelFormat)),
          datasets: history.series.map((series, index) => {
            const colour = this.seriesColours[index % this.seriesColours.length];
            return {
              label: series.label,
              data: series.samples.map(sample => sample.value),
              borderColor: `rgb(${colour})`,
              backgroundColor: `rgba(${colour},0.2)`,
              borderDash: series.dashed ? [6, 4] : undefined,
              tension: 0.25,
              fill: !series.dashed && solidSeriesCount === 1,
              pointRadius: 0
            };
          })
        };
      }
    } catch (error) {
      this.logger.error("fly machine history failed", error);
      this.historyError = error?.error?.error || error?.error?.message || error?.message || "Failed to read Fly machine history";
      this.historyChart = {labels: [], datasets: []};
    } finally {
      this.historyLoading = false;
    }
  }

  async refreshFlyStats(): Promise<void> {
    try {
      const query = this.targetQuery().replace(/&$/, "");
      const url = query ? `/api/health/memory/fly-stats?${query}` : "/api/health/memory/fly-stats";
      this.flyStats = await firstValueFrom(this.http.get<FlyMachineStats>(url));
      if (isBoolean(this.flyStats?.integrationWorkerAvailable)) {
        this.integrationWorkerAvailable = this.flyStats.integrationWorkerAvailable;
      }
      if (isBoolean(this.flyStats?.jitsiAvailable)) {
        this.jitsiAvailable = this.flyStats.jitsiAvailable;
      }
    } catch (error) {
      this.logger.error("fly stats refresh failed", error);
      this.flyStats = {
        available: false,
        error: error?.error?.error || error?.error?.message || error?.message || "Failed to read Fly stats"
      };
    }
  }
}
