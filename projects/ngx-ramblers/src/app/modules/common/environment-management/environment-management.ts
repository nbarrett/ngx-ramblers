import { Component, inject, OnDestroy, OnInit } from "@angular/core";

import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import { sortBy } from "../../../functions/arrays";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCheckCircle,
  faCog,
  faExclamationCircle,
  faExclamationTriangle,
  faGlobe,
  faKey,
  faPlus,
  faRedo,
  faSpinner,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { NgSelectComponent } from "@ng-select/ng-select";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { EnvironmentStatus, ExistingEnvironment, ManageAction, OperationInProgress } from "../../../models/environment-setup.model";
import { CustomDomainEntry, CustomDomainStatus } from "../../../models/environment-config.model";
import { EventType, MessageType } from "../../../models/websocket.model";
import { SessionLogsComponent } from "../../../shared/components/session-logs";

@Component({
  selector: "app-environment-management",
  standalone: true,
  imports: [DatePipe, FormsModule, FontAwesomeModule, NgSelectComponent, SessionLogsComponent, TooltipDirective],
  styles: [`
    :host
      display: block

    :host ::ng-deep .alert
      padding: 1rem

    :host ::ng-deep .custom-domains-table th.col-hostname,
    :host ::ng-deep .custom-domains-table td.col-hostname
      min-width: 280px
      white-space: nowrap

    :host ::ng-deep .custom-domains-table th.col-status,
    :host ::ng-deep .custom-domains-table td.col-status
      min-width: 220px

    :host ::ng-deep .custom-domains-table th.col-added,
    :host ::ng-deep .custom-domains-table td.col-added
      width: 130px
      white-space: nowrap

    :host ::ng-deep .custom-domains-table th.col-actions,
    :host ::ng-deep .custom-domains-table td.col-actions
      width: 90px
      white-space: nowrap

    :host ::ng-deep .custom-domains-table .btn.icon-only
      width: 32px
      height: 32px
      padding: 0
      display: inline-flex
      align-items: center
      justify-content: center

    :host ::ng-deep .custom-domains-table tbody tr:last-child td
      border-bottom: 0

    :host ::ng-deep .custom-domains-table .domain-status-detail
      line-height: 1.3
      word-break: break-word

    :host ::ng-deep .custom-domains-table .fa-icon-globe
      color: var(--ramblers-colour-mintcake)
  `],
  template: `
    @if (!enabled) {
      <div class="alert alert-warning">
        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
        Environment management is not available on this environment.
        Please use the CLI or staging environment.
      </div>
    } @else {
      @if (existingEnvironments.length === 0) {
        <div class="alert alert-warning">
          <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
          No environments configured yet. Add environments in the Settings tab first.
        </div>
      } @else {
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">Manage Existing Environments</div>
          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="existing-env">Select Environment</label>
              <ng-select id="existing-env"
                         [items]="existingEnvironments"
                         bindLabel="name"
                         [(ngModel)]="selectedExistingEnv"
                         (ngModelChange)="onExistingEnvironmentSelected($event)"
                         [loading]="loading"
                         placeholder="Select an environment">
              </ng-select>
            </div>
          </div>

          @if (selectedExistingEnv) {
            <div class="row thumbnail-heading-frame mt-2">
              <div class="thumbnail-heading">Environment Details</div>
              <div class="row">
                <div class="col-md-3 mb-2">
                  <strong>Name:</strong> {{ selectedExistingEnv.name }}
                </div>
                <div class="col-md-3 mb-2">
                  <strong>App:</strong> {{ selectedExistingEnv.appName }}
                </div>
                <div class="col-md-2 mb-2">
                  <strong>Memory:</strong> {{ selectedExistingEnv.memory }}
                </div>
                <div class="col-md-2 mb-2">
                  <strong>Scale:</strong> {{ selectedExistingEnv.scaleCount }}
                </div>
                <div class="col-md-2 mb-2">
                  <strong>Fly.io Token:</strong>
                  @if (selectedExistingEnv.hasApiKey) {
                    <span class="text-success ms-1">Configured</span>
                  } @else {
                    <span class="text-warning ms-1">Missing</span>
                  }
                </div>
              </div>
            </div>

            @if (loadingStatus) {
              <div class="d-flex align-items-center mt-3">
                <fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>
                Detecting environment state...
              </div>
            } @else {
              <div class="row mt-3">
                <div class="col-md-12">
                  <strong>Steps to run:</strong>
                  <div class="form-check mt-2">
                    <input class="form-check-input" type="checkbox" id="runDbInit"
                           [(ngModel)]="resumeOptions.runDbInit">
                    <label class="form-check-label" for="runDbInit">
                      Initialise database
                      @if (envStatus) {
                        <span class="ms-1 badge" [class]="envStatus.databaseInitialised ? 'bg-success' : 'bg-warning'">
                          {{ envStatus.databaseInitialised ? 'done' : 'needed' }}
                        </span>
                      }
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="runFlyDeployment"
                           [(ngModel)]="resumeOptions.runFlyDeployment">
                    <label class="form-check-label" for="runFlyDeployment">
                      Deploy to Fly.io
                      @if (envStatus) {
                        <span class="ms-1 badge" [class]="envStatus.flyAppDeployed ? 'bg-success' : 'bg-warning'">
                          {{ envStatus.flyAppDeployed ? 'done' : 'needed' }}
                        </span>
                      }
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="copyStandardAssets"
                           [(ngModel)]="resumeOptions.copyStandardAssets">
                    <label class="form-check-label" for="copyStandardAssets">
                      Copy standard assets (icons, logos, backgrounds)
                      @if (envStatus) {
                        <span class="ms-1 badge" [class]="envStatus.standardAssetsPresent ? 'bg-success' : 'bg-warning'">
                          {{ envStatus.standardAssetsPresent ? 'done' : 'needed' }}
                        </span>
                      }
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="setupSubdomain"
                           [(ngModel)]="resumeOptions.setupSubdomain">
                    <label class="form-check-label" for="setupSubdomain">
                      Setup subdomain (DNS + SSL certificate)
                      @if (envStatus) {
                        <span class="ms-1 badge" [class]="envStatus.subdomainConfigured ? 'bg-success' : 'bg-warning'">
                          {{ envStatus.subdomainConfigured ? 'done' : 'needed' }}
                        </span>
                      }
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="includeSamplePages"
                           [(ngModel)]="resumeOptions.includeSamplePages">
                    <label class="form-check-label" for="includeSamplePages">
                      Include sample page content
                      @if (envStatus) {
                        <span class="ms-1 badge" [class]="envStatus.samplePagesPresent ? 'bg-success' : 'bg-warning'">
                          {{ envStatus.samplePagesPresent ? 'done' : 'needed' }}
                        </span>
                      }
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="includeNotificationConfigs"
                           [(ngModel)]="resumeOptions.includeNotificationConfigs">
                    <label class="form-check-label" for="includeNotificationConfigs">
                      Include notification configs
                      @if (envStatus) {
                        <span class="ms-1 badge" [class]="envStatus.notificationConfigsPresent ? 'bg-success' : 'bg-warning'">
                          {{ envStatus.notificationConfigsPresent ? 'done' : 'needed' }}
                        </span>
                      }
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="populateBrevoTemplates"
                           [(ngModel)]="resumeOptions.populateBrevoTemplates">
                    <label class="form-check-label" for="populateBrevoTemplates">
                      Populate Brevo templates
                      @if (envStatus) {
                        <span class="ms-1 badge" [class]="envStatus.brevoTemplatesPresent ? 'bg-success' : 'bg-warning'">
                          {{ envStatus.brevoTemplatesPresent ? 'done' : 'needed' }}
                        </span>
                      }
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="authenticateBrevoDomain"
                           [(ngModel)]="resumeOptions.authenticateBrevoDomain">
                    <label class="form-check-label" for="authenticateBrevoDomain">
                      Authenticate Brevo sending domain
                      @if (envStatus) {
                        <span class="ms-1 badge" [class]="envStatus.brevoDomainAuthenticated ? 'bg-success' : 'bg-warning'">
                          {{ envStatus.brevoDomainAuthenticated ? 'done' : 'needed' }}
                        </span>
                      }
                    </label>
                  </div>
                </div>
              </div>
              @if (progressMessages.length > 0) {
                <div class="row mt-3">
                  <div class="col-md-12">
                    <app-session-logs [messages]="progressMessages"></app-session-logs>
                  </div>
                </div>
              }
              @if (setupResult) {
                <div class="row mt-3">
                  <div class="col-md-12">
                    <div class="alert alert-success mb-0">
                      <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
                      <strong>Environment modified successfully!</strong>
                      @if (setupResult.appUrl) {
                        <br>App URL: <a [href]="setupResult.appUrl" target="_blank">{{ setupResult.appUrl }}</a>
                      }
                    </div>
                  </div>
                </div>
              }
              @if (setupError) {
                <div class="row mt-3">
                  <div class="col-md-12">
                    <div class="alert alert-danger mb-0">
                      <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                      <strong>Error:</strong> {{ setupError }}
                    </div>
                  </div>
                </div>
              }
              @if (!selectedExistingEnv.hasApiKey && (resumeOptions.runFlyDeployment || resumeOptions.setupSubdomain)) {
                <div class="row mt-3">
                  <div class="col-md-12">
                    <div class="alert alert-warning mb-0">
                      <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                      <strong>Fly.io token not configured</strong> for this environment. Deploy and subdomain operations will fail without it.
                      Configure it in the <strong>Settings</strong> tab under environment configuration.
                    </div>
                  </div>
                </div>
              }
              <div class="row mt-3">
                <div class="col-md-12">
                  <strong>Action:</strong>
                  <div class="form-check mt-2">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionModify"
                           [value]="ManageAction.MODIFY" [(ngModel)]="manageAction">
                    <label class="form-check-label" for="actionModify">
                      <fa-icon [icon]="faCog" class="me-1"></fa-icon> Modify Environment
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionDestroy"
                           [value]="ManageAction.DESTROY" [(ngModel)]="manageAction">
                    <label class="form-check-label text-danger" for="actionDestroy">
                      <fa-icon [icon]="faTrash" class="me-1"></fa-icon> Destroy Environment
                    </label>
                  </div>
                </div>
              </div>
              @if (manageAction === ManageAction.MODIFY) {
                <div class="row thumbnail-heading-frame mt-3">
                  <div class="thumbnail-heading">Custom Domains</div>
                  <div class="col-md-12">
                    <div class="d-flex gap-2 align-items-start flex-wrap">
                      <input type="text" class="form-control" style="max-width: 320px;"
                             placeholder="Enter full domain name (apex or subdomain)"
                             [(ngModel)]="customDomainHostname"
                             [disabled]="operationBusy || customDomainBusy">
                      <button class="btn btn-primary" (click)="addCustomDomain()"
                              [disabled]="operationBusy || customDomainBusy || !customDomainHostname">
                        @if (customDomainBusy && !removingDomainHostname && !checkingDomainHostname) {
                          <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                        } @else {
                          <fa-icon [icon]="faPlus" class="me-1"></fa-icon>
                        }
                        Add Custom Domain
                      </button>
                    </div>
                    @if (shouldShowAlsoAttachWwwOption()) {
                      <div class="form-check mt-2">
                        <input class="form-check-input" type="checkbox" id="alsoAttachWww"
                               [(ngModel)]="alsoAttachWww"
                               [disabled]="operationBusy || customDomainBusy">
                        <label class="form-check-label small" for="alsoAttachWww">
                          Also attach the <code>www.</code> variant (CNAME to Fly app)
                        </label>
                      </div>
                    }
                    @if (customDomainError) {
                      <div class="alert alert-danger mt-3 mb-0">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                        {{ customDomainError }}
                      </div>
                    }
                    @if (customDomainMessages.length > 0) {
                      <div class="mt-3">
                        <app-session-logs [messages]="customDomainMessages"></app-session-logs>
                      </div>
                    }
                    @if (customDomains().length > 0) {
                      <div class="table-responsive mt-3">
                        <table class="table table-sm align-middle mb-0 custom-domains-table">
                          <thead>
                            <tr>
                              <th scope="col" class="col-hostname">Hostname</th>
                              <th scope="col" class="col-status">Status</th>
                              <th scope="col" class="col-added">Added</th>
                              <th scope="col" class="text-end col-actions">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (domain of customDomains(); track domain.hostname) {
                              <tr>
                                <td class="col-hostname">
                                  <fa-icon [icon]="faGlobe" class="me-2 fa-icon-globe"></fa-icon>
                                  <a [href]="'https://' + domain.hostname" target="_blank">{{ domain.hostname }}</a>
                                </td>
                                <td class="col-status">
                                  <div>
                                    <span class="badge" [class]="domainBadgeClass(domain.status)">{{ domainStatusLabel(domain.status) }}</span>
                                  </div>
                                  @if (domain.message && domain.message !== domain.status) {
                                    <div class="small text-muted mt-1 domain-status-detail">{{ domain.message }}</div>
                                  }
                                </td>
                                <td class="col-added">{{ domain.addedAt ? (domain.addedAt | date:"short") : "" }}</td>
                                <td class="text-end col-actions">
                                  <div class="d-inline-flex gap-1">
                                    <button class="btn btn-sm btn-outline-secondary icon-only"
                                            (click)="checkCustomDomain(domain)"
                                            [disabled]="operationBusy || customDomainBusy"
                                            tooltip="Check &amp; reconcile DNS/cert"
                                            container="body"
                                            aria-label="Check">
                                      @if (checkingDomainHostname === domain.hostname) {
                                        <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                                      } @else {
                                        <fa-icon [icon]="faRedo"></fa-icon>
                                      }
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger icon-only"
                                            (click)="removeCustomDomain(domain)"
                                            [disabled]="operationBusy || customDomainBusy"
                                            tooltip="Remove custom domain"
                                            container="body"
                                            aria-label="Remove">
                                      @if (removingDomainHostname === domain.hostname) {
                                        <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                                      } @else {
                                        <fa-icon [icon]="faTrash"></fa-icon>
                                      }
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  </div>
                </div>
                @if (passwordResetResult) {
                  <div class="row mt-3">
                    <div class="col-md-12">
                      <div class="alert alert-success mb-0">
                        <fa-icon [icon]="faKey" class="me-2"></fa-icon>
                        <strong>Admin password reset generated</strong> for {{ passwordResetResult.userName || passwordResetResult.email }}
                        <div class="mt-2">
                          <strong>Subdomain URL:</strong>
                          <a [href]="passwordResetResult.resetUrl" target="_blank">{{ passwordResetResult.resetUrl }}</a>
                        </div>
                        <div class="mt-1">
                          <strong>Fly.io URL:</strong>
                          <a [href]="passwordResetResult.flyResetUrl" target="_blank">{{ passwordResetResult.flyResetUrl }}</a>
                        </div>
                      </div>
                    </div>
                  </div>
                }
                <div class="row mt-3">
                  <div class="col-md-12 d-flex gap-2 align-items-start flex-wrap">
                    <button class="btn btn-primary" (click)="resumeSetup()"
                            [disabled]="operationBusy">
                      @if (resuming) {
                        <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                      }
                      Modify Environment
                    </button>
                    <button class="btn btn-outline-secondary" (click)="generateAdminPasswordReset()"
                            [disabled]="operationBusy || generatingPasswordReset">
                      @if (generatingPasswordReset) {
                        <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                      } @else {
                        <fa-icon [icon]="faKey" class="me-1"></fa-icon>
                      }
                      Reset Admin Password
                    </button>
                    @if (canRemoveNgxSubdomain()) {
                      <button class="btn btn-danger" (click)="requestRemoveNgxSubdomain()"
                              [disabled]="operationBusy || removingNgxSubdomain || removeNgxSubdomainConfirming"
                              tooltip="Delete the <env>.ngx-ramblers.org.uk DNS records and Fly cert"
                              container="body">
                        @if (removingNgxSubdomain) {
                          <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                        } @else {
                          <fa-icon [icon]="faTrash" class="me-1"></fa-icon>
                        }
                        Remove NGX Subdomain
                      </button>
                    }
                  </div>
                  @if (removeNgxSubdomainConfirming) {
                    <div class="alert alert-warning d-flex align-items-center justify-content-between mt-3 mb-0">
                      <span>
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                        <strong>Remove the NGX subdomain ({{ selectedExistingEnv.name }}.ngx-ramblers.org.uk)?</strong>
                        This deletes its DNS records and Fly certificate. The app will only be reachable via its attached custom domain(s).
                      </span>
                      <div class="btn-group btn-group-sm ms-3">
                        <button type="button" class="btn btn-danger" [disabled]="removingNgxSubdomain"
                                (click)="confirmRemoveNgxSubdomain()">Remove</button>
                        <button type="button" class="btn btn-outline-secondary"
                                (click)="cancelRemoveNgxSubdomain()">Cancel</button>
                      </div>
                    </div>
                  }
                </div>
              }
              @if (manageAction === ManageAction.DESTROY) {
                <div class="row mt-3">
                  <div class="col-md-12">
                    <div class="alert alert-danger">
                      <fa-icon [icon]="faExclamationCircle" class="me-2"></fa-icon>
                      <strong>Warning:</strong> This will permanently destroy the environment <strong>{{ selectedExistingEnv.name }}</strong>.
                      <ul class="mb-0 mt-2">
                        <li>Delete the Fly.io app: <strong>{{ selectedExistingEnv.appName }}</strong></li>
                        <li>Delete the S3 bucket: <strong>ngx-ramblers-{{ selectedExistingEnv.name.toLowerCase() }}</strong></li>
                        <li>Delete the IAM user: <strong>ngx-ramblers-{{ selectedExistingEnv.name.toLowerCase() }}-user</strong></li>
                        <li>Clear all collections in database: <strong>ngx-ramblers-{{ selectedExistingEnv.name.toLowerCase() }}</strong></li>
                        <li>Remove environment configuration from database</li>
                        <li>Delete the local secrets file</li>
                      </ul>
                      <p class="mt-3 mb-0"><strong>This action is irreversible.</strong></p>
                    </div>
                    @if (destroyProgressMessages.length > 0) {
                      <app-session-logs [messages]="destroyProgressMessages"></app-session-logs>
                    }
                    @if (destroyComplete) {
                      <div class="alert alert-success mt-3 mb-0">
                        <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
                        <strong>Environment destroyed successfully.</strong>
                      </div>
                    }
                    @if (destroyError) {
                      <div class="alert alert-danger mt-3 mb-0">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                        {{ destroyError }}
                      </div>
                    }
                    <button class="btn btn-danger mt-3" (click)="destroyEnvironment()"
                            [disabled]="operationBusy || destroyComplete">
                      @if (destroying) {
                        <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
                      }
                      Destroy Environment
                    </button>
                  </div>
                </div>
              }
            }
          }
        </div>
      }

      @if (notifyTarget.showAlert) {
        <div class="alert {{ notifyTarget.alert.class }} mt-3">
          <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
          @if (notifyTarget.alertTitle) {
            <strong>{{ notifyTarget.alertTitle }}: </strong>
          }
          {{ notifyTarget.alertMessage }}
        </div>
      }
    }
  `
})
export class EnvironmentManagement implements OnInit, OnDestroy {
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("EnvironmentManagement", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private websocketService = inject(WebSocketClientService);

  private subscriptions: Subscription[] = [];
  private notify: AlertInstance;
  notifyTarget: AlertTarget = {};
  private wsConnected = false;

  enabled = false;
  loading = false;
  loadingStatus = false;
  existingEnvironments: ExistingEnvironment[] = [];
  selectedExistingEnv: ExistingEnvironment | null = null;
  operationInProgress = OperationInProgress.NONE;
  manageAction: ManageAction = ManageAction.MODIFY;
  protected readonly ManageAction = ManageAction;
  envStatus: EnvironmentStatus | null = null;

  resumeOptions = {
    runDbInit: false,
    runFlyDeployment: false,
    copyStandardAssets: false,
    setupSubdomain: false,
    includeSamplePages: false,
    includeNotificationConfigs: false,
    populateBrevoTemplates: false,
    authenticateBrevoDomain: false
  };

  progressMessages: string[] = [];
  setupResult: { environmentName: string; appName: string; appUrl: string } | null = null;
  setupError: string | null = null;

  destroyProgressMessages: string[] = [];
  destroyComplete = false;
  destroyError: string | null = null;

  passwordResetResult: { resetUrl?: string; flyResetUrl?: string; userName?: string; email?: string } | null = null;
  generatingPasswordReset = false;
  removingNgxSubdomain = false;
  removeNgxSubdomainConfirming = false;

  customDomainHostname = "";
  customDomainBusy = false;
  customDomainError: string | null = null;
  customDomainMessages: string[] = [];
  removingDomainHostname: string | null = null;
  checkingDomainHostname: string | null = null;
  alsoAttachWww = true;

  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faCog = faCog;
  protected readonly faExclamationCircle = faExclamationCircle;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faGlobe = faGlobe;
  protected readonly faKey = faKey;
  protected readonly faPlus = faPlus;
  protected readonly faRedo = faRedo;
  protected readonly faSpinner = faSpinner;
  protected readonly faTrash = faTrash;

  get resuming(): boolean {
    return this.operationInProgress === OperationInProgress.CREATING;
  }

  get destroying(): boolean {
    return this.operationInProgress === OperationInProgress.DESTROYING;
  }

  get operationBusy(): boolean {
    return this.operationInProgress !== OperationInProgress.NONE;
  }

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    try {
      const status = await this.environmentSetupService.status();
      this.enabled = status.enabled;
      if (this.enabled) {
        await this.loadExistingEnvironments();
        await this.connectWebSocket();
      }
    } catch (error) {
      this.logger.error("Failed to check setup status:", error);
      this.enabled = false;
    }
  }

