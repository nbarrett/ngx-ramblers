import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { CommonModule, DatePipe, DOCUMENT } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom, interval, Subscription } from "rxjs";
import { switchMap } from "rxjs/operators";
import { isNumber, isString, isUndefined, kebabCase } from "es-toolkit/compat";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faChartBar,
  faChevronDown,
  faChevronUp,
  faExclamationTriangle,
  faFileLines,
  faRotateLeft,
  faSpinner,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { PageComponent } from "../../../page/page.component";
import { EnvironmentSettings } from "../../../modules/common/environment-settings/environment-settings";
import { EnvironmentConfigService } from "../../../services/environment-config.service";
import {
  BackupListItem,
  BackupLocation,
  BackupRequest,
  BackupRestoreTab,
  BackupSession,
  BackupSessionHistoryRow,
  BackupSessionStatus,
  BackupSessionTrigger,
  BackupSessionType,
  EnvironmentInfo,
  RestoreRequest,
  S3BackupManifest,
  S3BackupSummary,
  S3ManifestBreakdown,
  S3RestoreRequest
} from "../../../models/backup-session.model";
import { humanFileSize } from "../../../functions/file-utils";
import {
  groupEntriesByExtension,
  groupEntriesByPrefix,
  topLargestEntries
} from "../../../functions/s3-manifest-analysis";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { BackupAndRestoreService } from "../../../services/backup-and-restore.service";
import { Confirm, StoredValue } from "../../../models/ui-actions";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { EventType, MessageType } from "../../../models/websocket.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { reversed, sortBy } from "../../../functions/arrays";
import { AWS_DEFAULTS, EnvironmentsConfig } from "../../../models/environment-config.model";
import { EnvironmentSelectComponent } from "../../../modules/common/selectors/environment-select";
import { CollectionsMultiSelectComponent } from "../../../modules/common/selectors/collections-multi-select";
import { BackupsMultiSelectComponent } from "../../../modules/common/selectors/backups-multi-select";
import { BackupSelectComponent } from "../../../modules/common/selectors/backup-select";
import { backupEnvironment, backupSource, sameBackupEnvironment } from "../../../functions/backup-list-items";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import {
  SortableTableCellDirective,
  SortableTableExpandedRowDirective,
  SortableTableGroupHeaderDirective
} from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableGroup } from "../../../modules/common/sortable-table/sortable-table.model";
import { DESCENDING } from "../../../models/table-filtering.model";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";

const HISTORY_INVOCATION_GAP_MS = 15 * 60 * 1000;

