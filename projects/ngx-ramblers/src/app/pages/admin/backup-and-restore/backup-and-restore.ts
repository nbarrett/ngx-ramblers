import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { interval, Subscription } from "rxjs";
import { switchMap } from "rxjs/operators";
import { isNumber, isString, kebabCase } from "es-toolkit/compat";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faBackward, faCopy, faForward, faPlus, faSpinner, faTrash } from "@fortawesome/free-solid-svg-icons";
import { PageComponent } from "../../../page/page.component";
import { SecretInputComponent } from "../../../modules/common/secret-input/secret-input.component";
import { BackupConfigService } from "../../../services/backup-config.service";
import {
  BackupConfig,
  BackupListItem,
  BackupRequest,
  BackupRestoreTab,
  BackupSession,
  EnvironmentBackupConfig,
  EnvironmentInfo,
  RestoreRequest
} from "../../../models/backup-session.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { BackupAndRestoreService } from "../../../services/backup-and-restore.service";
import { StoredValue } from "../../../models/ui-actions";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { EventType, MessageType } from "../../../models/websocket.model";
import { NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { sortBy } from "../../../functions/arrays";
import { EnvironmentSelectComponent } from "../../../modules/common/selectors/environment-select";
import { CollectionsMultiSelectComponent } from "../../../modules/common/selectors/collections-multi-select";
import { BackupsMultiSelectComponent } from "../../../modules/common/selectors/backups-multi-select";

@Component({
  selector: "app-backup-and-restore",
  imports: [
    CommonModule,
    FormsModule,
    TabsetComponent,
    TabDirective,
    PageComponent,
    DatePipe,
    SecretInputComponent,
    FontAwesomeModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    EnvironmentSelectComponent,
    CollectionsMultiSelectComponent,
    BackupsMultiSelectComponent
  ],
  styles: [`
    .session-status
      padding: 0.25rem 0.5rem
      border-radius: 0.25rem
      font-size: 0.875rem
      font-weight: 500

    .session-logs
      background-color: #1e293b
      color: #e2e8f0
      padding: 1rem
      border-radius: 0.375rem
      font-family: monospace
      font-size: 0.875rem
      max-height: 400px
      overflow-y: auto

      div
        margin-bottom: 0.25rem
  `],
  template: `
    <app-page autoTitle pageTitle="Backup & Restore">
      <div class="row">
        <div class="col-sm-12">
          <tabset class="custom-tabset">
            <tab [active]="tabActive(BackupRestoreTab.BACKUP)"
                 (selectTab)="selectTab(BackupRestoreTab.BACKUP)"
                 [heading]="BackupRestoreTab.BACKUP">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row thumbnail-heading-frame">
                  <div class="thumbnail-heading">Backup</div>
                  <form (ngSubmit)="startBackup()" autocomplete="off">
                    <div class="mb-3">
                      <label class="form-label">Environment(s)</label>
                      <app-environment-select
                        [items]="environmentsWithMongo"
                        [multiple]="true"
                        [showSelectAllHeader]="true"
                        [(selected)]="selectedEnvironments"
                        (selectedChange)="onBackupEnvironmentsChange($event)"></app-environment-select>
                      @if (environments.length === 0) {
                        <small class="form-text text-warning">
                          No environments configured. Please configure environments in the
                          Settings tab first.
                        </small>
                      }
                      @if (selectedEnvironments.length > 0) {
                        <small class="form-text">
                          {{ stringUtils.pluraliseWithCount(selectedEnvironments.length, 'environment') }}
                          selected</small>
                      }
                    </div>
                    <div class="mb-3">
                      <label class="form-label">Collections (optional)</label>
                      <app-collections-multi-select
                        [available]="availableCollections"
                        [(selected)]="selectedCollections">
                      </app-collections-multi-select>
                      <small class="form-text text-muted">Auto-populated when exactly one
                        environment is selected. Leave empty to backup all collections.</small>
                    </div>
                    <div class="mb-3 form-check">
                      <input type="checkbox" class="form-check-input"
                             [(ngModel)]="backupRequest.scaleDown"
                             name="scaleDown" id="scaleDown">
                      <label class="form-check-label" for="scaleDown">Scale down app during
                        backup</label>
                    </div>
                    <div class="mb-3 form-check">
                      <input type="checkbox" class="form-check-input"
                             [(ngModel)]="backupRequest.upload" name="upload"
                             id="upload" [disabled]="!s3Available()">
                      <label class="form-check-label" for="upload">Upload to S3</label>
                      @if (!s3Available()) {
                        <small class="form-text text-muted d-block">
                          Set a global bucket (Settings → Global AWS S3 Configuration) or per‑environment bucket to
                          enable uploads.
                        </small>
                      }
                    </div>
                    <button type="submit" class="btn btn-primary"
                            [disabled]="selectedEnvironments.length === 0">
                      Start Backup
                    </button>
                  </form>
                </div>
              </div>
            </tab>
            <tab [active]="tabActive(BackupRestoreTab.RESTORE)"
                 (selectTab)="selectTab(BackupRestoreTab.RESTORE)"
                 [heading]="BackupRestoreTab.RESTORE">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row thumbnail-heading-frame">
                  <div class="thumbnail-heading">Restore Database from Backup</div>
                  <div class="mb-3">
                    <label class="form-label me-3">Backup Source</label>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="radio" id="sourceS3" name="backupSource"
                             value="s3"
                             [(ngModel)]="backupSource" (ngModelChange)="onBackupSourceChange()"
                             checked>
                      <label class="form-check-label" for="sourceS3">S3</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="radio" id="sourceLocal"
                             name="backupSource"
                             value="local"
                             [(ngModel)]="backupSource" (ngModelChange)="onBackupSourceChange()">
                      <label class="form-check-label" for="sourceLocal">Local</label>
                    </div>
                  </div>
                  <form (ngSubmit)="startRestore()" autocomplete="off">
                    <div class="mb-3">
                      <label class="form-label">Target Environment</label>
                      <app-environment-select
                        [items]="environmentsWithMongo"
                        [(selectedName)]="restoreRequest.environment"
                        (selectedNameChange)="onRestoreEnvironmentChange($event)"
                        placeholder="Select environment..."></app-environment-select>
                      @if (environments.length === 0) {
                        <small class="form-text text-warning">
                          No environments configured. Please configure environments in the
                          Settings tab first.
                        </small>
                      }
                    </div>
                    <div class="mb-3">
                      <label class="form-label">Source Environment</label>
                      <app-environment-select
                        [items]="environmentsWithMongo"
                        [(selectedName)]="sourceEnvironment"
                        (selectedNameChange)="onSourceEnvironmentChange($event)"
                        placeholder="Filter backups by source..."></app-environment-select>
                    </div>
                    <div class="mb-3">
                      <label class="form-label">Backup to Restore</label>
                      <ng-select
                        [(ngModel)]="selectedBackupForRestore"
                        (ngModelChange)="onBackupForRestoreChange($event)"
                        [items]="backups"
                        [multiple]="false"
                        [searchable]="true"
                        [searchFn]="backupSearch"
                        [clearable]="true"
                        [appendTo]="'body'"
                        [dropdownPosition]="'bottom'"
                        bindLabel="name"
                        placeholder="Select backup..."
                        name="backupForRestore"
                        appearance="outline">
                        <ng-template ng-option-tmp let-item="item">
                          <div class="d-flex flex-column align-items-start gap-1" [title]="item.path || item.name">
                            @if (backupSource === 's3') {
                              <div class="d-flex align-items-center gap-2 flex-wrap">
                                <span class="badge bg-light text-body border">{{ s3Env(item) }}</span>
                                <span class="badge bg-light text-muted">{{ s3Date(item) }}</span>
                              </div>
                              <div class="text-muted small font-monospace text-truncate" style="max-width: 800px;">{{ item.name }}</div>
                            } @else {
                              <div class="badge bg-light text-muted">{{ item.timestamp ? (item.timestamp | date:'medium') : '' }}</div>
                              <div class="text-muted small font-monospace text-truncate" style="max-width: 640px;">{{ item.name }}</div>
                            }
                          </div>
                        </ng-template>
                      </ng-select>
                      @if (backups.length === 0) {
                        <small class="form-text">No backups available.</small>
                      }
                    </div>
                    <div class="mb-3">
                      <label class="form-label">Collections (optional)</label>
                      <app-collections-multi-select
                        [available]="restoreAvailableCollections"
                        [(selected)]="selectedRestoreCollections">
                      </app-collections-multi-select>
                      <small class="form-text text-muted">Auto-populated after selecting an
                        environment. Leave empty to restore all collections.</small>
                    </div>
                    <div class="mb-3 form-check">
                      <input type="checkbox" class="form-check-input"
                             [(ngModel)]="restoreRequest.drop" name="drop"
                             id="drop">
                      <label class="form-check-label" for="drop">Drop collections before
                        restore</label>
                    </div>
                    <div class="mb-3 form-check">
                      <input type="checkbox" class="form-check-input"
                             [(ngModel)]="restoreRequest.dryRun" name="dryRun"
                             id="dryRun">
                      <label class="form-check-label" for="dryRun">Dry run (simulate only)</label>
                    </div>
                    <button type="submit" class="btn btn-warning"
                            [disabled]="!restoreRequest.environment || !selectedBackupForRestore">
                      {{ restoreButtonLabel() }}
                    </button>
                  </form>
                </div>
              </div>
            </tab>
            <tab [active]="tabActive(BackupRestoreTab.BACKUPS)"
                 (selectTab)="selectTab(BackupRestoreTab.BACKUPS)"
                 [heading]="BackupRestoreTab.BACKUPS">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row thumbnail-heading-frame">
                  <div class="thumbnail-heading">Bulk Backup Management</div>
                  <div class="mb-3">
                    <label class="form-label">Select Backups for Bulk Actions</label>
                    <app-backups-multi-select
                      [items]="backups"
                      [(selected)]="selectedBackups">
                    </app-backups-multi-select>
                    @if (selectedBackups.length > 0) {
                      <small class="form-text">{{ stringUtils.pluraliseWithCount(selectedBackups.length, 'backup') }} selected</small>
                    }
                  </div>
                  @if (selectedBackups.length > 0) {
                    <div class="d-flex gap-2 mb-3">
                      <button type="button" class="btn btn-danger"
                              (click)="deleteSelectedBackups()">
                        <fa-icon [icon]="faTrash"></fa-icon>
                        Delete {{ selectedBackups.length }} Backup(s)
                      </button>
                    </div>
                  }
                </div>
              </div>
            </tab>
            <tab [active]="tabActive(BackupRestoreTab.HISTORY)"
                 (selectTab)="selectTab(BackupRestoreTab.HISTORY)"
                 [heading]="BackupRestoreTab.HISTORY">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row thumbnail-heading-frame">
                  <div class="thumbnail-heading">Backup/Restore History</div>
                  <div class="table-responsive">
                    <table class="table table-striped table-sm">
                      <thead>
                      <tr>
                        <th>Type</th>
                        <th>Environment</th>
                        <th>Status</th>
                        <th>Started</th>
                        <th>Duration</th>
                        <th>Actions</th>
                      </tr>
                      </thead>
                      <tbody>
                        @for (session of sessions; track session._id) {
                          <tr>
                            <td>{{ session.type }}</td>
                            <td>{{ session.environment }}</td>
                            <td>
                              <span class="session-status" [ngClass]="statusStyle(session.status)">
                                @if (session.status === 'in_progress') {
                                  <fa-icon [icon]="faSpinner" [spin]="true" class="me-1"></fa-icon>
                                }
                                {{ humaniseStatus(session.status) }}
                              </span>
                            </td>
                            <td>{{ session.startTime | date:'medium' }}</td>
                            <td>
                              @if (session.endTime) {
                                {{ duration(session.startTime, session.endTime) }}
                              } @else {
                                -
                              }
                            </td>
                            <td>
                              <button class="btn btn-sm btn-info"
                                      (click)="toggleSessionLogs(session)">
                                {{ isSessionExpanded(session) ? 'Hide Logs' : 'View Logs' }}
                              </button>
                            </td>
                          </tr>
                          @if (isSessionExpanded(session)) {
                            <tr>
                              <td colspan="6">
                                <div class="session-logs">
                                  @for (log of logsNewestFirst(session); track $index) {
                                    <div>{{ log }}</div>
                                  }
                                  @if (session.error) {
                                    <div class="text-danger">ERROR: {{ session.error }}</div>
                                  }
                                </div>
                              </td>
                            </tr>
                          }
                        }
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            </tab>

            <tab [active]="tabActive(BackupRestoreTab.SETTINGS)"
                 (selectTab)="selectTab(BackupRestoreTab.SETTINGS)"
                 [heading]="BackupRestoreTab.SETTINGS">
              @if (tabActive(BackupRestoreTab.SETTINGS)) {
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row thumbnail-heading-frame">
                  <div class="thumbnail-heading">Backup Configuration</div>
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <p class="text-muted mb-0">
                      Manage backup configurations for each environment
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
                      Initialize from Files
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="loadConfig()">
                      Reload Config
                    </button>
                    <small class="form-text text-muted d-block mt-2">
                      Initialize will read configs.json and secret files to populate per-environment
                      configurations
                    </small>
                  </div>
                  @if (configError) {
                    <div class="alert alert-danger">
                      {{ configError }}
                    </div>
                  }
                  @if (jsonViewMode) {
                    <form (ngSubmit)="saveConfig()" autocomplete="off">
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
                  } @else {
                    <form (ngSubmit)="saveConfigFromForm()" autocomplete="off">
                      <div class="row thumbnail-heading-frame mb-5">
                        <div class="thumbnail-heading">Global AWS S3 Configuration</div>
                        <div class="row">
                          <div class="col-md-6 mb-2">
                            <label class="form-label">Bucket</label>
                            <input type="text"
                                   class="form-control form-control-sm"
                                   [(ngModel)]="editableConfig.aws.bucket"
                                   name="globalAwsBucket"
                                   placeholder="e.g. ngx-ramblers-backups">
                          </div>
                          <div class="col-md-6 mb-2">
                            <label class="form-label">Region</label>
                            <input type="text"
                                   class="form-control form-control-sm"
                                   [(ngModel)]="editableConfig.aws.region"
                                   name="globalAwsRegion"
                                   placeholder="e.g. eu-west-2">
                          </div>
                        </div>
                        <small class="form-text text-muted">If set, all uploads/listing/deletes will use this bucket,
                          with per-environment bucket used only as a fallback.</small>
                      </div>
                      @if (currentEnvironment) {
                        <div class="row thumbnail-heading-frame">
                          <div class="thumbnail-heading-with-select">
                            <strong class="text-nowrap">
                              Environment Configuration {{ currentEnvironmentIndex + 1 }}
                              of {{ environmentCount }}:</strong>
                            <select class="form-control"
                                    [(ngModel)]="currentEnvironmentIndex"
                                    name="environmentSelector">
                              @for (env of editableConfig.environments; let i = $index; track i) {
                                <option [ngValue]="i">{{ env.environment || 'New Environment' }}</option>
                              }
                            </select>
                          </div>
                          <div class="d-flex gap-2 mb-3 flex-wrap">
                            <button type="button"
                                    class="btn btn-secondary"
                                    [disabled]="!canNavigatePrevious"
                                    (click)="navigatePrevious()">
                              <fa-icon [icon]="faBackward"></fa-icon>
                              Previous
                            </button>
                            <button type="button"
                                    class="btn btn-success"
                                    [disabled]="!canNavigateNext"
                                    (click)="navigateNext()">
                              <fa-icon [icon]="faForward"></fa-icon>
                              Next
                            </button>
                            <button type="button"
                                    class="btn btn-info"
                                    (click)="duplicateEnvironment()">
                              <fa-icon [icon]="faCopy"></fa-icon>
                              Duplicate
                            </button>
                            <button type="button"
                                    class="btn btn-success"
                                    (click)="addNewEnvironment()">
                              <fa-icon [icon]="faPlus"></fa-icon>
                              Add New
                            </button>
                            <button type="button"
                                    class="btn btn-danger"
                                    (click)="deleteCurrentEnvironment()">
                              <fa-icon [icon]="faTrash"></fa-icon>
                              Delete
                            </button>
                          </div>
                          <div class="row thumbnail-heading-frame">
                            <div class="thumbnail-heading">Environment Details</div>
                            <div class="row">
                              <div class="col-md-12 mb-3">
                                <label class="form-label">Environment Name</label>
                                <input type="text"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="currentEnvironment.environment"
                                       name="envName"
                                       autocomplete="off"
                                       placeholder="e.g., staging, production">
                              </div>
                            </div>
                          </div>
                          <div class="row thumbnail-heading-frame">
                            <div class="thumbnail-heading">AWS S3 Configuration</div>
                            <div class="row">
                              <div class="col-md-6 mb-2">
                                <label class="form-label">Bucket</label>
                                <input type="text"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="currentEnvironment.aws.bucket"
                                       name="awsBucket"
                                       autocomplete="off">
                              </div>
                              <div class="col-md-6 mb-2">
                                <label class="form-label">Region</label>
                                <input type="text"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="currentEnvironment.aws.region"
                                       name="awsRegion"
                                       autocomplete="off"
                                       placeholder="us-east-1">
                              </div>
                              <div class="col-md-6 mb-2">
                                <label class="form-label">Access Key ID</label>
                                <app-secret-input
                                  [(ngModel)]="currentEnvironment.aws.accessKeyId"
                                  name="awsKeyId"
                                  size="sm">
                                </app-secret-input>
                              </div>
                              <div class="col-md-6 mb-2">
                                <label class="form-label">Secret Access
                                  Key</label>
                                <app-secret-input
                                  [(ngModel)]="currentEnvironment.aws.secretAccessKey"
                                  name="awsSecret"
                                  size="sm">
                                </app-secret-input>
                              </div>
                            </div>
                          </div>
                          <div class="row thumbnail-heading-frame">
                            <div class="thumbnail-heading">MongoDB Configuration</div>
                            <div class="row">
                              <div class="col-md-12 mb-2">
                                <label class="form-label">Connection URI</label>
                                <input type="text"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="currentEnvironment.mongo.uri"
                                       (blur)="parseMongoUri()"
                                       name="mongoUri"
                                       autocomplete="off"
                                       placeholder="mongodb+srv://...">
                              </div>
                              <div class="col-md-4 mb-2">
                                <label class="form-label">Database</label>
                                <input type="text"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="currentEnvironment.mongo.db"
                                       name="mongoDb"
                                       autocomplete="off">
                              </div>
                              <div class="col-md-4 mb-2">
                                <label class="form-label">Username</label>
                                <input type="text"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="currentEnvironment.mongo.username"
                                       name="mongoUser"
                                       autocomplete="off">
                              </div>
                              <div class="col-md-4 mb-2">
                                <label class="form-label">Password</label>
                                <app-secret-input
                                  [(ngModel)]="currentEnvironment.mongo.password"
                                  name="mongoPass"
                                  size="sm">
                                </app-secret-input>
                              </div>
                            </div>
                          </div>
                          <div class="row thumbnail-heading-frame">
                            <div class="thumbnail-heading">Fly.io Configuration</div>
                            <div class="row">
                              <div class="col-md-12 mb-2">
                                <label class="form-label">API Key</label>
                                <app-secret-input
                                  [(ngModel)]="currentEnvironment.flyio.apiKey"
                                  name="flyApiKey"
                                  size="sm">
                                </app-secret-input>
                              </div>
                              <div class="col-md-4 mb-2">
                                <label class="form-label">App Name</label>
                                <input type="text"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="currentEnvironment.flyio.appName"
                                       name="flyAppName"
                                       autocomplete="off">
                              </div>
                              <div class="col-md-4 mb-2">
                                <label class="form-label">Memory</label>
                                <input type="text"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="currentEnvironment.flyio.memory"
                                       name="flyMemory"
                                       autocomplete="off"
                                       placeholder="512mb">
                              </div>
                              <div class="col-md-4 mb-2">
                                <label class="form-label">Scale Count</label>
                                <input type="number"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="currentEnvironment.flyio.scaleCount"
                                       name="flyScale"
                                       autocomplete="off">
                              </div>
                              <div class="col-md-12 mb-2">
                                <label class="form-label">Organisation</label>
                                <input type="text"
                                       class="form-control form-control-sm"
                                       [(ngModel)]="currentEnvironment.flyio.organization"
                                       name="flyOrg"
                                       autocomplete="off"
                                       placeholder="Fly.io organisation/team name">
                              </div>
                            </div>
                          </div>
                        </div>
                      } @else {
                        <div class="alert alert-info">
                          <p>No environment configurations yet.</p>
                          <button type="button" class="btn btn-success btn-sm"
                                  (click)="addNewEnvironment()">
                            <fa-icon [icon]="faPlus"></fa-icon>
                            Add New Environment
                          </button>
                        </div>
                      }
                      <button type="submit" class="btn btn-primary me-2">
                        Save Configuration
                      </button>
                    </form>
                  }
                </div>
              </div>
              }
            </tab>
          </tabset>
        </div>
      </div>
    </app-page>
  `
})
export class BackupAndRestore implements OnInit, OnDestroy {

  get currentEnvironmentIndex(): number {
    return this._currentEnvironmentIndex;
  }

  set currentEnvironmentIndex(value: number) {
    const numValue = isString(value) ? parseInt(value, 10) : value;
    const maxIndex = Math.max(0, this.editableConfig.environments.length - 1);
    this._currentEnvironmentIndex = Math.min(Math.max(0, numValue), maxIndex);
  }

  get currentEnvironment(): EnvironmentBackupConfig | null {
    return this.editableConfig.environments[this.currentEnvironmentIndex] ?? null;
  }

  get environmentCount(): number {
    return this.editableConfig.environments.length;
  }

  get canNavigatePrevious(): boolean {
    return this.currentEnvironmentIndex > 0;
  }

  get canNavigateNext(): boolean {
    return this.currentEnvironmentIndex < this.editableConfig.environments.length - 1;
  }
  private logger: Logger = inject(LoggerFactory).createLogger("BackupAndRestore", NgxLoggerLevel.ERROR);
  private backupRestoreService = inject(BackupAndRestoreService);
  private backupConfigService = inject(BackupConfigService);
  private notifierService = inject(NotifierService);
  private websocketService = inject(WebSocketClientService);
  stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private subscriptions: Subscription[] = [];
  private refreshSubscription: Subscription | null = null;
  private tab: any;
  private wsConnected = false;

  protected readonly BackupRestoreTab = BackupRestoreTab;
  protected readonly faBackward = faBackward;
  protected readonly faForward = faForward;
  protected readonly faCopy = faCopy;
  protected readonly faPlus = faPlus;
  protected readonly faTrash = faTrash;
  protected readonly faSpinner = faSpinner;

  notifyTarget: AlertTarget = {};
  notify = this.notifierService.createAlertInstance(this.notifyTarget);

  environments: EnvironmentInfo[] = [];
  environmentsWithMongo: EnvironmentInfo[] = [];
  selectedEnvironments: EnvironmentInfo[] = [];
  backups: BackupListItem[] = [];
  selectedBackups: BackupListItem[] = [];
  allBackups: BackupListItem[] = [];
  selectedBackupForRestore: BackupListItem | null = null;
  backupSource: "s3" | "local" = "s3";
  sourceEnvironment = "";
  sessions: BackupSession[] = [];
  selectedSession?: BackupSession;
  expandedSessionIds: string[] = [];
  availableCollections: string[] = [];
  selectedCollections: string[] = [];
  restoreAvailableCollections: string[] = [];
  selectedRestoreCollections: string[] = [];
  configJson = "";
  configError = "";
  jsonViewMode = false;
  private _currentEnvironmentIndex = 0;
  editableConfig: BackupConfig = {
    environments: [],
    aws: { bucket: "", region: "us-east-1" }
  };

  backupRequest: BackupRequest = {
    environment: "",
    scaleDown: false,
    upload: true
  };

  restoreRequest: RestoreRequest = {
    environment: "",
    from: "",
    drop: true,
    dryRun: false
  };

  statusStyle(status: string) {
    if (status === "completed") return "text-style-mintcake";
    if (status === "failed") return "text-style-sunset";
    return "text-style-sunrise";
  }

  humaniseStatus(status: string): string {
    return this.stringUtils.asTitle(status);
  }

  async ngOnInit() {
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const defaultValue = kebabCase(BackupRestoreTab.BACKUP);
      const tabParameter = params[StoredValue.TAB];
      this.tab = tabParameter || defaultValue;
      this.logger.info("received tab value of:", tabParameter, "defaultValue:", defaultValue);
      this.handleTabChange(this.tab);
    }));
    this.loadEnvironments();
    this.loadBackups();
    this.loadSessions();
    this.loadConfig();
    await this.connectWebSocket();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.stopAutoRefresh();
  }

  private async connectWebSocket() {
    try {
      await this.websocketService.connect();
      this.wsConnected = true;
      this.logger.info("WebSocket connected");

      this.subscriptions.push(
        this.websocketService.receiveMessages<any>(MessageType.PROGRESS).subscribe(data => {
          this.handleProgressUpdate(data);
        })
      );

      this.subscriptions.push(
        this.websocketService.receiveMessages<any>(MessageType.COMPLETE).subscribe(data => {
          this.handleComplete(data);
        })
      );

      this.subscriptions.push(
        this.websocketService.receiveMessages<any>(MessageType.ERROR).subscribe(data => {
          this.handleError(data);
        })
      );
    } catch (error) {
      this.logger.error("Failed to connect WebSocket:", error);
      this.wsConnected = false;
    }
  }

  private handleProgressUpdate(data: any) {
    this.logger.info("Progress update:", data);
    if (data.logs && data.logs.length > 0) {
      const lastLog = data.logs[data.logs.length - 1];
      this.notify.progress({
        title: "Operation Progress",
        message: lastLog
      });
    }
    this.loadSessions();
  }

  private handleComplete(data: any) {
    this.logger.info("Operation complete:", data);
    this.loadSessions();
    this.loadBackups();
    if (data.status === "completed") {
      this.notify.success({
        title: "Operation Completed",
        message: `${data.sessionId} completed successfully`
      });
    } else if (data.status === "failed") {
      this.notify.error({
        title: "Operation Failed",
        message: data.error || "Operation failed"
      });
    }
  }

  private handleError(data: any) {
    this.logger.error("WebSocket error:", data);
    this.notify.error({
      title: "Operation Error",
      message: data.message || "An error occurred"
    });
  }

  logsNewestFirst(session: BackupSession): string[] {
    const items = session?.logs || [];
    return [...items].reverse();
  }

  private ensureInProgressExpanded(sessions: BackupSession[]) {
    if (!sessions || sessions.length === 0) return;
    if (this.expandedSessionIds.length > 0) return;
    const running = sessions.find(s => s.status === "in_progress");
    if (running) {
      const id = running._id || running.sessionId;
      this.expandedSessionIds = [id];
    }
  }

  selectTab(tab: BackupRestoreTab) {
    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: kebabCase(tab)},
      queryParamsHandling: "merge"
    });
  }

  tabActive(tab: BackupRestoreTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  private handleTabChange(tab: string) {
    if (kebabCase(tab) === kebabCase(BackupRestoreTab.HISTORY)) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  startAutoRefresh() {
    this.refreshSubscription = interval(5000)
      .pipe(switchMap(() => this.backupRestoreService.listSessions(50)))
      .subscribe(sessions => {
        this.sessions = sessions;
        this.ensureInProgressExpanded(sessions);
        if (this.selectedSession) {
          const updated = sessions.find(s => s._id === this.selectedSession?._id);
          if (updated) {
            this.selectedSession = updated;
          }
        }
      });
  }

  stopAutoRefresh() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = null;
    }
  }

  loadEnvironments() {
    this.subscriptions.push(
      this.backupRestoreService.listEnvironments().subscribe({
        next: envs => {
          this.environments = envs;
          this.environmentsWithMongo = envs.filter(e => e.hasMongoConfig);
          this.logger.info("Loaded environments:", envs);
        },
        error: err => this.notify.error({
          title: "Error loading environments",
          message: err.message
        })
      })
    );
  }

  loadBackups() {
    this.subscriptions.push(
      (this.backupSource === "s3" ? this.backupRestoreService.listS3Backups() : this.backupRestoreService.listBackups()).subscribe({
        next: backups => {
          this.allBackups = [...backups].sort(sortBy("-timestamp", "name"));
          this.applyBackupFilter();
          this.logger.info("Loaded backups:", backups);
        },
        error: err => this.notify.error({
          title: "Error loading backups",
          message: err.message
        })
      })
    );
  }

  onBackupSourceChange() {
    this.selectedBackupForRestore = null;
    this.selectedBackups = [];
    this.selectedRestoreCollections = [];
    this.restoreRequest.collections = undefined as any;
    this.loadBackups();
  }

  loadSessions() {
    this.subscriptions.push(
      this.backupRestoreService.listSessions(50).subscribe({
        next: sessions => {
          this.sessions = sessions;
          this.logger.info("Loaded sessions:", sessions);
          this.ensureInProgressExpanded(sessions);
        },
        error: err => this.notify.error({
          title: "Error loading sessions",
          message: err.message
        })
      })
    );
  }

  startBackup() {
    if (this.selectedEnvironments.length === 0) {
      this.notify.error({
        title: "Validation Error",
        message: "Please select at least one environment"
      });
      return;
    }

    if (this.backupRequest.upload && !this.s3Available()) {
      this.notify.error({
        title: "S3 Not Configured",
        message: "Configure a global or per‑environment S3 bucket in Settings before enabling uploads."
      });
      return;
    }

    this.selectTab(BackupRestoreTab.HISTORY);

    for (const env of this.selectedEnvironments) {
      const request: BackupRequest = {
        environment: env.name,
        scaleDown: this.backupRequest.scaleDown,
        upload: this.backupRequest.upload
      };
      if (this.selectedCollections.length > 0) {
        request.collections = this.selectedCollections;
      }

      this.subscriptions.push(
        this.backupRestoreService.startBackup(request).subscribe({
          next: session => {
            this.notify.success({
              title: "Backup Started",
              message: `Backup for ${env.name} started: ${session.sessionId}`
            });
            this.loadSessions();

            if (this.wsConnected && session._id) {
              this.websocketService.sendMessage(EventType.BACKUP_RESTORE, { sessionId: session._id });
            }
          },
          error: err => {
            const errorMessage = this.extractErrorMessage(err);
            this.logger.error("Backup error for", env.name, ":", err);
            this.notify.error({
              title: `Error Starting Backup for ${env.name}`,
              message: errorMessage
            });
          }
        })
      );
    }
  }

  startRestore() {
    if (!this.restoreRequest.environment) {
      this.notify.error({
        title: "Validation Error",
        message: "Please select a target environment"
      });
      return;
    }

    if (!this.selectedBackupForRestore) {
      this.notify.error({
        title: "Validation Error",
        message: "Please select a backup to restore"
      });
      return;
    }

    this.restoreRequest.from = this.selectedBackupForRestore.path;

    if (this.selectedRestoreCollections.length > 0) {
      this.restoreRequest.collections = this.selectedRestoreCollections;
    } else {
      this.restoreRequest.collections = undefined as any;
    }

    this.subscriptions.push(
      this.backupRestoreService.startRestore(this.restoreRequest).subscribe({
        next: session => {
          this.notify.success({
            title: "Restore Started",
            message: `Restore session ${session.sessionId} has been started. Switching to History tab to monitor progress.`
          });
          this.loadSessions();
          this.selectTab(BackupRestoreTab.HISTORY);

          if (this.wsConnected && session._id) {
            this.websocketService.sendMessage(EventType.BACKUP_RESTORE, { sessionId: session._id });
          }
        },
        error: err => {
          const errorMessage = this.extractErrorMessage(err);
          this.logger.error("Restore error:", err);
          this.notify.error({
            title: "Error Starting Restore",
            message: errorMessage
          });
        }
      })
    );
  }

  viewSession(session: BackupSession) {
    this.selectedSession = session;
  }

  onBackupForRestoreChange(item: BackupListItem | null) {
    this.selectedBackupForRestore = item;
    this.selectedRestoreCollections = [];
    this.restoreRequest.collections = undefined as any;
  }

  toggleSessionLogs(session: BackupSession) {
    const id = session._id || session.sessionId;
    const idx = this.expandedSessionIds.indexOf(id);
    if (idx >= 0) {
      this.expandedSessionIds.splice(idx, 1);
    } else {
      this.expandedSessionIds.push(id);
      this.subscriptions.push(
        this.backupRestoreService.session(id).subscribe(s => {
          const i = this.sessions.findIndex(x => (x._id || x.sessionId) === id);
          if (i >= 0) {
            this.sessions[i] = s;
          }
        })
      );
    }
  }

  isSessionExpanded(session: BackupSession): boolean {
    const id = session._id || session.sessionId;
    return this.expandedSessionIds.indexOf(id) >= 0;
  }

  duration(start: Date | number, end: Date | number): string {
    const startTime = isNumber(start) ? start : new Date(start).getTime();
    const endTime = isNumber(end) ? end : new Date(end).getTime();
    const durationMs = endTime - startTime;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  loadConfig() {
    this.subscriptions.push(
      this.backupConfigService.events().subscribe({
        next: config => {
          this.configJson = JSON.stringify(config, null, 2);
          this.populateFormFromConfig(config);
          this.configError = "";
        },
        error: err => {
          this.configError = `Error loading config: ${err.message}`;
        }
      })
    );
  }

  private populateFormFromConfig(config: BackupConfig) {
    this.editableConfig = JSON.parse(JSON.stringify(config));
    if (!this.editableConfig.environments) {
      this.editableConfig.environments = [];
    }

    if (!this.editableConfig.aws) {
      this.editableConfig.aws = { bucket: "", region: "us-east-1" } as any;
    }

    this.editableConfig.environments = this.editableConfig.environments.map(env => ({
      environment: env.environment || "",
      aws: env.aws || { bucket: "", region: "us-east-1", accessKeyId: "", secretAccessKey: "" },
      mongo: env.mongo || { uri: "", db: "", username: "", password: "" },
      flyio: env.flyio || { apiKey: "", appName: "", memory: "512mb", scaleCount: 1, organization: "" }
    }));

    if (this.currentEnvironmentIndex >= this.editableConfig.environments.length) {
      this.currentEnvironmentIndex = Math.max(0, this.editableConfig.environments.length - 1);
    }
  }

  saveConfig() {
    this.configError = "";
    const config: BackupConfig = JSON.parse(this.configJson);
    this.backupConfigService.saveConfig(config).then(() => {
      this.loadEnvironments();
      this.notify.success({
        title: "Configuration Saved",
        message: "Backup configuration has been saved successfully"
      });
    }).catch(err => {
        this.configError = `Error saving config: ${err.message}`;
        this.notify.error({
          title: "Error saving configuration",
          message: err.message
        });
      }
    );
  }

  saveConfigFromForm() {
    this.configError = "";
    const config: BackupConfig = {
      environments: this.editableConfig.environments,
      aws: this.editableConfig.aws
    };

    this.backupConfigService.saveConfig(config).then(() => {
      this.configJson = JSON.stringify(config, null, 2);
      this.loadEnvironments();
      this.notify.success({
        title: "Configuration Saved",
        message: "Backup configuration has been saved successfully"
      });
    }).catch(err => {
      this.configError = `Error saving config: ${err.message}`;
      this.notify.error({
        title: "Error saving configuration",
        message: err.message
      });
    });
  }

  addEnvironment() {
    const newEnv: EnvironmentBackupConfig = {
      environment: "",
      aws: {
        bucket: "",
        region: "us-east-1",
        accessKeyId: "",
        secretAccessKey: ""
      },
      mongo: {
        uri: "",
        db: "",
        username: "",
        password: ""
      },
      flyio: {
        apiKey: "",
        appName: "",
        memory: "512mb",
        scaleCount: 1,
        organization: ""
      }
    };
    this.editableConfig.environments.push(newEnv);
  }

  removeEnvironment(index: number) {
    this.editableConfig.environments.splice(index, 1);
    if (this.currentEnvironmentIndex >= this.editableConfig.environments.length) {
      this.currentEnvironmentIndex = Math.max(0, this.editableConfig.environments.length - 1);
    }
  }

  navigatePrevious() {
    if (this.canNavigatePrevious) {
      this.currentEnvironmentIndex--;
    }
  }

  navigateNext() {
    if (this.canNavigateNext) {
      this.currentEnvironmentIndex++;
    }
  }

  duplicateEnvironment() {
    if (this.currentEnvironment) {
      const duplicated: EnvironmentBackupConfig = JSON.parse(JSON.stringify(this.currentEnvironment));
      duplicated.environment = `${duplicated.environment} (Copy)`;
      this.editableConfig.environments.splice(this.currentEnvironmentIndex + 1, 0, duplicated);
      this.currentEnvironmentIndex++;
    }
  }

  s3Available(): boolean {
    if (this.editableConfig?.aws?.bucket) {
      return true;
    }
    if (!this.selectedEnvironments || this.selectedEnvironments.length === 0) {
      return false;
    }
    const selectedNames = new Set(this.selectedEnvironments.map(e => e.name));
    const configs = this.editableConfig.environments || [];
    return Array.from(selectedNames).every(name => {
      const env = configs.find(c => c.environment === name);
      return !!env?.aws?.bucket;
    });
  }

  deleteCurrentEnvironment() {
    if (this.editableConfig.environments.length > 0) {
      this.removeEnvironment(this.currentEnvironmentIndex);
    }
  }

  addNewEnvironment() {
    this.addEnvironment();
    this.currentEnvironmentIndex = this.editableConfig.environments.length - 1;
  }

  initializeFromFiles() {
    this.configError = "";
    this.subscriptions.push(
      this.backupRestoreService.initializeConfig().subscribe({
        next: config => {
          this.configJson = JSON.stringify(config, null, 2);
          this.populateFormFromConfig(config);
          this.notify.success({
            title: "Configuration Initialized",
            message: `Successfully initialized ${config.environments?.length || 0} environment configurations from files`
          });
        },
        error: err => {
          this.configError = `Error initializing config: ${err.error?.error || err.message}`;
          this.notify.error({
            title: "Error initializing configuration",
            message: err.error?.error || err.message
          });
        }
      })
    );
  }

  parseMongoUri() {
    if (!this.currentEnvironment?.mongo?.uri) {
      return;
    }

    const uri = this.currentEnvironment.mongo.uri.trim();
    const uriPattern = /^mongodb(\+srv)?:\/\/([^:]+):([^@]+)@(.+)$/;
    const match = uri.match(uriPattern);

    if (match) {
      const [, srvSuffix, username, password, rest] = match;
      const protocol = `mongodb${srvSuffix || ""}`;

      this.currentEnvironment.mongo.username = decodeURIComponent(username);
      this.currentEnvironment.mongo.password = decodeURIComponent(password);
      this.currentEnvironment.mongo.uri = `${protocol}://${rest}`;

      const dbMatch = rest.match(/^[^\/]+\/([^?]+)/);
      this.currentEnvironment.mongo.db = dbMatch ? dbMatch[1] : "";

      this.notify.success({
        title: "MongoDB URI Parsed",
        message: "Username and password extracted from URI"
      });
    }
  }

  private extractErrorMessage(err: any): string {
    if (err.error?.error) {
      return err.error.error;
    }
    if (err.error?.message) {
      return err.error.message;
    }
    if (err.message) {
      return err.message;
    }
    if (isString(err.error)) {
      return err.error;
    }
    return "An unexpected error occurred. Please check the logs.";
  }

  deleteSelectedBackups() {
    if (this.selectedBackups.length === 0) {
      return;
    }

    const backupNames = this.selectedBackups.map(b => b.name).join(", ");
    const confirmed = confirm(`Are you sure you want to delete ${this.selectedBackups.length} backup(s)?\n\n${backupNames}\n\nThis action cannot be undone.`);

    if (!confirmed) {
      return;
    }

    const names = this.selectedBackups.map(b => b.name);
    const obs = this.backupSource === "s3"
      ? this.backupRestoreService.deleteS3Backups(names)
      : this.backupRestoreService.deleteBackups(names);
    this.subscriptions.push(
      obs.subscribe({
        next: result => {
          const deletedCount = result.deleted.length;
          const errorCount = result.errors.length;
            if (deletedCount > 0) {
              this.notify.success({
                title: "Backups Deleted",
                message: `${deletedCount} backup(s) deleted`
              });
            }
            if (errorCount > 0) {
              const first = result.errors[0];
              this.notify.error({
                title: "Some deletions failed",
                message: `${errorCount} failed. First: ${first.name} (${first.error})`
              });
            }
            this.loadBackups();
            this.selectedBackups = [];
          },
          error: err => {
            this.notify.error({
              title: "Delete failed",
              message: this.extractErrorMessage(err)
            });
          }
        })
    );
  }

  onBackupEnvironmentsChange(selected?: EnvironmentInfo[]) {
    this.availableCollections = [];
    this.selectedCollections = [];
    const selection = selected || this.selectedEnvironments;
    if (selection && selection.length === 1) {
      this.loadCollectionsForEnvironment(selection[0].name, true);
    }
  }

  selectAllEnvironments() {
    this.selectedEnvironments = [...this.environmentsWithMongo];
    this.onBackupEnvironmentsChange();
  }

  clearAllEnvironments() {
    this.selectedEnvironments = [];
    this.onBackupEnvironmentsChange();
  }

  selectAllCollections() {
    this.selectedCollections = [...this.availableCollections];
  }

  clearAllCollections() {
    this.selectedCollections = [];
  }

  selectAllRestoreCollections() {
    this.selectedRestoreCollections = [...this.restoreAvailableCollections];
  }

  clearAllRestoreCollections() {
    this.selectedRestoreCollections = [];
  }

  selectAllBackups() {
    this.selectedBackups = [...this.backups];
  }

  clearAllBackups() {
    this.selectedBackups = [];
  }

  onRestoreEnvironmentChange(environmentName: string) {
    this.restoreAvailableCollections = [];
    this.selectedRestoreCollections = [];
    const env = environmentName || this.restoreRequest.environment;
    if (env) {
      this.loadCollectionsForEnvironment(env, false);
    }
    this.sourceEnvironment = env || this.sourceEnvironment;
    this.applyBackupFilter();
  }

  private loadCollectionsForEnvironment(environmentName: string, isBackup: boolean) {
    this.subscriptions.push(
      this.backupRestoreService.listCollections(environmentName).subscribe({
        next: collections => {
          const sorted = collections.map(value => ({ value })).sort(sortBy("value")).map(o => o.value);
          if (isBackup) {
            this.availableCollections = sorted;
          } else {
            this.restoreAvailableCollections = sorted;
          }
          this.logger.info(`Loaded ${collections.length} collections for ${environmentName}`);
        },
        error: err => {
          this.logger.error("Error loading collections:", err);
          this.notify.error({
            title: "Error Loading Collections",
            message: this.extractErrorMessage(err)
          });
        }
      })
    );
  }

  s3Env(item: BackupListItem): string {
    const path = item.path || "";
    const idx = path.indexOf("//");
    const after = idx >= 0 ? path.substring(idx + 2) : path;
    const parts = after.split("/");
    return parts[1] || "";
  }

  s3Db(item: BackupListItem): string {
    const path = item.path || "";
    const idx = path.indexOf("//");
    const after = idx >= 0 ? path.substring(idx + 2) : path;
    const parts = after.split("/");
    return parts[2] || "";
  }

  s3Date(item: BackupListItem): string {
    if (item.timestamp) {
      return this.dateUtils.displayDateAndTime(item.timestamp as any);
    }
    const path = item.path || "";
    const folder = path.split("/").pop() || "";
    const token = folder.split("-")[0];
    return token.replace("-", "/").replace("-", "/");
  }

  backupSearch(term: string, item: BackupListItem): boolean {
    const q = (term || "").toLowerCase();
    if (!q) return true;
    const parts = [
      item.name || "",
      item.path || "",
      this.s3Env(item) || "",
      this.s3Db(item) || "",
      this.s3Date(item) || ""
    ].join(" ").toLowerCase();
    return parts.indexOf(q) >= 0;
  }

  onSourceEnvironmentChange(value: string) {
    this.sourceEnvironment = value || "";
    this.selectedBackupForRestore = null;
    this.selectedRestoreCollections = [];
    this.restoreRequest.collections = undefined as any;
    this.applyBackupFilter();
  }

  private applyBackupFilter() {
    if (this.sourceEnvironment) {
      this.backups = this.allBackups.filter(b => this.envOf(b) === this.sourceEnvironment);
    } else {
      this.backups = [...this.allBackups];
    }
  }

  restoreButtonLabel(): string {
    const count = this.selectedRestoreCollections.length;
    return count > 0 ? `Start Restore of ${this.stringUtils.pluraliseWithCount(count, "collection")}` : "Start Restore of all collections";
  }

  private envOf(item: BackupListItem): string {
    const path = item.path || "";
    const isS3 = path.startsWith("s3://");
    if (isS3) {
      return this.s3Env(item);
    }
    const anyItem = item as any;
    if (anyItem.environment) {
      return anyItem.environment as string;
    }
    const name = item.name || "";
    if (name.length > 20) {
      const remainder = name.slice(20);
      const db: string | undefined = anyItem.database;
      if (db && remainder.endsWith(`-${db}`)) {
        return remainder.slice(0, remainder.length - (db.length + 1));
      }
    }
    return "";
  }
}
