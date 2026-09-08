import { Component, EventEmitter, inject, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheck, faPowerOff, faRefresh, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { isBoolean } from "es-toolkit/compat";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import {
  FlyHistoryPreset,
  FlyMachineState,
  FlyMachineStats,
  FlyMetricHistory,
  FlyMetricTab,
  FlyRestartResponse,
  FlyRestartStatus,
  flyTargetApp,
  FlyTargetApp
} from "../../../../models/health.model";
import { UIDateFormat } from "../../../../models/date-format.model";
import { ALERT_ERROR } from "../../../../models/alert-target.model";
import { SectionToggle } from "../../../../shared/components/section-toggle";
import { StoredValue } from "../../../../models/ui-actions";

@Component({
  selector: "app-fly-machine-history",
  imports: [FontAwesomeModule, BaseChartDirective, SectionToggle],
  styles: [`
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
                <button type="button" class="btn btn-primary" [disabled]="historyLoading" (click)="loadFlyHistory()">
                  <fa-icon [icon]="historyLoading ? faSpinner : faRefresh" [animation]="historyLoading ? 'spin' : null"/>
                  Refresh
                </button>
              </div>
              @if (!restartConfirmPending && restartStatus !== FlyRestartStatus.RESTARTING) {
                <div class="form-group">
                  <button type="button" class="btn btn-outline-secondary" (click)="requestRestart()">
                    <fa-icon [icon]="faPowerOff"/>
                    Restart machine
                  </button>
                </div>
              }
            </div>
            @if (restartConfirmPending) {
              <div class="alert alert-warning">
                <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                <strong class="ms-2">Restart {{ targetDescription }}?</strong>
                <div class="mt-2">
                  This immediately restarts the running server. Anyone using the site will see a brief outage while it comes back up. Only do this if the site is genuinely slow or stuck.
                </div>
                <div class="mt-2 d-flex gap-2">
                  <button type="button" class="btn btn-sm btn-danger" (click)="confirmRestart()">
                    <fa-icon [icon]="faPowerOff"/>
                    Confirm restart
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-secondary" (click)="cancelRestart()">Cancel</button>
                </div>
              </div>
            }
            @if (restartStatus === FlyRestartStatus.RESTARTING) {
              <div class="alert alert-warning d-flex align-items-start">
                <fa-icon [icon]="faSpinner" animation="spin" class="me-2 mt-1"/>
                <div>
                  <strong>Restarting {{ targetDescription }}…</strong>
                  <div class="small">The server will be briefly unreachable. The figures below refresh automatically once it's back.</div>
                </div>
              </div>
            }
            @if (restartStatus === FlyRestartStatus.DONE) {
              <div class="alert alert-success">
                <fa-icon [icon]="faCheck" class="me-2"/>
                <strong>Machine restarted</strong> and is back up. Figures below are up to date.
              </div>
            }
            @if (restartStatus === FlyRestartStatus.SESSION_EXPIRED) {
              <div class="alert alert-success">
                <fa-icon [icon]="faCheck" class="me-2"/>
                <strong>Machine restarted</strong> — but your login session did not survive it, so the figures below can't refresh. Log in again to see up-to-date figures.
              </div>
            }
            @if (restartStatus === FlyRestartStatus.FAILED) {
              <div class="alert alert-warning">
                <fa-icon [icon]="ALERT_ERROR.icon" class="me-2"></fa-icon>
                <strong>Restart failed</strong> {{ restartError }}
              </div>
            }
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
export class FlyMachineHistoryComponent implements OnInit, OnChanges, OnDestroy {
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
    {label: "7d", minutes: 10080},
    {label: "14d", minutes: 20160},
    {label: "30d", minutes: 43200}
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
  protected readonly faPowerOff = faPowerOff;
  protected readonly faCheck = faCheck;
  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly FlyRestartStatus = FlyRestartStatus;
  protected restartStatus: FlyRestartStatus = FlyRestartStatus.IDLE;
  protected restartConfirmPending = false;
  protected restartError: string | null = null;
  private restartPollTimer: ReturnType<typeof setTimeout> | null = null;
  private restartPollAttempts = 0;
  private restartPollGeneration = 0;
  private static readonly MAX_RESTART_REQUEST_ATTEMPTS = 20;
  private static readonly RESTART_REQUEST_RETRY_MS = 3000;
  private static readonly RESTART_POLL_INTERVAL_MS = 4000;
  private static readonly MAX_RESTART_POLL_ATTEMPTS = 45;

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    if (this.environmentName) {
      this.selectedTargetLabel = "Website";
    }
    this.emitTargetQuery();
    this.refreshFlyStats();
    this.loadFlyHistory();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["environmentName"] && !changes["environmentName"].firstChange) {
      if (this.environmentName) {
        this.selectedTargetLabel = "Website";
      }
      this.cancelRestart();
      this.restartStatus = FlyRestartStatus.IDLE;
      this.clearRestartPollTimer();
      this.emitTargetQuery();
      this.refreshFlyStats();
      this.loadFlyHistory();
    }
  }

  ngOnDestroy(): void {
    this.clearRestartPollTimer();
  }

  get targetDescription(): string {
    if (this.selectedTarget() === FlyTargetApp.WORKER) {
      return "the integration worker";
    } else if (this.selectedTarget() === FlyTargetApp.JITSI) {
      return "the video meetings server";
    } else if (this.environmentName) {
      return `the ${this.environmentName} machine`;
    } else {
      return "this environment's Fly machine";
    }
  }

  requestRestart(): void {
    this.restartConfirmPending = true;
  }

  cancelRestart(): void {
    this.restartConfirmPending = false;
  }

  async confirmRestart(): Promise<void> {
    this.restartConfirmPending = false;
    this.restartError = null;
    this.restartStatus = FlyRestartStatus.RESTARTING;
    this.restartPollGeneration += 1;
    await this.requestRestartWithRetries(1);
  }

  private restartQuery(): string {
    return this.targetQuery().replace(/[?&]$/, "");
  }

  private async requestRestartWithRetries(attempt: number): Promise<void> {
    try {
      await firstValueFrom(this.http.post<FlyRestartResponse>(`/api/health/memory/restart?${this.restartQuery()}`.replace(/[?&]$/, ""), {}));
      this.pollUntilBackUp();
    } catch (error) {
      this.logger.error("restart attempt", attempt, "failed", error);
      if (error?.status === 503 && attempt < FlyMachineHistoryComponent.MAX_RESTART_REQUEST_ATTEMPTS) {
        setTimeout(() => this.requestRestartWithRetries(attempt + 1), FlyMachineHistoryComponent.RESTART_REQUEST_RETRY_MS);
      } else if ([401, 403, 503].includes(error?.status)) {
        this.restartError = error?.error?.error || `the server was too unresponsive to accept the restart request after ${attempt} attempts — restart the machine from the Fly dashboard instead`;
        this.restartStatus = FlyRestartStatus.FAILED;
      } else {
        this.pollUntilBackUp();
      }
    }
  }

  private pollUntilBackUp(): void {
    this.clearRestartPollTimer();
    this.restartPollAttempts = 0;
    this.scheduleRestartPoll(this.restartPollGeneration, this.dateUtils.nowAsValue());
  }

  private scheduleRestartPoll(generation: number, restartInitiated: number): void {
    this.restartPollTimer = setTimeout(() => this.runRestartPoll(generation, restartInitiated), FlyMachineHistoryComponent.RESTART_POLL_INTERVAL_MS);
  }

  private async runRestartPoll(generation: number, restartInitiated: number): Promise<void> {
    if (generation === this.restartPollGeneration) {
      this.restartPollAttempts += 1;
      try {
        const machineState = await firstValueFrom(this.http.get<FlyMachineState>(`/api/health/memory/machine-state?${this.restartQuery()}`.replace(/[?&]$/, "")));
        if (generation === this.restartPollGeneration) {
          if (machineState.available && machineState.state === "started" && machineState.updatedAt > restartInitiated) {
            this.restartStatus = FlyRestartStatus.DONE;
            await this.refreshFlyStats();
            await this.loadFlyHistory();
          } else {
            this.scheduleNextPollOrFail(generation, restartInitiated);
          }
        }
      } catch (error) {
        if (generation === this.restartPollGeneration) {
          if (error?.status === 401 && !this.environmentName) {
            this.clearRestartPollTimer();
            this.restartStatus = FlyRestartStatus.SESSION_EXPIRED;
          } else {
            this.scheduleNextPollOrFail(generation, restartInitiated);
          }
        }
      }
    }
  }

  private scheduleNextPollOrFail(generation: number, restartInitiated: number): void {
    if (this.restartPollAttempts >= FlyMachineHistoryComponent.MAX_RESTART_POLL_ATTEMPTS) {
      this.restartStatus = FlyRestartStatus.FAILED;
      this.restartError = "Machine did not come back within the expected time - check the Fly dashboard";
    } else {
      this.scheduleRestartPoll(generation, restartInitiated);
    }
  }

  private clearRestartPollTimer(): void {
    if (this.restartPollTimer) {
      clearTimeout(this.restartPollTimer);
      this.restartPollTimer = null;
    }
  }

  get showTargetToggle(): boolean {
    return !this.environmentName && (this.integrationWorkerAvailable || this.jitsiAvailable);
  }

  get visibleTargetLabels(): string[] {
    return this.targetTabs
      .filter(tab => tab.key === FlyTargetApp.ENVIRONMENT
        || (!this.environmentName && tab.key === FlyTargetApp.WORKER && this.integrationWorkerAvailable)
        || (!this.environmentName && tab.key === FlyTargetApp.JITSI && this.jitsiAvailable))
      .map(tab => tab.label);
  }

  get headingCopy(): string {
    if (this.environmentName) {
      return `Host-level metrics from Fly for ${this.environmentName}. Pick a metric and time range, then refresh, or restart the machine.`;
    } else {
      return "Host-level metrics from Fly for this environment's machines, over a selectable time range. Use this to spot memory creep, CPU saturation or traffic spikes, and to watch the effect of a restart or a big job as it happens. Pick a metric and time range, then refresh to pull the latest samples.";
    }
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
    this.cancelRestart();
    this.restartStatus = FlyRestartStatus.IDLE;
    this.clearRestartPollTimer();
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