@Component({
  selector: "app-backup-and-restore",
  imports: [
    CommonModule,
    FormsModule,
    TabsetComponent,
    TabDirective,
    PageComponent,
    DatePipe,
    FontAwesomeModule,
    SortableTableComponent,
    SortableTableCellDirective,
    SortableTableExpandedRowDirective,
    SortableTableGroupHeaderDirective,
    CopyIconComponent,
    EnvironmentSelectComponent,
    CollectionsMultiSelectComponent,
    BackupsMultiSelectComponent,
    BackupSelectComponent,
    EnvironmentSettings,
    TooltipDirective
  ],
  styles: [`
    .session-status
      padding: 0.25rem 0.5rem
      border-radius: 0.25rem
      font-size: 0.875rem
      font-weight: 500
      white-space: nowrap
      display: inline-block

    .session-actions .btn
      filter: grayscale(1)
      opacity: 0.65
      transition: filter 0.15s ease, opacity 0.15s ease
      padding: 0.25rem 0.5rem
      font-size: 0.75rem
      line-height: 1.2
      min-height: 0

      &:hover, &:focus-visible
        filter: none
        opacity: 1

    .session-logs-copy
      position: absolute
      top: 0.5rem
      right: 1.25rem
      color: #e2e8f0
      font-size: 1.1rem

      &:hover
        color: #ffffff

    .session-logs
      background-color: #1e293b
      color: #e2e8f0
      padding: 1rem
      border-radius: 0.375rem
      font-family: monospace
      font-size: 0.875rem
      max-height: 400px
      max-width: 100%
      overflow-y: auto
      overflow-x: hidden
      white-space: pre-wrap
      word-break: break-word
      overflow-wrap: anywhere

      div
        margin-bottom: 0.25rem
        white-space: pre-wrap
        word-break: break-word
        overflow-wrap: anywhere

    .manifest-analysis-header
      min-height: 5.5rem
      margin-bottom: 0.5rem

    .manifest-analysis-header-full
      min-height: 0

  `],
  template: `
    <app-page autoTitle pageTitle="Backup & Restore">
      <div class="row">
        <div class="col-sm-12">
          @if (!enabled) {
            <div class="alert alert-warning d-flex align-items-center gap-2">
              <fa-icon [icon]="faExclamationTriangle" size="lg"/>
              <span><strong>Not Available</strong> — Backup & Restore is not available on this environment. Please use the CLI or staging environment.</span>
            </div>
          } @else {
          <tabset class="custom-tabset">
            <tab [active]="tabActive(BackupRestoreTab.BACKUP)"
                 (selectTab)="selectTab(BackupRestoreTab.BACKUP)"
                 [heading]="BackupRestoreTab.BACKUP">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row thumbnail-heading-frame">
                  <div class="thumbnail-heading">Backup</div>
                  <form (ngSubmit)="startBackup()" autocomplete="off">
                    <div class="mb-3">
                      <app-environment-select
                        label="Environments"
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
                    </div>
                    <div class="mb-3">
                      <app-collections-multi-select
                        label="Collections (optional)"
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
                            [disabled]="selectedEnvironments.length === 0 || backupBusy">
                      @if (backupBusy) {
                        <fa-icon [icon]="faSpinner" animation="spin"/> Starting backups
                      } @else {
                        Start Backup
                      }
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
                             [value]="BackupLocation.S3"
                             [(ngModel)]="backupSource" (ngModelChange)="onBackupSourceChange($event)"
                             checked>
                      <label class="form-check-label" for="sourceS3">S3</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="radio" id="sourceLocal"
                             name="backupSource"
                             [value]="BackupLocation.LOCAL"
                             [(ngModel)]="backupSource" (ngModelChange)="onBackupSourceChange($event)">
                      <label class="form-check-label" for="sourceLocal">Local</label>
                    </div>
                  </div>
                  <form (ngSubmit)="startRestore()" autocomplete="off">
                    <div class="mb-3">
                      <app-environment-select
                        label="Target Environment"
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
                      <app-environment-select
                        label="Source Environment"
                        [items]="environmentsWithMongo"
                        [(selectedName)]="sourceEnvironment"
                        (selectedNameChange)="onSourceEnvironmentChange($event)"
                        placeholder="Filter backups by source..."></app-environment-select>
                    </div>
                    <div class="mb-3">
                      <app-backup-select
                        label="Backup to Restore"
                        [items]="backups"
                        [selected]="selectedBackupForRestore"
                        [source]="backupSource"
                        (selectedChange)="onBackupForRestoreChange($event)"
                        name="backupForRestore"
                        placeholder="Select backup..."
                        emptySummary="Select a backup before restoring."></app-backup-select>
                      @if (backups.length === 0) {
                        <small class="form-text">No backups available.</small>
                      }
                    </div>
                    <div class="mb-3">
                      <app-collections-multi-select
                        label="Collections (optional)"
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
                    <div class="mb-3 form-check">
                      <input type="checkbox" class="form-check-input"
                             [ngModel]="restoreRequest.includeS3 !== false"
                             (ngModelChange)="restoreRequest.includeS3 = $event"
                             name="restoreIncludeS3"
                             id="restoreIncludeS3">
                      <label class="form-check-label" for="restoreIncludeS3">
                        Also restore S3 objects for this environment
                      </label>
                      <small class="form-text text-muted d-block">
                        Uncheck to restore only the Mongo database. Leave unchecked if the target environment shares an S3 bucket with another environment and you don't want to overwrite its live objects.
                      </small>
                    </div>
                    <button type="submit" class="btn btn-warning"
                            [disabled]="!restoreRequest.environment || !selectedBackupForRestore">
                      {{ restoreButtonLabel() }}
                    </button>
                  </form>
                  <div class="mt-4">
                    <button type="button" class="btn btn-sm btn-warning"
                            (click)="manageStoredBackupsOpen = !manageStoredBackupsOpen">
                      <fa-icon [icon]="manageStoredBackupsOpen ? faChevronUp : faChevronDown" class="me-1"></fa-icon>
                      Manage stored backups
                    </button>
                    @if (manageStoredBackupsOpen) {
                      <div class="mt-2 p-3 bg-light border rounded">
                        <div class="small text-muted mb-2">
                          Bulk-select and delete old Mongo backup files from S3 and local storage. Use this to prune stale snapshots that are no longer needed.
                        </div>
                        <div class="mb-3">
                          <app-backups-multi-select
                            [items]="backups"
                            [(selected)]="selectedBackups">
                          </app-backups-multi-select>
                          @if (selectedBackups.length > 0) {
                            <small class="form-text">{{ stringUtils.pluraliseWithCount(selectedBackups.length, 'backup') }} selected</small>
                          }
                        </div>
                        @if (selectedBackups.length > 0) {
                          <div class="d-flex gap-2">
                            @if (backupDeleteConfirm.deleteConfirmOutstanding()) {
                              <button type="button" class="btn btn-danger"
                                      (click)="confirmDeleteSelectedBackups()">
                                <fa-icon [icon]="faTrash"></fa-icon>
                                Confirm delete of {{ selectedBackups.length }} backup(s)
                              </button>
                              <button type="button" class="btn btn-secondary"
                                      (click)="backupDeleteConfirm.clear()">
                                Cancel
                              </button>
                            } @else {
                              <button type="button" class="btn btn-danger"
                                      (click)="deleteSelectedBackups()">
                                <fa-icon [icon]="faTrash"></fa-icon>
                                Delete {{ selectedBackups.length }} Backup(s)
                              </button>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
            </tab>
            <tab [active]="tabActive(BackupRestoreTab.HISTORY)"
                 (selectTab)="selectTab(BackupRestoreTab.HISTORY)"
                 [heading]="BackupRestoreTab.HISTORY">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row thumbnail-heading-frame">
                  <div class="thumbnail-heading">Backup/Restore History</div>
                  <div class="mb-3 row g-3 align-items-start">
                    <div class="col-md-6">
                      <app-environment-select
                        label="Environments"
                        [items]="environmentsWithMongo"
                        [multiple]="true"
                        [showSelectAllHeader]="true"
                        [(selected)]="historyFilterEnvironments"
                        (selectedChange)="onHistoryFilterChange($event)"></app-environment-select>
                      <small class="form-text text-muted">
                        @if (historyFilterEnvironments.length === 0) {
                          No filter applied — showing sessions for all environments.
                        } @else {
                          Filtered to {{ historyFilterEnvironments.length }} of {{ environmentsWithMongo.length }} environments.
                        }
                      </small>
                    </div>
                    <div class="col-md-3">
                      <label class="form-label" for="history-trigger-filter">Triggered by</label>
                      <select id="history-trigger-filter" class="form-select" [(ngModel)]="historyFilterTrigger"
                              (ngModelChange)="onHistoryFilterControlsChange()">
                        <option [ngValue]="null">All triggers</option>
                        @for (trigger of historyTriggerOptions(); track trigger) {
                          <option [ngValue]="trigger">{{ triggerLabel(trigger) }}</option>
                        }
                      </select>
                    </div>
                    <div class="col-md-3">
                      <label class="form-label" for="history-status-filter">Status</label>
                      <select id="history-status-filter" class="form-select" [(ngModel)]="historyFilterStatus"
                              (ngModelChange)="onHistoryFilterControlsChange()">
                        <option [ngValue]="null">All statuses</option>
                        @for (status of historyStatusOptions(); track status) {
                          <option [ngValue]="status">{{ humaniseStatus(status) }}</option>
                        }
                      </select>
                    </div>
                  </div>
                  <app-sortable-table
                    [columns]="historyColumns"
                    [rows]="historyRows"
                    [defaultSortKey]="'startedMs'"
                    [defaultSortDirection]="DESCENDING"
                    [groupBy]="historyGroupBy"
                    [collapsibleGroups]="true"
                    [expandedWhen]="historyRowExpanded"
                    [trackBy]="historyTrackBy"
                    maxHeight="70vh"
                    [emptyMessage]="sessions.length === 0 ? 'No backup or restore sessions yet.' : 'No sessions match the selected filters.'">
                    <ng-template appSortableTableGroupHeader let-group>
                      {{ groupLabel(group) }} — {{ groupStart(group) | date:'EEE d MMM yyyy, HH:mm' }}
                      <span class="text-muted fw-normal ms-2">{{ stringUtils.pluraliseWithCount(group.rows.length, "session") }}</span>
                      @if (groupStatusCount(group, BackupSessionStatus.COMPLETED); as completed) {
                        <span class="session-status fw-normal ms-2" [ngClass]="statusStyle(BackupSessionStatus.COMPLETED)">{{ completed }} completed</span>
                      }
                      @if (groupStatusCount(group, BackupSessionStatus.FAILED); as failed) {
                        <span class="session-status fw-normal ms-1" [ngClass]="statusStyle(BackupSessionStatus.FAILED)">{{ failed }} failed</span>
                      }
                      @if (groupStatusCount(group, BackupSessionStatus.IN_PROGRESS); as inProgress) {
                        <span class="session-status fw-normal ms-1" [ngClass]="statusStyle(BackupSessionStatus.IN_PROGRESS)">
                          <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>{{ inProgress }} in progress
                        </span>
                      }
                      @if (groupDuration(group); as overall) {
                        <span class="text-muted fw-normal ms-2">· overall {{ overall }}</span>
                      }
                    </ng-template>
                    <ng-template appSortableTableCell="status" let-row>
                      <span class="session-status" [ngClass]="statusStyle(row.status)"
                            container="body"
                            [tooltip]="row.error || null">
                        @if (row.status === BackupSessionStatus.IN_PROGRESS) {
                          <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                        }
                        {{ humaniseStatus(row.status) }}
                      </span>
                    </ng-template>
                    <ng-template appSortableTableCell="started" let-row>{{ row.startTime | date:'medium' }}</ng-template>
                    <ng-template appSortableTableCell="duration" let-row>
                      @if (row.endTime) {
                        {{ duration(row.startTime, row.endTime) }}
                      } @else {
                        -
                      }
                    </ng-template>
                    <ng-template appSortableTableCell="s3Objects" let-row>
                      @if (sessionS3Summaries(row).length > 0) {
                        @for (summary of sessionS3Summaries(row); track summary.site) {
                          <div class="small">
                            <span class="session-status me-1" [ngClass]="statusStyle(summary.status)"
                                  container="body"
                                  [tooltip]="summary.error || null">{{ humaniseStatus(summary.status) }}</span>
                            {{ row.type === BackupSessionType.RESTORE ? summary.copiedObjects + ' restored' : summary.copiedObjects + ' copied' }}, {{ summary.skippedObjects }} skipped, {{ formatBytes(summary.copiedSizeBytes) }}
                            @if (summary.error) {
                              <div class="text-danger">{{ summary.error }}</div>
                            }
                          </div>
                        }
                      } @else {
                        <span class="text-muted">-</span>
                      }
                    </ng-template>
                    <ng-template appSortableTableCell="actions" let-row>
                      <div class="d-inline-flex gap-1 align-items-center text-nowrap session-actions">
                        <button type="button" class="btn btn-sm btn-info"
                                container="body"
                                [tooltip]="isSessionExpanded(row) ? 'Hide logs' : 'View logs'"
                                (click)="toggleSessionLogs(row)">
                          <fa-icon [icon]="isSessionExpanded(row) ? faChevronUp : faFileLines"></fa-icon>
                        </button>
                        @if (manifestForSession(row); as manifest) {
                          @if (pendingDeleteManifest?._id === manifest._id) {
                            <button type="button" class="btn btn-sm btn-danger"
                                    (click)="confirmDelete(manifest)">Confirm
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-secondary"
                                    (click)="cancelManifestConfirmation()">Cancel
                            </button>
                          } @else {
                            <button type="button" class="btn btn-sm btn-warning"
                                    container="body"
                                    [tooltip]="isAnalysing(manifest) ? 'Hide analysis' : 'Analyse S3 snapshot contents'"
                                    (click)="toggleAnalyse(manifest)">
                              <fa-icon [icon]="isAnalysing(manifest) ? faChevronUp : faChartBar"></fa-icon>
                            </button>
                            <button type="button" class="btn btn-sm btn-danger"
                                    container="body"
                                    [tooltip]="manifest.deletable === false ? manifest.blockReason : 'Delete S3 snapshot'"
                                    [disabled]="manifest.deletable === false"
                                    (click)="requestDelete(manifest)">
                              <fa-icon [icon]="faTrash"></fa-icon>
                            </button>
                          }
                        }
                      </div>
                    </ng-template>
                    <ng-template appSortableTableExpandedRow let-row>
                      @if (isSessionExpanded(row)) {
                        @if (row.error) {
                          <div class="alert alert-danger mb-2"><strong>Error:</strong> {{ row.error }}</div>
                        }
                        <div class="position-relative">
                          <div class="session-logs">
                            @if (logsNewestFirst(row).length === 0 && row.status === BackupSessionStatus.IN_PROGRESS) {
                              <div><fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>Waiting for log output...</div>
                            }
                            @for (log of logsNewestFirst(row); track $index) {
                              <div>{{ log }}</div>
                            }
                          </div>
                          <div class="session-logs-copy">
                            <app-copy-icon [value]="sessionLogsText(row)" elementName="session logs"/>
                          </div>
                        </div>
                      }
                      @if (manifestForSession(row); as manifest) {
                        @if (isAnalysing(manifest)) {
                          <div class="manifest-analysis">
                                    @if (!isAnalysisLoaded(manifest)) {
                                      <div class="d-flex align-items-center text-muted">
                                        <fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>
                                        Loading manifest entries...
                                      </div>
                                    } @else {
                                    <div class="row g-3">
                                      <div class="col-md-6">
                                        <div class="manifest-analysis-section">
                                          <div class="manifest-analysis-header">
                                            <div class="fw-bold mb-1">Breakdown by top-level prefix</div>
                                            <div class="small text-muted">Bytes per top-level folder.</div>
                                          </div>
                                          <table class="table table-sm table-striped table-bordered mb-0">
                                            <thead class="table-light">
                                            <tr>
                                              <th>Prefix</th>
                                              <th class="text-end">Count</th>
                                              <th class="text-end">Size</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                              @for (bucket of prefixBreakdown(manifest); track bucket.label) {
                                                <tr>
                                                  <td>{{ bucket.label }}</td>
                                                  <td class="text-end">{{ bucket.count }}</td>
                                                  <td class="text-end">{{ formatBytes(bucket.bytes) }}</td>
                                                </tr>
                                              }
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                      <div class="col-md-6">
                                        <div class="manifest-analysis-section">
                                          <div class="manifest-analysis-header">
                                            <div class="fw-bold mb-1">Breakdown by file extension</div>
                                            <div class="small text-muted">Bytes per file type.</div>
                                          </div>
                                          <table class="table table-sm table-striped table-bordered mb-0">
                                            <thead class="table-light">
                                            <tr>
                                              <th>Extension</th>
                                              <th class="text-end">Count</th>
                                              <th class="text-end">Size</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                              @for (bucket of extensionBreakdown(manifest); track bucket.label) {
                                                <tr>
                                                  <td>{{ bucket.label }}</td>
                                                  <td class="text-end">{{ bucket.count }}</td>
                                                  <td class="text-end">{{ formatBytes(bucket.bytes) }}</td>
                                                </tr>
                                              }
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                      <div class="col-12">
                                        <div class="manifest-analysis-section">
                                          <div class="manifest-analysis-header manifest-analysis-header-full">
                                            <div class="fw-bold mb-1">Top 20 largest objects</div>
                                            <div class="small text-muted">Largest individual files in this snapshot.</div>
                                          </div>
                                          <table class="table table-sm table-striped table-bordered mb-0">
                                            <thead class="table-light">
                                            <tr>
                                              <th class="text-end" style="width: 8rem;">Size</th>
                                              <th>Key</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                              @for (entry of topEntries(manifest); track entry.key) {
                                                <tr>
                                                  <td class="text-end">{{ formatBytes(entry.size) }}</td>
                                                  <td class="font-monospace small text-break">{{ entry.key }}</td>
                                                </tr>
                                              }
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </div>
                            }
                          </div>
                        }
                      }
                    </ng-template>
                  </app-sortable-table>

                </div>
              </div>
            </tab>

            <tab [active]="tabActive(BackupRestoreTab.SETTINGS)"
                 (selectTab)="selectTab(BackupRestoreTab.SETTINGS)"
                 [heading]="BackupRestoreTab.SETTINGS">
              @if (tabActive(BackupRestoreTab.SETTINGS)) {
                <div class="img-thumbnail thumbnail-admin-edit">
                  <app-environment-settings/>
                </div>
              }
            </tab>
          </tabset>
          }
        </div>
      </div>
    </app-page>
  `
})
export class BackupAndRestore implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("BackupAndRestore", NgxLoggerLevel.ERROR);
  private backupRestoreService = inject(BackupAndRestoreService);
  private environmentConfigService = inject(EnvironmentConfigService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private notifierService = inject(NotifierService);
  private websocketService = inject(WebSocketClientService);
  stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private pendingScrollToExpanded = false;
  private subscriptions: Subscription[] = [];
  private refreshSubscription: Subscription | null = null;
  private tab: BackupRestoreTab = BackupRestoreTab.BACKUP;
  private wsConnected = false;

  protected readonly BackupRestoreTab = BackupRestoreTab;
  protected readonly BackupLocation = BackupLocation;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faTrash = faTrash;
  protected readonly faSpinner = faSpinner;
  protected readonly faChartBar = faChartBar;
  protected readonly faChevronUp = faChevronUp;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faFileLines = faFileLines;
  protected readonly faRotateLeft = faRotateLeft;
  protected readonly DESCENDING = DESCENDING;
  protected readonly historyColumns: SortableTableColumn<BackupSessionHistoryRow>[] = [
    { key: "type", label: "Type", sortKey: "type", cellGetter: row => row.type, cellClass: "text-nowrap" },
    { key: "environment", label: "Environment", sortKey: "environment", cellGetter: row => row.environment },
    { key: "status", label: "Status", sortKey: "status", cellClass: "text-nowrap" },
    { key: "started", label: "Started", sortKey: "startedMs" },
    { key: "duration", label: "Duration", sortKey: "durationMs", cellClass: "text-nowrap" },
    { key: "s3Objects", label: "S3 Objects" },
    { key: "actions", label: "Actions" }
  ];

  enabled = false;

  notifyTarget: AlertTarget = {};
  notify = this.notifierService.createAlertInstance(this.notifyTarget);

  environments: EnvironmentInfo[] = [];
  environmentsWithMongo: EnvironmentInfo[] = [];
  selectedEnvironments: EnvironmentInfo[] = [];
  backups: BackupListItem[] = [];
  selectedBackups: BackupListItem[] = [];
  backupDeleteConfirm = new Confirm();
  allBackups: BackupListItem[] = [];
  selectedBackupForRestore: BackupListItem | null = null;
  backupSource: BackupLocation = BackupLocation.S3;
  sourceEnvironment = "";
  sessions: BackupSession[] = [];
  selectedSession?: BackupSession;
  expandedSessionIds: string[] = [];
  availableCollections: string[] = [];
  selectedCollections: string[] = [];
  backupBusy = false;
  restoreAvailableCollections: string[] = [];
  selectedRestoreCollections: string[] = [];
  editableConfig: EnvironmentsConfig = {
    environments: [],
    aws: {bucket: "", region: AWS_DEFAULTS.REGION},
    secrets: {}
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

  s3Sites: string[] = [];
  s3Manifests: S3BackupManifest[] = [];
  s3ManifestFilterSite: string | null = null;
  s3RestoreInProgress = false;
  pendingRestoreManifest: S3BackupManifest | undefined;
  pendingDeleteManifest: S3BackupManifest | undefined;
  historyFilterEnvironments: EnvironmentInfo[] = [];
  historyFilterStatus: BackupSessionStatus | null = null;
  historyFilterTrigger: BackupSessionTrigger | null = null;
  private historyEnvironmentNamesFromUrl: string[] = [];
  historyRows: BackupSessionHistoryRow[] = [];
  analysingManifestIds: Set<string> = new Set<string>();
  fullManifestsById: Map<string, S3BackupManifest> = new Map<string, S3BackupManifest>();
  manageStoredBackupsOpen = false;
  protected readonly BackupSessionStatus = BackupSessionStatus;
  protected readonly BackupSessionType = BackupSessionType;

  private sessionTrigger(session: BackupSession): BackupSessionTrigger {
    return session.metadata?.triggeredBy || BackupSessionTrigger.WEB;
  }

  private filteredSessions(): BackupSession[] {
    const selectedNames = new Set(this.historyFilterEnvironments.map(environment => environment.name));
    return this.sessions
      .filter(session => selectedNames.size === 0 || selectedNames.has(session.environment))
      .filter(session => !this.historyFilterStatus || session.status === this.historyFilterStatus)
      .filter(session => !this.historyFilterTrigger || this.sessionTrigger(session) === this.historyFilterTrigger);
  }

  historyStatusOptions(): BackupSessionStatus[] {
    const present = new Set(this.sessions.map(session => session.status));
    return [
      BackupSessionStatus.COMPLETED,
      BackupSessionStatus.FAILED,
      BackupSessionStatus.IN_PROGRESS,
      BackupSessionStatus.PENDING
    ].filter(status => present.has(status));
  }

  historyTriggerOptions(): BackupSessionTrigger[] {
    const present = new Set(this.sessions.map(session => this.sessionTrigger(session)));
    return [
      BackupSessionTrigger.SCHEDULED,
      BackupSessionTrigger.WEB,
      BackupSessionTrigger.CLI
    ].filter(trigger => present.has(trigger));
  }

  triggerLabel(trigger: BackupSessionTrigger): string {
    if (trigger === BackupSessionTrigger.SCHEDULED) {
      return "Scheduled task";
    } else if (trigger === BackupSessionTrigger.CLI) {
      return "CLI";
    } else {
      return "Manual";
    }
  }

  private timeValue(time: Date | number | undefined): number {
    if (isUndefined(time)) {
      return 0;
    }
    return isNumber(time) ? time : this.dateUtils.asDateTime(time).toMillis();
  }

  refreshHistoryRows() {
    const enriched = this.filteredSessions().map(session => ({
      ...session,
      startedMs: this.timeValue(session.startTime),
      durationMs: session.endTime ? this.timeValue(session.endTime) - this.timeValue(session.startTime) : -1,
      historyGroupKey: ""
    }));
    const byTrigger = enriched.reduce((groups, row) => {
      const trigger = this.sessionTrigger(row);
      groups.set(trigger, [...(groups.get(trigger) || []), row]);
      return groups;
    }, new Map<BackupSessionTrigger, BackupSessionHistoryRow[]>());
    byTrigger.forEach((rows, trigger) => this.assignInvocationChunks(rows, trigger));
    this.historyRows = enriched;
  }

  private assignInvocationChunks(rows: BackupSessionHistoryRow[], trigger: BackupSessionTrigger) {
    [...rows]
      .sort((first, second) => first.startedMs - second.startedMs)
      .reduce((state, row) => {
        const end = row.endTime ? this.timeValue(row.endTime) : row.startedMs;
        const newChunk = state.anchor === 0 || row.startedMs - state.latestEnd > HISTORY_INVOCATION_GAP_MS;
        const anchor = newChunk ? row.startedMs : state.anchor;
        row.historyGroupKey = `${trigger}|${anchor}`;
        return { anchor, latestEnd: newChunk ? end : Math.max(state.latestEnd, end) };
      }, { anchor: 0, latestEnd: 0 });
  }

  historyGroupBy = (row: BackupSessionHistoryRow): string => row.historyGroupKey;

  historyRowExpanded = (row: BackupSessionHistoryRow): boolean => {
    const manifest = this.manifestForSession(row);
    return this.isSessionExpanded(row) || (!!manifest && this.isAnalysing(manifest));
  };

  historyTrackBy = (index: number, row: BackupSessionHistoryRow) => row._id || index;

  groupLabel(group: SortableTableGroup<BackupSessionHistoryRow>): string {
    return this.triggerLabel(this.sessionTrigger(group.rows[0]));
  }

  groupStart(group: SortableTableGroup<BackupSessionHistoryRow>): number {
    return Math.min(...group.rows.map(row => row.startedMs));
  }

  groupDuration(group: SortableTableGroup<BackupSessionHistoryRow>): string {
    const earliestStart = Math.min(...group.rows.map(row => row.startedMs));
    const endTimes = group.rows.filter(row => row.endTime).map(row => this.timeValue(row.endTime));
    const anyInProgress = group.rows.some(row => row.status === BackupSessionStatus.IN_PROGRESS);
    if (anyInProgress) {
      return `${this.duration(earliestStart, this.dateUtils.dateTimeNow().toMillis())} so far`;
    } else if (endTimes.length > 0) {
      return this.duration(earliestStart, Math.max(...endTimes));
    } else {
      return "";
    }
  }

  groupStatusCount(group: SortableTableGroup<BackupSessionHistoryRow>, status: BackupSessionStatus): number {
    return group.rows.filter(row => row.status === status).length;
  }

  manifestForSession(session: BackupSession): S3BackupManifest | undefined {
    if (session.type !== BackupSessionType.BACKUP) {
      return undefined;
    }
    const timestampMatch = session.sessionId?.match(/^backup-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})-/);
    if (!timestampMatch) {
      return undefined;
    }
    const timestamp = timestampMatch[1];
    return this.s3Manifests.find(manifest =>
      manifest.site === session.environment && manifest.mongoTimestamp === timestamp
    );
  }

  onHistoryFilterChange(selected: EnvironmentInfo[]) {
    this.historyFilterEnvironments = selected || [];
    this.loadSessions();
    this.loadS3Manifests();
    this.refreshHistoryRows();
    this.updateHistoryFilterQueryParams();
  }

  onHistoryFilterControlsChange() {
    this.refreshHistoryRows();
    this.updateHistoryFilterQueryParams();
  }

  private applyHistoryFiltersFrom(params: Params) {
    const environmentsParameter: string = params[StoredValue.ENVIRONMENTS] || "";
    this.historyEnvironmentNamesFromUrl = environmentsParameter.split(",").filter(name => name.length > 0);
    this.historyFilterStatus = [
      BackupSessionStatus.COMPLETED,
      BackupSessionStatus.FAILED,
      BackupSessionStatus.IN_PROGRESS,
      BackupSessionStatus.PENDING
    ].find(status => status === params[StoredValue.STATUS]) || null;
    this.historyFilterTrigger = [BackupSessionTrigger.SCHEDULED, BackupSessionTrigger.WEB, BackupSessionTrigger.CLI]
      .find(trigger => trigger === params[StoredValue.TRIGGERED_BY]) || null;
    const expandedParameter: string = params[StoredValue.EXPANDED_SESSIONS];
    if (expandedParameter) {
      this.expandedSessionIds = expandedParameter.split(",").filter(id => id.length > 0);
      this.pendingScrollToExpanded = true;
      this.loadLogsForExpandedSessions();
    }
    this.syncHistoryFilterEnvironmentsFromUrl();
    this.refreshHistoryRows();
  }

  private syncHistoryFilterEnvironmentsFromUrl() {
    if (this.environmentsWithMongo.length > 0) {
      this.historyFilterEnvironments = this.environmentsWithMongo
        .filter(environment => this.historyEnvironmentNamesFromUrl.includes(environment.name));
    }
  }

  private updateHistoryFilterQueryParams() {
    this.router.navigate([], {
      queryParams: {
        [StoredValue.ENVIRONMENTS]: this.historyFilterEnvironments.length > 0
          ? this.historyFilterEnvironments.map(environment => environment.name).join(",")
          : null,
        [StoredValue.TRIGGERED_BY]: this.historyFilterTrigger,
        [StoredValue.STATUS]: this.historyFilterStatus,
        [StoredValue.EXPANDED_SESSIONS]: this.expandedSessionIds.length > 0 ? this.expandedSessionIds.join(",") : null
      },
      queryParamsHandling: "merge"
    });
  }

  private scrollToFirstExpandedSession() {
    if (this.pendingScrollToExpanded && this.expandedSessionIds.length > 0) {
      this.pendingScrollToExpanded = false;
      this.attemptScrollToExpandedRow(0);
    }
  }

  private attemptScrollToExpandedRow(attempt: number) {
    setTimeout(() => {
      const row = this.document.querySelector(".sortable-table-expanded-row");
      const viewportHeight = this.document.defaultView?.innerHeight || 0;
      const top = row?.getBoundingClientRect().top;
      const inView = !isUndefined(top) && top >= 0 && top < viewportHeight;
      if (row && !inView) {
        row.scrollIntoView({behavior: "auto", block: "center"});
      }
      if (!inView && attempt < 8) {
        this.attemptScrollToExpandedRow(attempt + 1);
      }
    }, 250);
  }

  private loadLogsForExpandedSessions() {
    this.expandedSessionIds
      .filter(id => this.sessions.some(session => (session._id || session.sessionId) === id && !session.logs))
      .forEach(id => this.loadSessionLogs(id));
  }

  private loadSessionLogs(id: string) {
    this.subscriptions.push(
      this.backupRestoreService.session(id).subscribe(s => {
        const i = this.sessions.findIndex(x => (x._id || x.sessionId) === id);
        if (i >= 0) {
          this.sessions[i] = s;
          this.refreshHistoryRows();
        }
      })
    );
  }

  toggleAnalyse(manifest: S3BackupManifest) {
    if (!manifest._id) {
      return;
    }
    const id = manifest._id;
    if (this.analysingManifestIds.has(id)) {
      this.analysingManifestIds.delete(id);
      return;
    }
    this.analysingManifestIds.add(id);
    if (!this.fullManifestsById.has(id)) {
      this.subscriptions.push(
        this.backupRestoreService.s3Manifest(id).subscribe({
          next: full => {
            this.fullManifestsById.set(id, full);
          },
          error: err => {
            this.analysingManifestIds.delete(id);
            this.notify.error({
              title: "Analyse Failed",
              message: this.extractErrorMessage(err)
            });
          }
        })
      );
    }
  }

  isAnalysing(manifest: S3BackupManifest): boolean {
    return !!manifest._id && this.analysingManifestIds.has(manifest._id);
  }

  isAnalysisLoaded(manifest: S3BackupManifest): boolean {
    return !!manifest._id && this.fullManifestsById.has(manifest._id);
  }

  prefixBreakdown(manifest: S3BackupManifest): S3ManifestBreakdown[] {
    const full = manifest._id ? this.fullManifestsById.get(manifest._id) : undefined;
    return groupEntriesByPrefix(full?.entries || [], 1);
  }

  extensionBreakdown(manifest: S3BackupManifest): S3ManifestBreakdown[] {
    const full = manifest._id ? this.fullManifestsById.get(manifest._id) : undefined;
    return groupEntriesByExtension(full?.entries || []);
  }

  topEntries(manifest: S3BackupManifest) {
    const full = manifest._id ? this.fullManifestsById.get(manifest._id) : undefined;
    return topLargestEntries(full?.entries || [], 20);
  }

  statusStyle(status: string) {
    if (status === BackupSessionStatus.COMPLETED) return "text-style-mintcake";
    if (status === BackupSessionStatus.FAILED) return "text-style-sunset";
    return "text-style-sunrise";
  }

  humaniseStatus(status: string): string {
    return this.stringUtils.asTitle(status);
  }

  async ngOnInit() {
    try {
      const status = await this.environmentSetupService.status();
      this.enabled = status.enabled;
    } catch {
      this.enabled = false;
    }
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const defaultValue = kebabCase(BackupRestoreTab.BACKUP);
      const tabParameter = params[StoredValue.TAB];
      this.tab = tabParameter || defaultValue;
      this.logger.info("received tab value of:", tabParameter, "defaultValue:", defaultValue);
      this.handleTabChange(this.tab);
      this.applyHistoryFiltersFrom(params);
    }));
    if (this.enabled) {
      this.loadEnvironments();
      this.loadBackups();
      this.loadSessions();
      this.loadConfig();
      this.loadS3Sites();
      this.loadS3Manifests();
      await this.connectWebSocket();
    }
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

      this.subscriptions.push(
        this.websocketService.receiveMessages<{manifest: S3BackupManifest}>(MessageType.BACKUP_MANIFEST_CREATED).subscribe(data => {
          this.handleManifestCreated(data.manifest);
        })
      );

      this.subscriptions.push(
        this.websocketService.receiveMessages<{id: string}>(MessageType.BACKUP_MANIFEST_DELETED).subscribe(data => {
          this.handleManifestDeleted(data.id);
        })
      );

      this.subscriptions.push(
        this.websocketService.receiveMessages<{session: BackupSession}>(MessageType.BACKUP_SESSION_UPDATED).subscribe(data => {
          this.handleSessionUpdated(data.session);
        })
      );

      this.websocketService.sendMessage(EventType.BACKUP_EVENTS, {});
    } catch (error) {
      this.logger.error("Failed to connect WebSocket:", error);
      this.wsConnected = false;
    }
  }

  private handleManifestCreated(manifest: S3BackupManifest) {
    if (!manifest?._id) {
      return;
    }
    const existingIndex = this.s3Manifests.findIndex(existing => existing._id === manifest._id);
    if (existingIndex >= 0) {
      this.s3Manifests[existingIndex] = manifest;
    } else {
      this.s3Manifests = [manifest, ...this.s3Manifests];
    }
  }

  private handleManifestDeleted(id: string) {
    this.s3Manifests = this.s3Manifests.filter(manifest => manifest._id !== id);
    this.fullManifestsById.delete(id);
    this.analysingManifestIds.delete(id);
  }

  private handleSessionUpdated(session: BackupSession) {
    if (!session?._id) {
      return;
    }
    const existingIndex = this.sessions.findIndex(existing => existing._id === session._id);
    if (existingIndex >= 0) {
      this.sessions = [
        ...this.sessions.slice(0, existingIndex),
        session,
        ...this.sessions.slice(existingIndex + 1)
      ];
    } else {
      this.sessions = [session, ...this.sessions];
    }
    this.ensureInProgressExpanded(this.sessions);
    this.refreshHistoryRows();
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
    if (data.status === BackupSessionStatus.COMPLETED) {
      this.notify.success({
        title: "Operation Completed",
        message: `${data.sessionId} completed successfully`
      });
    } else if (data.status === BackupSessionStatus.FAILED) {
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
    return reversed(session?.logs);
  }

  sessionLogsText(session: BackupSession): string {
    return this.logsNewestFirst(session).join("\n");
  }

  private ensureInProgressExpanded(sessions: BackupSession[]) {
    if (!sessions || sessions.length === 0) return;
    if (this.expandedSessionIds.length > 0) return;
    const running = sessions.find(s => s.status === BackupSessionStatus.IN_PROGRESS);
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
      this.loadS3Manifests();
    } else {
      this.stopAutoRefresh();
    }
  }

  startAutoRefresh() {
    // Event-driven via WebSocket (see connectWebSocket + BACKUP_EVENTS subscription).
    // This method is kept as a no-op so callers can still request "refresh while on History tab"
    // semantics without re-introducing HTTP polling.
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
          this.environmentsWithMongo = envs.filter(environment => environment.hasMongoConfig);
          this.logger.info("Loaded environments:", envs);
          if (this.historyEnvironmentNamesFromUrl.length > 0) {
            this.syncHistoryFilterEnvironmentsFromUrl();
            this.loadSessions();
            this.refreshHistoryRows();
          }
        },
        error: err => this.notify.error({
          title: "Error loading environments",
          message: err.message
        })
      })
    );
  }

  loadBackups() {
    const requestedSource = this.backupSource;
    this.subscriptions.push(
      (requestedSource === BackupLocation.S3 ? this.backupRestoreService.listS3Backups() : this.backupRestoreService.listBackups()).subscribe({
        next: backups => {
          if (this.backupSource === requestedSource) {
            this.allBackups = backups.map(backup => ({...backup, location: backup.location || requestedSource})).sort(sortBy("-timestamp", "name"));
            this.applyBackupFilter();
            this.logger.info("Loaded backups:", backups);
          }
        },
        error: err => this.notify.error({
          title: "Error loading backups",
          message: err.message
        })
      })
    );
  }

  onBackupSourceChange(source: BackupLocation) {
    this.backupSource = source;
    this.selectedBackupForRestore = null;
    this.selectedBackups = [];
    this.selectedRestoreCollections = [];
    this.restoreRequest.collections = undefined as any;
    this.loadBackups();
  }

  loadSessions() {
    const environmentNames = this.historyFilterEnvironments.map(environment => environment.name);
    this.subscriptions.push(
      this.backupRestoreService.listSessions(50, environmentNames).subscribe({
        next: sessions => {
          this.sessions = sessions;
          this.logger.info("Loaded sessions:", sessions);
          this.ensureInProgressExpanded(sessions);
          this.loadLogsForExpandedSessions();
          this.refreshHistoryRows();
          this.scrollToFirstExpandedSession();
        },
        error: err => this.notify.error({
          title: "Error loading sessions",
          message: err.message
        })
      })
    );
  }

  private backupRequestFor(env: EnvironmentInfo): BackupRequest {
    const request: BackupRequest = {
      environment: env.name,
      scaleDown: this.backupRequest.scaleDown,
      upload: this.backupRequest.upload
    };
    if (this.selectedCollections.length > 0) {
      request.collections = this.selectedCollections;
    }
    return request;
  }

  private async startBackupForEnvironment(env: EnvironmentInfo): Promise<void> {
    const session = await firstValueFrom(this.backupRestoreService.startBackup(this.backupRequestFor(env)));
    this.notify.success({
      title: "Backup Started",
      message: `Backup for ${env.name} started: ${session.sessionId}`
    });
    this.loadSessions();

    if (this.wsConnected && session._id) {
      this.websocketService.sendMessage(EventType.BACKUP_RESTORE, { sessionId: session._id });
    }
  }

  async startBackup(): Promise<void> {
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
    this.backupBusy = true;
    const failures: string[] = [];
    try {
      for (const env of this.selectedEnvironments) {
        try {
          await this.startBackupForEnvironment(env);
        } catch (err: any) {
          const errorMessage = this.extractErrorMessage(err);
          failures.push(`${env.name}: ${errorMessage}`);
          this.logger.error("Backup error:", err);
        }
      }
      if (failures.length > 0) {
        this.notify.error({
          title: "Error Starting Backup",
          message: failures.join("; ")
        });
      }
    } finally {
      this.backupBusy = false;
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
      this.loadSessionLogs(id);
    }
    this.updateHistoryFilterQueryParams();
  }

  isSessionExpanded(session: BackupSession): boolean {
    const id = session._id || session.sessionId;
    return this.expandedSessionIds.indexOf(id) >= 0;
  }

  duration(start: Date | number, end: Date | number): string {
    const startTime = isNumber(start) ? start : this.dateUtils.asDateTime(start).toMillis();
    const endTime = isNumber(end) ? end : this.dateUtils.asDateTime(end).toMillis();
    const durationMs = endTime - startTime;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    } else {
      return `${minutes}m ${remainingSeconds}s`;
    }
  }

  loadConfig() {
    this.subscriptions.push(
      this.environmentConfigService.events().subscribe({
        next: config => {
          this.populateFormFromConfig(config);
        },
        error: err => {
          this.logger.error("Error loading config:", err);
        }
      })
    );
  }

  private populateFormFromConfig(config: EnvironmentsConfig) {
    this.editableConfig = JSON.parse(JSON.stringify(config));
    if (!this.editableConfig.environments) {
      this.editableConfig.environments = [];
    }

    if (!this.editableConfig.aws) {
      this.editableConfig.aws = {bucket: "", region: AWS_DEFAULTS.REGION} as any;
    }

    if (!this.editableConfig.secrets) {
      this.editableConfig.secrets = {};
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
    this.backupDeleteConfirm.toggleOnDeleteConfirm();
  }

  confirmDeleteSelectedBackups() {
    this.backupDeleteConfirm.clear();
    const names = this.selectedBackups.map(b => b.name);
    const obs = this.backupSource === BackupLocation.S3
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

  onSourceEnvironmentChange(value: string) {
    this.sourceEnvironment = value || "";
    this.selectedBackupForRestore = null;
    this.selectedRestoreCollections = [];
    this.restoreRequest.collections = undefined as any;
    this.applyBackupFilter();
  }

  private applyBackupFilter() {
    const sourceBackups = this.allBackups.filter(backup => backupSource(backup, this.backupSource) === this.backupSource);
    if (this.sourceEnvironment) {
      this.backups = sourceBackups.filter(b => sameBackupEnvironment(this.envOf(b), this.sourceEnvironment));
    } else {
      this.backups = [...sourceBackups];
    }
  }

  restoreButtonLabel(): string {
    const count = this.selectedRestoreCollections.length;
    return count > 0 ? `Start Restore of ${this.stringUtils.pluraliseWithCount(count, "collection")}` : "Start Restore of all collections";
  }

  private envOf(item: BackupListItem): string {
    return backupEnvironment(item);
  }

  loadS3Sites() {
    this.subscriptions.push(
      this.backupRestoreService.listS3Sites().subscribe({
        next: sites => {
          this.s3Sites = sites;
          this.logger.info("Loaded S3 sites:", sites);
        },
        error: err => this.notify.error({
          title: "Error loading S3 sites",
          message: this.extractErrorMessage(err)
        })
      })
    );
  }

  loadS3Manifests() {
    const site = this.s3ManifestFilterSite || undefined;
    this.subscriptions.push(
      this.backupRestoreService.listS3Manifests(site, 50).subscribe({
        next: manifests => {
          this.s3Manifests = manifests;
          this.logger.info("Loaded S3 manifests:", manifests);
        },
        error: err => this.notify.error({
          title: "Error loading S3 backup history",
          message: this.extractErrorMessage(err)
        })
      })
    );
  }

  requestRestore(manifest: S3BackupManifest) {
    this.pendingRestoreManifest = manifest;
    this.pendingDeleteManifest = undefined;
  }

  requestDelete(manifest: S3BackupManifest) {
    this.pendingDeleteManifest = manifest;
    this.pendingRestoreManifest = undefined;
  }

  cancelManifestConfirmation() {
    this.pendingRestoreManifest = undefined;
    this.pendingDeleteManifest = undefined;
  }

  confirmRestore(manifest: S3BackupManifest) {
    this.pendingRestoreManifest = undefined;

    const request: S3RestoreRequest = {
      site: manifest.site,
      timestamp: manifest.timestamp
    };

    this.s3RestoreInProgress = true;

    this.subscriptions.push(
      this.backupRestoreService.startS3Restore(request).subscribe({
        next: results => {
          this.s3RestoreInProgress = false;
          const failed = results.filter(result => result.status === BackupSessionStatus.FAILED);
          if (failed.length > 0) {
            this.notify.error({
              title: "S3 Restore Failed",
              message: `${failed.length} site(s) failed to restore`
            });
          } else {
            this.notify.success({
              title: "S3 Restore Completed",
              message: `${results.length} site(s) restored successfully`
            });
          }
          this.loadS3Manifests();
        },
        error: err => {
          this.s3RestoreInProgress = false;
          this.notify.error({
            title: "S3 Restore Failed",
            message: this.extractErrorMessage(err)
          });
        }
      })
    );
  }

  confirmDelete(manifest: S3BackupManifest) {
    this.pendingDeleteManifest = undefined;
    if (!manifest._id) {
      return;
    }

    this.subscriptions.push(
      this.backupRestoreService.deleteS3Manifests([manifest._id]).subscribe({
        next: result => {
          if (result.deleted > 0) {
            this.notify.success({
              title: "Manifest Deleted",
              message: `${result.deleted} manifest(s) deleted`
            });
          }
          if (result.blocked?.length > 0) {
            this.notify.warning({
              title: "Manifest Delete Blocked",
              message: result.blocked.map(block => block.reason).join("; ")
            });
          }
          this.loadS3Manifests();
        },
        error: err => this.notify.error({
          title: "Delete Failed",
          message: this.extractErrorMessage(err)
        })
      })
    );
  }

  formatBytes(bytes: number): string {
    return humanFileSize(bytes);
  }

  sessionS3Summaries(session: BackupSession): S3BackupSummary[] {
    const stored = session.type === BackupSessionType.RESTORE ? session.s3Restores : session.s3Backups;
    if (stored && stored.length > 0) {
      return stored;
    }
    const matching = this.manifestForSession(session);
    if (!matching) {
      return [];
    }
    return [{
      site: matching.site,
      timestamp: matching.timestamp,
      totalObjects: matching.totalObjects,
      copiedObjects: matching.copiedObjects,
      skippedObjects: matching.skippedObjects,
      totalSizeBytes: matching.totalSizeBytes,
      copiedSizeBytes: matching.copiedSizeBytes,
      durationMs: matching.durationMs,
      status: matching.status
    }];
  }

  formatDurationMs(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}
