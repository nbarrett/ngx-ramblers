import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheckCircle, faExclamationCircle, faExclamationTriangle, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { ExistingEnvironment, OperationInProgress } from "../../../models/environment-setup.model";
import { AlertTarget } from "../../../models/alert-target.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { SessionLogsComponent } from "../../../shared/components/session-logs";
import { environmentOperationErrorDetail } from "./environment-operation-error";

@Component({
  selector: "app-environment-destroy",
  imports: [FontAwesomeModule, SessionLogsComponent],
  template: `
    <div class="row mt-3">
      <div class="col-md-12">
        <div class="alert alert-danger">
          <fa-icon [icon]="faExclamationCircle" class="me-2"></fa-icon>
          <strong>Warning:</strong> This will permanently destroy the environment <strong>{{ environment.name }}</strong>.
          <ul class="mb-0 mt-2">
            <li>Delete the Fly.io app: <strong>{{ environment.appName }}</strong></li>
            <li>Delete the S3 bucket: <strong>ngx-ramblers-{{ environment.name.toLowerCase() }}</strong></li>
            <li>Delete the IAM user: <strong>ngx-ramblers-{{ environment.name.toLowerCase() }}-user</strong></li>
            <li>Clear all collections in database: <strong>ngx-ramblers-{{ environment.name.toLowerCase() }}</strong></li>
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
  `
})
export class EnvironmentDestroy {
  private logger = inject(LoggerFactory).createLogger("EnvironmentDestroy", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private environmentSetupService = inject(EnvironmentSetupService);
  notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  @Input({required: true}) environment: ExistingEnvironment;
  @Output() destroyed = new EventEmitter<void>();

  operationInProgress = OperationInProgress.NONE;
  destroyProgressMessages: string[] = [];
  destroyComplete = false;
  destroyError: string | null = null;

  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faExclamationCircle = faExclamationCircle;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faSpinner = faSpinner;

  get destroying(): boolean {
    return this.operationInProgress === OperationInProgress.DESTROYING;
  }

  get operationBusy(): boolean {
    return this.operationInProgress !== OperationInProgress.NONE;
  }

  async destroyEnvironment(): Promise<void> {
    if (!this.environment) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment to destroy" });
    } else {
      const environmentName = this.environment.name;
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
          this.destroyed.emit();
        } else {
          this.destroyError = "Some steps failed - check details above";
        }
      } catch (error) {
        this.destroyError = environmentOperationErrorDetail(error);
        this.logger.error("Destroy environment failed:", error);
        this.destroyProgressMessages.push(`Error: ${this.destroyError}`);
        this.notify.error({ title: "Error", message: this.destroyError });
      } finally {
        this.operationInProgress = OperationInProgress.NONE;
      }
    }
  }
}
