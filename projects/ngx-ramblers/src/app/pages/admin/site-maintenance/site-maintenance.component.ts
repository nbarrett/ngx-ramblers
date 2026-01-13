import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faExclamationTriangle, faCheckCircle, faSpinner, faRedo, faTools, faChevronUp, faChevronDown, faTrash } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { interval, Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { SiteMaintenanceService } from "../../../services/site-maintenance.service";
import { HealthResponse, HealthStatus } from "../../../models/health.model";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass, DatePipe } from "@angular/common";
import { DateUtilsService } from "../../../services/date-utils.service";
import { MaintenanceMigrationFile, MigrationFileStatus, MigrationSortColumn } from "../../../models/mongo-migration-model";
import { sortBy } from "../../../functions/arrays";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { isNull } from "es-toolkit/compat";

@Component({
  selector: "app-site-maintenance",
  template: `
    <app-page>
      <div class="mt-4">
        <div class="card shadow-lg">
          <div class="card-body text-center p-5">
                <fa-icon [icon]="getStatusIcon()" [ngClass]="getStatusClass()" size="4x" class="mb-4"/>
                <h1 class="mb-4">{{ getTitle() }}</h1>
                <p class="lead text-muted mb-4">{{ getDescription() }}</p>

                @if (migrationStatus && isAdmin) {
                  <div class="alert" [ngClass]="getAlertClass()" role="alert">
                    @if (migrationStatus.migrations) {
                      <div class="migration-details">
                        <div class="row text-start">
                          <div class="col-md-3">
                            <strong>Status:</strong> {{ migrationStatus.status }}
                          </div>
                          <div class="col-md-3">
                            <strong>Applied:</strong> {{ migrationStatus.migrations.applied }}
                          </div>
                          <div class="col-md-3">
                            <strong>Pending:</strong> {{ migrationStatus.migrations.pending }}
                          </div>
                          <div class="col-md-3">
                            <strong>Failed:</strong> {{ migrationStatus.migrations.failed ? "Yes" : "No" }}
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }
                @if (migrationStatus && !isAdmin) {
                  <div class="alert" [ngClass]="getAlertClass()" role="alert">
                    <div>
                      We are applying routine updates. Please check back shortly.
                    </div>
                  </div>
                }

                @if (isAdmin) {
                  <div class="mt-4">
                    @if (allMigrationFiles().length > 0) {
                      <div class="mb-3 text-start">
                        <div class="table-responsive">
                          <table class="table table-sm table-hover">
                            <thead>
                              <tr>
                                <th class="sortable" style="width: 10%;" (click)="toggleSort(MigrationSortColumn.STATUS)">
                                  Status
                                  @if (sortColumn === MigrationSortColumn.STATUS) {
                                    <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                                  }
                                </th>
                                <th class="sortable" style="width: 40%;" (click)="toggleSort(MigrationSortColumn.FILE)">
                                  Migration File
                                  @if (sortColumn === MigrationSortColumn.FILE) {
                                    <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                                  }
                                </th>
                                <th class="sortable" style="width: 20%;" (click)="toggleSort(MigrationSortColumn.TIMESTAMP)">
                                  Applied/Failed At
                                  @if (sortColumn === MigrationSortColumn.TIMESTAMP) {
                                    <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                                  }
                                </th>
                                <th style="width: 15%;">Duration</th>
                                <th style="width: 13%;">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (migration of sortedMigrations(); track migration.file) {
                                <tr [ngClass]="{'migration-applied': isApplied(migration.status), 'migration-failed': isFailed(migration.status), 'migration-pending': isPending(migration.status), 'migration-running': isRunning(migration.file)}">
                                  <td>
                                    @if (isRunning(migration.file)) {
                                      <span class="badge bg-primary">
                                        <fa-icon [icon]="faSpinner" [spin]="true" class="me-1"/>Running
                                      </span>
                                    } @else {
                                      <span class="badge"
                                            [ngClass]="isApplied(migration.status) ? 'bg-success' : isFailed(migration.status) ? 'bg-danger' : 'bg-warning'">
                                        {{ isApplied(migration.status) ? 'Applied' : isFailed(migration.status) ? 'Failed' : 'Pending' }}
                                      </span>
                                    }
                                  </td>
                                  <td>
                                    {{ migration.file }}
                                    @if (migration.manual) {
                                      <span class="badge bg-info text-dark ms-2">Manual</span>
                                    }
                                    @if (isFailed(migration.status) && migration.error) {
                                      <div class="alert alert-danger mt-2 mb-0 p-2">
                                        <small>
                                          <strong>Error:</strong> {{ migration.error }}
                                        </small>
                                      </div>
                                    }
                                  </td>
                                  <td>
                                    @if (migration.timestamp) {
                                      <small>{{ migration.timestamp | date:'medium' }}</small>
                                    } @else {
                                      <small class="text-muted">—</small>
                                    }
                                  </td>
                                  <td>
                                    @if (migration.startedAt && migration.timestamp) {
                                      <small>{{ dateUtils.formatDuration(dateUtils.asValue(migration.startedAt), dateUtils.asValue(migration.timestamp)) }}</small>
                                    } @else {
                                      <small class="text-muted">—</small>
                                    }
                                  </td>
                                  <td>
                                    <button class="btn btn-sm text-nowrap"
                                            [ngClass]="isFailed(migration.status) ? 'btn-danger' : 'btn-primary'"
                                            [disabled]="retrying || !isNull(retryingFile)"
                                            (click)="retryMigrationFile(migration.file)">
                                      <fa-icon [icon]="retryingFile === migration.file ? faSpinner : faRedo" [spin]="retryingFile === migration.file" class="me-1"/>
                                      {{ runButtonLabel(migration) }}
                                    </button>
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      </div>
                    }
                    <div class="btn-group flex-wrap" role="group">
                      <button (click)="retryMigrations()"
                              [disabled]="retrying || migrationStatus?.status === 'OK'"
                              class="btn btn-primary text-nowrap">
                        <fa-icon [icon]="retrying ? faSpinner : faRedo" [spin]="retrying" class="me-2"/>
                        {{ retrying ? "Retrying..." : "Retry Migrations" }}
                      </button>
                      <button (click)="clearFailedMigrations()"
                              [disabled]="!migrationStatus?.migrations?.failed"
                              class="btn btn-warning text-nowrap">
                        <fa-icon [icon]="faTrash" class="me-2"/>
                        Clear Failed
                      </button>
                      <button (click)="viewLogs()" class="btn btn-secondary text-nowrap">
                        View Logs
                      </button>
                      @if (!simulationActive) {
                        <button (click)="simulateFailure()" class="btn btn-danger text-nowrap">
                          Simulate Failure
                        </button>
                      }
                      @if (simulationActive) {
                        <button (click)="clearSimulation()" class="btn btn-success text-nowrap">
                          Clear Simulation
                        </button>
                      }
                    </div>
                    @if (simulationActive) {
                      <div class="alert alert-warning mt-3">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"/>
                        Simulation mode enabled - showing simulated failures for testing
                      </div>
                    }
                    @if (lastRetryMessage) {
                      <div class="alert mt-3" [ngClass]="lastRetrySuccess ? 'alert-success' : 'alert-danger'">
                        {{ lastRetryMessage }}
                      </div>
                    }
                  </div>
                } @else {
                  <div class="spinner-border text-primary mt-4" role="status">
                    <span class="visually-hidden">Checking status...</span>
                  </div>
                  <p class="mt-3 text-muted">
                    The page will automatically refresh when maintenance is complete.
                  </p>
                }

                <div class="mt-4">
                  <small class="text-muted">
                    Last checked: {{ lastChecked | date:"medium" }}
                  </small>
                </div>
          </div>
        </div>
      </div>
    </app-page>
  `,
  styles: [`
    .migration-details
      padding: 1rem
      background-color: rgba(0, 0, 0, 0.05)
      border-radius: 0.25rem

    .sortable
      cursor: pointer
      user-select: none

      &:hover
        background-color: #e9ecef

    .table-responsive
      max-height: 500px
      overflow-y: auto
      border: 1px solid #dee2e6
      border-radius: 0.375rem

    .table
      margin-bottom: 0
      border-collapse: collapse

      thead th
        position: sticky
        top: 0
        background-color: white
        z-index: 10
        border-bottom: 2px solid #dee2e6
        border-right: 1px solid #dee2e6

        &:last-child
          border-right: none

      tbody tr td
        border-right: 1px solid #dee2e6
        vertical-align: middle

        &:last-child
          border-right: none

      tbody tr td:first-child
        border-left: 4px solid transparent

      tbody tr.migration-applied td:first-child
        border-left-color: #28a745

      tbody tr.migration-pending td:first-child
        border-left-color: #ffc107

      tbody tr.migration-failed td:first-child
        border-left-color: #dc3545

      tbody tr.migration-running td:first-child
        border-left-color: #0d6efd

    .text-warning
      color: #ffc107 !important

    .text-success
      color: #28a745 !important

    .text-danger
      color: #dc3545 !important
  `],
  imports: [PageComponent, FontAwesomeModule, NgClass, DatePipe]
})
export class SiteMaintenanceComponent implements OnInit, OnDestroy {
  protected readonly isNull = isNull;
  private logger: Logger = inject(LoggerFactory).createLogger(SiteMaintenanceComponent, NgxLoggerLevel.OFF);
  private memberLoginService = inject(MemberLoginService);
  private siteMaintenanceService = inject(SiteMaintenanceService);
  protected dateUtils = inject(DateUtilsService);

