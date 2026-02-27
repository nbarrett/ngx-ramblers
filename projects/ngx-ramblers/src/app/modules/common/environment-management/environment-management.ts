import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCheckCircle,
  faCog,
  faExclamationCircle,
  faExclamationTriangle,
  faKey,
  faPlus,
  faRedo,
  faSpinner,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { NgSelectComponent } from "@ng-select/ng-select";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { EnvironmentStatus, ExistingEnvironment, OperationInProgress } from "../../../models/environment-setup.model";
import { EventType, MessageType } from "../../../models/websocket.model";
import { SessionLogsComponent } from "../../../shared/components/session-logs";

@Component({
  selector: "app-environment-management",
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, NgSelectComponent, SessionLogsComponent],
  styles: [`
    :host
      display: block

    :host ::ng-deep .alert
      padding: 1rem
  `],
  template: `
    @if (!enabled) {
      <div class="alert alert-warning">
        <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
        Environment management is not available on this environment.
        Please use the CLI or staging environment.
      </div>
    } @else {
      @if (existingEnvironments.length === 0 && !loading) {
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
                <fa-icon [icon]="faSpinner" [spin]="true" class="me-2"></fa-icon>
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
                           value="modify" [(ngModel)]="manageAction">
                    <label class="form-check-label" for="actionModify">
                      <fa-icon [icon]="faCog" class="me-1"></fa-icon> Modify Environment
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionDestroy"
                           value="destroy" [(ngModel)]="manageAction">
                    <label class="form-check-label text-danger" for="actionDestroy">
                      <fa-icon [icon]="faTrash" class="me-1"></fa-icon> Destroy Environment
                    </label>
                  </div>
                </div>
              </div>
              @if (manageAction === 'modify') {
                <div class="row mt-3">
                  <div class="col-md-12 d-flex gap-2 align-items-start">
                    <button class="btn btn-primary" (click)="resumeSetup()"
                            [disabled]="operationBusy">
                      @if (resuming) {
                        <fa-icon [icon]="faSpinner" [spin]="true" class="me-1"></fa-icon>
                      }
                      Modify Environment
                    </button>
                    <button class="btn btn-outline-secondary" (click)="generateAdminPasswordReset()"
                            [disabled]="operationBusy || generatingPasswordReset">
                      @if (generatingPasswordReset) {
                        <fa-icon [icon]="faSpinner" [spin]="true" class="me-1"></fa-icon>
                      } @else {
                        <fa-icon [icon]="faKey" class="me-1"></fa-icon>
                      }
                      Reset Admin Password
                    </button>
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
              }
              @if (manageAction === 'destroy') {
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
                        <fa-icon [icon]="faSpinner" [spin]="true" class="me-1"></fa-icon>
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
  manageAction: "modify" | "destroy" = "modify";
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

  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faCog = faCog;
  protected readonly faExclamationCircle = faExclamationCircle;
  protected readonly faExclamationTriangle = faExclamationTriangle;
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
      this.existingEnvironments = response.environments || [];
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
    this.manageAction = "modify";
    this.envStatus = null;
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
