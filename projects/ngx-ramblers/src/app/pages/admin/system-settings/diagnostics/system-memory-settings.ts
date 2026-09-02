import { Component, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faRefresh, faCamera, faSpinner, faStop, faCheck, faPowerOff } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import {
  FlyMachineState,
  FlyRestartResponse,
  FlyRestartStatus,
  HeapSnapshotResponse,
  HeapSnapshotStatus,
  MemoryUsageResponse
} from "../../../../models/health.model";
import { ALERT_ERROR } from "../../../../models/alert-target.model";
import { FlyMachineHistoryComponent } from "./fly-machine-history";

@Component({
  selector: "app-system-memory-settings",
  imports: [FontAwesomeModule, FlyMachineHistoryComponent],
  template: `
    <app-fly-machine-history (targetQueryChange)="flyTargetQuery = $event"/>
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

  @ViewChild(FlyMachineHistoryComponent) private flyHistory: FlyMachineHistoryComponent;
  protected flyTargetQuery = "";
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
    await this.refresh();
  }

  get targetDescription(): string {
    if (this.flyTargetQuery.includes("app=jitsi")) {
      return "the video meetings Fly machine";
    } else if (this.flyTargetQuery.includes("app=worker")) {
      return "the integration worker's Fly machine";
    } else {
      return "this environment's Fly machine";
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
      await firstValueFrom(this.http.post<FlyRestartResponse>(`/api/health/memory/restart?${this.flyTargetQuery}`.replace(/[?&]$/, ""), {}));
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
        const machineState = await firstValueFrom(this.http.get<FlyMachineState>(`/api/health/memory/machine-state?${this.flyTargetQuery}`.replace(/[?&]$/, "")));
        if (generation !== this.restartPollGeneration) {
          return;
        }
        if (machineState.available && machineState.state === "started" && machineState.updatedAt > restartInitiated) {
          this.restartStatus = FlyRestartStatus.DONE;
          await this.refresh();
          await this.flyHistory?.refreshFlyStats();
          await this.flyHistory?.loadFlyHistory();
        } else {
          this.scheduleNextPollOrFail(generation, restartInitiated);
        }
      } catch (error) {
        if (generation !== this.restartPollGeneration) {
          return;
        }
        if (error?.status === 401 && !this.flyTargetQuery) {
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
