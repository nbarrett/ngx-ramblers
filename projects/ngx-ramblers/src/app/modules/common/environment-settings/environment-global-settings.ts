import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { SecretInputComponent } from "../secret-input/secret-input.component";
import { SecretsEditor } from "../secrets-editor/secrets-editor";
import { CloudflareUrlInputComponent, CloudflareUrlParseResult } from "../cloudflare-url-input/cloudflare-url-input";
import { createDefaultUploadWorkerConfig, EnvironmentsConfig } from "../../../models/environment-config.model";
import { InputSize } from "../../../models/ui-size.model";

@Component({
  selector: "app-environment-global-settings",
  standalone: true,
  imports: [
    FormsModule,
    FontAwesomeModule,
    SecretInputComponent,
    SecretsEditor,
    CloudflareUrlInputComponent
  ],
  styles: [`
    .btn-outline-aws
      border: 1px solid #FF9900
      color: #FF9900
      background-color: transparent
      &:hover
        background-color: #FF9900
        border-color: #FF9900
        color: white

    .btn-outline-cloudflare
      border: 1px solid #F6821F
      color: #F6821F
      background-color: transparent
      &:hover
        background-color: #F6821F
        border-color: #F6821F
        color: white
  `],
  template: `
    <div class="row thumbnail-heading-frame mb-5">
      <div class="thumbnail-heading with-vendor-logo d-flex align-items-center gap-2">
        <img src="assets/icons/aws-logo.svg" alt="AWS" style="height: 26px;">
        <span>Global AWS S3 Configuration</span>
        <a href="https://s3.console.aws.amazon.com/s3/buckets?region=eu-west-2"
           target="_blank"
           class="btn btn-sm btn-outline-aws ms-auto">
          <fa-icon [icon]="faExternalLinkAlt"></fa-icon>
          S3 Console
        </a>
      </div>
      <div class="row">
        <div class="col-md-6 mb-2">
          <label class="form-label">Bucket</label>
          <input type="text"
                 class="form-control"
                 [(ngModel)]="config.aws.bucket"
                 name="globalAwsBucket"
                 placeholder="e.g. ngx-ramblers-backups">
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Region</label>
          <input type="text"
                 class="form-control"
                 [(ngModel)]="config.aws.region"
                 name="globalAwsRegion"
                 placeholder="e.g. eu-west-2">
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Access Key ID</label>
          <app-secret-input
            [(ngModel)]="config.aws.accessKeyId"
            name="globalAwsAccessKeyId"
            [size]="InputSize.SM">
          </app-secret-input>
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Secret Access Key</label>
          <app-secret-input
            [(ngModel)]="config.aws.secretAccessKey"
            name="globalAwsSecretAccessKey"
            [size]="InputSize.SM">
          </app-secret-input>
        </div>
      </div>
      <small class="form-text text-muted">If set, all uploads/listing/deletes will use this bucket and credentials,
        with per-environment settings used only as a fallback.</small>
    </div>
    <div class="row thumbnail-heading-frame mb-5">
      <div class="thumbnail-heading with-vendor-logo d-flex align-items-center gap-2">
        <img src="assets/icons/cloudflare-logo.svg" alt="Cloudflare" style="height: 26px;">
        <span>Global Cloudflare Configuration</span>
        <a href="https://dash.cloudflare.com"
           target="_blank"
           class="btn btn-sm btn-outline-cloudflare ms-auto">
          <fa-icon [icon]="faExternalLinkAlt"></fa-icon>
          Cloudflare Dashboard
        </a>
      </div>
      <app-cloudflare-url-input (parsedUrl)="onCloudflareUrlParsed($event)"/>
      <div class="row">
        <div class="col-md-6 mb-2">
          <label class="form-label">API Token</label>
          <app-secret-input
            [(ngModel)]="config.cloudflare.apiToken"
            name="cloudflareApiToken"
            [size]="InputSize.SM">
          </app-secret-input>
          <small class="form-text text-muted">Token with Zone → DNS → Edit permission</small>
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Account ID</label>
          <app-secret-input
            [(ngModel)]="config.cloudflare.accountId"
            name="cloudflareAccountId"
            [size]="InputSize.SM">
          </app-secret-input>
          <small class="form-text text-muted">Found in <a href="https://dash.cloudflare.com" target="_blank">Cloudflare dashboard</a> URL</small>
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Zone ID</label>
          <app-secret-input
            [(ngModel)]="config.cloudflare.zoneId"
            name="cloudflareZoneId"
            [size]="InputSize.SM">
          </app-secret-input>
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Base Domain</label>
          <input type="text"
                 class="form-control"
                 [(ngModel)]="config.cloudflare.baseDomain"
                 name="cloudflareBaseDomain"
                 placeholder="e.g. ngx-ramblers.org.uk">
        </div>
      </div>
      <small class="form-text text-muted">Used for automatic subdomain DNS setup when creating new environments.</small>
    </div>
    <div class="row thumbnail-heading-frame mb-5">
      <div class="thumbnail-heading">Global Application Secrets</div>
      <small class="form-text text-muted mb-3">
        Default environment variables for all environments. Can be overridden per-environment.
      </small>
      <app-secrets-editor
        [secrets]="config.secrets || {}"
        (secretsChange)="config.secrets = $event"
        namePrefix="global">
      </app-secrets-editor>
    </div>
    <div class="row thumbnail-heading-frame mb-5">
      <div class="thumbnail-heading with-vendor-logo d-flex align-items-center gap-2">
        <img src="assets/icons/fly-logo.svg" alt="Fly.io" style="height: 26px;" onerror="this.style.display='none'">
        <span>Upload Worker Configuration</span>
        @if (config.uploadWorker?.appName) {
          <a href="https://fly.io/apps/{{ config.uploadWorker.appName }}"
             target="_blank"
             class="btn btn-sm btn-outline-secondary ms-auto">
            <fa-icon [icon]="faExternalLinkAlt"></fa-icon>
            Fly Dashboard
          </a>
        }
      </div>
      <small class="form-text text-muted mb-3">
        Shared Serenity upload worker deployed as a separate Fly.io app. Saving this
        configuration automatically updates the worker secrets on all environments that
        use the worker. Secrets are synced to GitHub alongside CONFIGS_JSON when you
        push from the GitHub Secrets tab.
      </small>
      <div class="row">
        <div class="col-md-6 mb-2">
          <label class="form-label">App Name</label>
          <input type="text"
                 class="form-control"
                 [(ngModel)]="config.uploadWorker.appName"
                 name="workerAppName"
                 placeholder="e.g. ngx-ramblers-upload-worker">
          @if (config.uploadWorker?.appName) {
            <small class="form-text text-muted">URL: https://{{ config.uploadWorker.appName }}.fly.dev</small>
          }
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Fly Deploy Token</label>
          <app-secret-input
            [(ngModel)]="config.uploadWorker.apiKey"
            name="workerApiKey"
            [size]="InputSize.SM">
          </app-secret-input>
          <small class="form-text text-muted">If blank, the staging environment's Fly API key is used instead</small>
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Shared Secret (HMAC)</label>
          <app-secret-input
            [(ngModel)]="config.uploadWorker.sharedSecret"
            name="workerSharedSecret"
            [size]="InputSize.SM">
          </app-secret-input>
          <small class="form-text text-muted">Used to sign requests between the environment and the worker</small>
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Encryption Key (AES)</label>
          <app-secret-input
            [(ngModel)]="config.uploadWorker.encryptionKey"
            name="workerEncryptionKey"
            [size]="InputSize.SM">
          </app-secret-input>
          <small class="form-text text-muted">Used to encrypt credentials sent to the worker</small>
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Memory</label>
          <input type="text"
                 class="form-control"
                 [(ngModel)]="config.uploadWorker.memory"
                 name="workerMemory"
                 placeholder="e.g. 1024mb">
        </div>
        <div class="col-md-6 mb-2">
          <label class="form-label">Scale Count</label>
          <input type="number"
                 class="form-control"
                 [(ngModel)]="config.uploadWorker.scaleCount"
                 name="workerScaleCount"
                 min="0"
                 placeholder="e.g. 1">
        </div>
      </div>
    </div>
  `
})
export class EnvironmentGlobalSettings {

  @Input({required: true}) config: EnvironmentsConfig;

  protected readonly InputSize = InputSize;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;

  onCloudflareUrlParsed(result: CloudflareUrlParseResult) {
    this.config.cloudflare.accountId = result.accountId;
  }
}
