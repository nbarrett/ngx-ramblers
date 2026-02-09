import { Component, EventEmitter, inject, Input, OnDestroy, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import { EnvironmentConfigService } from "../../../services/environment-config.service";
import { BackupAndRestoreService } from "../../../services/backup-and-restore.service";
import { EnvironmentsConfig } from "../../../models/environment-config.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";

@Component({
  selector: "app-environment-config-tools",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">View or Initialise Configuration</div>
      <div class="d-flex justify-content-between align-items-center mb-3">
        <p class="text-muted mb-0">
          Configure environments, credentials, and application secrets
        </p>
        <div class="btn-group" role="group">
          <button type="button"
                  class="btn btn-sm"
                  [class.btn-secondary]="!jsonViewMode"
                  [class.btn-outline-secondary]="jsonViewMode"
                  (click)="jsonViewMode = false">
            Form View
          </button>
          <button type="button"
                  class="btn btn-sm"
                  [class.btn-secondary]="jsonViewMode"
                  [class.btn-outline-secondary]="!jsonViewMode"
                  (click)="jsonViewMode = true">
            JSON View
          </button>
        </div>
      </div>
      <div class="mb-3">
        <button type="button" class="btn btn-info btn-sm me-2"
                (click)="initializeFromFiles()">
          Initialise from Files
        </button>
        <button type="button" class="btn btn-secondary btn-sm" (click)="reloadConfig()">
          Reload Config
        </button>
        <small class="form-text text-muted d-block mt-2">
          Initialise will read configs.json and secret files to populate per-environment
          configurations
        </small>
      </div>
      @if (jsonViewMode) {
        <form (ngSubmit)="saveJsonConfig()" autocomplete="off">
          <div class="mb-3">
            <label class="form-label">Configuration JSON</label>
            <textarea
              class="form-control"
              [(ngModel)]="configJson"
              name="configJson"
              rows="20"
              style="font-family: monospace; font-size: 0.875rem;"></textarea>
            <small class="form-text text-muted">
              Paste complete JSON configuration here
            </small>
          </div>
          <button type="submit" class="btn btn-primary me-2">
            Save Configuration
          </button>
        </form>
      }
    </div>
  `
})
export class EnvironmentConfigTools implements OnDestroy {

  private environmentConfigService = inject(EnvironmentConfigService);
  private backupRestoreService = inject(BackupAndRestoreService);
  private notifierService = inject(NotifierService);
  private subscriptions: Subscription[] = [];

  @Input({required: true}) configJson: string;
  @Output() configJsonChange = new EventEmitter<string>();
  @Output() configLoaded = new EventEmitter<EnvironmentsConfig>();

  notifyTarget: AlertTarget = {};
  notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  jsonViewMode = false;

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  reloadConfig() {
    this.subscriptions.push(
      this.environmentConfigService.events().subscribe({
        next: config => {
          this.configJson = JSON.stringify(config, null, 2);
          this.configJsonChange.emit(this.configJson);
          this.configLoaded.emit(config);
        },
        error: err => {
          this.notify.error({
            title: "Error loading configuration",
            message: err.message
          });
        }
      })
    );
  }

  saveJsonConfig() {
    const config: EnvironmentsConfig = JSON.parse(this.configJson);
    this.environmentConfigService.saveConfig(config).then(() => {
      this.notify.success({
        title: "Configuration Saved",
        message: "Environment configuration has been saved successfully"
      });
    }).catch(err => {
      this.notify.error({
        title: "Error saving configuration",
        message: err.message
      });
    });
  }

  initializeFromFiles() {
    this.subscriptions.push(
      this.backupRestoreService.initializeConfig().subscribe({
        next: config => {
          const environmentsConfig: EnvironmentsConfig = {
            environments: config.environments?.map(env => ({
              environment: env.environment,
              aws: env.aws,
              mongo: env.mongo,
              flyio: env.flyio,
              cloudflare: env.cloudflare,
              secrets: env.secrets
            })) || [],
            aws: config.aws,
            cloudflare: config.cloudflare,
            secrets: config.secrets
          };
          this.configJson = JSON.stringify(environmentsConfig, null, 2);
          this.configJsonChange.emit(this.configJson);
          this.configLoaded.emit(environmentsConfig);
          this.notify.success({
            title: "Configuration Initialised",
            message: `Successfully initialised ${environmentsConfig.environments?.length || 0} environment configurations from files`
          });
        },
        error: err => {
          this.notify.error({
            title: "Error initialising configuration",
            message: err.error?.error || err.message
          });
        }
      })
    );
  }
}
