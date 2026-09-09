import { Component, inject, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faBan, faCircleExclamation, faPowerOff, faRefresh, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import {
  IntegrationWorkerQueueCancelResult,
  IntegrationWorkerQueueClearResult,
  IntegrationWorkerQueueStatus
} from "../../../../models/integration-worker.model";

@Component({
  selector: "app-integration-worker-queue",
  imports: [FontAwesomeModule],
  template: `
    <div class="thumbnail-heading-frame mt-3">
      <div class="thumbnail-heading">Integration worker queue</div>
      <p>The integration worker runs one job at a time (OS Maps conversions and Ramblers uploads), with anything else waiting
        in a queue behind it. Use this to stop a job that will not finish and to clear anything waiting, so someone else can
        have a go without restarting the worker machine.</p>
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <button type="button" class="btn btn-primary" (click)="refresh()" [disabled]="busy">
          <fa-icon [icon]="loading ? faSpinner : faRefresh" class="me-2"/>
          {{ loading ? "Loading…" : "Refresh" }}
        </button>
        @if (status?.activeJob) {
          <button type="button" class="btn btn-quiet btn-icon" (click)="confirmStop = true" [disabled]="busy">
            <fa-icon [icon]="stopping ? faSpinner : faPowerOff" class="me-2"/>Stop active job
          </button>
        }
        @if (status && status.queuedJobs.length > 0) {
          <button type="button" class="btn btn-quiet btn-icon" (click)="confirmClear = true" [disabled]="busy">
            <fa-icon [icon]="clearing ? faSpinner : faBan" class="me-2"/>Clear queue ({{ status.queuedJobs.length }})
          </button>
        }
      </div>

      @if (status && status.workerConfigured === false) {
        <div class="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div><strong>No integration worker configured</strong>
            <div>This environment has no integration worker, so there is nothing to control here.</div>
          </div>
        </div>
      }

      @if (confirmStop) {
        <div class="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div class="flex-grow-1">
            <strong>Stop the active job?</strong>
            <div>{{ status?.activeJob?.label }} will be stopped and reported as failed, and the next queued job will start.</div>
            <div class="mt-2 d-flex gap-2">
              <button type="button" class="btn btn-primary btn-sm" (click)="stopActive()">Stop job</button>
              <button type="button" class="btn btn-quiet btn-sm" (click)="confirmStop = false">Cancel</button>
            </div>
          </div>
        </div>
      }

      @if (confirmClear) {
        <div class="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div class="flex-grow-1">
            <strong>Clear the queue?</strong>
            <div>{{ queuedCountLabel() }} will be removed. The active job keeps running.</div>
            <div class="mt-2 d-flex gap-2">
              <button type="button" class="btn btn-primary btn-sm" (click)="clearQueue()">Clear queue</button>
              <button type="button" class="btn btn-quiet btn-sm" (click)="confirmClear = false">Cancel</button>
            </div>
          </div>
        </div>
      }

      @if (errorMessage) {
        <div class="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div><strong>Worker queue control failed</strong>
            <div>{{ errorMessage }}</div>
          </div>
        </div>
      }

      @if (actionMessage) {
        <div class="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div><strong>Done</strong>
            <div>{{ actionMessage }}</div>
          </div>
        </div>
      }

      @if (status && status.workerConfigured !== false) {
        <table class="table table-sm">
          <thead>
          <tr>
            <th>State</th>
            <th>Type</th>
            <th>Label</th>
          </tr>
          </thead>
          <tbody>
            @if (status.activeJob) {
              <tr>
                <td><strong>Running</strong></td>
                <td>{{ status.activeJob.type }}</td>
                <td>{{ status.activeJob.label }}</td>
              </tr>
            } @else {
              <tr>
                <td colspan="3">No active job.</td>
              </tr>
            }
            @for (job of status.queuedJobs; track job.jobId; let i = $index) {
              <tr>
                <td>Queued {{ i + 1 }}</td>
                <td>{{ job.type }}</td>
                <td>{{ job.label }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `
})
export class IntegrationWorkerQueueComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("IntegrationWorkerQueueComponent", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private stringUtils = inject(StringUtilsService);
  faRefresh = faRefresh;
  faSpinner = faSpinner;
  faPowerOff = faPowerOff;
  faBan = faBan;
  faCircleExclamation = faCircleExclamation;
  status: IntegrationWorkerQueueStatus | null = null;
  loading = false;
  stopping = false;
  clearing = false;
  confirmStop = false;
  confirmClear = false;
  errorMessage = "";
  actionMessage = "";

  get busy(): boolean {
    return this.loading || this.stopping || this.clearing;
  }

  ngOnInit(): void {
    void this.refresh();
  }

  queuedCountLabel(): string {
    return this.stringUtils.pluraliseWithCount(this.status?.queuedJobs?.length || 0, "queued job");
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.errorMessage = "";
    try {
      this.status = await firstValueFrom(this.http.get<IntegrationWorkerQueueStatus>("/api/health/worker-queue/status"));
    } catch (error) {
      this.errorMessage = this.messageFrom(error);
      this.logger.error("refresh failed:", error);
    }
    this.loading = false;
  }

  async stopActive(): Promise<void> {
    this.confirmStop = false;
    this.stopping = true;
    this.errorMessage = "";
    this.actionMessage = "";
    try {
      const result = await firstValueFrom(this.http.post<IntegrationWorkerQueueCancelResult>("/api/health/worker-queue/cancel-active", {}));
      this.actionMessage = result.cancelled ? `Stopped the active job (${result.jobId}).` : "There was no active job to stop.";
      await this.refresh();
    } catch (error) {
      this.errorMessage = this.messageFrom(error);
      this.logger.error("stopActive failed:", error);
    }
    this.stopping = false;
  }

  async clearQueue(): Promise<void> {
    this.confirmClear = false;
    this.clearing = true;
    this.errorMessage = "";
    this.actionMessage = "";
    try {
      const result = await firstValueFrom(this.http.post<IntegrationWorkerQueueClearResult>("/api/health/worker-queue/clear", {}));
      this.actionMessage = `Cleared ${this.stringUtils.pluraliseWithCount(result.clearedCount, "queued job")}.`;
      await this.refresh();
    } catch (error) {
      this.errorMessage = this.messageFrom(error);
      this.logger.error("clearQueue failed:", error);
    }
    this.clearing = false;
  }

  private messageFrom(error: unknown): string {
    const asHttp = error as { error?: { error?: string }; message?: string };
    return asHttp?.error?.error || asHttp?.message || "The worker queue request failed";
  }
}
