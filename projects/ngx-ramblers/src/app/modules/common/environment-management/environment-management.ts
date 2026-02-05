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
  faPlus,
  faRedo,
  faSpinner,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { NgSelectComponent } from "@ng-select/ng-select";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { ExistingEnvironment, ManageAction, OperationInProgress } from "../../../models/environment-setup.model";
import { EventType, MessageType } from "../../../models/websocket.model";
import { SessionLogsComponent } from "../../../shared/components/session-logs";

@Component({
  selector: "app-environment-management",
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, NgSelectComponent, SessionLogsComponent],
  styles: [`
    :host
      display: block
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
            @if (selectedExistingEnv) {
              <div class="col-md-6 mb-3">
                <label>Action</label>
                <div class="d-flex gap-3">
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionResume"
                           [checked]="manageAction === ManageAction.RESUME"
                           (change)="setManageAction(ManageAction.RESUME)">
                    <label class="form-check-label" for="actionResume">
                      <fa-icon [icon]="faRedo" class="me-1"></fa-icon>
                      Modify Environment
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionDestroy"
                           [checked]="manageAction === ManageAction.DESTROY"
                           (change)="setManageAction(ManageAction.DESTROY)">
                    <label class="form-check-label text-danger" for="actionDestroy">
                      <fa-icon [icon]="faTrash" class="me-1"></fa-icon>
                      Destroy
                    </label>
                  </div>
                </div>
              </div>
            }
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
                  <strong>API Key:</strong>
                  @if (selectedExistingEnv.hasApiKey) {
                    <span class="text-success">Configured</span>
                  } @else {
                    <span class="text-warning">Missing</span>
                  }
                </div>
              </div>
            </div>
          }

          @if (selectedExistingEnv && manageAction === ManageAction.RESUME) {
            <div class="row mt-3">
              <div class="col-md-12">
                <strong>Steps to run:</strong>
                <div class="form-check mt-2">
                  <input class="form-check-input" type="checkbox" id="runDbInit"
                         [(ngModel)]="resumeOptions.runDbInit">
                  <label class="form-check-label" for="runDbInit">
                    Initialise database
                  </label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="runFlyDeployment"
                         [(ngModel)]="resumeOptions.runFlyDeployment">
                  <label class="form-check-label" for="runFlyDeployment">Deploy to Fly.io</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="copyStandardAssets"
                         [(ngModel)]="resumeOptions.copyStandardAssets">
                  <label class="form-check-label" for="copyStandardAssets">Copy standard assets (icons, logos, backgrounds)</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="setupSubdomain"
                         [(ngModel)]="resumeOptions.setupSubdomain">
                  <label class="form-check-label" for="setupSubdomain">Setup subdomain (DNS + SSL certificate)</label>
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
                    {{ setupError }}
                  </div>
                </div>
              </div>
            }
            <div class="row mt-3">
              <div class="col-md-12">
                <button class="btn btn-primary" (click)="resumeSetup()"
                        [disabled]="operationBusy">
                  @if (resuming) {
                    <fa-icon [icon]="faSpinner" [spin]="true" class="me-1"></fa-icon>
                  }
                  Modify Environment
                </button>
              </div>
            </div>
          }

          @if (selectedExistingEnv && manageAction === ManageAction.DESTROY) {
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
                    <li>Remove from configs.json</li>
                    <li>Delete the secrets file</li>
                  </ul>
                  <p class="mt-3 mb-0"><strong>This action is irreversible.</strong></p>
                </div>
              </div>
            </div>
            @if (destroyProgressMessages.length > 0) {
              <div class="row mt-3">
                <div class="col-md-12">
                  <app-session-logs [messages]="destroyProgressMessages"></app-session-logs>
                </div>
              </div>
            }
            @if (destroyComplete) {
              <div class="row mt-3">
                <div class="col-md-12">
                  <div class="alert alert-success mb-0">
                    <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
                    <strong>Environment destroyed successfully.</strong>
                  </div>
                </div>
              </div>
            }
            @if (destroyError) {
              <div class="row mt-3">
                <div class="col-md-12">
                  <div class="alert alert-danger mb-0">
                    <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                    {{ destroyError }}
                  </div>
                </div>
              </div>
            }
            <div class="row mt-3">
              <div class="col-md-12">
                <button class="btn btn-danger" (click)="destroyEnvironment()"
                        [disabled]="operationBusy || destroyComplete">
                  @if (destroying) {
                    <fa-icon [icon]="faSpinner" [spin]="true" class="me-1"></fa-icon>
                  }
                  Destroy Environment
                </button>
              </div>
            </div>
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
  private stringUtils = inject(StringUtilsService);
  private websocketService = inject(WebSocketClientService);

  private subscriptions: Subscription[] = [];
  private notify: AlertInstance;
  notifyTarget: AlertTarget = {};
  private wsConnected = false;

  enabled = false;
  loading = false;
  existingEnvironments: ExistingEnvironment[] = [];
  selectedExistingEnv: ExistingEnvironment | null = null;
  manageAction = ManageAction.RESUME;
  operationInProgress = OperationInProgress.NONE;

  resumeOptions = {
    runDbInit: false,
    runFlyDeployment: true,
    copyStandardAssets: false,
    setupSubdomain: false
  };

  progressMessages: string[] = [];
  setupResult: { environmentName: string; appName: string; appUrl: string } | null = null;
  setupError: string | null = null;

  destroyProgressMessages: string[] = [];
  destroyComplete = false;
  destroyError: string | null = null;

  protected readonly ManageAction = ManageAction;
  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faCog = faCog;
  protected readonly faExclamationCircle = faExclamationCircle;
  protected readonly faExclamationTriangle = faExclamationTriangle;
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
          if (data?.result) {
            this.setupResult = {
              environmentName: data.result.environmentName,
              appName: data.result.appName,
              appUrl: data.result.appUrl
            };
          }
          this.progressMessages.push(data?.message || "Completed");
          if (this.resumeOptions.setupSubdomain && this.selectedExistingEnv) {
            await this.runSubdomainSetup();
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

  onExistingEnvironmentSelected(env: ExistingEnvironment): void {
    this.clearState();
  }

  setManageAction(action: ManageAction): void {
    this.manageAction = action;
    this.clearState();
  }

  private clearState(): void {
    this.progressMessages = [];
    this.setupResult = null;
    this.setupError = null;
    this.destroyProgressMessages = [];
    this.destroyComplete = false;
    this.destroyError = null;
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

        if (response.result) {
          this.setupResult = {
            environmentName: response.result.environmentName,
            appName: response.result.appName,
            appUrl: response.result.appUrl
          };
          this.progressMessages.push("Environment modified successfully!");
        }
        this.operationInProgress = OperationInProgress.NONE;

        if (this.resumeOptions.setupSubdomain) {
          await this.runSubdomainSetup();
        }
      }
    } catch (error) {
      this.setupError = this.extractErrorDetail(error);
      this.progressMessages.push(`Error: ${this.setupError}`);
      this.logger.error("Resume setup failed:", error);
      this.operationInProgress = OperationInProgress.NONE;
    }
  }

  private async runSubdomainSetup(): Promise<void> {
    if (!this.selectedExistingEnv) return;
    this.progressMessages.push("Setting up subdomain...");
    const subdomainResponse = await this.environmentSetupService.setupSubdomain(this.selectedExistingEnv.name);
    if (subdomainResponse.success) {
      this.progressMessages.push(`Subdomain configured: ${subdomainResponse.hostname}`);
    } else {
      this.progressMessages.push(`Subdomain setup failed: ${subdomainResponse.message}`);
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
          this.destroyProgressMessages.push(`${step.success ? "✓" : "✗"} ${step.step}: ${step.message}`);
        });
      }

      this.destroyProgressMessages.push(response.message || `Environment ${environmentName} destroyed`);

      if (response.success) {
        this.destroyComplete = true;
        this.selectedExistingEnv = null;
        await this.loadExistingEnvironments();
        this.manageAction = ManageAction.RESUME;
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
