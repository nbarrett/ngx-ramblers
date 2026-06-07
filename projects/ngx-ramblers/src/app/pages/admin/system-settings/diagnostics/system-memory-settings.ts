import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faRefresh, faCamera, faSpinner, faStop, faCheck } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { HeapSnapshotResponse, HeapSnapshotStatus, MemoryUsageResponse } from "../../../../models/health.model";

@Component({
  selector: "app-system-memory-settings",
  imports: [FontAwesomeModule],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Memory Diagnostics</div>
      <div class="col-sm-12">
        <p>Live memory usage for this environment's server. Use this to see whether a site is heap-bound (objects and caches) or external-bound (buffers) when investigating per-site memory.</p>
        <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
          <button type="button" class="btn btn-primary" [disabled]="busy || snapshotRunning" (click)="refresh()">
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
        </div>
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
    </div>`
})
export class SystemMemorySettingsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("SystemMemorySettings", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  protected memory: MemoryUsageResponse | null = null;
  protected snapshot: HeapSnapshotResponse | null = null;
  protected busy = false;
  protected error: string | null = null;

  protected snapshotStatus: HeapSnapshotStatus = HeapSnapshotStatus.IDLE;
  protected snapshotError: string | null = null;
  protected snapshotElapsedSeconds = 0;
  private snapshotSub: Subscription | null = null;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly faRefresh = faRefresh;
  protected readonly faCamera = faCamera;
  protected readonly faSpinner = faSpinner;
  protected readonly faStop = faStop;
  protected readonly faCheck = faCheck;
  protected readonly HeapSnapshotStatus = HeapSnapshotStatus;

  ngOnInit() {
    this.refresh();
  }

  ngOnDestroy() {
    this.clearSnapshotTimer();
    this.snapshotSub?.unsubscribe();
  }

  get uptimeText(): string {
    const seconds = this.memory?.uptimeSeconds || 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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
}
