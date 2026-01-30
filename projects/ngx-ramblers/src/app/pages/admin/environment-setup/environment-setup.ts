import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ActivatedRoute, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { kebabCase } from "es-toolkit/compat";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  createEmptySetupRequest,
  EnvironmentDefaults,
  EnvironmentSetupRequest,
  EnvironmentSetupResult,
  EnvironmentSetupStepperKey,
  EnvironmentSetupStepperStep,
  EnvironmentSetupTab,
  ExistingEnvironment,
  ManageAction,
  OperationInProgress,
  SetupMode,
  SetupProgress,
  ValidationResult
} from "../../../models/environment-setup.model";
import { StoredValue } from "../../../models/ui-actions";
import { parseMongoUri } from "../../../functions/mongo";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { AvailableArea, AvailableAreaWithLabel, SystemConfig } from "../../../models/system.model";
import { RamblersGroupsApiResponse, RamblersGroupWithLabel } from "../../../models/ramblers-walks-manager";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { UrlService } from "../../../services/url.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { PageComponent } from "../../../page/page.component";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faArrowLeft,
  faCheck,
  faCheckCircle,
  faCog,
  faExclamationCircle,
  faExclamationTriangle,
  faPlus,
  faRedo,
  faSpinner,
  faTimes,
  faTrash,
  faUndo,
  faUsers
} from "@fortawesome/free-solid-svg-icons";
import { StepperModule } from "primeng/stepper";
import { NgSelectComponent } from "@ng-select/ng-select";
import { StatusIconComponent } from "../status-icon";
import { Status } from "../../../models/ramblers-upload-audit.model";
import { SecretInputComponent } from "../../../modules/common/secret-input/secret-input.component";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { EventType, MessageType } from "../../../models/websocket.model";
import { SessionLogsComponent } from "../../../shared/components/session-logs";
import { EnvironmentSettings } from "../../../modules/common/environment-settings/environment-settings";
import { EnvironmentManagement } from "../../../modules/common/environment-management/environment-management";

