import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { isString } from "es-toolkit/compat";
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
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import {
  createEmptyEnvironmentConfig,
  EnvironmentConfig,
  EnvironmentsConfig
} from "../../../models/environment-config.model";
import { EnvironmentSettingsSubTab, Image, SystemConfig, SystemSettingsTab } from "../../../models/system.model";
import { EnvironmentSetupTab } from "../../../models/environment-setup.model";
import { InputSize } from "../../../models/ui-size.model";
import { asNumber } from "../../../functions/numbers";
import { toKebabCase } from "../../../functions/strings";

@Component({
  selector: "app-environment-per-env-settings",
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    FontAwesomeModule,
    SecretInputComponent,
    SecretsEditor,
    MongoUriInputComponent
  ],
  styles: [`
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

    .btn-outline-cloudflare
      border: 1px solid #F6821F
      color: #F6821F
      background-color: transparent
      &:hover
        background-color: #F6821F
        border-color: #F6821F
        color: white
  `],
  template: `
    @if (currentEnvironment) {
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading-with-select">
          <strong class="text-nowrap">
            Environment Configuration {{ currentEnvironmentIndex + 1 }}
            of {{ environmentCount }}:</strong>
          <select class="form-control"
                  [(ngModel)]="currentEnvironmentIndex"
                  name="environmentSelector">
            @for (env of config.environments; let i = $index; track i) {
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
          <div class="thumbnail-heading with-vendor-logo d-flex align-items-center gap-2">
            <img src="assets/icons/cloudflare-logo.svg" alt="Cloudflare" style="height: 26px;">
            <span>Email Routing (Per-Environment)</span>
            @if (config?.cloudflare?.accountId && currentEnvironment?.cloudflare?.baseDomain) {
              <a [href]="'https://dash.cloudflare.com/' + config.cloudflare.accountId + '/' + currentEnvironment.cloudflare.baseDomain + '/email/routing/overview'"
                 target="_blank"
                 class="btn btn-sm btn-outline-cloudflare ms-auto">
                <fa-icon [icon]="faExternalLinkAlt"></fa-icon>
                Email Routing
              </a>
            }
          </div>
          <div class="row">
            <div class="col-md-6 mb-2">
              <label class="form-label">Zone ID</label>
              <app-secret-input
                [(ngModel)]="currentEnvironment.cloudflare.zoneId"
                name="envCloudflareZoneId"
                [size]="InputSize.SM">
              </app-secret-input>
              <small class="form-text text-muted">Cloudflare zone for this environment's domain</small>
            </div>
            <div class="col-md-6 mb-2">
              <label class="form-label">Account ID (override)</label>
              <app-secret-input
                [(ngModel)]="currentEnvironment.cloudflare.accountId"
                name="envCloudflareAccountId"
                [size]="InputSize.SM">
              </app-secret-input>
              <small class="form-text text-muted">Leave empty to use <a routerLink="/admin/environment-setup" [queryParams]="environmentSetupGlobalQueryParams">global</a> account</small>
            </div>
            <div class="col-md-6 mb-2">
              <label class="form-label">API Token (override)</label>
              <app-secret-input
                [(ngModel)]="currentEnvironment.cloudflare.apiToken"
                name="envCloudflareApiToken"
                [size]="InputSize.SM">
              </app-secret-input>
              <small class="form-text text-muted">Leave empty to use <a routerLink="/admin/environment-setup" [queryParams]="environmentSetupGlobalQueryParams">global</a> token</small>
            </div>
          </div>
          <small class="form-text text-muted">Zone ID for email routing. The base domain is derived from the <a routerLink="/admin/system-settings" [queryParams]="systemSettingsAreaGroupQueryParams">Web URL</a>. API credentials are inherited from the <a routerLink="/admin/environment-setup" [queryParams]="environmentSetupGlobalQueryParams">global Cloudflare config</a> and encrypted during deployment.</small>
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
  `
})
export class EnvironmentPerEnvSettings implements OnInit, OnDestroy {

  private systemConfigService = inject(SystemConfigService);
  urlService = inject(UrlService);
  private subscriptions: Subscription[] = [];

  @Input({required: true}) config: EnvironmentsConfig;

  systemConfig: SystemConfig;
  headerLogo: Image;

  protected readonly InputSize = InputSize;
  protected readonly environmentSetupGlobalQueryParams = {tab: toKebabCase(EnvironmentSetupTab.SETTINGS), "sub-tab": EnvironmentSettingsSubTab.GLOBAL};
  protected readonly systemSettingsAreaGroupQueryParams = {tab: toKebabCase(SystemSettingsTab.AREA_AND_GROUP)};
  protected readonly faBackward = faBackward;
  protected readonly faForward = faForward;
  protected readonly faCopy = faCopy;
  protected readonly faPlus = faPlus;
  protected readonly faTrash = faTrash;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;

  private _currentEnvironmentIndex = 0;

  get currentEnvironmentIndex(): number {
    return this._currentEnvironmentIndex;
  }

  set currentEnvironmentIndex(value: number) {
    const numValue = isString(value) ? asNumber(value) : value;
    const maxIndex = Math.max(0, this.config.environments.length - 1);
    this._currentEnvironmentIndex = Math.min(Math.max(0, numValue), maxIndex);
  }

  get currentEnvironment(): EnvironmentConfig | null {
    return this.config.environments[this.currentEnvironmentIndex] ?? null;
  }

  get environmentCount(): number {
    return this.config.environments.length;
  }

  get canNavigatePrevious(): boolean {
    return this.currentEnvironmentIndex > 0;
  }

  get canNavigateNext(): boolean {
    return this.currentEnvironmentIndex < this.config.environments.length - 1;
  }

  ngOnInit() {
    this.subscriptions.push(
      this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => {
        this.systemConfig = systemConfig;
        this.headerLogo = this.systemConfig?.logos?.images?.find(logo => logo.originalFileName === this.systemConfig?.header?.selectedLogo);
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
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
      this.config.environments.splice(this.currentEnvironmentIndex + 1, 0, duplicated);
      this.currentEnvironmentIndex++;
    }
  }

  deleteCurrentEnvironment() {
    if (this.config.environments.length > 0) {
      this.config.environments.splice(this.currentEnvironmentIndex, 1);
      if (this.currentEnvironmentIndex >= this.config.environments.length) {
        this.currentEnvironmentIndex = Math.max(0, this.config.environments.length - 1);
      }
    }
  }

  addNewEnvironment() {
    this.config.environments.push(createEmptyEnvironmentConfig());
    this.currentEnvironmentIndex = this.config.environments.length - 1;
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
