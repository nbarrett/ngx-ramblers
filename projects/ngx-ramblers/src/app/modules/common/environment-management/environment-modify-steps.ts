import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { EnvironmentModifyOptions, EnvironmentStatus, EnvironmentStatusCheck } from "../../../models/environment-setup.model";
import { subdomainStepBadgeClass, subdomainStepBadgeLabel } from "./environment-hostname-display";

@Component({
  selector: "app-environment-modify-steps",
  imports: [FormsModule],
  template: `
    <div class="fw-bold mb-2">Steps to run</div>
    <div class="resume-steps">
      <div class="form-check resume-step">
        <input class="form-check-input" type="checkbox" id="runDbInit"
               [(ngModel)]="resumeOptions.runDbInit">
        <label class="form-check-label resume-step-label" for="runDbInit">
          <span class="resume-step-text">Initialise database</span>
          @if (envStatus) {
            <span class="badge resume-step-badge"
                  [class]="stepBadgeClass(EnvironmentStatusCheck.DATABASE, envStatus.databaseInitialised)">
              {{ stepBadgeLabel(EnvironmentStatusCheck.DATABASE, envStatus.databaseInitialised) }}
            </span>
          }
        </label>
      </div>
      <div class="form-check resume-step">
        <input class="form-check-input" type="checkbox" id="runFlyDeployment"
               [(ngModel)]="resumeOptions.runFlyDeployment">
        <label class="form-check-label resume-step-label" for="runFlyDeployment">
          <span class="resume-step-text">Deploy to Fly.io</span>
          @if (envStatus) {
            <span class="badge resume-step-badge"
                  [class]="stepBadgeClass(EnvironmentStatusCheck.FLY, envStatus.flyAppDeployed)">
              {{ stepBadgeLabel(EnvironmentStatusCheck.FLY, envStatus.flyAppDeployed) }}
            </span>
          }
        </label>
      </div>
      <div class="form-check resume-step">
        <input class="form-check-input" type="checkbox" id="copyStandardAssets"
               [(ngModel)]="resumeOptions.copyStandardAssets">
        <label class="form-check-label resume-step-label" for="copyStandardAssets">
          <span class="resume-step-text">Copy standard assets (icons, logos, backgrounds)</span>
          @if (envStatus) {
            <span class="badge resume-step-badge"
                  [class]="stepBadgeClass(EnvironmentStatusCheck.ASSETS, envStatus.standardAssetsPresent)">
              {{ stepBadgeLabel(EnvironmentStatusCheck.ASSETS, envStatus.standardAssetsPresent) }}
            </span>
          }
        </label>
      </div>
      <div class="form-check resume-step">
        <input class="form-check-input" type="checkbox" id="setupSubdomain"
               [(ngModel)]="resumeOptions.setupSubdomain">
        <label class="form-check-label resume-step-label" for="setupSubdomain">
          <span class="resume-step-text">Setup subdomain (DNS + SSL certificate)</span>
          @if (envStatus) {
            <span class="badge resume-step-badge"
                  [class]="subdomainBadgeClass()">
              {{ subdomainBadgeLabel() }}
            </span>
          }
        </label>
      </div>
      <div class="form-check resume-step">
        <input class="form-check-input" type="checkbox" id="authenticateBrevoDomain"
               [(ngModel)]="resumeOptions.authenticateBrevoDomain">
        <label class="form-check-label resume-step-label" for="authenticateBrevoDomain">
          <span class="resume-step-text">
            Authenticate Brevo sending domain
            <span class="small text-muted">(after subdomain)</span>
          </span>
          @if (envStatus) {
            <span class="badge resume-step-badge"
                  [class]="stepBadgeClass(EnvironmentStatusCheck.BREVO, envStatus.brevoDomainAuthenticated)">
              {{ stepBadgeLabel(EnvironmentStatusCheck.BREVO, envStatus.brevoDomainAuthenticated) }}
            </span>
          }
        </label>
      </div>
      <div class="form-check resume-step">
        <input class="form-check-input" type="checkbox" id="includeSamplePages"
               [(ngModel)]="resumeOptions.includeSamplePages">
        <label class="form-check-label resume-step-label" for="includeSamplePages">
          <span class="resume-step-text">Include sample page content</span>
          @if (envStatus) {
            <span class="badge resume-step-badge"
                  [class]="stepBadgeClass(EnvironmentStatusCheck.DATABASE, envStatus.samplePagesPresent)">
              {{ stepBadgeLabel(EnvironmentStatusCheck.DATABASE, envStatus.samplePagesPresent) }}
            </span>
          }
        </label>
      </div>
      <div class="form-check resume-step">
        <input class="form-check-input" type="checkbox" id="includeNotificationConfigs"
               [(ngModel)]="resumeOptions.includeNotificationConfigs">
        <label class="form-check-label resume-step-label" for="includeNotificationConfigs">
          <span class="resume-step-text">Include notification configs</span>
          @if (envStatus) {
            <span class="badge resume-step-badge"
                  [class]="stepBadgeClass(EnvironmentStatusCheck.DATABASE, envStatus.notificationConfigsPresent)">
              {{ stepBadgeLabel(EnvironmentStatusCheck.DATABASE, envStatus.notificationConfigsPresent) }}
            </span>
          }
        </label>
      </div>
    </div>
  `
})
export class EnvironmentModifySteps {
  @Input({required: true}) resumeOptions: EnvironmentModifyOptions;
  @Input() envStatus: EnvironmentStatus | null = null;
  protected readonly EnvironmentStatusCheck = EnvironmentStatusCheck;

  checkUnavailable(check: EnvironmentStatusCheck): boolean {
    return (this.envStatus?.unavailableChecks || []).includes(check);
  }

  stepBadgeClass(check: EnvironmentStatusCheck, done: boolean): string {
    if (this.checkUnavailable(check)) {
      return "bg-secondary";
    } else {
      return done ? "bg-success" : "bg-warning";
    }
  }

  stepBadgeLabel(check: EnvironmentStatusCheck, done: boolean): string {
    if (this.checkUnavailable(check)) {
      return "unknown";
    } else {
      return done ? "done" : "needed";
    }
  }

  subdomainBadgeClass(): string {
    if (this.checkUnavailable(EnvironmentStatusCheck.HOSTNAMES)) {
      return "bg-secondary";
    } else {
      return subdomainStepBadgeClass(!!this.envStatus?.subdomainConfigured, !!this.envStatus?.subdomainOptional);
    }
  }

  subdomainBadgeLabel(): string {
    if (this.checkUnavailable(EnvironmentStatusCheck.HOSTNAMES)) {
      return "unknown";
    } else {
      return subdomainStepBadgeLabel(!!this.envStatus?.subdomainConfigured, !!this.envStatus?.subdomainOptional);
    }
  }
}
