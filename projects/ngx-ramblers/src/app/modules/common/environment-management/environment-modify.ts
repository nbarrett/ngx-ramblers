import { Component, EventEmitter, inject, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCheckCircle,
  faExclamationTriangle,
  faKey,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import {
  AdminPasswordResetResult,
  EnvironmentAppResult,
  EnvironmentModifyOptions,
  EnvironmentStatus,
  ExistingEnvironment,
  OperationInProgress
} from "../../../models/environment-setup.model";
import { EventType, MessageType } from "../../../models/websocket.model";
import { AlertTarget } from "../../../models/alert-target.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SessionLogsComponent } from "../../../shared/components/session-logs";
import { EnvironmentHostnames } from "./environment-hostnames";
import { environmentOperationErrorDetail } from "./environment-operation-error";

export function emptyModifyOptions(): EnvironmentModifyOptions {
  return {
    runDbInit: false,
    runFlyDeployment: false,
    copyStandardAssets: false,
    setupSubdomain: false,
    includeSamplePages: false,
    includeNotificationConfigs: false,
    authenticateBrevoDomain: false
  };
}

export function modifyOptionsFromStatus(envStatus: EnvironmentStatus | null): EnvironmentModifyOptions {
  if (envStatus) {
    return {
      runDbInit: !envStatus.databaseInitialised,
      runFlyDeployment: !envStatus.flyAppDeployed,
      copyStandardAssets: !envStatus.standardAssetsPresent,
      setupSubdomain: !envStatus.subdomainConfigured && !envStatus.subdomainOptional,
      includeSamplePages: !envStatus.samplePagesPresent,
      includeNotificationConfigs: !envStatus.notificationConfigsPresent,
      authenticateBrevoDomain: !envStatus.brevoDomainAuthenticated
    };
  } else {
    return {
      runDbInit: false,
      runFlyDeployment: true,
      copyStandardAssets: false,
      setupSubdomain: false,
      includeSamplePages: false,
      includeNotificationConfigs: false,
      authenticateBrevoDomain: false
    };
  }
}

@Component({
  selector: "app-environment-modify",
  imports: [FormsModule, FontAwesomeModule, SessionLogsComponent, EnvironmentHostnames],
  template: `
    <app-environment-hostnames
      [environment]="environment"
      [environments]="environments"
      [envStatus]="envStatus"
      [operationBusy]="operationBusy"
      (environmentChanged)="onHostnamesEnvironmentChanged()"/>
    <div class="row mt-3">
      <div class="col-md-12 d-flex gap-2 align-items-start flex-wrap">
        <button class="btn btn-primary" (click)="resumeSetup()"
                [disabled]="operationBusy">
          @if (resuming) {
            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
          }
          Run selected steps
        </button>
        <button type="button" class="btn btn-quiet" (click)="generateAdminPasswordReset()"
                [disabled]="operationBusy || generatingPasswordReset">
          @if (generatingPasswordReset) {
            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
          } @else {
            <fa-icon [icon]="faKey" class="me-1"></fa-icon>
          }
          Reset Admin Password
        </button>
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
    @if (passwordResetResult) {
      <div class="row mt-3">
        <div class="col-md-12">
          <div class="alert alert-success mb-0">
            <div class="d-flex align-items-start">
              <fa-icon [icon]="faKey" class="me-2 mt-1"></fa-icon>
              <div>
                <strong>Admin sign-in for this environment</strong>
                <dl class="row mb-0 mt-2">
                  <dt class="col-sm-3">Username</dt>
                  <dd class="col-sm-9"><code>{{ passwordResetResult.userName || passwordResetResult.email }}</code></dd>
                  <dt class="col-sm-3">Email</dt>
                  <dd class="col-sm-9">{{ passwordResetResult.email }}</dd>
                  @if (passwordResetResult.resetUrl) {
                    <dt class="col-sm-3">Set password</dt>
                    <dd class="col-sm-9">
                      <a [href]="passwordResetResult.resetUrl" target="_blank">{{ passwordResetResult.resetUrl }}</a>
                      <div class="small mt-1">Open this once to choose a password, then sign in with the username above. There is no initial password.</div>
                    </dd>
                  }
                  @if (passwordResetResult.flyResetUrl) {
                    <dt class="col-sm-3">Fly.io set password</dt>
                    <dd class="col-sm-9">
                      <a [href]="passwordResetResult.flyResetUrl" target="_blank">{{ passwordResetResult.flyResetUrl }}</a>
                      <div class="small text-muted mt-1">Fallback if the custom host is not ready yet.</div>
                    </dd>
                  }
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
    @if (setupWarnings.length > 0) {
      <div class="row mt-3">
        <div class="col-md-12">
          <div class="alert alert-warning mb-0">
            <div class="d-flex align-items-start">
              <fa-icon [icon]="faExclamationTriangle" class="me-2 mt-1"></fa-icon>
              <div>
                <strong>Completed with {{ stringUtils.pluraliseWithCount(setupWarnings.length, "step") }} needing attention</strong>
                <p class="mb-1 mt-2">The environment is usable. Finish these later (for Brevo domain auth, the Brevo UI is often required).</p>
                <ul class="mb-0">
                  @for (warning of setupWarnings; track warning) {
                    <li>{{ warning }}</li>
                  }
                </ul>
              </div>
            </div>
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
  `
})
export class EnvironmentModify implements OnInit, OnChanges, OnDestroy {
  private logger = inject(LoggerFactory).createLogger("EnvironmentModify", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private websocketService = inject(WebSocketClientService);
  protected stringUtils = inject(StringUtilsService);
  notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private subscriptions: Subscription[] = [];
  private wsConnected = false;

  @Input({required: true}) environment: ExistingEnvironment;
  @Input({required: true}) resumeOptions: EnvironmentModifyOptions;
  @Input() environments: ExistingEnvironment[] = [];
  @Input() envStatus: EnvironmentStatus | null = null;
  @Output() environmentChanged = new EventEmitter<void>();
  operationInProgress = OperationInProgress.NONE;
  progressMessages: string[] = [];
  setupResult: EnvironmentAppResult | null = null;
  setupError: string | null = null;
  setupWarnings: string[] = [];
  passwordResetResult: AdminPasswordResetResult | null = null;
  generatingPasswordReset = false;

  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faKey = faKey;
  protected readonly faSpinner = faSpinner;

  get resuming(): boolean {
    return this.operationInProgress === OperationInProgress.CREATING;
  }

  get operationBusy(): boolean {
    return this.operationInProgress !== OperationInProgress.NONE;
  }

  async ngOnInit() {
    await this.connectWebSocket();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.environment && !changes.environment.firstChange) {
      this.resetOperationState();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onHostnamesEnvironmentChanged(): void {
    this.environmentChanged.emit();
  }

  async resumeSetup(): Promise<void> {
    if (!this.environment) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment to resume" });
    } else {
      this.operationInProgress = OperationInProgress.CREATING;
      this.progressMessages = [];
      this.setupError = null;
      this.setupWarnings = [];
      this.setupResult = null;
      this.progressMessages.push(`Modifying environment: ${this.environment.name}`);
      try {
        const assetsOk = this.resumeOptions.copyStandardAssets ? await this.copyStandardAssetsStep() : true;
        const samplePagesOk = assetsOk && this.resumeOptions.includeSamplePages ? await this.seedSamplePagesStep() : assetsOk;
        const notificationsOk = samplePagesOk && this.resumeOptions.includeNotificationConfigs ? await this.seedNotificationConfigsStep() : samplePagesOk;
        if (notificationsOk) {
          if (this.wsConnected && (this.resumeOptions.runDbInit || this.resumeOptions.runFlyDeployment)) {
            this.websocketService.sendMessage(EventType.ENVIRONMENT_SETUP, {
              environmentName: this.environment.name,
              runDbInit: this.resumeOptions.runDbInit,
              runFlyDeployment: this.resumeOptions.runFlyDeployment
            });
            if (this.resumeOptions.setupSubdomain || this.resumeOptions.authenticateBrevoDomain) {
              this.progressMessages.push("Subdomain setup and Brevo domain authentication run after deployment completes...");
            }
          } else {
            const response = await this.environmentSetupService.resumeEnvironment(
              this.environment.name,
              this.resumeOptions.runDbInit,
              this.resumeOptions.runFlyDeployment
            );
            const pendingResult = response.result ? {
              environmentName: response.result.environmentName,
              appName: response.result.appName,
              appUrl: response.result.appUrl
            } : null;
            await this.finishResumeAfterDeploy(pendingResult);
            if (!this.setupError) {
              this.progressMessages.push("Environment modified successfully!");
            }
            this.operationInProgress = OperationInProgress.NONE;
          }
        }
      } catch (error) {
        this.setupError = environmentOperationErrorDetail(error);
        this.progressMessages.push(`Error: ${this.setupError}`);
        this.logger.error("Resume setup failed:", error);
        this.operationInProgress = OperationInProgress.NONE;
      }
    }
  }

  async generateAdminPasswordReset(): Promise<void> {
    if (this.environment) {
      this.generatingPasswordReset = true;
      this.passwordResetResult = null;
      try {
        const response = await this.environmentSetupService.adminPasswordReset(this.environment.name);
        if (response.success) {
          this.passwordResetResult = response;
          this.progressMessages.push(
            `Admin sign-in ready: username ${response.userName || response.email} - set password via the link shown below`
          );
        } else {
          this.setupWarnings = [...this.setupWarnings, `Admin sign-in: ${response.message}`];
          this.progressMessages.push(`Warning: could not prepare admin sign-in: ${response.message}`);
        }
      } catch (error) {
        const detail = environmentOperationErrorDetail(error);
        this.setupWarnings = [...this.setupWarnings, `Admin sign-in: ${detail}`];
        this.progressMessages.push(`Warning: could not prepare admin sign-in: ${detail}`);
        this.logger.error("Admin password reset failed:", error);
      } finally {
        this.generatingPasswordReset = false;
      }
    }
  }

  private async copyStandardAssetsStep(): Promise<boolean> {
    this.progressMessages.push("Copying standard assets...");
    const copyResponse = await this.environmentSetupService.copyAssets(this.environment.name);
    if (copyResponse.copiedAssets) {
      const { icons, logos, backgrounds } = copyResponse.copiedAssets;
      this.progressMessages.push(`Copied ${icons.length} icons, ${logos.length} logos, ${backgrounds.length} backgrounds`);
    }
    if (copyResponse.failures && copyResponse.failures.length > 0) {
      this.progressMessages.push(`Failed to copy ${copyResponse.failures.length} files:`);
      copyResponse.failures.forEach(failure => this.progressMessages.push(`  - ${failure.file}: ${failure.error}`));
    }
    if (copyResponse.success) {
      return true;
    } else {
      this.setupError = copyResponse.message;
      this.progressMessages.push(`Error: ${copyResponse.message}`);
      this.operationInProgress = OperationInProgress.NONE;
      return false;
    }
  }

  private async seedSamplePagesStep(): Promise<boolean> {
    this.progressMessages.push("Seeding sample page content...");
    const samplePagesResponse = await this.environmentSetupService.seedSamplePages(this.environment.name);
    if (samplePagesResponse.success) {
      this.progressMessages.push(samplePagesResponse.message);
      return true;
    } else {
      this.setupError = samplePagesResponse.message;
      this.progressMessages.push(`Error: ${samplePagesResponse.message}`);
      this.operationInProgress = OperationInProgress.NONE;
      return false;
    }
  }

  private async seedNotificationConfigsStep(): Promise<boolean> {
    this.progressMessages.push("Seeding notification configs...");
    const notifResponse = await this.environmentSetupService.seedNotificationConfigs(this.environment.name);
    if (notifResponse.success) {
      this.progressMessages.push(notifResponse.message);
      return true;
    } else {
      this.setupError = notifResponse.message;
      this.progressMessages.push(`Error: ${notifResponse.message}`);
      this.operationInProgress = OperationInProgress.NONE;
      return false;
    }
  }

  private async finishResumeAfterDeploy(pendingResult: EnvironmentAppResult | null): Promise<void> {
    const result = pendingResult ? {...pendingResult} : null;
    if (this.resumeOptions.setupSubdomain) {
      const subdomainHostname = await this.runSubdomainSetup();
      if (subdomainHostname && result) {
        result.appUrl = `https://${subdomainHostname}`;
      }
    }
    if (this.resumeOptions.authenticateBrevoDomain) {
      await this.runBrevoDomainAuth();
    }
    if (result) {
      this.setupResult = result;
    }
    if (!this.setupError) {
      await this.generateAdminPasswordReset();
    }
  }

  private async runSubdomainSetup(): Promise<string | null> {
    if (this.environment) {
      this.progressMessages.push("Setting up subdomain...");
      try {
        const subdomainResponse = await this.environmentSetupService.setupSubdomain(this.environment.name);
        if (subdomainResponse.success) {
          this.progressMessages.push(`Subdomain configured: ${subdomainResponse.hostname}`);
          return subdomainResponse.hostname;
        } else {
          this.setupError = subdomainResponse.message || "Subdomain setup failed";
          this.progressMessages.push(`Subdomain setup failed: ${this.setupError}`);
          return null;
        }
      } catch (error) {
        this.setupError = environmentOperationErrorDetail(error);
        this.progressMessages.push(`Subdomain setup failed: ${this.setupError}`);
        this.logger.error("Subdomain setup failed:", error);
        return null;
      }
    } else {
      return null;
    }
  }

  private async runBrevoDomainAuth(): Promise<void> {
    if (this.environment) {
      this.progressMessages.push("Authenticating Brevo sending domain...");
      try {
        const authResponse = await this.environmentSetupService.authenticateBrevoDomain(this.environment.name);
        if (authResponse.authenticated) {
          this.progressMessages.push(authResponse.message);
        } else {
          const warning = authResponse.message
            || "Brevo domain authentication did not complete via API; finish it in the Brevo UI and re-run this step later.";
          this.setupWarnings = [...this.setupWarnings, `Brevo sending domain: ${warning}`];
          this.progressMessages.push(`Warning: ${warning}`);
          this.logger.warn("Brevo domain authentication incomplete:", authResponse);
        }
      } catch (error) {
        const warning = environmentOperationErrorDetail(error);
        this.setupWarnings = [...this.setupWarnings, `Brevo sending domain: ${warning}`];
        this.progressMessages.push(`Warning: ${warning}`);
        this.logger.warn("Brevo domain authentication failed (non-fatal):", error);
      }
    }
  }

  private resetOperationState(): void {
    this.progressMessages = [];
    this.setupResult = null;
    this.setupError = null;
    this.setupWarnings = [];
    this.passwordResetResult = null;
  }

  private async connectWebSocket(): Promise<void> {
    try {
      await this.websocketService.connect();
      this.wsConnected = true;
      this.subscriptions.push(
        this.websocketService.receiveMessages<{ message: string }>(MessageType.PROGRESS).subscribe(data => {
          if (this.resuming && data?.message) {
            this.progressMessages.push(data.message);
          }
        }),
        this.websocketService.receiveMessages<{ message: string; result?: EnvironmentAppResult }>(MessageType.COMPLETE).subscribe(async data => {
          if (this.resuming) {
            const pendingResult = data?.result ? {
              environmentName: data.result.environmentName,
              appName: data.result.appName,
              appUrl: data.result.appUrl
            } : null;
            this.progressMessages.push(data?.message || "Completed");
            await this.finishResumeAfterDeploy(pendingResult);
            this.operationInProgress = OperationInProgress.NONE;
          }
        }),
        this.websocketService.receiveMessages<{ message?: string; transient?: boolean }>(MessageType.ERROR).subscribe(data => {
          if (this.resuming) {
            const isTransient = data?.transient === true;
            if (isTransient) {
              this.progressMessages.push("Connection lost - server operation may still be running. Check Fly.io dashboard for deployment status.");
            } else {
              this.operationInProgress = OperationInProgress.NONE;
              this.setupError = data?.message || "An error occurred";
              this.progressMessages.push(`Error: ${this.setupError}`);
            }
          }
        })
      );
    } catch (error) {
      this.logger.error("Failed to connect WebSocket:", error);
      this.wsConnected = false;
    }
  }
}
