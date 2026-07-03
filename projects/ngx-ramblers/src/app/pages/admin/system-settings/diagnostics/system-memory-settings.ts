import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faRefresh, faCamera, faSpinner, faStop, faCheck, faPowerOff } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import {
  FlyHistoryPreset,
  FlyMachineStats,
  FlyMetricHistory,
  FlyMetricTab,
  FlyMachineState,
  FlyTargetApp,
  FlyRestartResponse,
  FlyRestartStatus,
  HeapSnapshotResponse,
  HeapSnapshotStatus,
  MemoryUsageResponse
} from "../../../../models/health.model";
import { ALERT_ERROR } from "../../../../models/alert-target.model";
import { UIDateFormat } from "../../../../models/date-format.model";
import { SectionToggle } from "../../../../shared/components/section-toggle";

@Component({
  selector: "app-system-memory-settings",
  imports: [FontAwesomeModule, BaseChartDirective, SectionToggle],
  styles: [`
    .history-refresh
      margin-bottom: 0.75rem
  `],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Fly Machine History</div>
      <div class="col-sm-12">
        <p>Host-level metrics from Fly for this environment's machines, over a selectable time range. Use this to spot memory creep, CPU saturation or traffic spikes — and to watch the effect of a restart or a big job as it happens. Choose the website or the integration worker, pick a metric, and refresh to pull the latest samples.</p>
        <div class="row mb-3">
          <div class="col-12">
            <div class="d-flex flex-wrap align-items-end gap-3 mb-3">
              <div class="form-group">
                <label class="d-block">App</label>
                <app-section-toggle [tabs]="targetTabLabels" [selectedTab]="selectedTargetLabel"
                                    [queryParamKey]="'app'"
                                    (selectedTabChange)="selectTarget($event)"/>
              </div>
              <div class="form-group">
                <label class="d-block">Metric</label>
                <app-section-toggle [tabs]="metricTabLabels" [selectedTab]="selectedMetricLabel"
                                    [queryParamKey]="'metric'"
                                    (selectedTabChange)="selectMetric($event)"/>
              </div>
              <div class="form-group">
                <label class="d-block">Range</label>
                <app-section-toggle [tabs]="historyPresetLabels" [selectedTab]="selectedHistoryPreset"
                                    [queryParamKey]="'range'"
                                    (selectedTabChange)="selectHistoryPreset($event)"/>
              </div>
              <div class="form-group">
                <button type="button" class="btn btn-primary history-refresh" [disabled]="historyLoading" (click)="loadFlyHistory()">
                  <fa-icon [icon]="historyLoading ? faSpinner : faRefresh" [animation]="historyLoading ? 'spin' : null"/>
                  Refresh
                </button>
              </div>
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
          </div>
        </div>
      </div>
    </div>
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Memory Diagnostics</div>
      <div class="col-sm-12">
        <p>Live memory usage for this environment's server. Use this to see whether a site is heap-bound (objects and caches) or external-bound (buffers) when investigating per-site memory.</p>
        <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
          <button type="button" class="btn btn-primary" [disabled]="busy || snapshotRunning || restarting" (click)="refreshAll()">
            <fa-icon [icon]="busy ? faSpinner : faRefresh" [animation]="busy ? 'spin' : null"/>
            Refresh
          </button>
          @if (!snapshotRunning) {
            <button type="button" class="btn btn-sunset" [disabled]="busy" (click)="captureSnapshot()">
              <fa-icon [icon]="faCamera"/>
              Capture heap snapshot
            </button>
          } @else {
            <button type="button" class="btn btn-sunset" disabled>
              <fa-icon [icon]="faSpinner" animation="spin"/>
              Capturing… {{ snapshotElapsedText }}
            </button>
            <button type="button" class="btn btn-danger" (click)="stopSnapshot()">
              <fa-icon [icon]="faStop"/>
              Stop
            </button>
          }
          @if (!restartConfirmPending && restartStatus !== FlyRestartStatus.RESTARTING) {
            <button type="button" class="btn btn-outline-secondary" [disabled]="busy" (click)="requestRestart()">
              <fa-icon [icon]="faPowerOff"/>
              Restart machine
            </button>
          }
        </div>
        @if (restartConfirmPending) {
          <div class="alert alert-warning">
            <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
            <strong class="ms-2">Restart {{ targetDescription }}?</strong>
            <div class="mt-2">
              This immediately restarts the running server. Anyone using the site will see a brief outage while it comes back up. Only do this if the site is genuinely slow or stuck.
            </div>
            <div class="d-flex gap-2 mt-2">
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
              <strong>Restarting machine…</strong>
              <div class="small">The server will be briefly unreachable. This page will refresh automatically once it's back.</div>
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
        @if (error) {
          <div class="alert alert-danger">{{ error }}</div>
        }
        @if (snapshotStatus === HeapSnapshotStatus.RUNNING) {
          <div class="alert alert-success d-flex align-items-start">
            <fa-icon [icon]="faSpinner" animation="spin" class="me-2 mt-1"/>
            <div>
              <strong>Capturing heap snapshot… ({{ snapshotElapsedText }} elapsed)</strong>
              <div class="small">It writes a full V8 snapshot of the server heap and streams it to S3, which can take several minutes for a large heap (and briefly freezes the server while the snapshot is taken). Press <strong>Stop</strong> to stop waiting.</div>
            </div>
          </div>
        }
        @if (snapshotStatus === HeapSnapshotStatus.DONE && snapshot) {
          <div class="alert alert-success">
            <fa-icon [icon]="faCheck" class="me-2"/>
            <strong>Heap snapshot captured</strong> in {{ snapshotElapsedText }}. Written to <code>s3://{{ snapshot.bucket }}/{{ snapshot.key }}</code> (RSS at capture: {{ snapshot.capturedRssMb }} MB). {{ snapshot.message }}
          </div>
        }
        @if (snapshotStatus === HeapSnapshotStatus.STOPPED) {
          <div class="alert alert-warning">
            <fa-icon [icon]="faStop" class="me-2"/>
            Stopped waiting after {{ snapshotElapsedText }}. The browser stopped tracking it; the server may still finish writing the snapshot to S3 in the background.
          </div>
        }
        @if (snapshotStatus === HeapSnapshotStatus.FAILED) {
          <div class="alert alert-danger">Heap snapshot failed: {{ snapshotError }}</div>
        }
        @if (memory) {
          <div class="row mb-3">
            <div class="col-md-8">
              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <strong>Heap usage</strong>
                <span class="fw-bold"
                      [class.text-success]="heapPercent < 70"
                      [class.text-warning]="heapPercent >= 70 && heapPercent < 85"
                      [class.text-danger]="heapPercent >= 85">
                  {{ heapPercent }}% of {{ memory.v8HeapMb.heapSizeLimit }} MB heap limit
                </span>
              </div>
              <div class="progress" role="progressbar" [attr.aria-valuenow]="heapPercent" aria-valuemin="0" aria-valuemax="100" style="height: 28px;">
                <div class="progress-bar fw-bold"
                     [class.bg-success]="heapPercent < 70"
                     [class.bg-warning]="heapPercent >= 70 && heapPercent < 85"
                     [class.bg-danger]="heapPercent >= 85"
                     [style.width.%]="heapPercent">
                  {{ memory.processMemoryMb.heapUsed }} MB ({{ heapPercent }}%)
                </div>
              </div>
              <div class="small text-muted mt-1">{{ heapStatusText }}</div>
            </div>
          </div>
          <div class="row">
            <div class="col-md-6">
              <table class="table table-sm">
                <tbody>
                  <tr><th>Environment</th><td>{{ memory.environment }}</td></tr>
                  <tr><th>Uptime</th><td>{{ uptimeText }}</td></tr>
                  <tr><th>Node</th><td>{{ memory.nodeVersion }}</td></tr>
                  <tr><th>RSS (total process)</th><td><strong>{{ memory.processMemoryMb.rss }} MB</strong></td></tr>
                  <tr><th>Heap used</th><td>{{ memory.processMemoryMb.heapUsed }} MB</td></tr>
                  <tr><th>Heap total</th><td>{{ memory.processMemoryMb.heapTotal }} MB</td></tr>
                  <tr><th>Heap size limit</th><td>{{ memory.v8HeapMb.heapSizeLimit }} MB</td></tr>
                  <tr><th>External (buffers)</th><td>{{ memory.processMemoryMb.external }} MB</td></tr>
                  <tr><th>ArrayBuffers</th><td>{{ memory.processMemoryMb.arrayBuffers }} MB</td></tr>
                  <tr><th>Native contexts</th><td>{{ memory.nativeContexts }}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="col-md-6">
              @if (flyStats?.available) {
                <table class="table table-sm">
                  <caption>Fly machine (host-level, from Fly's own metrics - not the Node heap above)</caption>
                  <tbody>
                    <tr><th>App</th><td>{{ flyStats.appName }}</td></tr>
                    <tr><th>Machine</th><td>{{ flyStats.machineId }}</td></tr>
                    <tr><th>Memory used</th><td><strong>{{ flyStats.memoryUsedMb }} MB</strong></td></tr>
                    <tr><th>Memory total</th><td>{{ flyStats.memoryTotalMb }} MB</td></tr>
                  </tbody>
                </table>
              } @else if (flyStats) {
                <div class="small text-muted">Fly stats unavailable: {{ flyStats.error }}</div>
              }
            </div>
          </div>
        }
      </div>
    </div>
`
})
export class SystemMemorySettingsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("SystemMemorySettings", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private dateUtils = inject(DateUtilsService);
  protected memory: MemoryUsageResponse | null = null;
  protected snapshot: HeapSnapshotResponse | null = null;
  protected busy = false;
  protected error: string | null = null;

  protected snapshotStatus: HeapSnapshotStatus = HeapSnapshotStatus.IDLE;
  protected snapshotError: string | null = null;
  protected snapshotElapsedSeconds = 0;
  private snapshotSub: Subscription | null = null;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;

  protected flyStats: FlyMachineStats | null = null;
  protected historyError: string | null = null;
  protected historyLoading = false;
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
    {label: "Integration worker", key: FlyTargetApp.WORKER}
  ];
  protected readonly targetTabLabels: string[] = this.targetTabs.map(tab => tab.label);
  protected selectedTargetLabel = "Website";
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
  protected restartStatus: FlyRestartStatus = FlyRestartStatus.IDLE;
  protected restartConfirmPending = false;
  protected restartError: string | null = null;
  private restartPollTimer: ReturnType<typeof setTimeout> | null = null;
  private restartPollAttempts = 0;
  private restartPollGeneration = 0;
  private static readonly MAX_RESTART_POLL_ATTEMPTS = 40;
  private static readonly RESTART_POLL_INTERVAL_MS = 3000;
  private static readonly MAX_RESTART_REQUEST_ATTEMPTS = 5;
  private static readonly RESTART_REQUEST_RETRY_MS = 5000;

  protected readonly faRefresh = faRefresh;
  protected readonly faCamera = faCamera;
  protected readonly faSpinner = faSpinner;
  protected readonly faStop = faStop;
  protected readonly faCheck = faCheck;
  protected readonly faPowerOff = faPowerOff;
  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly HeapSnapshotStatus = HeapSnapshotStatus;
  protected readonly FlyRestartStatus = FlyRestartStatus;

  constructor() {
    Chart.register(...registerables);
  }

  ngOnInit() {
    this.refreshAll();
  }

  ngOnDestroy() {
    this.clearSnapshotTimer();
    this.clearRestartPollTimer();
    this.snapshotSub?.unsubscribe();
  }

  get uptimeText(): string {
    const seconds = this.memory?.uptimeSeconds || 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  get heapPercent(): number {
    const limit = this.memory?.v8HeapMb?.heapSizeLimit || 0;
    return limit > 0 ? Math.round((this.memory.processMemoryMb.heapUsed / limit) * 100) : 0;
  }

  get heapStatusText(): string {
    const percent = this.heapPercent;
    if (percent >= 85) {
      return "Critical — heap is near its V8 limit. The server will slow down under heavy garbage collection and may restart. Investigate or restart now.";
    } else if (percent >= 70) {
      return "Elevated — heap is climbing toward its limit. Worth watching.";
    } else {
      return "Healthy — heap is comfortably within its limit.";
    }
  }

  get snapshotElapsedText(): string {
    const minutes = Math.floor(this.snapshotElapsedSeconds / 60);
    const seconds = this.snapshotElapsedSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  get snapshotRunning(): boolean {
    return this.snapshotStatus === HeapSnapshotStatus.RUNNING;
  }

  async refresh(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      this.memory = await firstValueFrom(this.http.get<MemoryUsageResponse>("/api/health/memory"));
    } catch (error) {
      this.logger.error("memory refresh failed", error);
      this.error = error?.error?.message || error?.message || "Failed to read memory usage";
    } finally {
      this.busy = false;
    }
  }

  captureSnapshot(): void {
    this.snapshot = null;
    this.snapshotError = null;
    this.snapshotElapsedSeconds = 0;
    this.snapshotStatus = HeapSnapshotStatus.RUNNING;
    this.snapshotTimer = setInterval(() => this.snapshotElapsedSeconds += 1, 1000);
    this.snapshotSub = this.http.get<HeapSnapshotResponse>("/api/health/memory/heap-snapshot").subscribe({
      next: (response) => {
        this.snapshot = response;
        this.snapshotStatus = HeapSnapshotStatus.DONE;
        this.clearSnapshotTimer();
        this.snapshotSub = null;
        this.refresh();
      },
      error: (error) => {
        if (this.snapshotStatus === HeapSnapshotStatus.RUNNING) {
          this.logger.error("heap snapshot failed", error);
          this.snapshotError = error?.error?.message || error?.message || "Failed to capture heap snapshot";
          this.snapshotStatus = HeapSnapshotStatus.FAILED;
        }
        this.clearSnapshotTimer();
        this.snapshotSub = null;
      }
    });
  }

  stopSnapshot(): void {
    this.snapshotStatus = HeapSnapshotStatus.STOPPED;
    this.clearSnapshotTimer();
    this.snapshotSub?.unsubscribe();
    this.snapshotSub = null;
  }

  private clearSnapshotTimer(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  async refreshAll(): Promise<void> {
    await Promise.all([this.refresh(), this.refreshFlyStats(), this.loadFlyHistory()]);
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
    this.refreshFlyStats();
    this.loadFlyHistory();
  }

  private targetQuery(): string {
    const target = this.targetTabs.find(candidate => candidate.label === this.selectedTargetLabel) || this.targetTabs[0];
    return target.key === FlyTargetApp.WORKER ? `app=${FlyTargetApp.WORKER}&` : "";
  }

  get targetDescription(): string {
    return this.selectedTargetLabel === "Website" ? "this environment's Fly machine" : "the integration worker's Fly machine";
  }

  async loadFlyHistory(): Promise<void> {
    try {
      this.historyLoading = true;
      this.historyError = null;
      const preset = this.historyPresets.find(candidate => candidate.label === this.selectedHistoryPreset) || this.historyPresets.find(candidate => candidate.label === "24h");
      const metric = this.metricTabs.find(candidate => candidate.label === this.selectedMetricLabel) || this.metricTabs[0];
      const history = await firstValueFrom(this.http.get<FlyMetricHistory>(`/api/health/memory/fly-history?${this.targetQuery()}metric=${metric.key}&minutes=${preset.minutes}`));
      if (!history.available) {
        this.historyError = history.error || "Failed to read Fly machine history";
        this.historyChart = {labels: [], datasets: []};
        return;
      }
      const labelFormat = preset.minutes <= 1440 ? UIDateFormat.RAMBLERS_TIME : UIDateFormat.DAY_MONTH_ABBREVIATED_TIME;
      const longestSeries = history.series.reduce((longest, candidate) => candidate.samples.length > longest.samples.length ? candidate : longest, history.series[0]);
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
      this.flyStats = await firstValueFrom(this.http.get<FlyMachineStats>(`/api/health/memory/fly-stats?${this.targetQuery()}`.replace(/[?&]$/, "")));
    } catch (error) {
      this.logger.error("fly stats refresh failed", error);
      this.flyStats = { available: false, error: error?.error?.error || error?.error?.message || error?.message || "Failed to read Fly stats" };
    }
  }

  get restarting(): boolean {
    return this.restartStatus === FlyRestartStatus.RESTARTING;
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
    await this.requestRestartWithRetries(1);
  }

  private async requestRestartWithRetries(attempt: number): Promise<void> {
    try {
      await firstValueFrom(this.http.post<FlyRestartResponse>(`/api/health/memory/restart?${this.targetQuery()}`.replace(/[?&]$/, ""), {}));
      this.pollUntilBackUp();
    } catch (error) {
      this.logger.error("restart attempt", attempt, "failed", error);
      if (error?.status === 503 && attempt < SystemMemorySettingsComponent.MAX_RESTART_REQUEST_ATTEMPTS) {
        setTimeout(() => this.requestRestartWithRetries(attempt + 1), SystemMemorySettingsComponent.RESTART_REQUEST_RETRY_MS);
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
    this.restartPollTimer = setTimeout(async () => {
      if (generation !== this.restartPollGeneration) {
        return;
      }
      this.restartPollAttempts += 1;
      try {
        const machineState = await firstValueFrom(this.http.get<FlyMachineState>(`/api/health/memory/machine-state?${this.targetQuery()}`.replace(/[?&]$/, "")));
        if (generation !== this.restartPollGeneration) {
          return;
        }
        if (machineState.available && machineState.state === "started" && machineState.updatedAt > restartInitiated) {
          this.restartStatus = FlyRestartStatus.DONE;
          await Promise.all([this.refresh(), this.refreshFlyStats(), this.loadFlyHistory()]);
        } else {
          this.scheduleNextPollOrFail(generation, restartInitiated);
        }
      } catch (error) {
        if (generation !== this.restartPollGeneration) {
          return;
        }
        if (error?.status === 401 && !this.targetQuery()) {
          this.clearRestartPollTimer();
          this.restartStatus = FlyRestartStatus.SESSION_EXPIRED;
        } else {
          this.scheduleNextPollOrFail(generation, restartInitiated);
        }
      }
    }, SystemMemorySettingsComponent.RESTART_POLL_INTERVAL_MS);
  }

  private scheduleNextPollOrFail(generation: number, restartInitiated: number): void {
    if (this.restartPollAttempts >= SystemMemorySettingsComponent.MAX_RESTART_POLL_ATTEMPTS) {
      this.restartStatus = FlyRestartStatus.FAILED;
      this.restartError = "Machine did not come back within the expected time - check the Fly dashboard";
    } else {
      this.scheduleRestartPoll(generation, restartInitiated);
    }
  }

  private clearRestartPollTimer(): void {
    this.restartPollGeneration += 1;
    if (this.restartPollTimer) {
      clearTimeout(this.restartPollTimer);
      this.restartPollTimer = null;
    }
  }
}
