import { CommonModule, DatePipe } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faExclamationTriangle, faRotate, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { kebabCase } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { firstValueFrom } from "rxjs";
import { BackupListItem, BackupLocation, EnvironmentInfo, S3BackupManifest } from "../../../models/backup-session.model";
import {
  EnvironmentMigrationAudit,
  EnvironmentMigrationMode,
  EnvironmentMigrationRequest,
  EnvironmentMigrationStatus,
  EnvironmentMigrationTab
} from "../../../models/environment-migration.model";
import { SortableTableAlignment, SortableTableColumn } from "../../../modules/common/sortable-table/sortable-table.model";
import { SortableTableCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { MongoUriInputComponent, MongoUriParseResult } from "../../../modules/common/mongo-uri-input/mongo-uri-input";
import { SecretInputComponent } from "../../../modules/common/secret-input/secret-input.component";
import { BackupSelectComponent } from "../../../modules/common/selectors/backup-select";
import { EnvironmentSelectComponent } from "../../../modules/common/selectors/environment-select";
import { PageComponent } from "../../../page/page.component";
import { BackupAndRestoreService } from "../../../services/backup-and-restore.service";
import { EnvironmentConfigService } from "../../../services/environment-config.service";
import { EnvironmentMigrationService } from "../../../services/environment-migration.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StoredValue } from "../../../models/ui-actions";
import { InputSize } from "../../../models/ui-size.model";
import { DESCENDING } from "../../../models/table-filtering.model";
import { EnvironmentsConfig } from "../../../models/environment-config.model";
import { backupEnvironment, backupSource, sameBackupEnvironment } from "../../../functions/backup-list-items";

@Component({
  selector: "app-environment-migration",
  imports: [
    CommonModule,
    DatePipe,
    EnvironmentSelectComponent,
    FontAwesomeModule,
    FormsModule,
    MongoUriInputComponent,
    BackupSelectComponent,
    PageComponent,
    SecretInputComponent,
    SortableTableCellDirective,
    SortableTableComponent,
    TabDirective,
    TabsetComponent
  ],
  styles: [`
    .status-pill
      display: inline-block
      padding: 0.25rem 0.5rem
      border-radius: 0.25rem
      font-weight: 600
      white-space: nowrap
      background: var(--ramblers-colour-granite, #f1f3f5)

    .status-pill.completed
      background: rgba(25, 135, 84, 0.12)
      color: #146c43

    .status-pill.failed,
    .status-pill.missing-manifest
      background: rgba(220, 53, 69, 0.12)
      color: #b02a37

    .status-pill.in-progress,
    .status-pill.pending
      background: rgba(255, 193, 7, 0.18)
      color: #664d03

    .table-action-button
      white-space: nowrap
      min-width: 5rem
      color: var(--bs-body-color)
      border-color: var(--bs-secondary-border-subtle)
      background-color: var(--bs-light)

    .table-action-button:hover,
    .table-action-button:focus
      color: var(--bs-body-color)
      border-color: var(--ramblers-colour-sunrise, #f9b104)
      background-color: var(--ramblers-colour-sunrise, #f9b104)

    .result-panel
      border: 1px solid rgba(155, 200, 171, 0.35)
      border-radius: 8px
      padding: 1rem

  `],
  template: `
    <app-page autoTitle pageTitle="Environment Migration">
      <tabset class="custom-tabset">
        <tab [active]="tabActive(EnvironmentMigrationTab.PLAN)"
             (selectTab)="selectTab(EnvironmentMigrationTab.PLAN)"
             [heading]="EnvironmentMigrationTab.PLAN">
          <form (ngSubmit)="plan()" autocomplete="off" class="img-thumbnail thumbnail-admin-edit mt-3">
            <div class="row thumbnail-heading-frame">
              <div class="thumbnail-heading">Migration Plan</div>
              <div class="col-12">
                <div class="alert alert-warning d-flex align-items-center gap-2 mb-3" role="alert">
                  <fa-icon [icon]="faExclamationTriangle" size="lg"/>
                  <span><strong>Cutover Safety</strong> — Verify the target restore before rotating credentials. Cutover only happens when you press Rotate Credentials.</span>
                </div>
              </div>
              <div class="col-12">
                <div class="row align-items-stretch">
                  <div class="col-lg-6 d-flex">
                    <div class="row thumbnail-heading-frame flex-fill">
                      <div class="thumbnail-heading">Source and Backup</div>
                      <div class="mb-3">
                        <app-environment-select
                          label="Environment"
                          [items]="environmentsWithMongo"
                          [(selectedName)]="request.environment"
                          (selectedNameChange)="onEnvironmentChange()"
                          placeholder="Select environment..."></app-environment-select>
                      </div>

                      <div class="mb-3">
                        <label class="form-label me-3">Backup Source</label>
                        <div class="form-check form-check-inline">
                          <input class="form-check-input" type="radio" id="migrationSourceS3" name="migrationBackupSource"
                                 [value]="BackupLocation.S3"
                                 [(ngModel)]="backupSource" (ngModelChange)="onBackupSourceChange($event)">
                          <label class="form-check-label" for="migrationSourceS3">S3</label>
                        </div>
                        <div class="form-check form-check-inline">
                          <input class="form-check-input" type="radio" id="migrationSourceLocal" name="migrationBackupSource"
                                 [value]="BackupLocation.LOCAL"
                                 [(ngModel)]="backupSource" (ngModelChange)="onBackupSourceChange($event)">
                          <label class="form-check-label" for="migrationSourceLocal">Local</label>
                        </div>
                      </div>

                      <div class="mb-3">
                        <app-backup-select
                          label="Backup to Restore"
                          [items]="backups"
                          [selected]="selectedBackupForRestore"
                          [source]="backupSource"
                          (selectedChange)="onBackupForRestoreChange($event)"
                          name="backupForRestore"
                          placeholder="Select backup..."></app-backup-select>
                      </div>

                      <div class="d-flex flex-wrap gap-4 mb-3">
                        <div class="form-check">
                          <input type="checkbox" class="form-check-input"
                                 [ngModel]="request.mode === EnvironmentMigrationMode.MONGO_AND_S3"
                                 (ngModelChange)="setIncludeS3($event)"
                                 name="includeS3"
                                 id="includeS3">
                          <label class="form-check-label" for="includeS3">Restore S3 objects from the matching snapshot</label>
                        </div>
                        <div class="form-check">
                          <input type="checkbox" class="form-check-input"
                                 [(ngModel)]="request.rotateS3Credentials"
                                 name="rotateS3Credentials"
                                 id="rotateS3Credentials"
                                 [disabled]="request.mode !== EnvironmentMigrationMode.MONGO_AND_S3">
                          <label class="form-check-label" for="rotateS3Credentials">Rotate AWS credentials to bucket-scoped access during cutover</label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="col-lg-6 d-flex">
                    <div class="row thumbnail-heading-frame flex-fill">
                      <div class="thumbnail-heading d-flex align-items-center gap-3">
                        <img src="assets/icons/mongodb-logo.svg" alt="MongoDB" style="height: 30px;">
                        <span>Target MongoDB</span>
                      </div>
                      <app-mongo-uri-input (parsedUri)="onMongoUriParsed($event)"/>
                      <div class="row">
                        <div class="col-12 mb-2">
                          <label class="form-label" for="target-cluster">Cluster</label>
                          <input id="target-cluster" class="form-control" name="targetCluster"
                                 [(ngModel)]="request.targetMongo.cluster" placeholder="ngx-ramblers.0svhxsk" autocomplete="off" required>
                        </div>
                        <div class="col-12 mb-2">
                          <label class="form-label" for="target-db">Database</label>
                          <input id="target-db" class="form-control" name="targetDb"
                                 [(ngModel)]="request.targetMongo.db" autocomplete="off" required>
                        </div>
                        <div class="col-12 mb-2">
                          <label class="form-label" for="target-username">Username</label>
                          <app-secret-input [(ngModel)]="request.targetMongo.username"
                                            name="targetUsername"
                                            id="target-username"
                                            [size]="InputSize.SM"
                                            autocomplete="off">
                          </app-secret-input>
                        </div>
                        <div class="col-12 mb-2">
                          <label class="form-label" for="target-password">Password</label>
                          <app-secret-input [(ngModel)]="request.targetMongo.password"
                                            name="targetPassword"
                                            id="target-password"
                                            [size]="InputSize.SM"
                                            autocomplete="new-password">
                          </app-secret-input>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            <div class="col-12">
              <div class="row mt-3">
                <div class="col-lg-6">
                  <label class="form-label" for="confirm-environment">Typed confirmation</label>
                  <input id="confirm-environment" class="form-control" name="confirmEnvironment"
                         [(ngModel)]="request.confirmEnvironment"
                         [placeholder]="request.environment || 'environment name'">
                </div>
              </div>
            </div>

            <div class="col-12">
              <div class="d-flex flex-wrap gap-2 mt-3">
                <button type="submit" class="btn btn-primary" [disabled]="busy || !formReady()">
                  @if (busyAction === "plan") {
                    <fa-icon [icon]="faSpinner" animation="spin"/> Validating
                  } @else {
                    Validate Plan
                  }
                </button>
                <button type="button" class="btn btn-warning" [disabled]="busy || !formReady() || !confirmationReady()"
                        (click)="execute(false)">
                  @if (busyAction === "execute") {
                    <fa-icon [icon]="faSpinner" animation="spin"/> Restoring
                  } @else {
                    Restore with Drop
                  }
                </button>
                <button type="button" class="btn btn-danger" [disabled]="busy || !canRotate()"
                        (click)="rotate()">
                  @if (busyAction === "rotate") {
                    <fa-icon [icon]="faSpinner" animation="spin"/> Rotating
                  } @else {
                    Rotate Credentials
                  }
                </button>
              </div>
            </div>
            @if (error) {
              <div class="col-12">
                <div class="alert alert-danger d-flex align-items-center gap-2 mt-3 mb-0" role="alert">
                  <fa-icon [icon]="faExclamationTriangle" size="lg"/>
                  <span><strong>Migration Failed</strong> — {{ error }}</span>
                </div>
              </div>
            }
            @if (success) {
              <div class="col-12">
                <div class="alert alert-success mt-3 mb-0" role="alert"><strong>Success</strong> — {{ success }}</div>
              </div>
            }
            @if (request.mode === EnvironmentMigrationMode.MONGO_AND_S3) {
              <div class="col-12">
                <div class="alert alert-warning d-flex align-items-start gap-2 w-100 mt-3 mb-0" role="alert">
                  <fa-icon [icon]="faExclamationTriangle" class="mt-1"/>
                  <span>
                    <strong>S3 Restore Scope</strong> —
                    {{ s3RestoreScopeSummary() }}
                  </span>
                </div>
              </div>
            }
            </div>
          </form>
        </tab>

        <tab [active]="tabActive(EnvironmentMigrationTab.RESULT)"
             (selectTab)="selectTab(EnvironmentMigrationTab.RESULT)"
             [heading]="EnvironmentMigrationTab.RESULT">
          <div class="result-panel mt-3">
            @if (selectedMigration) {
              <p><span class="status-pill" [ngClass]="statusClass(selectedMigration.status)">{{ selectedMigration.status }}</span> {{ selectedMigration.phase }}</p>
              @if (selectedMigration.status === EnvironmentMigrationStatus.ORPHANED) {
                <div class="alert alert-warning d-flex align-items-center gap-2" role="alert">
                  <fa-icon [icon]="faExclamationTriangle" size="lg"/>
                  <span><strong>Interrupted</strong> — This migration was interrupted by a server restart. Inspect the target database and restart explicitly with fresh target credentials.</span>
                </div>
              }
              <dl class="row">
                <dt class="col-sm-4">Migration</dt>
                <dd class="col-sm-8">{{ selectedMigration.migrationId }}</dd>
                <dt class="col-sm-4">Source</dt>
                <dd class="col-sm-8">{{ selectedMigration.sourceMongo.uriSummary }}</dd>
                <dt class="col-sm-4">Target</dt>
                <dd class="col-sm-8">{{ selectedMigration.targetMongo.uriSummary }}</dd>
                <dt class="col-sm-4">Backup</dt>
                <dd class="col-sm-8">{{ selectedMigration.backupName || selectedMigration.backupPath || selectedMigration.rollbackInfo?.backupUsed || "not created" }}</dd>
                <dt class="col-sm-4">Heartbeat</dt>
                <dd class="col-sm-8">{{ selectedMigration.heartbeatAt ? (selectedMigration.heartbeatAt | date: "short") : "not started" }}</dd>
              </dl>
              @if (selectedMigration.error) {
                <p class="text-danger">{{ selectedMigration.error }}</p>
              }
              @if (selectedMigration.verification) {
                <h3 class="h6">Verification</h3>
                <ul class="list-unstyled">
                  <li>Group: {{ selectedMigration.verification.systemGroupIdentity?.shortName || selectedMigration.verification.systemGroupIdentity?.groupCode }}</li>
                  <li>Collections: {{ selectedMigration.verification.collections.length }}</li>
                  <li>Total documents: {{ selectedMigration.verification.totalDocumentCount }}</li>
                  @if (selectedMigration.verification.stagingEnvironments) {
                    <li>Staging environments: {{ selectedMigration.verification.stagingEnvironments.count }}</li>
                    @if (selectedMigration.verification.stagingEnvironments.missing.length > 0) {
                      <li class="text-danger">Missing: {{ selectedMigration.verification.stagingEnvironments.missing.join(", ") }}</li>
                    }
                  }
                </ul>
                <app-sortable-table
                  [columns]="collectionCountColumns"
                  [rows]="selectedMigration.verification.keyCollectionCounts"
                  [trackBy]="trackCollectionCount"
                  emptyMessage="No collection counts returned">
                </app-sortable-table>
              }
              @if (selectedMigration.s3Backups?.length || selectedMigration.s3Restores?.length) {
                <h3 class="h6 mt-3">S3 Results</h3>
                <app-sortable-table
                  [columns]="s3Columns"
                  [rows]="s3Rows(selectedMigration)"
                  [trackBy]="trackS3Summary"
                  emptyMessage="No S3 results returned">
                </app-sortable-table>
              }
            } @else {
              <p class="text-muted mb-0">Run a validation plan to see migration details.</p>
            }
          </div>
        </tab>

        <tab [active]="tabActive(EnvironmentMigrationTab.HISTORY)"
             (selectTab)="selectTab(EnvironmentMigrationTab.HISTORY)"
             [heading]="EnvironmentMigrationTab.HISTORY">
          <div class="d-flex justify-content-end mt-3 mb-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="loadHistory()" [disabled]="busy">
              <fa-icon [icon]="faRotate"/> Refresh
            </button>
          </div>
          <app-sortable-table
            [columns]="historyColumns"
            [rows]="history"
            [trackBy]="trackMigration"
            defaultSortKey="startTime"
            [defaultSortDirection]="DESCENDING"
            maxHeight="70vh"
            emptyMessage="No migration records yet">
            <ng-template appSortableTableCell="started" let-migration>
              {{ migration.startTime | date: "short" }}
            </ng-template>
            <ng-template appSortableTableCell="status" let-migration>
              <span class="status-pill" [ngClass]="statusClass(migration.status)">{{ migration.status }}</span>
            </ng-template>
            <ng-template appSortableTableCell="actions" let-migration>
              <button class="btn btn-sm table-action-button" type="button" (click)="selectMigration(migration)">Select</button>
            </ng-template>
          </app-sortable-table>
        </tab>
      </tabset>
    </app-page>
  `
})
export class EnvironmentMigrationComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger(EnvironmentMigrationComponent, NgxLoggerLevel.ERROR);
  private backupService = inject(BackupAndRestoreService);
  private environmentConfigService = inject(EnvironmentConfigService);
  private migrationService = inject(EnvironmentMigrationService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private tab: EnvironmentMigrationTab | string = EnvironmentMigrationTab.PLAN;

  protected readonly BackupLocation = BackupLocation;
  protected readonly EnvironmentMigrationMode = EnvironmentMigrationMode;
  protected readonly EnvironmentMigrationStatus = EnvironmentMigrationStatus;
  protected readonly EnvironmentMigrationTab = EnvironmentMigrationTab;
  protected readonly InputSize = InputSize;
  protected readonly DESCENDING = DESCENDING;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faRotate = faRotate;
  protected readonly faSpinner = faSpinner;

  environments: EnvironmentInfo[] = [];
  environmentsWithMongo: EnvironmentInfo[] = [];
  history: EnvironmentMigrationAudit[] = [];
  backups: BackupListItem[] = [];
  allBackups: BackupListItem[] = [];
  selectedBackupForRestore: BackupListItem | null = null;
  selectedS3Manifest: S3BackupManifest | null = null;
  selectedMigration: EnvironmentMigrationAudit | null = null;
  environmentsConfig: EnvironmentsConfig | null = null;
  backupSource: BackupLocation = BackupLocation.S3;
  sourceEnvironment = "";
  error = "";
  success = "";
  busy = false;
  busyAction = "";

  historyColumns: SortableTableColumn<EnvironmentMigrationAudit>[] = [
    { key: "started", label: "Started", sortKey: "startTime" },
    { key: "environment", label: "Environment", sortKey: "environment", cellGetter: row => row.environment },
    { key: "status", label: "Status", sortKey: "status" },
    { key: "source", label: "Source", cellGetter: row => row.sourceMongo.uriSummary },
    { key: "target", label: "Target", cellGetter: row => row.targetMongo.uriSummary },
    { key: "actions", label: "", align: SortableTableAlignment.RIGHT }
  ];

  collectionCountColumns: SortableTableColumn[] = [
    { key: "collection", label: "Collection", sortKey: "collection", cellGetter: row => row.collection },
    { key: "count", label: "Count", sortKey: "count", align: SortableTableAlignment.RIGHT, cellGetter: row => row.count }
  ];

  s3Columns: SortableTableColumn[] = [
    { key: "site", label: "Site", sortKey: "site", cellGetter: row => row.site },
    { key: "status", label: "Status", sortKey: "status", cellGetter: row => row.status },
    { key: "copiedObjects", label: "Objects", sortKey: "copiedObjects", align: SortableTableAlignment.RIGHT, cellGetter: row => row.copiedObjects },
    { key: "skippedObjects", label: "Skipped", sortKey: "skippedObjects", align: SortableTableAlignment.RIGHT, cellGetter: row => row.skippedObjects }
  ];

  request: EnvironmentMigrationRequest = {
    environment: "",
    mode: EnvironmentMigrationMode.MONGO_AND_S3,
    dryRun: true,
    targetMongo: {
      cluster: "",
      db: "",
      username: "",
      password: ""
    },
    confirmEnvironment: "",
    rotateS3Credentials: true
  };

  async ngOnInit(): Promise<void> {
    this.activatedRoute.queryParams.subscribe(params => {
      this.tab = params[StoredValue.TAB] || kebabCase(EnvironmentMigrationTab.PLAN);
    });
    await Promise.all([this.loadEnvironments(), this.loadBackups(), this.loadHistory(), this.loadEnvironmentConfig()]);
  }

  async loadEnvironments(): Promise<void> {
    try {
      this.environments = await firstValueFrom(this.backupService.listEnvironments());
      this.environmentsWithMongo = this.environments.filter(environment => environment.hasMongoConfig);
    } catch (error: any) {
      this.logger.error("Failed to load environments:", error);
      this.error = this.extractErrorMessage(error, "Failed to load environments");
    }
  }

  async loadBackups(): Promise<void> {
    const requestedSource = this.backupSource;
    this.logger.info("loadBackups requestedSource:",  requestedSource);
    try {
      const source = requestedSource === BackupLocation.S3 ? this.backupService.listS3Backups() : this.backupService.listBackups();
      const backups = await firstValueFrom(source);
      if (this.backupSource === requestedSource) {
        this.allBackups = backups.map(backup => ({...backup, location: backup.location || requestedSource}));
        this.applyBackupFilter();
      }
    } catch (error: any) {
      this.logger.error("Failed to load backups:", error);
      this.error = this.extractErrorMessage(error, "Failed to load backups");
    }
  }

  async loadHistory(): Promise<void> {
    try {
      this.history = await firstValueFrom(this.migrationService.history(50, this.request.environment || ""));
    } catch (error: any) {
      this.logger.error("Failed to load migration history:", error);
      this.error = this.extractErrorMessage(error, "Failed to load migration history");
    }
  }

  async loadEnvironmentConfig(): Promise<void> {
    try {
      this.environmentsConfig = await firstValueFrom(this.environmentConfigService.events());
    } catch (error: any) {
      this.logger.error("Failed to load environment config:", error);
      this.environmentsConfig = null;
    }
  }

  selectTab(tab: EnvironmentMigrationTab) {
    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: kebabCase(tab)},
      queryParamsHandling: "merge"
    });
  }

  tabActive(tab: EnvironmentMigrationTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  onEnvironmentChange(): void {
    const environment = this.environments.find(candidate => candidate.name === this.request.environment);
    if (environment?.database && !this.request.targetMongo.db) {
      this.request.targetMongo.db = environment.database;
    }
    this.sourceEnvironment = this.request.environment;
    this.selectedBackupForRestore = null;
    this.selectedS3Manifest = null;
    this.applyBackupFilter();
    this.updateS3Preview();
    this.loadHistory();
  }

  onBackupSourceChange(source: BackupLocation): void {
    this.backupSource = source;
    this.selectedBackupForRestore = null;
    this.request.backupPath = "";
    this.request.backupName = "";
    this.request.backupLocation = this.backupSource;
    this.selectedS3Manifest = null;
    this.loadBackups();
  }

  onBackupForRestoreChange(item: BackupListItem | null): void {
    this.selectedBackupForRestore = item;
    this.request.backupPath = item?.path || "";
    this.request.backupName = item?.name || "";
    this.request.backupLocation = item?.location || this.backupSource;
    this.updateS3Preview();
  }

  onMongoUriParsed(parsed: MongoUriParseResult): void {
    this.request.targetMongo.cluster = parsed.cluster;
    if (parsed.database) {
      this.request.targetMongo.db = parsed.database;
    }
    this.request.targetMongo.username = parsed.username;
    this.request.targetMongo.password = parsed.password;
  }

  setIncludeS3(includeS3: boolean): void {
    this.request.mode = includeS3 ? EnvironmentMigrationMode.MONGO_AND_S3 : EnvironmentMigrationMode.MONGO_ONLY;
    this.request.rotateS3Credentials = includeS3 ? this.request.rotateS3Credentials !== false : false;
    this.updateS3Preview();
  }

  targetS3Bucket(): string {
    const environmentConfig = this.environmentsConfig?.environments?.find(environment => environment.environment === this.request.environment);
    return environmentConfig?.aws?.bucket || "";
  }

  s3RestoreScopeSummary(): string {
    const targetBucket = this.targetS3Bucket();
    if (this.selectedS3Manifest) {
      return `S3 objects will be restored from ${this.selectedS3Manifest.backupBucket}/${this.selectedS3Manifest.backupPrefix} into ${targetBucket || "the target bucket, which is not configured yet"}.`;
    }
    const timestamp = this.selectedBackupForRestore ? this.backupTimestamp(this.selectedBackupForRestore) : "";
    if (this.request.environment && timestamp) {
      return `This backup does not have a completed S3 object snapshot, so S3 restore is not ready. Choose another backup or turn off S3 restore. Target bucket: ${targetBucket || "not configured"}.`;
    }
    return `Choose a backup to show which S3 objects will be restored. Target bucket: ${targetBucket || "not configured"}.`;
  }

  formReady(): boolean {
    return !!(this.request.environment && this.request.targetMongo.cluster && this.request.targetMongo.db && this.request.targetMongo.username && this.request.targetMongo.password);
  }

  confirmationReady(): boolean {
    return this.request.confirmEnvironment === this.request.environment;
  }

  canRotate(): boolean {
    return this.formReady() && this.confirmationReady() && this.selectedMigration?.status === EnvironmentMigrationStatus.READY_FOR_CUTOVER;
  }

  async plan(): Promise<void> {
    await this.run("plan", async () => {
      const migration = await firstValueFrom(this.migrationService.planMongoOnlyMigration({
        ...this.request,
        dryRun: true
      }));
      this.selectedMigration = migration;
      this.success = "Target credentials validated and verification checks completed.";
      this.selectTab(EnvironmentMigrationTab.RESULT);
      await this.loadHistory();
    });
  }

  async execute(rotateCredentials: boolean): Promise<void> {
    await this.run("execute", async () => {
      const migration = await firstValueFrom(this.migrationService.executeMongoOnlyMigration({
        ...this.request,
        dryRun: false,
        rotateCredentials
      }));
      this.selectedMigration = migration;
      this.success = "Migration started. This page will refresh the migration status while the restore runs.";
      this.selectTab(EnvironmentMigrationTab.RESULT);
      this.pollMigration(migration.migrationId);
      await this.loadHistory();
    });
  }

  async rotate(): Promise<void> {
    if (!this.selectedMigration) {
      return;
    }
    await this.run("rotate", async () => {
      const migration = await firstValueFrom(this.migrationService.rotateMongoCredentials({
        migrationId: this.selectedMigration!.migrationId,
        confirmEnvironment: this.request.confirmEnvironment || "",
        targetMongo: this.request.targetMongo,
        rotateS3Credentials: this.request.rotateS3Credentials
      }));
      this.selectedMigration = migration;
      this.success = "Environment credentials rotated in environment config.";
      this.selectTab(EnvironmentMigrationTab.RESULT);
      await this.loadHistory();
    });
  }

  selectMigration(migration: EnvironmentMigrationAudit): void {
    this.selectedMigration = migration;
    this.request.environment = migration.environment;
    this.request.targetMongo.cluster = migration.targetMongo.cluster;
    this.request.targetMongo.db = migration.targetMongo.db;
    this.request.targetMongo.username = migration.targetMongo.username;
    this.request.mode = migration.mode;
    this.request.backupPath = migration.backupPath || "";
    this.request.backupName = migration.backupName || "";
    this.request.backupLocation = migration.backupLocation || this.backupSource;
    this.selectTab(EnvironmentMigrationTab.RESULT);
  }

  envOf(item: BackupListItem): string {
    return backupEnvironment(item);
  }

  statusClass(status: string): string {
    return status.replace(/_/g, "-").replace(/\s+/g, "-");
  }

  s3Rows(migration: EnvironmentMigrationAudit): any[] {
    return [...(migration.s3Backups || []), ...(migration.s3Restores || [])];
  }

  trackMigration(index: number, migration: EnvironmentMigrationAudit): string {
    return migration.migrationId;
  }

  trackCollectionCount(index: number, row: any): string {
    return row.collection;
  }

  trackS3Summary(index: number, row: any): string {
    return `${row.site}-${row.timestamp}-${index}`;
  }

  private applyBackupFilter(): void {
    const environment = this.sourceEnvironment || this.request.environment;
    const sourceBackups = this.allBackups.filter(backup => backupSource(backup, this.backupSource) === this.backupSource);
    this.backups = environment ? sourceBackups.filter(backup => sameBackupEnvironment(this.envOf(backup), environment)) : [...sourceBackups];
  }

  private updateS3Preview(): void {
    if (this.request.mode !== EnvironmentMigrationMode.MONGO_AND_S3 || !this.selectedBackupForRestore) {
      this.selectedS3Manifest = null;
      return;
    }
    const environment = this.envOf(this.selectedBackupForRestore);
    const timestamp = this.backupTimestamp(this.selectedBackupForRestore);
    if (!environment || !timestamp) {
      this.selectedS3Manifest = null;
      return;
    }
    this.backupService.s3ManifestByTimestamp(environment, timestamp).subscribe({
      next: manifest => this.selectedS3Manifest = manifest,
      error: error => {
        this.logger.error("Failed to load S3 manifest preview:", error);
        this.selectedS3Manifest = null;
      }
    });
  }

  private backupTimestamp(item: BackupListItem): string {
    const path = item.path || "";
    if (path.startsWith("s3://")) {
      const afterScheme = path.substring(path.indexOf("//") + 2);
      const parts = afterScheme.split("/");
      return parts[2] || "";
    }
    return (item.name || "").slice(0, 19);
  }

  private async run(action: string, operation: () => Promise<void>): Promise<void> {
    this.error = "";
    this.success = "";
    this.busy = true;
    this.busyAction = action;
    try {
      await operation();
    } catch (error: any) {
      this.logger.error(`Migration ${action} failed:`, error);
      this.error = this.extractErrorMessage(error, `Migration ${action} failed`);
    } finally {
      this.busy = false;
      this.busyAction = "";
    }
  }

  private pollMigration(migrationId: string, attempt = 0): void {
    setTimeout(async () => {
      try {
        const migration = await firstValueFrom(this.migrationService.migration(migrationId));
        this.selectedMigration = migration;
        await this.loadHistory();
        if (this.migrationActive(migration) && attempt < 720) {
          this.pollMigration(migrationId, attempt + 1);
        } else if (migration.status === EnvironmentMigrationStatus.READY_FOR_CUTOVER) {
          this.success = "Migration restored and verified. Credentials are not rotated yet.";
        } else if (migration.status === EnvironmentMigrationStatus.ROTATED) {
          this.success = "Migration verified and credentials rotated.";
        } else if (migration.status === EnvironmentMigrationStatus.FAILED) {
          this.error = migration.error || "Migration failed";
        } else if (migration.status === EnvironmentMigrationStatus.ORPHANED) {
          this.error = migration.error || "Migration was interrupted by a server restart";
        }
      } catch (error: any) {
        this.logger.error("Migration polling failed:", error);
      }
    }, 5000);
  }

  private migrationActive(migration: EnvironmentMigrationAudit): boolean {
    const activeStatuses: EnvironmentMigrationStatus[] = [
      EnvironmentMigrationStatus.PENDING,
      EnvironmentMigrationStatus.VALIDATING,
      EnvironmentMigrationStatus.DUMPING,
      EnvironmentMigrationStatus.RESTORING,
      EnvironmentMigrationStatus.VERIFYING
    ];
    return activeStatuses.includes(migration.status as EnvironmentMigrationStatus);
  }

  private extractErrorMessage(error: any, fallback: string): string {
    return error?.error?.error || error?.error?.message || error?.message || fallback;
  }
}
