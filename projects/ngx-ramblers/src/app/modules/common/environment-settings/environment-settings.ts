import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import { isString } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faBackward,
  faCopy,
  faExternalLinkAlt,
  faForward,
  faPlus,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { SecretInputComponent } from "../secret-input/secret-input.component";
import { SecretsEditor } from "../secrets-editor/secrets-editor";
import { MongoUriInputComponent, MongoUriParseResult } from "../mongo-uri-input/mongo-uri-input";
import { EnvironmentConfigService } from "../../../services/environment-config.service";
import { BackupAndRestoreService } from "../../../services/backup-and-restore.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import {
  createDefaultFlyioConfig,
  createEmptyAwsConfig,
  createEmptyEnvironmentConfig,
  createEmptyMongoConfig,
  EnvironmentConfig,
  EnvironmentsConfig
} from "../../../models/environment-config.model";
import { Image, SystemConfig } from "../../../models/system.model";
import { InputSize } from "../../../models/ui-size.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { asNumber } from "../../../functions/numbers";
import { sortBy } from "../../../functions/arrays";

@Component({
  selector: "app-environment-settings",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    SecretInputComponent,
    SecretsEditor,
    MongoUriInputComponent
  ],
  styles: [`
    .thumbnail-heading
      position: relative
      top: -32px

    .btn-outline-aws
      border: 1px solid #FF9900
      color: #FF9900
      background-color: transparent
      &:hover
        background-color: #FF9900
        border-color: #FF9900
        color: white

    .btn-outline-mongodb
      border: 1px solid #00684A
      color: #00684A
      background-color: transparent
      &:hover
        background-color: #00684A
        border-color: #00684A
        color: white

    .btn-outline-flyio
      border: 1px solid #7c3aed
      color: #7c3aed
      background-color: transparent
      &:hover
        background-color: #7c3aed
        border-color: #7c3aed
        color: white

    .btn-outline-ramblers
      border: 1px solid #9BC8AB
      color: #9BC8AB
      background-color: transparent
      &:hover
        background-color: #9BC8AB
        border-color: #9BC8AB
        color: white
  `],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Environment Configuration</div>
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
        <button type="button" class="btn btn-secondary btn-sm" (click)="loadConfig()">
          Reload Config
        </button>
        <small class="form-text text-muted d-block mt-2">
          Initialise will read configs.json and secret files to populate per-environment
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
            <div class="thumbnail-heading with-vendor-logo d-flex align-items-center gap-2">
              <img src="assets/icons/aws-logo.svg" alt="AWS" style="height: 26px;">
              <span>Global AWS S3 Configuration</span>
              <a href="https://s3.console.aws.amazon.com/s3/buckets?region=eu-west-2"
                 target="_blank"
                 class="btn btn-sm btn-outline-aws ms-auto">
                <fa-icon [icon]="faExternalLinkAlt"></fa-icon>
                S3 Console
              </a>
            </div>
            <div class="row">
              <div class="col-md-6 mb-2">
                <label class="form-label">Bucket</label>
                <input type="text"
                       class="form-control"
                       [(ngModel)]="editableConfig.aws.bucket"
                       name="globalAwsBucket"
                       placeholder="e.g. ngx-ramblers-backups">
              </div>
              <div class="col-md-6 mb-2">
                <label class="form-label">Region</label>
                <input type="text"
                       class="form-control"
                       [(ngModel)]="editableConfig.aws.region"
                       name="globalAwsRegion"
                       placeholder="e.g. eu-west-2">
              </div>
              <div class="col-md-6 mb-2">
                <label class="form-label">Access Key ID</label>
                <app-secret-input
                  [(ngModel)]="editableConfig.aws.accessKeyId"
                  name="globalAwsAccessKeyId"
                  [size]="InputSize.SM">
                </app-secret-input>
              </div>
              <div class="col-md-6 mb-2">
                <label class="form-label">Secret Access Key</label>
                <app-secret-input
                  [(ngModel)]="editableConfig.aws.secretAccessKey"
                  name="globalAwsSecretAccessKey"
                  [size]="InputSize.SM">
                </app-secret-input>
              </div>
            </div>
            <small class="form-text text-muted">If set, all uploads/listing/deletes will use this bucket and credentials,
              with per-environment settings used only as a fallback.</small>
          </div>
          <div class="row thumbnail-heading-frame mb-5">
            <div class="thumbnail-heading">Global Application Secrets</div>
            <small class="form-text text-muted mb-3">
              Default environment variables for all environments. Can be overridden per-environment.
            </small>
            <app-secrets-editor
              [secrets]="editableConfig.secrets || {}"
              (secretsChange)="editableConfig.secrets = $event"
              namePrefix="global">
            </app-secrets-editor>
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
                <div class="thumbnail-heading with-vendor-logo d-flex align-items-center gap-2">
                  @if (headerLogo?.awsFileName) {
                    <img [src]="urlService.resourceRelativePathForAWSFileName(headerLogo.awsFileName)"
                         [alt]="systemConfig?.group?.shortName" style="height: 39px;">
                  }
                  <span>Environment Details</span>
                  @if (currentEnvironment?.flyio?.appName) {
                    <a [href]="'https://' + currentEnvironment.flyio.appName + '.fly.dev'"
                       target="_blank"
                       class="btn btn-sm btn-outline-ramblers ms-auto">
                      <fa-icon [icon]="faExternalLinkAlt"></fa-icon>
                      Open App
                    </a>
                  }
                </div>
                <div class="row">
                  <div class="col-md-12 mb-3">
                    <label class="form-label">Environment Name</label>
                    <input type="text"
                           class="form-control"
                           [(ngModel)]="currentEnvironment.environment"
                           name="envName"
                           autocomplete="off"
                           placeholder="e.g., staging, production">
                  </div>
                </div>
              </div>
              <div class="row thumbnail-heading-frame">
                <div class="thumbnail-heading with-vendor-logo d-flex align-items-center gap-2">
                  <img src="assets/icons/aws-logo.svg" alt="AWS" style="height: 26px;">
                  <span>AWS S3 Configuration</span>
                  @if (currentEnvironment?.aws?.bucket) {
                    <a [href]="'https://s3.console.aws.amazon.com/s3/buckets/' + currentEnvironment.aws.bucket + '?region=' + (currentEnvironment.aws.region || 'eu-west-2')"
                       target="_blank"
                       class="btn btn-sm btn-outline-aws ms-auto">
                      <fa-icon [icon]="faExternalLinkAlt"></fa-icon>
                      S3 Console
                    </a>
                  }
                </div>
                <div class="row">
                  <div class="col-md-6 mb-2">
                    <label class="form-label">Bucket</label>
                    <input type="text"
                           class="form-control"
                           [(ngModel)]="currentEnvironment.aws.bucket"
                           name="awsBucket"
                           autocomplete="off">
                  </div>
                  <div class="col-md-6 mb-2">
                    <label class="form-label">Region</label>
                    <input type="text"
                           class="form-control"
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
                      [size]="InputSize.SM">
                    </app-secret-input>
                  </div>
                  <div class="col-md-6 mb-2">
                    <label class="form-label">Secret Access Key</label>
                    <app-secret-input
                      [(ngModel)]="currentEnvironment.aws.secretAccessKey"
                      name="awsSecret"
                      [size]="InputSize.SM">
                    </app-secret-input>
                  </div>
                </div>
              </div>
              <div class="row thumbnail-heading-frame">
                <div class="thumbnail-heading d-flex align-items-center gap-3">
                  <img src="assets/icons/mongodb-logo.svg" alt="MongoDB" style="height: 30px;">
                  <span>MongoDB Configuration</span>
                  @if (currentEnvironment?.mongo?.cluster || currentEnvironment?.mongo?.db) {
                    <a href="https://cloud.mongodb.com/"
                       target="_blank"
                       class="btn btn-sm btn-outline-mongodb ms-auto">
                      <fa-icon [icon]="faExternalLinkAlt"></fa-icon>
                      MongoDB Atlas
                    </a>
                  }
                </div>
                <app-mongo-uri-input (parsedUri)="onMongoUriParsed($event)"/>
                <div class="row">
                  <div class="col-md-6 mb-2">
                    <label class="form-label">Cluster</label>
                    <input type="text"
                           class="form-control"
                           [(ngModel)]="currentEnvironment.mongo.cluster"
                           name="mongoCluster"
                           autocomplete="off"
                           placeholder="e.g. cluster0.abc123">
                    <small class="form-text text-muted">Without .mongodb.net suffix</small>
                  </div>
                  <div class="col-md-6 mb-2">
                    <label class="form-label">Database</label>
                    <input type="text"
                           class="form-control"
                           [(ngModel)]="currentEnvironment.mongo.db"
                           name="mongoDb"
                           autocomplete="off">
                  </div>
                  <div class="col-md-6 mb-2">
                    <label class="form-label">Username</label>
                    <input type="text"
                           class="form-control"
                           [(ngModel)]="currentEnvironment.mongo.username"
                           name="mongoUser"
                           autocomplete="off">
                  </div>
                  <div class="col-md-6 mb-2">
                    <label class="form-label">Password</label>
                    <app-secret-input
                      [(ngModel)]="currentEnvironment.mongo.password"
                      name="mongoPass"
                      [size]="InputSize.SM">
                    </app-secret-input>
                  </div>
                </div>
              </div>
              <div class="row thumbnail-heading-frame">
                <div class="thumbnail-heading d-flex align-items-center gap-3">
                  <img src="assets/icons/flyio-logo.svg" alt="Fly.io" style="height: 28px;">
                  <span>Fly.io Configuration</span>
                  @if (currentEnvironment?.flyio?.appName) {
                    <a [href]="'https://fly.io/apps/' + currentEnvironment.flyio.appName"
                       target="_blank"
                       class="btn btn-sm btn-outline-flyio ms-auto">
                      <fa-icon [icon]="faExternalLinkAlt"></fa-icon>
                      Fly.io Dashboard
                    </a>
                  }
                </div>
                <div class="row">
                  <div class="col-md-12 mb-2">
                    <label class="form-label">API Key</label>
                    <app-secret-input
                      [(ngModel)]="currentEnvironment.flyio.apiKey"
                      name="flyApiKey"
                      [size]="InputSize.SM">
                    </app-secret-input>
                  </div>
                  <div class="col-md-4 mb-2">
                    <label class="form-label">App Name</label>
                    <input type="text"
                           class="form-control"
                           [(ngModel)]="currentEnvironment.flyio.appName"
                           name="flyAppName"
                           autocomplete="off">
                  </div>
                  <div class="col-md-4 mb-2">
                    <label class="form-label">Memory</label>
                    <input type="text"
                           class="form-control"
                           [(ngModel)]="currentEnvironment.flyio.memory"
                           name="flyMemory"
                           autocomplete="off"
                           placeholder="512mb">
                  </div>
                  <div class="col-md-4 mb-2">
                    <label class="form-label">Scale Count</label>
                    <input type="number"
                           class="form-control"
                           [(ngModel)]="currentEnvironment.flyio.scaleCount"
                           name="flyScale"
                           autocomplete="off">
                  </div>
                  <div class="col-md-12 mb-2">
                    <label class="form-label">Organisation</label>
                    <input type="text"
                           class="form-control"
                           [(ngModel)]="currentEnvironment.flyio.organisation"
                           name="flyOrg"
                           autocomplete="off"
                           placeholder="Fly.io organisation/team name">
                  </div>
                </div>
              </div>
              <div class="row thumbnail-heading-frame">
                <div class="thumbnail-heading">Application Secrets (Overrides)</div>
                <small class="form-text text-muted mb-2">
                  Leave empty to use global defaults. Only set values here to override the global setting for this environment.
                </small>
                <app-secrets-editor
                  [secrets]="currentEnvironment.secrets || {}"
                  (secretsChange)="currentEnvironment.secrets = $event"
                  namePrefix="env">
                </app-secrets-editor>
              </div>
            </div>
          } @else {
            <div class="alert alert-warning">
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
  `
})
export class EnvironmentSettings implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("EnvironmentSettings", NgxLoggerLevel.ERROR);
  private environmentConfigService = inject(EnvironmentConfigService);
  private backupRestoreService = inject(BackupAndRestoreService);
  private notifierService = inject(NotifierService);
  private systemConfigService = inject(SystemConfigService);
  urlService = inject(UrlService);
  private subscriptions: Subscription[] = [];

  systemConfig: SystemConfig;
  headerLogo: Image;

  protected readonly InputSize = InputSize;
  protected readonly faBackward = faBackward;
  protected readonly faForward = faForward;
  protected readonly faCopy = faCopy;
  protected readonly faPlus = faPlus;
  protected readonly faTrash = faTrash;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;

  notifyTarget: AlertTarget = {};
  notify: AlertInstance;

  configJson = "";
  configError = "";
  jsonViewMode = false;
  private _currentEnvironmentIndex = 0;
  editableConfig: EnvironmentsConfig = {
    environments: [],
    aws: createEmptyAwsConfig(),
    secrets: {}
  };

  get currentEnvironmentIndex(): number {
    return this._currentEnvironmentIndex;
  }

  set currentEnvironmentIndex(value: number) {
    const numValue = isString(value) ? asNumber(value) : value;
    const maxIndex = Math.max(0, this.editableConfig.environments.length - 1);
    this._currentEnvironmentIndex = Math.min(Math.max(0, numValue), maxIndex);
  }

  get currentEnvironment(): EnvironmentConfig | null {
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

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(
      this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => {
        this.systemConfig = systemConfig;
        this.headerLogo = this.systemConfig?.logos?.images?.find(logo => logo.originalFileName === this.systemConfig?.header?.selectedLogo);
      })
    );
    this.loadConfig();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadConfig() {
    this.subscriptions.push(
      this.environmentConfigService.events().subscribe({
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

  private populateFormFromConfig(config: EnvironmentsConfig) {
    this.editableConfig = JSON.parse(JSON.stringify(config));
    this.editableConfig.environments = this.editableConfig.environments || [];
    this.editableConfig.aws = {...createEmptyAwsConfig(), ...this.editableConfig.aws};
    this.editableConfig.secrets = this.editableConfig.secrets || {};
    this.editableConfig.environments = this.editableConfig.environments
      .map(env => ({
        environment: env.environment || "",
        aws: {...createEmptyAwsConfig(), ...env.aws},
        mongo: {...createEmptyMongoConfig(), ...env.mongo},
        flyio: {...createDefaultFlyioConfig(), ...env.flyio},
        secrets: env.secrets || {}
      }))
      .sort(sortBy("environment"));
    if (this.currentEnvironmentIndex >= this.editableConfig.environments.length) {
      this.currentEnvironmentIndex = Math.max(0, this.editableConfig.environments.length - 1);
    }
  }

  saveConfig() {
    this.configError = "";
    const config: EnvironmentsConfig = JSON.parse(this.configJson);
    this.environmentConfigService.saveConfig(config).then(() => {
      this.notify.success({
        title: "Configuration Saved",
        message: "Environment configuration has been saved successfully"
      });
    }).catch(err => {
      this.configError = `Error saving config: ${err.message}`;
      this.notify.error({
        title: "Error saving configuration",
        message: err.message
      });
    });
  }

  saveConfigFromForm() {
    this.configError = "";
    const config: EnvironmentsConfig = {
      environments: this.editableConfig.environments,
      aws: this.editableConfig.aws,
      secrets: this.editableConfig.secrets
    };

    this.environmentConfigService.saveConfig(config).then(() => {
      this.configJson = JSON.stringify(config, null, 2);
      this.notify.success({
        title: "Configuration Saved",
        message: "Environment configuration has been saved successfully"
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
    const newEnv = createEmptyEnvironmentConfig();
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
      const duplicated: EnvironmentConfig = JSON.parse(JSON.stringify(this.currentEnvironment));
      duplicated.environment = `${duplicated.environment} (Copy)`;
      this.editableConfig.environments.splice(this.currentEnvironmentIndex + 1, 0, duplicated);
      this.currentEnvironmentIndex++;
    }
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
          const environmentsConfig: EnvironmentsConfig = {
            environments: config.environments?.map(env => ({
              environment: env.environment,
              aws: env.aws,
              mongo: env.mongo,
              flyio: env.flyio,
              secrets: env.secrets
            })) || [],
            aws: config.aws,
            secrets: config.secrets
          };
          this.configJson = JSON.stringify(environmentsConfig, null, 2);
          this.populateFormFromConfig(environmentsConfig);
          this.notify.success({
            title: "Configuration Initialised",
            message: `Successfully initialised ${environmentsConfig.environments?.length || 0} environment configurations from files`
          });
        },
        error: err => {
          this.configError = `Error initialising config: ${err.error?.error || err.message}`;
          this.notify.error({
            title: "Error initialising configuration",
            message: err.error?.error || err.message
          });
        }
      })
    );
  }

  onMongoUriParsed(result: MongoUriParseResult) {
    if (this.currentEnvironment) {
      this.currentEnvironment.mongo.cluster = result.cluster;
      this.currentEnvironment.mongo.username = result.username;
      this.currentEnvironment.mongo.password = result.password;
      if (result.database) {
        this.currentEnvironment.mongo.db = result.database;
      }
    }
  }

}