@Component({
  selector: "app-environment-setup",
  template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          @if (!enabled) {
            <div class="alert alert-warning">
              <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
              Environment setup is not available on this environment.
              Please use the CLI or staging environment.
            </div>
          } @else {
            <tabset class="custom-tabset">
              <tab [active]="tabActive(EnvironmentSetupTab.CREATE)"
                   (selectTab)="selectTab(EnvironmentSetupTab.CREATE)"
                   [heading]="EnvironmentSetupTab.CREATE">
                @if (tabActive(EnvironmentSetupTab.CREATE)) {
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <div class="row thumbnail-heading-frame">
                      <div class="thumbnail-heading">Environment Setup</div>
                      <p class="text-muted mb-3">
                        Use this wizard to set up a new environment for a Ramblers group or area.
                      </p>
                      <p-stepper [(value)]="stepperActiveIndex" [linear]="false">
                        @for (step of stepperSteps; let idx = $index; track step.key) {
                          <p-step-item [value]="idx">
                            <p-step [disabled]="!canAccessStep(step.key)">
                              <div class="import-step-header">
                                <span class="import-step-number">{{ idx + 1 }}</span>
                                <div class="import-step-text">
                                  <div class="import-step-label">{{ step.label }}</div>
                                  <div class="import-step-hint">{{ stepHint(step.key) }}</div>
                                </div>
                              </div>
                            </p-step>
                            <p-step-panel>
                              <ng-template pTemplate="content">
                                @if (step.key === EnvironmentSetupStepperKey.RAMBLERS_SELECTION) {
                                <div>
                                  <div class="d-flex gap-4 mb-4">
                                    <div class="form-check">
                                      <input class="form-check-input" type="radio" name="setupMode" id="modeCreate"
                                             [checked]="setupMode === SetupMode.CREATE"
                                             (change)="setSetupMode(SetupMode.CREATE)">
                                      <label class="form-check-label" for="modeCreate">
                                        <fa-icon [icon]="faPlus" class="me-2"></fa-icon>
                                        Create New Environment
                                      </label>
                                    </div>
                                    <div class="form-check">
                                      <input class="form-check-input" type="radio" name="setupMode" id="modeResume"
                                             [checked]="setupMode === SetupMode.MANAGE"
                                             (change)="setSetupMode(SetupMode.MANAGE)">
                                      <label class="form-check-label" for="modeResume">
                                        <fa-icon [icon]="faRedo" class="me-2"></fa-icon>
                                        Resume Existing Setup
                                      </label>
                                    </div>
                                  </div>
                                  @if (setupMode === SetupMode.CREATE) {
                                  <div class="row mb-3">
                                  <div class="col-md-6">
                                    <div class="form-group">
                                      <label for="ramblers-api-key">Ramblers API Key</label>
                                      <app-secret-input [(ngModel)]="request.serviceConfigs.ramblers.apiKey"
                                                        id="ramblers-api-key"
                                                        placeholder="Enter your Ramblers API key">
                                      </app-secret-input>
                                    </div>
                                  </div>
                                  <div class="col-md-6 d-flex align-items-end">
                                    <button class="btn btn-primary mb-3" (click)="validateApiKey()"
                                            [disabled]="!request.serviceConfigs.ramblers.apiKey || apiKeyValidating">
                                      @if (apiKeyValidating) {
                                        <fa-icon [icon]="faSpinner" [spin]="true"></fa-icon>
                                      }
                                      Validate API Key
                                    </button>
                                    @if (apiKeyValid !== null) {
                                      <span class="ms-2 mb-3" [ngClass]="apiKeyValid ? 'text-success' : 'text-danger'">
                                        {{ apiKeyValid ? 'Valid' : 'Invalid' }}
                                      </span>
                                    }
                                  </div>
                                </div>
                              @if (apiKeyValid) {
                                <div class="row mb-3">
                                  <div class="col-md-6">
                                    <div class="form-group">
                                      <label for="area-select">Ramblers Area
                                        ({{ loadingAreas ? 'retrieving areas...' : availableAreas.length + ' areas available' }})
                                      </label>
                                      <div class="position-relative">
                                        <ng-select id="area-select"
                                                   [items]="availableAreas"
                                                   bindLabel="ngSelectLabel"
                                                   bindValue="areaCode"
                                                   [searchable]="true"
                                                   [clearable]="false"
                                                   [loading]="loadingAreas"
                                                   dropdownPosition="bottom"
                                                   placeholder="Select an area..."
                                                   [(ngModel)]="selectedAreaCode"
                                                   (ngModelChange)="onAreaCodeChange($event)">
                                        </ng-select>
                                        <app-status-icon noLabel [status]="areaQueryStatus" class="area-status-icon"/>
                                      </div>
                                    </div>
                                  </div>
                                  <div class="col-md-6">
                                    <div class="form-group">
                                      <label for="group-select">Select Group
                                        ({{ loadingGroups ? 'retrieving groups...' : availableGroups.length + ' groups available' }})
                                      </label>
                                      <div class="position-relative">
                                        <ng-select id="group-select"
                                                   [items]="availableGroups"
                                                   bindLabel="ngSelectAttributes.label"
                                                   [searchable]="true"
                                                   [clearable]="false"
                                                   [loading]="loadingGroups"
                                                   dropdownPosition="bottom"
                                                   placeholder="Select a group..."
                                                   [(ngModel)]="selectedGroup"
                                                   (ngModelChange)="onGroupSelected()">
                                        </ng-select>
                                        <app-status-icon noLabel [status]="groupQueryStatus" class="group-status-icon"/>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                @if (selectedGroup) {
                                  <div class="row mb-3">
                                    <div class="col-md-12">
                                      <div class="alert alert-warning mb-0">
                                        <fa-icon [icon]="faUsers" class="me-2"></fa-icon>
                                        <strong>Selected Group:</strong> {{ selectedGroup.name }}<br>
                                        <strong>Code:</strong> {{ selectedGroup.group_code }}<br>
                                        @if (selectedGroup.url || selectedGroup.external_url) {
                                          <strong>URL:</strong> <a [href]="selectedGroup.url || selectedGroup.external_url"
                                                                   target="_blank">{{ selectedGroup.url || selectedGroup.external_url }}</a>
                                        }
                                      </div>
                                    </div>
                                  </div>
                                }
                                }
                                <div class="stepper-nav">
                                  <button type="button" class="btn btn-secondary" (click)="cancel()">Cancel</button>
                                  <button type="button" class="btn btn-primary" (click)="goToStep(1)"
                                          [disabled]="!canAccessStep(EnvironmentSetupStepperKey.SERVICES_CONFIG)">Next
                                  </button>
                                </div>
                                  } @else {
                                    <app-environment-management/>
                                  }
                              </div>
                            } @else if (step.key === EnvironmentSetupStepperKey.SERVICES_CONFIG) {
                            <div>
                              <div class="row thumbnail-heading-frame">
                                <div class="thumbnail-heading">Environment Basics</div>
                                <div class="row">
                                  <div class="col-md-4">
                                    <label for="env-name">Environment Name</label>
                                    <input [(ngModel)]="request.environmentBasics.environmentName"
                                           type="text" class="form-control" id="env-name"
                                           placeholder="e.g. surrey" (change)="updateAppName()">
                                  </div>
                                  <div class="col-md-4">
                                    <label for="app-name">Fly.io App Name</label>
                                    <input [(ngModel)]="request.environmentBasics.appName"
                                           type="text" class="form-control" id="app-name">
                                  </div>
                                  <div class="col-md-2">
                                    <label for="memory">Memory (MB)</label>
                                    <input [(ngModel)]="request.environmentBasics.memory"
                                           type="text" class="form-control" id="memory">
                                  </div>
                                  <div class="col-md-2">
                                    <label for="scale">Instances</label>
                                    <input [(ngModel)]="request.environmentBasics.scaleCount"
                                           type="number" class="form-control" id="scale">
                                  </div>
                                </div>
                              </div>

                              <div class="row thumbnail-heading-frame">
                                <div class="thumbnail-heading">MongoDB Configuration</div>
                                <div class="row mb-2">
                                  <div class="col-md-8">
                                    <label for="mongo-connection-string">Connection String (paste full URI to auto-populate)</label>
                                    <input [(ngModel)]="mongoConnectionString"
                                           type="text" class="form-control" id="mongo-connection-string"
                                           placeholder="mongodb+srv://user:password@cluster.mongodb.net/database"
                                           (paste)="onMongoConnectionStringPaste($event)"
                                           (ngModelChange)="handleParseMongoConnectionString()">
                                  </div>
                                  <div class="col-md-4 d-flex align-items-end">
                                    @if (mongoConnectionStringParsed) {
                                      <span class="text-success mb-2">
                                        <fa-icon [icon]="faCheck" class="me-1"></fa-icon>
                                        Parsed successfully
                                      </span>
                                    } @else if (mongoConnectionString && !mongoConnectionStringParsed) {
                                      <span class="text-warning mb-2">
                                        <fa-icon [icon]="faExclamationTriangle" class="me-1"></fa-icon>
                                        Could not parse URI
                                      </span>
                                    }
                                  </div>
                                </div>
                                <div class="row">
                                  <div class="col-md-4">
                                    <label for="mongo-cluster">Cluster</label>
                                    <input [(ngModel)]="request.serviceConfigs.mongodb.cluster"
                                           type="text" class="form-control" id="mongo-cluster"
                                           placeholder="e.g. cluster0.xxxxx">
                                  </div>
                                  <div class="col-md-4">
                                    <label for="mongo-database">Database</label>
                                    <input [(ngModel)]="request.serviceConfigs.mongodb.database"
                                           type="text" class="form-control" id="mongo-database">
                                  </div>
                                </div>
                                <div class="row mt-2">
                                  <div class="col-md-4">
                                    <label for="mongo-username">Username</label>
                                    <app-secret-input [(ngModel)]="request.serviceConfigs.mongodb.username"
                                                      id="mongo-username">
                                    </app-secret-input>
                                  </div>
                                  <div class="col-md-4">
                                    <label for="mongo-password">Password</label>
                                    <app-secret-input [(ngModel)]="request.serviceConfigs.mongodb.password"
                                                      id="mongo-password">
                                    </app-secret-input>
                                  </div>
                                  <div class="col-md-4 d-flex align-items-end">
                                    <button class="btn btn-secondary" (click)="validateMongodb()"
                                            [disabled]="mongoValidating">
                                      @if (mongoValidating) {
                                        <fa-icon [icon]="faSpinner" [spin]="true"></fa-icon>
                                      }
                                      Test Connection
                                    </button>
                                    @if (mongoValid !== null) {
                                      <span class="ms-2" [ngClass]="mongoValid ? 'text-success' : 'text-danger'">
                                        {{ mongoValid ? 'Connected' : 'Failed' }}
                                      </span>
                                    }
                                  </div>
                                </div>
                                @if (mongoErrorMessage) {
                                  <div class="row mt-2">
                                    <div class="col-12">
                                      <div class="alert alert-danger mb-0">
                                        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                                        {{ mongoErrorMessage }}
                                      </div>
                                    </div>
                                  </div>
                                }
                              </div>

                              <div class="row thumbnail-heading-frame">
                                <div class="thumbnail-heading">AWS Configuration</div>
                                <div class="row">
                                  <div class="col-md-6">
                                    <label for="aws-bucket">S3 Bucket Name (will be auto-created)</label>
                                    <input [(ngModel)]="request.serviceConfigs.aws.bucket"
                                           type="text" class="form-control" id="aws-bucket">
                                  </div>
                                  <div class="col-md-6">
                                    <label for="aws-region">Region</label>
                                    <select class="form-control" id="aws-region"
                                            [(ngModel)]="request.serviceConfigs.aws.region">
                                      <option value="eu-west-1">eu-west-1 (Ireland)</option>
                                      <option value="eu-west-2">eu-west-2 (London)</option>
                                      <option value="us-east-1">us-east-1 (N. Virginia)</option>
                                    </select>
                                  </div>
                                </div>
                              </div>

                              <div class="row thumbnail-heading-frame">
                                <div class="thumbnail-heading">Brevo Email Configuration</div>
                                <div class="row">
                                  <div class="col-md-8">
                                    <label for="brevo-api-key">Brevo API Key (optional)</label>
                                    <app-secret-input [(ngModel)]="request.serviceConfigs.brevo.apiKey"
                                                      id="brevo-api-key"
                                                      placeholder="Enter your Brevo API key">
                                    </app-secret-input>
                                  </div>
                                </div>
                              </div>

                              <div class="row thumbnail-heading-frame">
                                <div class="thumbnail-heading">Google Maps</div>
                                <div class="row">
                                  <div class="col-md-8">
                                    <label for="google-maps-key">Google Maps API Key (optional)</label>
                                    <app-secret-input [(ngModel)]="request.serviceConfigs.googleMaps.apiKey"
                                                      id="google-maps-key"
                                                      placeholder="Leave empty to use shared key">
                                    </app-secret-input>
                                  </div>
                                </div>
                              </div>

                              <div class="row thumbnail-heading-frame">
                                <div class="thumbnail-heading">Fly.io Deployment</div>
                                <div class="row">
                                  <div class="col-md-8">
                                    <label for="flyio-token">Personal Access Token or Org Token (required for
                                      deployment)</label>
                                    <app-secret-input [(ngModel)]="request.serviceConfigs.flyio.personalAccessToken"
                                                      id="flyio-token"
                                                      placeholder="Create at fly.io/user/personal_access_tokens">
                                    </app-secret-input>
                                    <small class="text-muted">Required to create new Fly.io apps. Get one from
                                      <a href="https://fly.io/user/personal_access_tokens" target="_blank">fly.io/user/personal_access_tokens</a>
                                    </small>
                                  </div>
                                </div>
                              </div>
                              <div class="stepper-nav">
                                <button type="button" class="btn btn-secondary" (click)="goToStep(0)">Back</button>
                                <button type="button" class="btn btn-primary" (click)="goToStep(2)"
                                        [disabled]="!canAccessStep(EnvironmentSetupStepperKey.ADMIN_USER)">Next
                                </button>
                              </div>
                            </div>
                          } @else if (step.key === EnvironmentSetupStepperKey.ADMIN_USER) {
                            <div>
                              <div class="row">
                                <div class="col-md-4">
                                  <label for="admin-firstname">First Name</label>
                                  <input [(ngModel)]="request.adminUser.firstName"
                                         type="text" class="form-control" id="admin-firstname">
                                </div>
                                <div class="col-md-4">
                                  <label for="admin-lastname">Last Name</label>
                                  <input [(ngModel)]="request.adminUser.lastName"
                                         type="text" class="form-control" id="admin-lastname">
                                </div>
                                <div class="col-md-4">
                                  <label for="admin-email">Email</label>
                                  <input [(ngModel)]="request.adminUser.email"
                                         type="email" class="form-control" id="admin-email">
                                </div>
                              </div>
                              <div class="row mt-2">
                                <div class="col-md-4">
                                  <label for="admin-password">Password</label>
                                  <app-secret-input [(ngModel)]="request.adminUser.password"
                                                    id="admin-password">
                                  </app-secret-input>
                                </div>
                                <div class="col-md-4">
                                  <label for="admin-password-confirm">Confirm Password</label>
                                  <app-secret-input [(ngModel)]="confirmPassword"
                                                    id="admin-password-confirm">
                                  </app-secret-input>
                                </div>
                              </div>
                              @if (request.adminUser.password && confirmPassword && request.adminUser.password !== confirmPassword) {
                                <div class="alert alert-danger mt-2">
                                  <fa-icon [icon]="faExclamationCircle" class="me-2"></fa-icon>
                                  Passwords do not match
                                </div>
                              }

                              <div class="row thumbnail-heading-frame mt-3">
                                <div class="thumbnail-heading">Options</div>
                                <div class="form-check">
                                  <input [(ngModel)]="request.options.includeSamplePages"
                                         type="checkbox" class="form-check-input" id="include-pages">
                                  <label class="form-check-label" for="include-pages">Include sample page content</label>
                                </div>
                                <div class="form-check">
                                  <input [(ngModel)]="request.options.includeNotificationConfigs"
                                         type="checkbox" class="form-check-input" id="include-notifs">
                                  <label class="form-check-label" for="include-notifs">Include notification
                                    configs</label>
                                </div>
                                <div class="form-check">
                                  <input [(ngModel)]="request.options.skipFlyDeployment"
                                         type="checkbox" class="form-check-input" id="skip-fly">
                                  <label class="form-check-label" for="skip-fly">Skip Fly.io deployment (database init
                                    only)</label>
                                </div>
                                <div class="form-check">
                                  <input [(ngModel)]="request.options.copyStandardAssets"
                                         type="checkbox" class="form-check-input" id="copy-assets">
                                  <label class="form-check-label" for="copy-assets">Copy standard assets (logos, icons, backgrounds)</label>
                                </div>
                              </div>
                              <div class="stepper-nav">
                                <button type="button" class="btn btn-secondary" (click)="goToStep(1)">Back</button>
                                <button type="button" class="btn btn-primary" (click)="goToStep(3)"
                                        [disabled]="!canAccessStep(EnvironmentSetupStepperKey.REVIEW)">Next
                                </button>
                              </div>
                            </div>
                          } @else if (step.key === EnvironmentSetupStepperKey.REVIEW) {
                            <div>
                              <div class="row mb-3">
                                <div class="col-md-6">
                                  <h5>Ramblers Group</h5>
                                  <dl class="row">
                                    <dt class="col-sm-4">Group Code</dt>
                                    <dd class="col-sm-8">{{ request.ramblersInfo.groupCode }}</dd>
                                    <dt class="col-sm-4">Group Name</dt>
                                    <dd class="col-sm-8">{{ request.ramblersInfo.groupName }}</dd>
                                    <dt class="col-sm-4">Area</dt>
                                    <dd class="col-sm-8">{{ request.ramblersInfo.areaName }} ({{ request.ramblersInfo.areaCode }})</dd>
                                  </dl>

                                  <h5>Environment</h5>
                                  <dl class="row">
                                    <dt class="col-sm-4">Name</dt>
                                    <dd class="col-sm-8">{{ request.environmentBasics.environmentName }}</dd>
                                    <dt class="col-sm-4">App Name</dt>
                                    <dd class="col-sm-8">{{ request.environmentBasics.appName }}</dd>
                                    <dt class="col-sm-4">Memory</dt>
                                    <dd class="col-sm-8">{{ request.environmentBasics.memory }}MB</dd>
                                    <dt class="col-sm-4">Instances</dt>
                                    <dd class="col-sm-8">{{ request.environmentBasics.scaleCount }}</dd>
                                  </dl>
                                </div>
                                <div class="col-md-6">
                                  <h5>MongoDB</h5>
                                  <dl class="row">
                                    <dt class="col-sm-4">Cluster</dt>
                                    <dd class="col-sm-8">{{ request.serviceConfigs.mongodb.cluster }}</dd>
                                    <dt class="col-sm-4">Database</dt>
                                    <dd class="col-sm-8">{{ request.serviceConfigs.mongodb.database }}</dd>
                                  </dl>

                                  <h5>Admin User</h5>
                                  <dl class="row">
                                    <dt class="col-sm-4">Name</dt>
                                    <dd
                                      class="col-sm-8">{{ request.adminUser.firstName }} {{ request.adminUser.lastName }}
                                    </dd>
                                    <dt class="col-sm-4">Email</dt>
                                    <dd class="col-sm-8">{{ request.adminUser.email }}</dd>
                                  </dl>

                                  <h5>Options</h5>
                                  <dl class="row">
                                    <dt class="col-sm-6">Sample Pages</dt>
                                    <dd class="col-sm-6">{{ request.options.includeSamplePages ? 'Yes' : 'No' }}</dd>
                                    <dt class="col-sm-6">Skip Fly.io</dt>
                                    <dd class="col-sm-6">{{ request.options.skipFlyDeployment ? 'Yes' : 'No' }}</dd>
                                    <dt class="col-sm-6">Copy Standard Assets</dt>
                                    <dd class="col-sm-6">{{ request.options.copyStandardAssets ? 'Yes' : 'No' }}</dd>
                                  </dl>
                                </div>
                              </div>

                              @if (validationResults.length > 0) {
                                <div class="alert"
                                     [ngClass]="allValid ? 'alert-success' : 'alert-danger'">
                                  <h5>Validation Results</h5>
                                  <ul>
                                    @for (result of validationResults; track result.message) {
                                      <li [ngClass]="result.valid ? 'text-success' : 'text-danger'">
                                        <fa-icon [icon]="result.valid ? faCheck : faTimes"></fa-icon>
                                        {{ result.message }}
                                      </li>
                                    }
                                  </ul>
                                </div>
                              }
                              <div class="stepper-nav">
                                <button type="button" class="btn btn-secondary" (click)="goToStep(2)">Back</button>
                                <button class="btn btn-warning" (click)="validateRequest()"
                                        [disabled]="validating">
                                  @if (validating) {
                                    <fa-icon [icon]="faSpinner" [spin]="true"></fa-icon>
                                  }
                                  Validate
                                </button>
                                <button class="btn btn-success" (click)="createEnvironment()"
                                        [disabled]="!allValid || creating">
                                  @if (creating) {
                                    <fa-icon [icon]="faSpinner" [spin]="true"></fa-icon>
                                  }
                                  Create Environment
                                </button>
                              </div>
                            </div>
                          } @else if (step.key === EnvironmentSetupStepperKey.PROGRESS) {
                            <div>
                              @if (creating) {
                                <div class="d-flex align-items-center mb-3">
                                  <fa-icon [icon]="faSpinner" [spin]="true" class="text-primary me-2"></fa-icon>
                                  <span>Deployment in progress...</span>
                                </div>
                              }

                              @if (progressMessages.length > 0) {
                                <app-session-logs [messages]="progressMessages" class="mb-3"></app-session-logs>
                              }

                              @if (setupResult) {
                                <div class="alert alert-success mt-3">
                                  <h5><fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>Environment Created Successfully!</h5>
                                  <dl class="row mb-0">
                                    <dt class="col-sm-3">App URL</dt>
                                    <dd class="col-sm-9">
                                      <a [href]="setupResult.appUrl" target="_blank">{{ setupResult.appUrl }}</a>
                                    </dd>
                                    <dt class="col-sm-3">Admin Email</dt>
                                    <dd class="col-sm-9">{{ request.adminUser.email }}</dd>
                                  </dl>
                                </div>
                              }

                              @if (setupError) {
                                <div class="alert alert-danger mt-3">
                                  <h5><fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>Setup Failed</h5>
                                  <p>{{ setupError }}</p>
                                </div>
                              }
                              <div class="stepper-nav">
                                <button type="button" class="btn btn-primary me-2" (click)="retrySetup()">
                                  <fa-icon [icon]="faRedo" class="me-1"></fa-icon>Retry
                                </button>
                                <button type="button" class="btn btn-secondary me-2" (click)="goToStep(3)">
                                  <fa-icon [icon]="faArrowLeft" class="me-1"></fa-icon>Back
                                </button>
                                <button type="button" class="btn btn-warning me-2" (click)="startAgain()">
                                  <fa-icon [icon]="faUndo" class="me-1"></fa-icon>Start Again
                                </button>
                                <button type="button" class="btn btn-outline-secondary" (click)="cancel()">
                                  Back to Admin
                                </button>
                              </div>
                            </div>
                          }
                        </ng-template>
                              </p-step-panel>
                            </p-step-item>
                          }
                        </p-stepper>
                    </div>
                  </div>
                }
              </tab>
                <tab [active]="tabActive(EnvironmentSetupTab.SETTINGS)"
                     (selectTab)="selectTab(EnvironmentSetupTab.SETTINGS)"
                     [heading]="EnvironmentSetupTab.SETTINGS">
                  @if (tabActive(EnvironmentSetupTab.SETTINGS)) {
                    <div class="img-thumbnail thumbnail-admin-edit">
                      <app-environment-settings/>
                    </div>
                  }
                </tab>
              </tabset>

              @if (notifyTarget.showAlert) {
                <div class="row mt-3">
                  <div class="col-sm-12">
                    <div class="alert {{ notifyTarget.alert.class }}">
                      <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                      @if (notifyTarget.alertTitle) {
                        <strong>{{ notifyTarget.alertTitle }}: </strong>
                      }
                      {{ notifyTarget.alertMessage }}
                    </div>
                  </div>
                </div>
              }
            }
          </div>
        </div>
      </app-page>
    `,
  styleUrls: ["./environment-setup.sass"],
  imports: [PageComponent, FormsModule, NgClass, FontAwesomeModule, StepperModule, NgSelectComponent, StatusIconComponent, SecretInputComponent, SessionLogsComponent, TabsetComponent, TabDirective, EnvironmentSettings, EnvironmentManagement]
})
export class EnvironmentSetupComponent implements OnInit, OnDestroy {

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private subscriptions: Subscription[] = [];

  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("EnvironmentSetupComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private systemConfigService = inject(SystemConfigService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private http = inject(HttpClient);
  private urlService = inject(UrlService);
  private stringUtils = inject(StringUtilsService);
  private websocketService = inject(WebSocketClientService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private systemConfig: SystemConfig;
  private environmentDefaults: EnvironmentDefaults;
  private tab: EnvironmentSetupTab = EnvironmentSetupTab.CREATE;

  protected readonly EnvironmentSetupTab = EnvironmentSetupTab;
  protected readonly SetupMode = SetupMode;

  enabled = false;
  wsConnected = false;
  progressMessages: string[] = [];
  stepperActiveIndex = 0;
  request: EnvironmentSetupRequest = createEmptySetupRequest();
  confirmPassword = "";

  apiKeyValid: boolean | null = null;
  apiKeyValidating = false;
  mongoValid: boolean | null = null;
  mongoValidating = false;
  mongoErrorMessage: string | null = null;
  mongoConnectionString = "";
  mongoConnectionStringParsed = false;
  operationInProgress = OperationInProgress.NONE;
  destroyProgressMessages: string[] = [];
  destroyComplete = false;

  availableAreas: AvailableAreaWithLabel[] = [];
  loadingAreas = false;
  selectedAreaCode: string | null = null;
  areaQueryStatus: Status = Status.INFO;

  availableGroups: RamblersGroupWithLabel[] = [];
  loadingGroups = false;
  selectedGroup: RamblersGroupWithLabel | null = null;
  groupQueryStatus: Status = Status.INFO;
  areaGroup: RamblersGroupsApiResponse | null = null;

  validationResults: ValidationResult[] = [];
  allValid = false;

  setupProgress: SetupProgress[] = [];
  setupResult: EnvironmentSetupResult | null = null;
  setupError: string | null = null;

  setupMode = SetupMode.CREATE;
  manageAction = ManageAction.RESUME;
  existingEnvironments: ExistingEnvironment[] = [];
  selectedExistingEnv: ExistingEnvironment | null = null;
  resumeOptions = {
    runValidation: false,
    runAwsCreation: false,
    runDbInit: false,
    runFlyDeployment: true
  };

  get otherEnvironmentDatabases(): string[] {
    if (!this.selectedExistingEnv) {
      return this.existingEnvironments.map(e => `ngx-ramblers-${e.name.toLowerCase()}`);
    }
    return this.existingEnvironments
      .filter(e => e.name !== this.selectedExistingEnv!.name)
      .map(e => `ngx-ramblers-${e.name.toLowerCase()}`);
  }

  get otherDatabasesSummary(): string {
    const databases = this.otherEnvironmentDatabases;
    if (databases.length === 0) {
      return "";
    }
    return ` ${this.stringUtils.pluraliseWithCount(databases.length, "other database")} associated with this user will be unaffected: ${databases.join(", ")}`;
  }

  get canDestroy(): boolean {
    return this.selectedExistingEnv !== null;
  }

  get creating(): boolean {
    return this.operationInProgress === OperationInProgress.CREATING;
  }

  get destroying(): boolean {
    return this.operationInProgress === OperationInProgress.DESTROYING;
  }

  get validating(): boolean {
    return this.operationInProgress === OperationInProgress.VALIDATING;
  }

  get operationBusy(): boolean {
    return this.operationInProgress !== OperationInProgress.NONE;
  }

  stepperSteps: EnvironmentSetupStepperStep[] = [
    {key: EnvironmentSetupStepperKey.RAMBLERS_SELECTION, label: "Group Selection"},
    {key: EnvironmentSetupStepperKey.SERVICES_CONFIG, label: "Services"},
    {key: EnvironmentSetupStepperKey.ADMIN_USER, label: "Admin User"},
    {key: EnvironmentSetupStepperKey.REVIEW, label: "Review"},
    {key: EnvironmentSetupStepperKey.PROGRESS, label: "Progress"}
  ];

  protected readonly EnvironmentSetupStepperKey = EnvironmentSetupStepperKey;
  protected readonly faCheck = faCheck;
  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faCog = faCog;
  protected readonly faExclamationCircle = faExclamationCircle;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faPlus = faPlus;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faRedo = faRedo;
  protected readonly faSpinner = faSpinner;
  protected readonly faTimes = faTimes;
  protected readonly faTrash = faTrash;
  protected readonly faUndo = faUndo;
  protected readonly faUsers = faUsers;

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const defaultValue = kebabCase(EnvironmentSetupTab.CREATE);
      const tabParameter = params[StoredValue.TAB];
      this.tab = tabParameter || defaultValue;
      this.logger.info("received tab value of:", tabParameter, "defaultValue:", defaultValue);
    }));
    try {
      const status = await this.environmentSetupService.status();
      this.enabled = status.enabled;
      if (this.enabled) {
        await this.loadDefaults();
        await this.connectWebSocket();
      }
    } catch (error) {
      this.logger.error("Failed to check setup status:", error);
      this.enabled = false;
    }
  }

  selectTab(tab: EnvironmentSetupTab) {
    this.router.navigate([], {
      queryParams: { [StoredValue.TAB]: kebabCase(tab) },
      queryParamsHandling: "merge"
    });
  }

  tabActive(tab: EnvironmentSetupTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  private async connectWebSocket(): Promise<void> {
    try {
      await this.websocketService.connect();
      this.wsConnected = true;
      this.logger.info("WebSocket connected");

      this.subscriptions.push(
        this.websocketService.receiveMessages<any>(MessageType.PROGRESS).subscribe(data => {
          this.logger.info("Progress:", data);
          if (data?.message) {
            this.progressMessages.push(data.message);
          }
        }),
        this.websocketService.receiveMessages<any>(MessageType.COMPLETE).subscribe(data => {
          this.logger.info("Complete:", data);
          this.operationInProgress = OperationInProgress.NONE;
          if (data?.result) {
            this.setupResult = {
              environmentName: data.result.environmentName,
              appName: data.result.appName,
              appUrl: data.result.appUrl,
              mongoDbUri: "",
              awsCredentials: null,
              adminUserCreated: false,
              configsJsonUpdated: true
            };
          }
          this.progressMessages.push(data?.message || "Completed");
        }),
        this.websocketService.receiveMessages<any>(MessageType.ERROR).subscribe(data => {
          this.logger.error("WebSocket error:", data);
          const isTransient = data?.transient === true;
          if (isTransient) {
            this.progressMessages.push(`Connection lost - server operation may still be running. Check Fly.io dashboard for deployment status.`);
          } else {
            this.operationInProgress = OperationInProgress.NONE;
            this.setupError = data?.message || "An error occurred";
            this.progressMessages.push(`Error: ${this.setupError}`);
          }
        })
      );
    } catch (error) {
      this.logger.error("Failed to connect WebSocket:", error);
      this.wsConnected = false;
    }
  }

  private async loadExistingEnvironments(): Promise<void> {
    try {
      const response = await this.environmentSetupService.existingEnvironments();
      this.existingEnvironments = response.environments || [];
      this.logger.info("Loaded existing environments:", this.existingEnvironments.length);
    } catch (error) {
      this.logger.error("Failed to load existing environments:", error);
    }
  }

  setSetupMode(mode: SetupMode): void {
    this.setupMode = mode;
    if (mode === SetupMode.CREATE) {
      this.selectedExistingEnv = null;
      this.manageAction = ManageAction.RESUME;
    }
  }

  setManageAction(action: ManageAction): void {
    this.manageAction = action;
    this.destroyProgressMessages = [];
    this.destroyComplete = false;
  }

  onExistingEnvironmentSelected(env: ExistingEnvironment): void {
    if (env) {
      this.request.environmentBasics.environmentName = env.name;
      this.request.environmentBasics.appName = env.appName;
      this.request.environmentBasics.memory = env.memory;
      this.request.environmentBasics.scaleCount = env.scaleCount;
      this.request.environmentBasics.organisation = env.organisation || "personal";
    }
  }

  async resumeSetup(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({title: "No Environment Selected", message: "Please select an environment to resume"});
      return;
    }

    this.operationInProgress = OperationInProgress.CREATING;
    this.setupProgress = [];
    this.setupError = null;
    this.setupResult = null;
    this.progressMessages = [];
    this.goToStep(4);

    if (this.wsConnected) {
      this.websocketService.sendMessage(EventType.ENVIRONMENT_SETUP, {
        environmentName: this.selectedExistingEnv.name,
        runDbInit: this.resumeOptions.runDbInit,
        runFlyDeployment: this.resumeOptions.runFlyDeployment
      });
    } else {
      try {
        const response = await this.environmentSetupService.resumeEnvironment(
          this.selectedExistingEnv.name,
          this.resumeOptions.runDbInit,
          this.resumeOptions.runFlyDeployment
        );
        if (response.result) {
          this.setupResult = {
            environmentName: response.result.environmentName,
            appName: response.result.appName,
            appUrl: response.result.appUrl,
            mongoDbUri: "",
            awsCredentials: null,
            adminUserCreated: false,
            configsJsonUpdated: true
          };
        }
        this.notify.success({title: "Success", message: response.message || "Environment setup resumed successfully!"});
      } catch (error) {
        this.setupError = this.extractErrorDetail(error);
        this.logger.error("Resume setup failed:", error);
      } finally {
        this.operationInProgress = OperationInProgress.NONE;
      }
    }
  }

  async destroyEnvironment(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({title: "No Environment Selected", message: "Please select an environment to destroy"});
      return;
    }

    const environmentName = this.selectedExistingEnv.name;
    this.operationInProgress = OperationInProgress.DESTROYING;
    this.setupProgress = [];
    this.setupError = null;
    this.destroyProgressMessages = [];
    this.destroyComplete = false;

    this.destroyProgressMessages.push(`Starting destruction of environment: ${environmentName}`);

    try {
      const response = await this.environmentSetupService.destroyEnvironment(environmentName);

      if (response.steps) {
        for (const step of response.steps) {
          this.destroyProgressMessages.push(`${step.success ? "✓" : "✗"} ${step.step}: ${step.message}`);
        }
      }

      this.destroyProgressMessages.push(response.message || `Environment ${environmentName} destroyed`);

      if (response.success) {
        this.destroyComplete = true;
        this.selectedExistingEnv = null;
        await this.loadExistingEnvironments();
        this.manageAction = ManageAction.RESUME;
      } else {
        this.setupError = "Some steps failed - check details above";
      }
    } catch (error) {
      this.setupError = this.extractErrorDetail(error);
      this.logger.error("Destroy environment failed:", error);
      this.destroyProgressMessages.push(`Error: ${this.setupError}`);
      this.notify.error({title: "Error", message: this.setupError});
    } finally {
      this.operationInProgress = OperationInProgress.NONE;
    }
  }

  private async loadDefaults(): Promise<void> {
    try {
      this.systemConfig = this.systemConfigService.systemConfig();
      if (!this.systemConfig) {
        this.subscriptions.push(
          this.systemConfigService.events().subscribe(config => {
            this.systemConfig = config;
            this.applyDefaults();
          })
        );
      }
      this.environmentDefaults = await this.environmentSetupService.defaults();
      this.applyDefaults();
      this.logger.info("Loaded defaults from current environment");
    } catch (error) {
      this.logger.error("Failed to load defaults:", error);
    }
  }

  private applyDefaults(): void {
    if (this.systemConfig?.national?.walksManager?.apiKey) {
      this.request.serviceConfigs.ramblers.apiKey = this.systemConfig.national.walksManager.apiKey;
    }
    if (this.environmentDefaults?.mongodb?.cluster) {
      this.request.serviceConfigs.mongodb.cluster = this.environmentDefaults.mongodb.cluster;
    }
    if (this.environmentDefaults?.mongodb?.username) {
      this.request.serviceConfigs.mongodb.username = this.environmentDefaults.mongodb.username;
    }
    if (this.environmentDefaults?.aws?.region) {
      this.request.serviceConfigs.aws.region = this.environmentDefaults.aws.region;
    }
    if (this.environmentDefaults?.googleMaps?.apiKey) {
      this.request.serviceConfigs.googleMaps.apiKey = this.environmentDefaults.googleMaps.apiKey;
    }
    if (this.environmentDefaults?.osMaps?.apiKey) {
      this.request.serviceConfigs.osMaps = { apiKey: this.environmentDefaults.osMaps.apiKey };
    }
    if (this.environmentDefaults?.recaptcha?.siteKey) {
      this.request.serviceConfigs.recaptcha = {
        siteKey: this.environmentDefaults.recaptcha.siteKey,
        secretKey: this.environmentDefaults.recaptcha.secretKey || ""
      };
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  stepHint(key: EnvironmentSetupStepperKey): string {
    switch (key) {
      case EnvironmentSetupStepperKey.RAMBLERS_SELECTION:
        return this.selectedGroup ? `Selected: ${this.selectedGroup.name}` : "Enter API key and select group";
      case EnvironmentSetupStepperKey.SERVICES_CONFIG:
        return this.request.environmentBasics.appName ? `App: ${this.request.environmentBasics.appName}` : "Configure environment and services";
      case EnvironmentSetupStepperKey.ADMIN_USER:
        return this.request.adminUser.email ? `Admin: ${this.request.adminUser.email}` : "Create initial admin user";
      case EnvironmentSetupStepperKey.REVIEW:
        return this.allValid ? "Validated and ready" : "Review and validate configuration";
      case EnvironmentSetupStepperKey.PROGRESS:
        return this.setupResult ? "Complete" : this.setupError ? "Failed" : "Creating environment...";
      default:
        return "";
    }
  }

  canAccessStep(stepKey: EnvironmentSetupStepperKey): boolean {
    switch (stepKey) {
      case EnvironmentSetupStepperKey.RAMBLERS_SELECTION:
        return true;
      case EnvironmentSetupStepperKey.SERVICES_CONFIG:
        return this.apiKeyValid === true && !!this.selectedGroup;
      case EnvironmentSetupStepperKey.ADMIN_USER:
        return this.canAccessStep(EnvironmentSetupStepperKey.SERVICES_CONFIG) && this.hasServicesConfigured();
      case EnvironmentSetupStepperKey.REVIEW:
        return this.canAccessStep(EnvironmentSetupStepperKey.ADMIN_USER) && this.hasAdminConfigured();
      case EnvironmentSetupStepperKey.PROGRESS:
        return this.creating || !!this.setupResult || !!this.setupError;
      default:
        return false;
    }
  }

  goToStep(index: number): void {
    const step = this.stepperSteps[index];
    if (step && this.canAccessStep(step.key)) {
      this.stepperActiveIndex = index;
    }
  }

  private hasServicesConfigured(): boolean {
    return !!this.request.environmentBasics.environmentName &&
      !!this.request.serviceConfigs.mongodb.cluster &&
      !!this.request.serviceConfigs.mongodb.password;
  }

  private hasAdminConfigured(): boolean {
    return !!this.request.adminUser.firstName &&
      !!this.request.adminUser.lastName &&
      !!this.request.adminUser.email &&
      !!this.request.adminUser.password &&
      this.request.adminUser.password === this.confirmPassword;
  }

  async validateApiKey() {
    this.apiKeyValidating = true;
    try {
      const result = await this.environmentSetupService.validateRamblersApiKey(
        this.request.serviceConfigs.ramblers.apiKey
      );
      this.apiKeyValid = result.valid;
      if (result.valid) {
        await this.loadAvailableAreas();
      } else {
        this.notify.warning({title: "Invalid API Key", message: result.message});
      }
    } catch (error) {
      this.apiKeyValid = false;
      this.notify.error({title: "Validation Error", message: error});
    } finally {
      this.apiKeyValidating = false;
    }
  }

  private async loadAvailableAreas(): Promise<void> {
    this.loadingAreas = true;
    this.areaQueryStatus = Status.ACTIVE;
    try {
      const response = await this.http.get<{ areas: AvailableArea[] }>("api/areas/available-areas").toPromise();
      this.availableAreas = (response?.areas || []).map(area => ({
        ...area,
        ngSelectLabel: `${area.areaName} (${area.areaCode})`
      }));
      this.areaQueryStatus = this.availableAreas.length > 0 ? Status.COMPLETE : Status.ERROR;
      this.logger.info("Loaded available areas:", this.availableAreas.length);
    } catch (error) {
      this.logger.error("Failed to load available areas:", error);
      this.areaQueryStatus = Status.ERROR;
      this.notify.error({title: "Failed to load areas", message: error});
    } finally {
      this.loadingAreas = false;
    }
  }

  async onAreaCodeChange(areaCode: string): Promise<void> {
    if (areaCode) {
      const selectedArea = this.availableAreas.find(a => a.areaCode === areaCode);
      if (selectedArea) {
        this.request.ramblersInfo.areaCode = selectedArea.areaCode;
        this.request.ramblersInfo.areaName = selectedArea.areaName;
      }
      await this.loadGroupsForArea(areaCode);
    }
  }

  private async loadGroupsForArea(areaCode: string): Promise<void> {
    if (!areaCode) {
      this.availableGroups = [];
      return;
    }

    this.loadingGroups = true;
    this.groupQueryStatus = Status.ACTIVE;
    this.selectedGroup = null;

    try {
      const groups = await this.ramblersWalksAndEventsService.listRamblersGroups([areaCode]);
      this.logger.info("Raw groups data returned from API:", groups);
      this.groupQueryStatus = groups.length > 0 ? Status.COMPLETE : Status.ERROR;

      this.availableGroups = groups
        .filter(group => group.scope === "G")
        .map(group => ({
          ...group,
          ngSelectAttributes: {label: `${group.name} (${group.group_code})`}
        }));

      this.areaGroup = groups.find(group => group.scope === "A") || null;
      this.logger.info("Available groups (scope=G):", this.availableGroups.length, "areaGroup:", this.areaGroup);
    } catch (error) {
      this.logger.error("Error loading groups:", error);
      this.groupQueryStatus = Status.ERROR;
      this.notify.error({title: "Failed to load groups", message: error});
    } finally {
      this.loadingGroups = false;
    }
  }

  onGroupSelected() {
    if (this.selectedGroup) {
      this.request.ramblersInfo.groupCode = this.selectedGroup.group_code;
      this.request.ramblersInfo.groupName = this.selectedGroup.name;
      this.request.ramblersInfo.groupUrl = this.selectedGroup.url || this.selectedGroup.external_url;
      this.request.ramblersInfo.groupData = this.selectedGroup;
      this.updateEnvironmentDefaults();
    }
  }

  updateEnvironmentDefaults() {
    const envName = this.request.ramblersInfo.groupName
      .toLowerCase()
      .replace(/ramblers?/gi, "")
      .replace(/group/gi, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 45);

    this.request.environmentBasics.environmentName = envName;
    this.updateAppName();
    this.request.serviceConfigs.aws.bucket = `ngx-ramblers-${envName}`;
    this.request.serviceConfigs.mongodb.database = `ngx-ramblers-${envName}`;

    const firstWord = this.request.ramblersInfo.groupName
      .split(/\s+/)[0]
      .replace(/[^a-zA-Z]/g, "");
    const firstName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();

    this.request.adminUser.firstName = firstName;
    this.request.adminUser.lastName = "Admin";
    this.request.adminUser.email = `${envName}@ngx-ramblers.org.uk`;
    this.request.adminUser.password = "password";
    this.confirmPassword = "password";
  }

  updateAppName() {
    this.request.environmentBasics.appName = `ngx-ramblers-${this.request.environmentBasics.environmentName}`;
  }

  async validateMongodb() {
    this.mongoValidating = true;
    this.mongoErrorMessage = null;
    try {
      const result = await this.environmentSetupService.validateMongodb(this.request.serviceConfigs.mongodb);
      this.mongoValid = result.valid;
      if (!result.valid) {
        this.mongoErrorMessage = result.message;
      }
    } catch (error) {
      this.mongoValid = false;
      this.mongoErrorMessage = this.extractErrorDetail(error);
    } finally {
      this.mongoValidating = false;
    }
  }

  onMongoConnectionStringPaste(event: ClipboardEvent) {
    const pastedText = event.clipboardData?.getData("text");
    if (pastedText) {
      this.mongoConnectionString = pastedText;
      this.handleParseMongoConnectionString();
    }
  }

  handleParseMongoConnectionString() {
    this.mongoConnectionStringParsed = false;
    if (!this.mongoConnectionString) {
      return;
    }

    const parsed = parseMongoUri(this.mongoConnectionString);
    if (parsed) {
      this.request.serviceConfigs.mongodb.cluster = parsed.cluster;
      this.request.serviceConfigs.mongodb.username = parsed.username;
      this.request.serviceConfigs.mongodb.password = parsed.password;
      if (parsed.database) {
        this.request.serviceConfigs.mongodb.database = parsed.database;
      }
      this.mongoConnectionStringParsed = true;
      this.mongoValid = null;
    }
  }

  async validateRequest() {
    this.operationInProgress = OperationInProgress.VALIDATING;
    this.validationResults = [];
    try {
      const response = await this.environmentSetupService.validateRequest(this.request);
      this.validationResults = response.results;
      this.allValid = response.valid;
    } catch (error) {
      this.notify.error({title: "Validation Error", message: error});
    } finally {
      this.operationInProgress = OperationInProgress.NONE;
    }
  }

  async createEnvironment() {
    this.operationInProgress = OperationInProgress.CREATING;
    this.setupProgress = [];
    this.setupResult = null;
    this.setupError = null;
    this.progressMessages = [];
    this.goToStep(4);

    if (this.wsConnected) {
      this.websocketService.sendMessage(EventType.ENVIRONMENT_CREATE, {
        request: this.request
      });
    } else {
      try {
        const response = await this.environmentSetupService.createEnvironment(this.request);
        if (response.success) {
          this.setupResult = response.result;
          this.notify.success({title: "Success", message: "Environment created successfully!"});
        } else {
          this.setupError = (response as any).error || "Unknown error";
        }
      } catch (error) {
        this.setupError = this.extractErrorDetail(error);
        this.logger.error("Create environment failed:", error);
      } finally {
        this.operationInProgress = OperationInProgress.NONE;
      }
    }
  }

  private extractErrorDetail(error: any): string {
    if (error?.error?.error) {
      return error.error.error;
    }
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.message) {
      return error.message;
    }
    return error?.toString() || "Unknown error occurred";
  }

  cancel() {
    this.urlService.navigateTo(["admin"]);
  }

  retrySetup() {
    this.createEnvironment();
  }

  startAgain() {
    this.setupProgress = [];
    this.setupResult = null;
    this.setupError = null;
    this.progressMessages = [];
    this.operationInProgress = OperationInProgress.NONE;
    this.goToStep(0);
  }
}
