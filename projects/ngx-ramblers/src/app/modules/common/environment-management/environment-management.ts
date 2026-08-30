import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { values } from "es-toolkit/compat";
import { StoredValue } from "../../../models/ui-actions";
import { sortBy } from "../../../functions/arrays";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCog,
  faExclamationTriangle,
  faPlaneDeparture,
  faSpinner,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { NgSelectComponent } from "@ng-select/ng-select";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  EnvironmentModifyOptions,
  EnvironmentStatus,
  ExistingEnvironment,
  ManageAction
} from "../../../models/environment-setup.model";
import { emptyModifyOptions, EnvironmentModify, modifyOptionsFromStatus } from "./environment-modify";
import { EnvironmentModifySteps } from "./environment-modify-steps";
import { EnvironmentFlyOrgMigrate } from "./environment-fly-org-migrate";
import { EnvironmentDestroy } from "./environment-destroy";

@Component({
  selector: "app-environment-management",
  imports: [
    FormsModule,
    FontAwesomeModule,
    NgSelectComponent,
    EnvironmentModify,
    EnvironmentModifySteps,
    EnvironmentFlyOrgMigrate,
    EnvironmentDestroy
  ],
  styles: [`
    :host
      display: block

    :host ::ng-deep .alert
      padding: 1rem

    :host ::ng-deep .resume-steps
      max-width: 36rem

    :host ::ng-deep .resume-step.form-check
      padding-right: 0

    :host ::ng-deep .resume-step-label
      display: flex
      align-items: center
      justify-content: space-between
      width: 100%
      gap: 1rem

    :host ::ng-deep .resume-step-text
      flex: 1 1 auto
      min-width: 0

    :host ::ng-deep .resume-step-badge
      flex: 0 0 4.5rem
      text-align: center
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
          <div class="thumbnail-heading">Change existing environment</div>
          <div class="col-12">
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
              <div class="col-12">
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
                <div class="col-md-3 mb-2">
                  <strong>Organisation:</strong>
                  <span class="ms-1">{{ selectedExistingEnv.organisation || "personal" }}</span>
                </div>
              </div>
              </div>
            </div>

            @if (loadingStatus) {
              <div class="d-flex align-items-center mt-3">
                <fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>
                Detecting environment state...
              </div>
            } @else {
              <div class="row thumbnail-heading-frame mt-3">
                <div class="thumbnail-heading">What do you want to do?</div>
                <div class="col-12">
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionModify"
                           [value]="ManageAction.MODIFY" [ngModel]="manageAction"
                           (ngModelChange)="setManageAction($event)">
                    <label class="form-check-label" for="actionModify">
                      <fa-icon [icon]="faCog" class="me-1"></fa-icon> Modify (deploy, subdomain, hostnames, data)
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionMigrateFlyOrg"
                           [value]="ManageAction.MIGRATE_FLY_ORG" [ngModel]="manageAction"
                           (ngModelChange)="setManageAction($event)">
                    <label class="form-check-label" for="actionMigrateFlyOrg">
                      <fa-icon [icon]="faPlaneDeparture" class="me-1"></fa-icon> Move Fly organisation (cutover to new org token)
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="manageAction" id="actionDestroy"
                           [value]="ManageAction.DESTROY" [ngModel]="manageAction"
                           (ngModelChange)="setManageAction($event)">
                    <label class="form-check-label text-danger" for="actionDestroy">
                      <fa-icon [icon]="faTrash" class="me-1"></fa-icon> Destroy (permanent removal)
                    </label>
                  </div>
                  @if (manageAction === ManageAction.MODIFY) {
                    <div class="mt-3">
                      <app-environment-modify-steps
                        [resumeOptions]="resumeOptions"
                        [envStatus]="envStatus"/>
                    </div>
                    @if (!selectedExistingEnv.hasApiKey && (resumeOptions.runFlyDeployment || resumeOptions.setupSubdomain)) {
                      <div class="alert alert-warning d-flex align-items-start mt-3 mb-0">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2 mt-1"></fa-icon>
                        <div>
                          <strong>Fly.io token not configured</strong>
                          <div class="mt-1">Deploy and subdomain operations will fail without it. Configure it in the Settings tab under environment configuration.</div>
                        </div>
                      </div>
                    }
                  }
                </div>
              </div>
              @if (manageAction === ManageAction.MODIFY) {
                <app-environment-modify
                  [environment]="selectedExistingEnv"
                  [environments]="existingEnvironments"
                  [envStatus]="envStatus"
                  [resumeOptions]="resumeOptions"
                  (environmentChanged)="onChildEnvironmentChanged()"/>
              }
              @if (manageAction === ManageAction.MIGRATE_FLY_ORG) {
                <app-environment-fly-org-migrate
                  [environment]="selectedExistingEnv"
                  (environmentChanged)="onChildEnvironmentChanged()"/>
              }
              @if (manageAction === ManageAction.DESTROY) {
                <app-environment-destroy
                  [environment]="selectedExistingEnv"
                  (destroyed)="onEnvironmentDestroyed()"/>
              }
              @if (notifyTarget.showAlert) {
                <div class="alert {{ notifyTarget.alert.class }} mt-3 mb-0">
                  <div class="d-flex align-items-start">
                    <fa-icon [icon]="notifyTarget.alert.icon" class="me-2 mt-1"></fa-icon>
                    <div>
                      @if (notifyTarget.alertTitle) {
                        <strong>{{ notifyTarget.alertTitle }}</strong>
                        <div class="mt-1">{{ notifyTarget.alertMessage }}</div>
                      } @else {
                        {{ notifyTarget.alertMessage }}
                      }
                    </div>
                  </div>
                </div>
              }
            }
          }
          </div>
        </div>
      }
    }
  `
})
export class EnvironmentManagement implements OnInit {
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("EnvironmentManagement", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  private notify: AlertInstance;
  notifyTarget: AlertTarget = {};

  enabled = false;
  loading = false;
  loadingStatus = false;
  existingEnvironments: ExistingEnvironment[] = [];
  selectedExistingEnv: ExistingEnvironment | null = null;
  manageAction: ManageAction = ManageAction.MODIFY;
  envStatus: EnvironmentStatus | null = null;
  resumeOptions: EnvironmentModifyOptions = emptyModifyOptions();

  protected readonly ManageAction = ManageAction;
  protected readonly faCog = faCog;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faPlaneDeparture = faPlaneDeparture;
  protected readonly faSpinner = faSpinner;
  protected readonly faTrash = faTrash;

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    try {
      const status = await this.environmentSetupService.status();
      this.enabled = status.enabled;
      if (this.enabled) {
        await this.loadExistingEnvironments();
        await this.applyStateFromQueryParams();
      }
    } catch (error) {
      this.logger.error("Failed to check setup status:", error);
      this.enabled = false;
    }
  }

  setManageAction(action: ManageAction): void {
    this.manageAction = action;
    this.updateQueryParams({ [StoredValue.MANAGE_ACTION]: action });
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
    const preservedManageAction = this.manageAction;
    this.clearState();
    this.manageAction = preservedManageAction;
    this.updateQueryParams({ [StoredValue.ENVIRONMENT]: env?.name || null });
    if (env) {
      await this.probeEnvironmentStatus(env.name);
    }
  }

  async onChildEnvironmentChanged(): Promise<void> {
    await this.refreshSelectedEnvironment();
    if (this.selectedExistingEnv) {
      await this.probeEnvironmentStatus(this.selectedExistingEnv.name);
    }
  }

  async onEnvironmentDestroyed(): Promise<void> {
    this.selectedExistingEnv = null;
    this.updateQueryParams({ [StoredValue.ENVIRONMENT]: null });
    await this.loadExistingEnvironments();
  }

  private async applyStateFromQueryParams(): Promise<void> {
    const params = this.activatedRoute.snapshot.queryParams;
    const manageActionParameter = params[StoredValue.MANAGE_ACTION];
    if (manageActionParameter && values(ManageAction).includes(manageActionParameter)) {
      this.manageAction = manageActionParameter;
    }
    const environmentParameter = params[StoredValue.ENVIRONMENT];
    const matched = this.existingEnvironments.find(environment => environment.name === environmentParameter);
    if (matched) {
      this.selectedExistingEnv = matched;
      await this.onExistingEnvironmentSelected(matched);
    }
  }

  private updateQueryParams(queryParams: Record<string, string | null>): void {
    this.router.navigate([], { queryParams, queryParamsHandling: "merge" });
  }

  private async probeEnvironmentStatus(environmentName: string): Promise<void> {
    const showSpinner = this.envStatus === null;
    if (showSpinner) {
      this.loadingStatus = true;
    }
    try {
      this.envStatus = await this.environmentSetupService.environmentStatus(environmentName);
      this.resumeOptions = modifyOptionsFromStatus(this.envStatus);
      this.logger.info("Environment status:", this.envStatus);
    } catch (error) {
      this.logger.error("Failed to probe environment status:", error);
      this.resumeOptions = modifyOptionsFromStatus(null);
    } finally {
      if (showSpinner) {
        this.loadingStatus = false;
      }
    }
  }

  private clearState(): void {
    this.manageAction = ManageAction.MODIFY;
    this.envStatus = null;
    this.resumeOptions = emptyModifyOptions();
  }

  private async refreshSelectedEnvironment(): Promise<void> {
    if (this.selectedExistingEnv) {
      const currentName = this.selectedExistingEnv.name;
      await this.loadExistingEnvironments();
      const refreshed = this.existingEnvironments.find(env => env.name === currentName) || null;
      if (refreshed) {
        this.selectedExistingEnv = refreshed;
      }
    }
  }
}