  faExclamationTriangle = faExclamationTriangle;
  faCheckCircle = faCheckCircle;
  faSpinner = faSpinner;
  faRedo = faRedo;
  faTools = faTools;
  faChevronUp = faChevronUp;
  faChevronDown = faChevronDown;
  faTrash = faTrash;

  MigrationSortColumn = MigrationSortColumn;
  ASCENDING = ASCENDING;
  DESCENDING = DESCENDING;

  migrationStatus: HealthResponse | null = null;
  isAdmin = false;
  simulationActive = false;
  retrying = false;
  retryingFile: string | null = null;
  lastChecked: number = this.dateUtils.dateTimeNowAsValue();
  lastRetryMessage = "";
  lastRetrySuccess = false;
  sortColumn: MigrationSortColumn = MigrationSortColumn.TIMESTAMP;
  sortDirection: string = DESCENDING;

  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.isAdmin = this.memberLoginService.isAdmin();
    this.checkStatus();

    this.subscriptions.push(
      interval(5000).subscribe(() => this.checkStatus())
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async checkStatus() {
    this.migrationStatus = await this.siteMaintenanceService.getMigrationStatus();
    this.lastChecked = this.dateUtils.dateTimeNowAsValue();

    this.logger.info("Migration status response:", this.migrationStatus);
    this.logger.info("Files array:", this.migrationStatus?.migrations?.files);
    this.logger.info("All migration files:", this.allMigrationFiles());

    const simulationState = await this.siteMaintenanceService.readSimulation();
    this.simulationActive = simulationState.active;

    if (this.migrationStatus.status === HealthStatus.OK && !this.isAdmin) {
      window.location.href = "/";
    }
  }

  async retryMigrations() {
    this.retrying = true;
    this.lastRetryMessage = "";
    try {
      const result = await this.siteMaintenanceService.retryMigrations();
      this.lastRetrySuccess = result.success;
      this.lastRetryMessage = result.message || "Migration retry initiated";
      await this.checkStatus();
    } catch (error: any) {
      this.lastRetrySuccess = false;
      this.lastRetryMessage = error.message || "Failed to retry migrations";
    } finally {
      this.retrying = false;
    }
  }

  async retryMigrationFile(fileName: string) {
    this.retryingFile = fileName;
    this.lastRetryMessage = "";
    try {
      const result = await this.siteMaintenanceService.retryMigration(fileName);
      this.lastRetrySuccess = result.success;
      this.lastRetryMessage = result.message || `Migration ${fileName} retried`;
      await this.checkStatus();
    } catch (error: any) {
      this.lastRetrySuccess = false;
      this.lastRetryMessage = error.message || `Failed to retry migration ${fileName}`;
    } finally {
      this.retryingFile = null;
    }
  }

  viewLogs() {
    window.open("/api/health", "_blank");
  }

  async simulateFailure() {
    try {
      await this.siteMaintenanceService.simulateFailure(2, true);
      await this.checkStatus();
      this.lastRetryMessage = null;
    } catch (error: any) {
      this.lastRetrySuccess = false;
      this.lastRetryMessage = error.message || "Failed to enable simulation";
    }
  }

  async clearSimulation() {
    try {
      await this.siteMaintenanceService.clearSimulation();
      await this.checkStatus();
      this.lastRetryMessage = null;
    } catch (error: any) {
      this.lastRetrySuccess = false;
      this.lastRetryMessage = error.message || "Failed to clear simulation";
    }
  }

  async clearFailedMigrations() {
    try {
      const result = await this.siteMaintenanceService.clearFailedMigrations();
      await this.checkStatus();
      this.lastRetrySuccess = true;
      this.lastRetryMessage = `Cleared ${result.deletedCount} failed migration(s)`;
    } catch (error: any) {
      this.lastRetrySuccess = false;
      this.lastRetryMessage = error.message || "Failed to clear failed migrations";
    }
  }

  getStatusIcon() {
    if (!this.migrationStatus) return this.faSpinner;
    if (this.isSystemHealthy()) return this.faCheckCircle;
    if (!this.isAdmin) return this.faTools;
    if (this.migrationStatus.migrations?.failed) return this.faExclamationTriangle;
    return this.faTools;
  }

  getStatusClass() {
    if (!this.migrationStatus) return "text-primary";
    if (this.isSystemHealthy()) return "text-success";
    if (!this.isAdmin) return "text-warning";
    if (this.migrationStatus.migrations?.failed) return "text-danger";
    return "text-warning";
  }

  getAlertClass() {
    if (!this.migrationStatus) return "alert-info";
    if (this.isSystemHealthy()) return "alert-success";
    if (!this.isAdmin) return "alert-warning";
    if (this.migrationStatus.migrations?.failed) return "alert-danger";
    return "alert-warning";
  }

  getTitle() {
    if (!this.migrationStatus) return "Checking System Status...";
    if (this.isSystemHealthy()) return "System Operational";
    if (!this.isAdmin) return "Site Maintenance in Progress";
    if (this.migrationStatus.migrations?.failed) return "Migration Failed";
    return "Site Maintenance in Progress";
  }

  getDescription() {
    if (!this.migrationStatus) {
      return "Please wait while we check the system status...";
    }
    if (this.isSystemHealthy()) {
      return "All database migrations have been applied successfully.";
    }
    const nonAdminMessage = "We're performing updates to improve your experience. This should only take a few moments.";
    if (!this.isAdmin) {
      return nonAdminMessage;
    }
    if (this.migrationStatus.migrations?.failed) {
      return "A database migration has failed. Please contact your system administrator.";
    }
    return nonAdminMessage;
  }

  private isSystemHealthy(): boolean {
    return this.migrationStatus?.status === HealthStatus.OK &&
           this.migrationStatus?.migrations?.pending === 0 &&
           !this.migrationStatus?.migrations?.failed;
  }

  allMigrationFiles(): MaintenanceMigrationFile[] {
    if (!this.migrationStatus?.migrations?.files) {
      return [];
    }

    return this.migrationStatus.migrations.files.map(migrationFile => {
      const pendingTimestamp = migrationFile.status === MigrationFileStatus.PENDING ? this.dateUtils.isoDateTime(this.lastChecked) : "";
      const timestamp = migrationFile.timestamp || pendingTimestamp;
      return {
        file: migrationFile.fileName,
        status: migrationFile.status,
        startedAt: migrationFile.startedAt,
        timestamp,
        error: migrationFile.error,
        manual: migrationFile.manual
      };
    });
  }

  toggleSort(column: MigrationSortColumn) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === ASCENDING ? DESCENDING : ASCENDING;
    } else {
      this.sortColumn = column;
      this.sortDirection = ASCENDING;
    }
  }

  sortedMigrations(): MaintenanceMigrationFile[] {
    const migrations = this.allMigrationFiles();
    const prefix = this.sortDirection === DESCENDING ? "-" : "";
    return migrations.sort(sortBy(`${prefix}${this.sortColumn}`));
  }

  isApplied(status: MigrationFileStatus): boolean {
    return status === MigrationFileStatus.APPLIED;
  }

  isFailed(status: MigrationFileStatus): boolean {
    return status === MigrationFileStatus.FAILED;
  }

  isPending(status: MigrationFileStatus): boolean {
    return status === MigrationFileStatus.PENDING;
  }

  isRunning(fileName: string): boolean {
    return this.retryingFile === fileName;
  }

  runButtonLabel(migration: MaintenanceMigrationFile): string {
    if (this.isFailed(migration.status)) {
      return "Retry";
    }
    if (this.isApplied(migration.status)) {
      return "Re-run";
    }
    return migration.manual ? "Run manually" : "Run";
  }
}
