import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { EnvironmentModifyOptions, EnvironmentStatus } from "../../../models/environment-setup.model";
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
                  [class]="envStatus.databaseInitialised ? 'bg-success' : 'bg-warning'">
              {{ envStatus.databaseInitialised ? "done" : "needed" }}
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
                  [class]="envStatus.flyAppDeployed ? 'bg-success' : 'bg-warning'">
              {{ envStatus.flyAppDeployed ? "done" : "needed" }}
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
                  [class]="envStatus.standardAssetsPresent ? 'bg-success' : 'bg-warning'">
              {{ envStatus.standardAssetsPresent ? "done" : "needed" }}
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
                  [class]="subdomainStepBadgeClass(envStatus.subdomainConfigured, envStatus.subdomainOptional)">
              {{ subdomainStepBadgeLabel(envStatus.subdomainConfigured, envStatus.subdomainOptional) }}
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
                  [class]="envStatus.brevoDomainAuthenticated ? 'bg-success' : 'bg-warning'">
              {{ envStatus.brevoDomainAuthenticated ? "done" : "needed" }}
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
                  [class]="envStatus.samplePagesPresent ? 'bg-success' : 'bg-warning'">
              {{ envStatus.samplePagesPresent ? "done" : "needed" }}
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
                  [class]="envStatus.notificationConfigsPresent ? 'bg-success' : 'bg-warning'">
              {{ envStatus.notificationConfigsPresent ? "done" : "needed" }}
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
  protected readonly subdomainStepBadgeClass = subdomainStepBadgeClass;
  protected readonly subdomainStepBadgeLabel = subdomainStepBadgeLabel;
}