  private async connectWebSocket(): Promise<void> {
    try {
      await this.websocketService.connect();
      this.wsConnected = true;
      this.logger.info("WebSocket connected");

      this.subscriptions.push(
        this.websocketService.receiveMessages<{ message: string }>(MessageType.PROGRESS).subscribe(data => {
          this.logger.info("Progress:", data);
          if (data?.message) {
            this.progressMessages.push(data.message);
          }
        }),
        this.websocketService.receiveMessages<{ message: string; result?: { environmentName: string; appName: string; appUrl: string } }>(MessageType.COMPLETE).subscribe(async data => {
          this.logger.info("Complete:", data);
          const pendingResult = data?.result ? {
            environmentName: data.result.environmentName,
            appName: data.result.appName,
            appUrl: data.result.appUrl
          } : null;
          this.progressMessages.push(data?.message || "Completed");
          if (this.resumeOptions.setupSubdomain && this.selectedExistingEnv) {
            const subdomainHostname = await this.runSubdomainSetup();
            if (subdomainHostname && pendingResult) {
              pendingResult.appUrl = `https://${subdomainHostname}`;
              this.setupResult = pendingResult;
            }
          } else if (pendingResult) {
            this.setupResult = pendingResult;
          }
          this.operationInProgress = OperationInProgress.NONE;
        }),
        this.websocketService.receiveMessages<{ message?: string; transient?: boolean }>(MessageType.ERROR).subscribe(data => {
          this.logger.error("WebSocket error:", data);
          const isTransient = data?.transient === true;
          if (isTransient) {
            this.progressMessages.push("Connection lost - server operation may still be running. Check Fly.io dashboard for deployment status.");
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

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  async loadExistingEnvironments(): Promise<void> {
    this.loading = true;
    try {
      const response = await this.environmentSetupService.existingEnvironments();
      this.existingEnvironments = (response.environments || []).sort(sortBy("name"));
      this.logger.info("Loaded existing environments:", this.existingEnvironments.length);
    } catch (error) {
      this.logger.error("Failed to load existing environments:", error);
      this.notify.error({ title: "Error", message: "Failed to load environments" });
    } finally {
      this.loading = false;
    }
  }

  async onExistingEnvironmentSelected(env: ExistingEnvironment): Promise<void> {
    this.clearState();
    if (env) {
      await this.probeEnvironmentStatus(env.name);
    }
  }

  private async probeEnvironmentStatus(environmentName: string): Promise<void> {
    this.loadingStatus = true;
    this.envStatus = null;
    try {
      this.envStatus = await this.environmentSetupService.environmentStatus(environmentName);
      this.resumeOptions = {
        runDbInit: !this.envStatus.databaseInitialised,
        runFlyDeployment: !this.envStatus.flyAppDeployed,
        copyStandardAssets: !this.envStatus.standardAssetsPresent,
        setupSubdomain: !this.envStatus.subdomainConfigured,
        includeSamplePages: !this.envStatus.samplePagesPresent,
        includeNotificationConfigs: !this.envStatus.notificationConfigsPresent,
        populateBrevoTemplates: !this.envStatus.brevoTemplatesPresent,
        authenticateBrevoDomain: !this.envStatus.brevoDomainAuthenticated
      };
      this.logger.info("Environment status:", this.envStatus, "Resume options:", this.resumeOptions);
    } catch (error) {
      this.logger.error("Failed to probe environment status:", error);
      this.resumeOptions = {
        runDbInit: false,
        runFlyDeployment: true,
        copyStandardAssets: false,
        setupSubdomain: false,
        includeSamplePages: false,
        includeNotificationConfigs: false,
        populateBrevoTemplates: false,
        authenticateBrevoDomain: false
      };
    } finally {
      this.loadingStatus = false;
    }
  }

  private clearState(): void {
    this.progressMessages = [];
    this.setupResult = null;
    this.setupError = null;
    this.destroyProgressMessages = [];
    this.destroyComplete = false;
    this.destroyError = null;
    this.passwordResetResult = null;
    this.manageAction = ManageAction.MODIFY;
    this.envStatus = null;
    this.customDomainHostname = "";
    this.customDomainMessages = [];
    this.customDomainError = null;
    this.removingDomainHostname = null;
    this.checkingDomainHostname = null;
    this.alsoAttachWww = true;
  }

  customDomains(): CustomDomainEntry[] {
    return this.selectedExistingEnv?.customDomains || [];
  }

  domainBadgeClass(status: CustomDomainStatus | string | undefined): string {
    if (status === CustomDomainStatus.ATTACHED) {
      return "bg-success";
    }
    if (status === CustomDomainStatus.FAILED) {
      return "bg-danger";
    }
    return "bg-warning text-dark";
  }

  domainStatusLabel(status: CustomDomainStatus | string | undefined): string {
    if (status === CustomDomainStatus.ATTACHED) return "Attached";
    if (status === CustomDomainStatus.FAILED) return "Failed";
    return "Awaiting configuration";
  }

  async addCustomDomain(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment first" });
      return;
    }
    const hostname = this.normaliseHostname(this.customDomainHostname);
    if (!hostname) {
      this.customDomainError = "Enter a hostname to add";
      return;
    }
    this.customDomainBusy = true;
    this.customDomainError = null;
    this.customDomainMessages = [`Attaching custom domain: ${hostname}`];
    const queue = [hostname];
    if (this.shouldAttachWwwFor(hostname)) {
      queue.push(`www.${hostname}`);
    }
    try {
      for (const target of queue) {
        if (target !== hostname) {
          this.customDomainMessages.push(`Attaching companion domain: ${target}`);
        }
        const response = await this.environmentSetupService.addCustomDomain(this.selectedExistingEnv.name, target);
        if (response.success) {
          this.appendLogs(response.logs, response.message || `Custom domain ${response.hostname} attached`);
        } else {
          this.customDomainError = response.message || "Custom domain add failed";
          this.appendLogs(response.logs, `Error: ${this.customDomainError}`);
          break;
        }
      }
      if (!this.customDomainError) {
        this.customDomainHostname = "";
      }
      await this.refreshSelectedEnvironment();
    } catch (error) {
      this.customDomainError = this.extractErrorDetail(error);
      this.appendLogs(error?.error?.logs, `Error: ${this.customDomainError}`);
      this.logger.error("Add custom domain failed:", error);
    } finally {
      this.customDomainBusy = false;
    }
  }

  private normaliseHostname(input: string | null | undefined): string {
    return (input || "").trim().toLowerCase().replace(/\.$/, "").replace(/^https?:\/\//, "");
  }

  shouldShowAlsoAttachWwwOption(): boolean {
    const normalised = this.normaliseHostname(this.customDomainHostname);
    return !!normalised && !normalised.startsWith("www.") && normalised.split(".").length >= 2;
  }

  private shouldAttachWwwFor(hostname: string): boolean {
    return this.alsoAttachWww && !hostname.startsWith("www.") && hostname.split(".").length >= 2;
  }

  async removeCustomDomain(domain: CustomDomainEntry): Promise<void> {
    if (!this.selectedExistingEnv) return;
    this.customDomainBusy = true;
    this.removingDomainHostname = domain.hostname;
    this.customDomainError = null;
    this.customDomainMessages = [`Removing custom domain: ${domain.hostname}`];
    try {
      const response = await this.environmentSetupService.removeCustomDomain(this.selectedExistingEnv.name, domain.hostname);
      if (response.success) {
        this.appendLogs(response.logs, response.message || `Custom domain ${domain.hostname} removed`);
        await this.refreshSelectedEnvironment();
      } else {
        this.customDomainError = response.message || "Custom domain remove failed";
        this.appendLogs(response.logs, `Error: ${this.customDomainError}`);
      }
    } catch (error) {
      this.customDomainError = this.extractErrorDetail(error);
      this.appendLogs(error?.error?.logs, `Error: ${this.customDomainError}`);
      this.logger.error("Remove custom domain failed:", error);
    } finally {
      this.customDomainBusy = false;
      this.removingDomainHostname = null;
    }
  }

  async checkCustomDomain(domain: CustomDomainEntry): Promise<void> {
    if (!this.selectedExistingEnv) return;
    this.customDomainBusy = true;
    this.checkingDomainHostname = domain.hostname;
    this.customDomainError = null;
    this.customDomainMessages = [`Checking custom domain: ${domain.hostname}`];
    try {
      const response = await this.environmentSetupService.checkCustomDomain(this.selectedExistingEnv.name, domain.hostname);
      if (response.success) {
        this.appendLogs(response.logs, response.message || `Status checked for ${domain.hostname}`);
        await this.refreshSelectedEnvironment();
      } else {
        this.customDomainError = response.message || "Status check failed";
        this.appendLogs(response.logs, `Error: ${this.customDomainError}`);
      }
    } catch (error) {
      this.customDomainError = this.extractErrorDetail(error);
      this.appendLogs(error?.error?.logs, `Error: ${this.customDomainError}`);
      this.logger.error("Check custom domain failed:", error);
    } finally {
      this.customDomainBusy = false;
      this.checkingDomainHostname = null;
    }
  }

  private appendLogs(logs: string[] | undefined, fallback: string): void {
    if (logs && logs.length > 0) {
      this.customDomainMessages = [...this.customDomainMessages, ...logs];
    } else {
      this.customDomainMessages.push(fallback);
    }
  }

  private async refreshSelectedEnvironment(): Promise<void> {
    if (!this.selectedExistingEnv) return;
    const currentName = this.selectedExistingEnv.name;
    await this.loadExistingEnvironments();
    const refreshed = this.existingEnvironments.find(env => env.name === currentName) || null;
    if (refreshed) {
      this.selectedExistingEnv = refreshed;
    }
  }

  async resumeSetup(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment to resume" });
      return;
    }

    this.operationInProgress = OperationInProgress.CREATING;
    this.progressMessages = [];
    this.setupError = null;
    this.setupResult = null;

    this.progressMessages.push(`Modifying environment: ${this.selectedExistingEnv.name}`);

    try {
      if (this.resumeOptions.copyStandardAssets) {
        this.progressMessages.push("Copying standard assets...");
        const copyResponse = await this.environmentSetupService.copyAssets(this.selectedExistingEnv.name);
        if (copyResponse.copiedAssets) {
          const { icons, logos, backgrounds } = copyResponse.copiedAssets;
          this.progressMessages.push(`Copied ${icons.length} icons, ${logos.length} logos, ${backgrounds.length} backgrounds`);
        }
        if (copyResponse.failures && copyResponse.failures.length > 0) {
          this.progressMessages.push(`Failed to copy ${copyResponse.failures.length} files:`);
          copyResponse.failures.forEach(f => this.progressMessages.push(`  - ${f.file}: ${f.error}`));
          if (!copyResponse.success) {
            this.setupError = copyResponse.message;
            this.operationInProgress = OperationInProgress.NONE;
            return;
          }
        } else if (!copyResponse.success) {
          this.setupError = copyResponse.message;
          this.progressMessages.push(`Error: ${copyResponse.message}`);
          this.operationInProgress = OperationInProgress.NONE;
          return;
        }
      }

      if (this.resumeOptions.includeSamplePages) {
        this.progressMessages.push("Seeding sample page content...");
        const samplePagesResponse = await this.environmentSetupService.seedSamplePages(this.selectedExistingEnv.name);
        if (samplePagesResponse.success) {
          this.progressMessages.push(samplePagesResponse.message);
        } else {
          this.setupError = samplePagesResponse.message;
          this.progressMessages.push(`Error: ${samplePagesResponse.message}`);
          this.operationInProgress = OperationInProgress.NONE;
          return;
        }
      }

      if (this.resumeOptions.includeNotificationConfigs) {
        this.progressMessages.push("Seeding notification configs...");
        const notifResponse = await this.environmentSetupService.seedNotificationConfigs(this.selectedExistingEnv.name);
        if (notifResponse.success) {
          this.progressMessages.push(notifResponse.message);
        } else {
          this.setupError = notifResponse.message;
          this.progressMessages.push(`Error: ${notifResponse.message}`);
          this.operationInProgress = OperationInProgress.NONE;
          return;
        }
      }

      if (this.resumeOptions.populateBrevoTemplates) {
        this.progressMessages.push("Populating Brevo templates...");
        const brevoResponse = await this.environmentSetupService.populateBrevoTemplates(this.selectedExistingEnv.name);
        if (brevoResponse.success) {
          this.progressMessages.push(brevoResponse.message);
        } else {
          this.setupError = brevoResponse.message;
          this.progressMessages.push(`Error: ${brevoResponse.message}`);
          this.operationInProgress = OperationInProgress.NONE;
          return;
        }
      }

      if (this.resumeOptions.authenticateBrevoDomain) {
        this.progressMessages.push("Authenticating Brevo sending domain...");
        const authResponse = await this.environmentSetupService.authenticateBrevoDomain(this.selectedExistingEnv.name);
        if (authResponse.success) {
          this.progressMessages.push(authResponse.message);
        } else {
          this.setupError = authResponse.message;
          this.progressMessages.push(`Error: ${authResponse.message}`);
          this.operationInProgress = OperationInProgress.NONE;
          return;
        }
      }

      if (this.wsConnected && (this.resumeOptions.runDbInit || this.resumeOptions.runFlyDeployment)) {
        this.websocketService.sendMessage(EventType.ENVIRONMENT_SETUP, {
          environmentName: this.selectedExistingEnv.name,
          runDbInit: this.resumeOptions.runDbInit,
          runFlyDeployment: this.resumeOptions.runFlyDeployment
        });

        if (this.resumeOptions.setupSubdomain) {
          this.progressMessages.push("Subdomain setup will run after deployment completes...");
        }
      } else {
        const response = await this.environmentSetupService.resumeEnvironment(
          this.selectedExistingEnv.name,
          this.resumeOptions.runDbInit,
          this.resumeOptions.runFlyDeployment
        );

        const pendingResult = response.result ? {
          environmentName: response.result.environmentName,
          appName: response.result.appName,
          appUrl: response.result.appUrl
        } : null;

        if (this.resumeOptions.setupSubdomain) {
          const subdomainHostname = await this.runSubdomainSetup();
          if (subdomainHostname && pendingResult) {
            pendingResult.appUrl = `https://${subdomainHostname}`;
            this.setupResult = pendingResult;
            this.progressMessages.push("Environment modified successfully!");
          }
        } else if (pendingResult) {
          this.setupResult = pendingResult;
          this.progressMessages.push("Environment modified successfully!");
        }
        this.operationInProgress = OperationInProgress.NONE;
      }
    } catch (error) {
      this.setupError = this.extractErrorDetail(error);
      this.progressMessages.push(`Error: ${this.setupError}`);
      this.logger.error("Resume setup failed:", error);
      this.operationInProgress = OperationInProgress.NONE;
    }
  }

  private async runSubdomainSetup(): Promise<string | null> {
    if (!this.selectedExistingEnv) return null;
    this.progressMessages.push("Setting up subdomain...");
    try {
      const subdomainResponse = await this.environmentSetupService.setupSubdomain(this.selectedExistingEnv.name);
      if (subdomainResponse.success) {
        this.progressMessages.push(`Subdomain configured: ${subdomainResponse.hostname}`);
        return subdomainResponse.hostname;
      } else {
        this.setupError = subdomainResponse.message || "Subdomain setup failed";
        this.progressMessages.push(`Subdomain setup failed: ${this.setupError}`);
        return null;
      }
    } catch (error) {
      this.setupError = this.extractErrorDetail(error);
      this.progressMessages.push(`Subdomain setup failed: ${this.setupError}`);
      this.logger.error("Subdomain setup failed:", error);
      return null;
    }
  }

  async destroyEnvironment(): Promise<void> {
    if (!this.selectedExistingEnv) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment to destroy" });
      return;
    }

    const environmentName = this.selectedExistingEnv.name;
    this.operationInProgress = OperationInProgress.DESTROYING;
    this.destroyProgressMessages = [];
    this.destroyComplete = false;
    this.destroyError = null;

    this.destroyProgressMessages.push(`Starting destruction of environment: ${environmentName}`);

    try {
      const response = await this.environmentSetupService.destroyEnvironment(environmentName);

      if (response.steps) {
        response.steps.forEach(step => {
          this.destroyProgressMessages.push(`${step.success ? "\u2713" : "\u2717"} ${step.step}: ${step.message}`);
        });
      }

      this.destroyProgressMessages.push(response.message || `Environment ${environmentName} destroyed`);

      if (response.success) {
        this.destroyComplete = true;
        this.selectedExistingEnv = null;
        await this.loadExistingEnvironments();
      } else {
        this.destroyError = "Some steps failed - check details above";
      }
    } catch (error) {
      this.destroyError = this.extractErrorDetail(error);
      this.logger.error("Destroy environment failed:", error);
      this.destroyProgressMessages.push(`Error: ${this.destroyError}`);
      this.notify.error({ title: "Error", message: this.destroyError });
    } finally {
      this.operationInProgress = OperationInProgress.NONE;
    }
  }

  canRemoveNgxSubdomain(): boolean {
    if (!this.selectedExistingEnv || !this.envStatus?.subdomainConfigured) return false;
    return this.customDomains().some(domain => domain.status === CustomDomainStatus.ATTACHED);
  }

  requestRemoveNgxSubdomain(): void {
    if (!this.selectedExistingEnv) return;
    this.removeNgxSubdomainConfirming = true;
  }

  cancelRemoveNgxSubdomain(): void {
    this.removeNgxSubdomainConfirming = false;
  }

  async confirmRemoveNgxSubdomain(): Promise<void> {
    if (!this.selectedExistingEnv) return;
    this.removeNgxSubdomainConfirming = false;
    this.removingNgxSubdomain = true;
    this.progressMessages = [`Removing NGX subdomain for ${this.selectedExistingEnv.name}...`];
    try {
      const response = await this.environmentSetupService.removeSubdomain(this.selectedExistingEnv.name);
      if (response.logs?.length) {
        this.progressMessages = [...this.progressMessages, ...response.logs];
      } else {
        this.progressMessages.push(response.message || "NGX subdomain removed");
      }
      if (response.success) {
        await this.probeEnvironmentStatus(this.selectedExistingEnv.name);
      } else {
        this.setupError = response.message || "Failed to remove NGX subdomain";
      }
    } catch (error) {
      this.setupError = this.extractErrorDetail(error);
      this.progressMessages.push(`Error: ${this.setupError}`);
      this.logger.error("Remove NGX subdomain failed:", error);
    } finally {
      this.removingNgxSubdomain = false;
    }
  }

  async generateAdminPasswordReset(): Promise<void> {
    if (!this.selectedExistingEnv) return;
    this.generatingPasswordReset = true;
    this.passwordResetResult = null;
    try {
      const response = await this.environmentSetupService.adminPasswordReset(this.selectedExistingEnv.name);
      if (response.success) {
        this.passwordResetResult = response;
      } else {
        this.notify.error({ title: "Password Reset Failed", message: response.message });
      }
    } catch (error) {
      this.notify.error({ title: "Password Reset Failed", message: this.extractErrorDetail(error) });
    } finally {
      this.generatingPasswordReset = false;
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
}
