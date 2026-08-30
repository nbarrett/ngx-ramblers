import { Component, EventEmitter, inject, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCheckCircle,
  faExclamationTriangle,
  faPlaneDeparture,
  faRedo,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import {
  EnvironmentAppResult,
  ExistingEnvironment,
  FlyOrgMigrateForm,
  FlyOrgMigrateOptions,
  FlyOrgMigrationPhase,
  FlyOrgMigrationStatus,
  OperationInProgress
} from "../../../models/environment-setup.model";
import { EventType, MessageType } from "../../../models/websocket.model";
import { InputSize } from "../../../models/ui-size.model";
import { AlertTarget } from "../../../models/alert-target.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { EnvironmentConfigService } from "../../../services/environment-config.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { SecretInputComponent } from "../secret-input/secret-input.component";
import { SessionLogsComponent } from "../../../shared/components/session-logs";
import { environmentOperationErrorDetail } from "./environment-operation-error";

function emptyFlyMigrateForm(): FlyOrgMigrateForm {
  return {
    oldApiKey: "",
    oldOrganisation: "",
    oldAppName: "",
    newApiKey: "",
    newOrganisation: "",
    newAppName: ""
  };
}

@Component({
  selector: "app-environment-fly-org-migrate",
  imports: [FormsModule, FontAwesomeModule, SecretInputComponent, SessionLogsComponent],
  styles: [`
    :host
      display: block

    .fly-migrate-panels
      margin-bottom: 0

    .fly-migrate-panels .thumbnail-heading-frame
      margin-top: 1.75rem
      margin-bottom: 0.75rem
      height: calc(100% - 0.75rem)

    .fly-migrate-detect
      margin-top: 2rem

    .fly-migrate-options
      clear: both
      position: relative
      z-index: 1
      margin-top: 0.5rem

    .fly-migrate-status .resume-step-label
      display: flex
      align-items: center
      justify-content: space-between
      width: 100%
      gap: 1rem
  `],
  template: `
    <div class="row mt-3">
      <div class="col-md-12">
        <p class="text-muted small mb-3">
          Fly cannot move an app between orgs. Enter the <strong>old</strong> token that owns the app now,
          and the <strong>new</strong> org-scoped token for the destination. Cutover creates the app under
          the new token, deploys the same image and secrets, re-points custom domain DNS/SSL (from Site URL
          and configured custom domains) at the destination app, optionally re-attaches the free NGX
          subdomain, then optionally destroys the old app. If a previous run stopped mid-way, status below
          shows what is already done so <strong>Resume cutover</strong> only finishes remaining steps.
        </p>
        <div class="row fly-migrate-panels">
          <div class="col-md-6">
            <div class="thumbnail-heading-frame">
              <div class="thumbnail-heading">Old Fly credentials (source)</div>
              <div class="mb-2">
                <label class="form-label" for="flyMigrateOldApiKey">API token</label>
                <app-secret-input
                  [(ngModel)]="flyMigrateForm.oldApiKey"
                  name="flyMigrateOldApiKey"
                  [size]="InputSize.SM">
                </app-secret-input>
              </div>
              <div class="mb-2">
                <label class="form-label" for="flyMigrateOldOrg">Organisation</label>
                <input type="text" class="form-control form-control-sm" id="flyMigrateOldOrg"
                       [(ngModel)]="flyMigrateForm.oldOrganisation" name="flyMigrateOldOrg"
                       autocomplete="off" placeholder="personal">
              </div>
              <div class="mb-0">
                <label class="form-label" for="flyMigrateOldApp">App name</label>
                <input type="text" class="form-control form-control-sm" id="flyMigrateOldApp"
                       [(ngModel)]="flyMigrateForm.oldAppName" name="flyMigrateOldApp"
                       autocomplete="off">
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="thumbnail-heading-frame">
              <div class="thumbnail-heading">New Fly credentials (destination)</div>
              <div class="mb-2">
                <label class="form-label" for="flyMigrateNewApiKey">API token</label>
                <app-secret-input
                  [(ngModel)]="flyMigrateForm.newApiKey"
                  name="flyMigrateNewApiKey"
                  [size]="InputSize.SM">
                </app-secret-input>
              </div>
              <div class="mb-2">
                <label class="form-label" for="flyMigrateNewOrg">Organisation</label>
                <input type="text" class="form-control form-control-sm" id="flyMigrateNewOrg"
                       [(ngModel)]="flyMigrateForm.newOrganisation" name="flyMigrateNewOrg"
                       autocomplete="off" placeholder="e.g. ramblers">
              </div>
              <div class="mb-0">
                <label class="form-label" for="flyMigrateNewApp">App name</label>
                <input type="text" class="form-control form-control-sm" id="flyMigrateNewApp"
                       [(ngModel)]="flyMigrateForm.newAppName" name="flyMigrateNewApp"
                       autocomplete="off">
                <small class="form-text text-muted">Usually the same name as the old app</small>
              </div>
            </div>
          </div>
        </div>
        <div class="fly-migrate-detect d-flex align-items-center gap-2 flex-wrap mb-3">
          <button type="button" class="btn btn-quiet d-inline-flex align-items-center"
                  (click)="probeFlyOrgMigrationStatus()"
                  [disabled]="operationBusy || loadingFlyMigrationStatus">
            @if (loadingFlyMigrationStatus) {
              <fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>
            } @else {
              <fa-icon [icon]="faRedo" class="me-2"></fa-icon>
            }
            Detect cutover state
          </button>
          @if (flyMigrationStatus) {
            <span class="small text-muted">{{ flyMigrationStatus.summary }}</span>
          }
        </div>
        @if (flyMigrationStatusError) {
          <div class="alert alert-warning mb-2">
            <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
            {{ flyMigrationStatusError }}
          </div>
        }
        @if (flyMigrationStatus) {
          <div class="fly-migrate-status resume-steps mb-3">
            <div class="resume-step">
              <span class="resume-step-label">
                <span class="resume-step-text">Preferred app under destination token</span>
                <span class="badge resume-step-badge"
                      [class]="flyMigrationStatus.preferredExistsUnderNew ? 'bg-success' : 'bg-warning'">
                  {{ flyMigrationStatus.preferredExistsUnderNew ? "done" : "needed" }}
                </span>
              </span>
            </div>
            <div class="resume-step">
              <span class="resume-step-label">
                <span class="resume-step-text">Preferred app deployed</span>
                <span class="badge resume-step-badge"
                      [class]="flyMigrationStatus.preferredDeployedUnderNew ? 'bg-success' : 'bg-warning'">
                  {{ flyMigrationStatus.preferredDeployedUnderNew ? "done" : "needed" }}
                </span>
              </span>
            </div>
            <div class="resume-step">
              <span class="resume-step-label">
                <span class="resume-step-text">Source app removed</span>
                <span class="badge resume-step-badge"
                      [class]="!flyMigrationStatus.sourceExistsUnderOld ? 'bg-success' : 'bg-warning'">
                  {{ !flyMigrationStatus.sourceExistsUnderOld ? "done" : "needed" }}
                </span>
              </span>
            </div>
            <div class="resume-step">
              <span class="resume-step-label">
                <span class="resume-step-text">Temporary cutover app cleaned up</span>
                <span class="badge resume-step-badge"
                      [class]="!flyMigrationStatus.cutoverExistsUnderNew ? 'bg-success' : 'bg-warning'">
                  {{ !flyMigrationStatus.cutoverExistsUnderNew ? "done" : "needed" }}
                </span>
              </span>
            </div>
            <div class="resume-step">
              <span class="resume-step-label">
                <span class="resume-step-text">Config points at preferred app</span>
                <span class="badge resume-step-badge"
                      [class]="flyMigrationStatus.configPointsAtPreferred && !flyMigrationStatus.hasPreviousCredentials ? 'bg-success' : 'bg-warning'">
                  {{ flyMigrationStatus.configPointsAtPreferred && !flyMigrationStatus.hasPreviousCredentials ? "done" : "needed" }}
                </span>
              </span>
            </div>
            <div class="resume-step">
              <span class="resume-step-label">
                <span class="resume-step-text">
                  Custom domain DNS/SSL on destination
                  @if (flyMigrationStatus.customDomainHostnames?.length) {
                    <span class="text-muted"> ({{ flyMigrationStatus.customDomainHostnames.join(", ") }})</span>
                  }
                </span>
                <span class="badge resume-step-badge"
                      [class]="!flyMigrationStatus.needsCustomDomainReattach ? 'bg-success' : 'bg-warning'">
                  {{ !flyMigrationStatus.needsCustomDomainReattach ? "done" : "needed" }}
                </span>
              </span>
            </div>
          </div>
        }
        <div class="fly-migrate-options">
          <div class="form-check mb-2">
            <input class="form-check-input" type="checkbox" id="destroyOldFlyAppManage"
                   [(ngModel)]="flyMigrateOptions.destroyOldApp" name="destroyOldFlyAppManage">
            <label class="form-check-label" for="destroyOldFlyAppManage">
              Destroy previous Fly app after the new app is healthy
            </label>
          </div>
          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="reattachSubdomainOnMigrateManage"
                   [(ngModel)]="flyMigrateOptions.reattachSubdomain" name="reattachSubdomainOnMigrateManage">
            <label class="form-check-label" for="reattachSubdomainOnMigrateManage">
              Re-attach free NGX subdomain ({{ environment.name }}.ngx-ramblers.org.uk) DNS/SSL only — leave off if this site uses a custom domain only
            </label>
          </div>
        </div>
        @if (progressMessages.length > 0) {
          <app-session-logs [messages]="progressMessages"></app-session-logs>
        }
        @if (flyMigrationComplete && setupResult) {
          <div class="alert alert-success mt-3 mb-0">
            <fa-icon [icon]="faCheckCircle" class="me-2"></fa-icon>
            <strong>Fly organisation migration completed.</strong>
            @if (setupResult.appUrl) {
              <br>App URL: <a [href]="setupResult.appUrl" target="_blank">{{ setupResult.appUrl }}</a>
            }
            @if (setupResult.appName) {
              <br>App name: <code>{{ setupResult.appName }}</code>
            }
          </div>
        }
        @if (setupError) {
          <div class="alert alert-danger mt-3 mb-0">
            <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
            <strong>Error:</strong> {{ setupError }}
          </div>
        }
        <button class="btn btn-primary mt-3"
                (click)="runFlyOrgMigration()"
                [disabled]="operationBusy || (flyMigrationStatus?.phase === FlyOrgMigrationPhase.COMPLETE && !flyMigrationStatus?.needsCustomDomainReattach)">
          @if (migratingFlyOrg) {
            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
          } @else {
            <fa-icon [icon]="faPlaneDeparture" class="me-1"></fa-icon>
          }
          {{ flyMigrationPrimaryButtonLabel() }}
        </button>
      </div>
    </div>
  `
})
export class EnvironmentFlyOrgMigrate implements OnInit, OnChanges, OnDestroy {
  private logger = inject(LoggerFactory).createLogger("EnvironmentFlyOrgMigrate", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private environmentConfigService = inject(EnvironmentConfigService);
  private websocketService = inject(WebSocketClientService);
  notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private subscriptions: Subscription[] = [];
  private wsConnected = false;

  @Input({required: true}) environment: ExistingEnvironment;
  @Output() environmentChanged = new EventEmitter<void>();

  flyMigrateOptions: FlyOrgMigrateOptions = {
    destroyOldApp: true,
    reattachSubdomain: false
  };
  flyMigrateForm: FlyOrgMigrateForm = emptyFlyMigrateForm();
  flyMigrationStatus: FlyOrgMigrationStatus | null = null;
  flyMigrationStatusError: string | null = null;
  loadingFlyMigrationStatus = false;
  operationInProgress = OperationInProgress.NONE;
  progressMessages: string[] = [];
  setupResult: EnvironmentAppResult | null = null;
  setupError: string | null = null;
  flyMigrationComplete = false;

  protected readonly FlyOrgMigrationPhase = FlyOrgMigrationPhase;
  protected readonly InputSize = InputSize;
  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faPlaneDeparture = faPlaneDeparture;
  protected readonly faRedo = faRedo;
  protected readonly faSpinner = faSpinner;

  get migratingFlyOrg(): boolean {
    return this.operationInProgress === OperationInProgress.MIGRATING_FLY_ORG;
  }

  get operationBusy(): boolean {
    return this.operationInProgress !== OperationInProgress.NONE;
  }

  async ngOnInit() {
    await this.connectWebSocket();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.environment && this.environment) {
      void this.populateFlyMigrateForm();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  flyMigrationPrimaryButtonLabel(): string {
    if (this.migratingFlyOrg) {
      return "Migrating…";
    } else if (this.flyMigrationStatus?.phase === FlyOrgMigrationPhase.COMPLETE && !this.flyMigrationStatus?.needsCustomDomainReattach) {
      return "Cutover already complete";
    } else if (this.flyMigrationStatus?.resumeAvailable || this.flyMigrationStatus?.needsCustomDomainReattach) {
      return "Resume cutover";
    } else {
      return "Move to this Fly organisation";
    }
  }

  async probeFlyOrgMigrationStatus(): Promise<void> {
    if (!this.environment) {
      this.flyMigrationStatus = null;
    } else {
      this.loadingFlyMigrationStatus = true;
      this.flyMigrationStatusError = null;
      try {
        this.flyMigrationStatus = await this.environmentSetupService.flyOrgMigrationStatus(
          this.environment.name,
          {
            previousApiKey: this.flyMigrateForm.oldApiKey,
            previousOrganisation: this.flyMigrateForm.oldOrganisation || "personal",
            previousAppName: this.flyMigrateForm.oldAppName,
            newApiKey: this.flyMigrateForm.newApiKey,
            newOrganisation: this.flyMigrateForm.newOrganisation || "personal",
            newAppName: this.flyMigrateForm.newAppName
          }
        );
      } catch (error) {
        this.flyMigrationStatus = null;
        this.flyMigrationStatusError = environmentOperationErrorDetail(error);
        this.logger.error("Failed to probe Fly org migration status:", error);
      } finally {
        this.loadingFlyMigrationStatus = false;
      }
    }
  }

  async runFlyOrgMigration(): Promise<void> {
    if (!this.environment) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment to migrate" });
    } else if (!this.wsConnected) {
      this.setupError = "WebSocket not connected — refresh the page and try again";
      this.progressMessages = [this.setupError];
    } else {
      this.operationInProgress = OperationInProgress.MIGRATING_FLY_ORG;
      this.progressMessages = [];
      this.setupError = null;
      this.setupResult = null;
      this.flyMigrationComplete = false;
      try {
        await this.probeFlyOrgMigrationStatus();
        if (this.flyMigrationStatus?.phase === FlyOrgMigrationPhase.COMPLETE && !this.flyMigrationStatus.needsCustomDomainReattach) {
          this.progressMessages = [this.flyMigrationStatus.summary || "Cutover already complete"];
          this.flyMigrationComplete = true;
          this.operationInProgress = OperationInProgress.NONE;
        } else {
          this.progressMessages.push(`Starting Fly organisation migration for ${this.environment.name}`);
          const payload: {
            environmentName: string;
            destroyOldApp: boolean;
            reattachSubdomain: boolean;
            previousApiKey?: string;
            previousOrganisation?: string;
            previousAppName?: string;
            newApiKey?: string;
            newOrganisation?: string;
            newAppName?: string;
          } = {
            environmentName: this.environment.name,
            destroyOldApp: this.flyMigrateOptions.destroyOldApp,
            reattachSubdomain: this.flyMigrateOptions.reattachSubdomain
          };
          if (this.flyMigrateForm.oldApiKey) {
            payload.previousApiKey = this.flyMigrateForm.oldApiKey;
          }
          if (this.flyMigrateForm.oldOrganisation) {
            payload.previousOrganisation = this.flyMigrateForm.oldOrganisation;
          }
          if (this.flyMigrateForm.oldAppName) {
            payload.previousAppName = this.flyMigrateForm.oldAppName;
          }
          if (this.flyMigrateForm.newApiKey) {
            payload.newApiKey = this.flyMigrateForm.newApiKey;
          }
          if (this.flyMigrateForm.newOrganisation) {
            payload.newOrganisation = this.flyMigrateForm.newOrganisation;
          }
          if (this.flyMigrateForm.newAppName) {
            payload.newAppName = this.flyMigrateForm.newAppName;
          }
          this.websocketService.sendMessage(EventType.FLY_ORG_MIGRATE, payload);
        }
      } catch (error) {
        this.operationInProgress = OperationInProgress.NONE;
        this.setupError = environmentOperationErrorDetail(error);
        this.progressMessages = [`Error: ${this.setupError}`];
      }
    }
  }

  private async populateFlyMigrateForm(): Promise<void> {
    if (!this.environment) {
      this.resetFlyMigrateForm();
    } else {
      try {
        await this.environmentConfigService.refresh();
        const config = this.environmentConfigService.cachedEnvironmentsConfig();
        const envConfig = (config?.environments || []).find(item => item.environment === this.environment.name);
        const flyio = envConfig?.flyio;
        const appName = flyio?.appName || this.environment.appName || "";
        const preferredAppName = appName.replace(/-cutover$/, "") || appName;
        const currentOrg = flyio?.organisation || this.environment.organisation || "personal";
        const currentApiKey = flyio?.apiKey || "";
        if (flyio?.previous?.apiKey) {
          const oldOrganisation = flyio.previous.organisation || currentOrg || "personal";
          this.flyMigrateForm = {
            oldApiKey: flyio.previous.apiKey || "",
            oldOrganisation,
            oldAppName: flyio.previous.appName || preferredAppName,
            newApiKey: currentApiKey,
            newOrganisation: currentOrg || oldOrganisation,
            newAppName: preferredAppName
          };
        } else {
          this.flyMigrateForm = {
            oldApiKey: currentApiKey,
            oldOrganisation: currentOrg,
            oldAppName: preferredAppName,
            newApiKey: "",
            newOrganisation: currentOrg,
            newAppName: preferredAppName
          };
        }
        await this.probeFlyOrgMigrationStatus();
      } catch (error) {
        this.logger.error("Failed to load Fly credentials for migration form:", error);
        const fallbackOrg = this.environment.organisation || "personal";
        this.flyMigrateForm = {
          oldApiKey: "",
          oldOrganisation: fallbackOrg,
          oldAppName: this.environment.appName || "",
          newApiKey: "",
          newOrganisation: fallbackOrg,
          newAppName: this.environment.appName || ""
        };
      }
    }
  }

  private resetFlyMigrateForm(): void {
    this.flyMigrateForm = emptyFlyMigrateForm();
    this.flyMigrationStatus = null;
    this.flyMigrationStatusError = null;
  }

  private async connectWebSocket(): Promise<void> {
    try {
      await this.websocketService.connect();
      this.wsConnected = true;
      this.subscriptions.push(
        this.websocketService.receiveMessages<{ message: string }>(MessageType.PROGRESS).subscribe(data => {
          if (this.migratingFlyOrg && data?.message) {
            this.progressMessages.push(data.message);
          }
        }),
        this.websocketService.receiveMessages<{ message: string; result?: { environmentName: string; appName: string; appUrl: string } }>(MessageType.COMPLETE).subscribe(async data => {
          if (this.migratingFlyOrg) {
            const pendingResult = data?.result ? {
              environmentName: data.result.environmentName,
              appName: data.result.appName,
              appUrl: data.result.appUrl
            } : null;
            this.progressMessages.push(data?.message || "Completed");
            await this.finishFlyOrgMigration(pendingResult);
            this.operationInProgress = OperationInProgress.NONE;
          }
        }),
        this.websocketService.receiveMessages<{ message?: string; transient?: boolean }>(MessageType.ERROR).subscribe(data => {
          if (this.migratingFlyOrg) {
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

  private async finishFlyOrgMigration(
    pendingResult: { environmentName: string; appName: string; appUrl: string } | null
  ): Promise<void> {
    if (pendingResult) {
      this.setupResult = pendingResult;
    }
    this.flyMigrationComplete = true;
    this.environmentChanged.emit();
    await this.populateFlyMigrateForm();
    await this.probeFlyOrgMigrationStatus();
  }
}
