import { Component, Input, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSave, faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  BackupsTaskSettings,
  DEFAULT_BACKUPS_TASK_SETTINGS,
  ScheduledTaskSummary
} from "../../../../models/scheduled-task.model";
import { ScheduledTaskService } from "../../../../services/scheduled-task.service";

@Component({
  selector: "app-backups-task-settings",
  imports: [FormsModule, FontAwesomeModule],
  template: `
    <div class="border-top pt-3">
      <h5>Backup worker pool</h5>
      <div class="row g-3 align-items-end">
        <div class="col-md-3">
          <label class="form-label" for="backup-mongo-concurrency">Mongo backups</label>
          <input id="backup-mongo-concurrency" class="form-control" type="number" min="1" max="5"
                 [(ngModel)]="settings.mongoDumpConcurrency" [disabled]="busy">
        </div>
        <div class="col-md-3">
          <label class="form-label" for="backup-s3-concurrency">S3 object backups</label>
          <input id="backup-s3-concurrency" class="form-control" type="number" min="1" max="5"
                 [(ngModel)]="settings.s3ObjectBackupConcurrency" [disabled]="busy">
        </div>
        <div class="col-md-3">
          <label class="form-label" for="backup-timeout">Timeout per environment</label>
          <input id="backup-timeout" class="form-control" type="number" min="1" max="180"
                 [(ngModel)]="settings.perEnvironmentTimeoutMinutes" [disabled]="busy">
        </div>
        <div class="col-md-3">
          <label class="form-label" for="backup-retries">Retries</label>
          <input id="backup-retries" class="form-control" type="number" min="0" max="5"
                 [(ngModel)]="settings.maxRetries" [disabled]="busy">
        </div>
      </div>
      <div class="row g-3 align-items-end mt-1">
        <div class="col-md-3">
          <label class="form-label" for="backup-retry-delay">Retry delay</label>
          <input id="backup-retry-delay" class="form-control" type="number" min="1" max="3600"
                 [(ngModel)]="settings.retryDelaySeconds" [disabled]="busy">
        </div>
        <div class="col-md-9">
          <div class="form-check form-check-inline">
            <input id="backup-upload-mongo" class="form-check-input" type="checkbox"
                   [(ngModel)]="settings.uploadMongoDumpToS3ByDefault" [disabled]="busy">
            <label class="form-check-label" for="backup-upload-mongo">Upload Mongo dumps to S3</label>
          </div>
          <div class="form-check form-check-inline">
            <input id="backup-include-s3" class="form-check-input" type="checkbox"
                   [(ngModel)]="settings.includeS3ObjectsByDefault" [disabled]="busy">
            <label class="form-check-label" for="backup-include-s3">Include S3 objects</label>
          </div>
        </div>
      </div>
      <div class="d-flex align-items-center gap-3 mt-3">
        <button type="button" class="btn btn-primary" [disabled]="busy || !task" (click)="save()">
          <fa-icon [icon]="busy ? faSpinner : faSave" [animation]="busy ? 'spin' : null"/> Save backup settings
        </button>
        @if (saved) {
          <span class="text-success">Saved</span>
        }
        @if (error) {
          <span class="text-danger">{{ error }}</span>
        }
      </div>
    </div>
  `
})
export class BackupsTaskSettingsComponent {
  private service = inject(ScheduledTaskService);
  protected readonly faSave = faSave;
  protected readonly faSpinner = faSpinner;
  protected task: ScheduledTaskSummary | null = null;
  protected settings: BackupsTaskSettings = {...DEFAULT_BACKUPS_TASK_SETTINGS};
  protected busy = false;
  protected saved = false;
  protected error: string | null = null;

  @Input() set taskValue(task: ScheduledTaskSummary) {
    this.task = task;
    this.settings = {
      ...DEFAULT_BACKUPS_TASK_SETTINGS,
      ...(task.settings as Partial<BackupsTaskSettings> || {})
    };
  }

  private bounded(value: number, fallback: number, minimum: number, maximum: number): number {
    const candidate = Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.max(minimum, Math.min(maximum, candidate));
  }

  private normalisedSettings(): BackupsTaskSettings {
    return {
      ...this.settings,
      mongoDumpConcurrency: this.bounded(this.settings.mongoDumpConcurrency, DEFAULT_BACKUPS_TASK_SETTINGS.mongoDumpConcurrency, 1, 5),
      s3ObjectBackupConcurrency: this.bounded(this.settings.s3ObjectBackupConcurrency, DEFAULT_BACKUPS_TASK_SETTINGS.s3ObjectBackupConcurrency, 1, 5),
      perEnvironmentTimeoutMinutes: this.bounded(this.settings.perEnvironmentTimeoutMinutes, DEFAULT_BACKUPS_TASK_SETTINGS.perEnvironmentTimeoutMinutes, 1, 180),
      maxRetries: this.bounded(this.settings.maxRetries, DEFAULT_BACKUPS_TASK_SETTINGS.maxRetries, 0, 5),
      retryDelaySeconds: this.bounded(this.settings.retryDelaySeconds, DEFAULT_BACKUPS_TASK_SETTINGS.retryDelaySeconds, 1, 3600)
    };
  }

  protected async save(): Promise<void> {
    if (!this.task) {
      return;
    }
    this.busy = true;
    this.saved = false;
    this.error = null;
    try {
      const updated = await this.service.setSettings(this.task.id, this.normalisedSettings());
      this.taskValue = updated;
      this.saved = true;
    } catch (error: any) {
      this.error = error?.message || "Unable to save backup settings";
    } finally {
      this.busy = false;
    }
  }
}
