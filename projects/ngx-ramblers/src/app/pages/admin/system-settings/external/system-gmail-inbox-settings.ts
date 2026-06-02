import { Component, inject, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { FormsModule } from "@angular/forms";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";
import { InputSize } from "../../../../models/ui-size.model";
import { SystemInboxMailboxConnectionsComponent } from "./system-inbox-mailbox-connections";
import { SystemInboxRoleMailboxesComponent } from "./system-inbox-role-mailboxes";
import { InboxService } from "../../../../services/inbox/inbox.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { AlertTarget } from "../../../../models/alert-target.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faGear, faList, faTriangleExclamation, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { StepperModule } from "primeng/stepper";
import { isUndefined } from "es-toolkit/compat";

export enum GmailInboxSetupStepKey {
  CLOUD_PROJECT = "cloud-project",
  GMAIL_ACCOUNTS = "gmail-accounts",
  ROLE_MAILBOXES = "role-mailboxes"
}

interface GmailInboxStepMeta {
  key: GmailInboxSetupStepKey;
  label: string;
  hint: string;
}

const GMAIL_INBOX_STEPS: GmailInboxStepMeta[] = [
  { key: GmailInboxSetupStepKey.CLOUD_PROJECT, label: "Google Cloud project", hint: "Set up once. OAuth client + optional Pub/Sub." },
  { key: GmailInboxSetupStepKey.GMAIL_ACCOUNTS, label: "Connected Gmail accounts", hint: "Add one per Gmail account you want to read mail from." },
  { key: GmailInboxSetupStepKey.ROLE_MAILBOXES, label: "Role mailboxes", hint: "Review which committee roles route to which Gmail." }
];

@Component({
  selector: "app-system-gmail-inbox-settings",
  standalone: true,
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Gmail Inbox</div>
      @if (systemConfigInternal?.googleInbox) {
        <div class="col-sm-12">
          <p class="text-muted mb-3 small">
            The Inbox (<a href="/admin/inbox">Admin &rarr; Inbox</a>) lets committee members read replies sent to their role
            addresses and reply from the role address. Work through the steps below in order: <strong>Step 1 is done once
            per deployment</strong> and provides the OAuth doorway used by all Gmail accounts; <strong>Step 2 is repeated
            for each Gmail account</strong> you want to read mail from; <strong>Step 3</strong> shows which committee
            roles route to which Gmail (configured in Committee Settings). Full setup steps are in
            <a href="/how-to/technical-articles/2026-05-29-gmail-inbox-setup">Setting up a Gmail inbox for committee replies</a>.
          </p>
          <p-stepper [(value)]="stepperActiveIndex" [linear]="false">
            @for (step of steps; let idx = $index; track step.key) {
              <p-step-item [value]="idx">
                <p-step>
                  <div class="stepper-step-header">
                    <span class="stepper-step-number">{{ idx + 1 }}</span>
                    <div class="stepper-step-text">
                      <div class="stepper-step-label">{{ step.label }}</div>
                      <div class="stepper-step-hint">{{ step.hint }}</div>
                    </div>
                  </div>
                </p-step>
                <p-step-panel>
                  <ng-template pTemplate="content">
                    @if (step.key === GmailInboxSetupStepKey.CLOUD_PROJECT) {
                      <div class="mt-3">
                        <h6 class="mb-2"><fa-icon [icon]="faGear" class="me-2"/>OAuth web-client</h6>
                        <p class="text-muted small mb-2">
                          Create an OAuth web-client in the
                          <a href="https://console.cloud.google.com/" target="_blank">Google Cloud console</a> with the Gmail
                          API enabled, then paste its credentials here. This OAuth client is the doorway used by every
                          connected Gmail account in step 2; you set it up once per deployment regardless of how many
                          Gmails you connect.
                        </p>
                        <div class="row">
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label for="google-inbox-client-id">OAuth Client ID</label>
                              <input [(ngModel)]="systemConfigInternal.googleInbox.clientId"
                                     type="text" class="form-control input-sm" id="google-inbox-client-id"
                                     name="googleInboxClientId"
                                     placeholder="Enter the Google OAuth web client ID">
                            </div>
                          </div>
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label for="google-inbox-client-secret">OAuth Client Secret</label>
                              <app-secret-input
                                [(ngModel)]="systemConfigInternal.googleInbox.clientSecret"
                                id="google-inbox-client-secret"
                                name="googleInboxClientSecret"
                                [size]="InputSize.SM"
                                placeholder="Enter the Google OAuth web client secret">
                              </app-secret-input>
                            </div>
                          </div>
                          <div class="col-sm-12">
                            <div class="form-group">
                              <label for="google-inbox-redirect-uri">OAuth Redirect URI</label>
                              <input [(ngModel)]="systemConfigInternal.googleInbox.redirectUri"
                                     type="text" class="form-control input-sm" id="google-inbox-redirect-uri"
                                     name="googleInboxRedirectUri"
                                     placeholder="https://this-deployment-host/api/inbox/oauth/callback">
                              <small class="text-muted">Must exactly match an Authorised redirect URI on the Google OAuth
                                client, e.g.
                                <code>https://{{deploymentHost()}}/api/inbox/oauth/callback</code>.</small>
                            </div>
                          </div>
                        </div>
                        <h6 class="mt-4 mb-2"><fa-icon [icon]="faGear" class="me-2"/>Pub/Sub setup (optional)</h6>
                        <p class="text-muted small mb-2">
                          Optional one-click provisioning for real-time push delivery via Google Pub/Sub. Skip this step if
                          you only want the default 30-second polling. Otherwise enter a Google Cloud project ID you own and
                          the Pub/Sub topic name to use; clicking <strong>Run Google Cloud setup</strong> takes you through
                          Google's consent screen, then NGX automatically enables the Gmail + Pub/Sub APIs, creates the
                          topic, grants <code>gmail-api-push&#64;system.gserviceaccount.com</code> the Pub/Sub Publisher
                          role, and creates a push subscription pointed at <code>{{ pushReceiverHint() }}</code>. The OAuth
                          client must list <code>cloud-platform</code> on its consent screen first.
                        </p>
                        @if (statusMessage) {
                          <div class="alert alert-success py-2 small mb-2">{{ statusMessage }}</div>
                        }
                        @if (errorMessage) {
                          <div class="alert alert-warning py-2 small mb-2">
                            <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
                            <strong>Google Cloud setup did not complete:</strong> {{ errorMessage }}
                          </div>
                        }
                        <div class="row">
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label for="setup-project-id">Google Cloud project ID</label>
                              <input [(ngModel)]="projectIdInput" type="text" class="form-control input-sm"
                                     id="setup-project-id" name="setupProjectId"
                                     placeholder="ngx-ramblers-inbox">
                            </div>
                          </div>
                          <div class="col-sm-6">
                            <div class="form-group">
                              <label for="setup-topic-name">Pub/Sub topic name</label>
                              <input [(ngModel)]="topicNameInput" type="text" class="form-control input-sm"
                                     id="setup-topic-name" name="setupTopicName"
                                     placeholder="ngx-inbox-events">
                            </div>
                          </div>
                          <div class="col-sm-12">
                            <button class="btn btn-primary btn-sm" type="button" (click)="runSetup()"
                                    [disabled]="busy || !projectIdInput || !topicNameInput">
                              Run Google Cloud setup
                            </button>
                            @if (systemConfigInternal?.googleInbox?.pubsubTopicName) {
                              <small class="text-muted ms-2">Last configured topic:
                                <code>{{ systemConfigInternal?.googleInbox?.pubsubTopicName }}</code></small>
                            }
                          </div>
                        </div>
                        <div class="mt-3 d-flex justify-content-end">
                          <button class="btn btn-sm btn-quiet" type="button" (click)="goToStep(1)">
                            Next: Connected Gmail accounts &rarr;
                          </button>
                        </div>
                      </div>
                    }
                    @if (step.key === GmailInboxSetupStepKey.GMAIL_ACCOUNTS) {
                      <div class="mt-3">
                        <h6 class="mb-2"><fa-icon [icon]="faUserPlus" class="me-2"/>Connect Gmail accounts</h6>
                        <app-system-inbox-mailbox-connections/>
                        <div class="mt-3 d-flex justify-content-between">
                          <button class="btn btn-sm btn-quiet" type="button" (click)="goToStep(0)">
                            &larr; Back: Google Cloud project
                          </button>
                          <button class="btn btn-sm btn-quiet" type="button" (click)="goToStep(2)">
                            Next: Role mailboxes &rarr;
                          </button>
                        </div>
                      </div>
                    }
                    @if (step.key === GmailInboxSetupStepKey.ROLE_MAILBOXES) {
                      <div class="mt-3">
                        <h6 class="mb-2"><fa-icon [icon]="faList" class="me-2"/>Role mailboxes</h6>
                        <app-system-inbox-role-mailboxes/>
                        <div class="mt-3 d-flex justify-content-start">
                          <button class="btn btn-sm btn-quiet" type="button" (click)="goToStep(1)">
                            &larr; Back: Connected Gmail accounts
                          </button>
                        </div>
                      </div>
                    }
                  </ng-template>
                </p-step-panel>
              </p-step-item>
            }
          </p-stepper>
        </div>
      }
    </div>`,
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    SecretInputComponent,
    SystemInboxMailboxConnectionsComponent,
    SystemInboxRoleMailboxesComponent,
    StepperModule
  ]
})
export class SystemGmailInboxSettingsComponent {

  protected systemConfigInternal: SystemConfig;
  private logger = inject(LoggerFactory).createLogger("SystemGmailInboxSettingsComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  private notifierService = inject(NotifierService);
  protected readonly InputSize = InputSize;
  protected readonly faGear = faGear;
  protected readonly faUserPlus = faUserPlus;
  protected readonly faList = faList;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly steps = GMAIL_INBOX_STEPS;
  protected readonly GmailInboxSetupStepKey = GmailInboxSetupStepKey;

  protected stepperActiveIndex = 0;
  protected projectIdInput = "";
  protected topicNameInput = "ngx-inbox-events";
  protected busy = false;
  protected statusMessage: string | null = null;
  protected errorMessage: string | null = null;
  protected notify: AlertInstance;
  protected notifyTarget: AlertTarget = {};

  constructor() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    if (!isUndefined(window)) {
      const url = new URL(window.location.href);
      const setupCompleted = url.searchParams.get("setupCompleted");
      if (setupCompleted) {
        this.statusMessage = `Google Cloud setup complete. ${setupCompleted}`;
        this.stepperActiveIndex = 0;
      }
      const oauthError = url.searchParams.get("oauthError");
      if (oauthError) {
        this.errorMessage = oauthError;
      }
      const connectedParam = url.searchParams.get("connected");
      if (connectedParam) {
        this.stepperActiveIndex = 1;
      }
    }
  }

  @Input({
    alias: "config",
    required: true
  }) set configValue(systemConfig: SystemConfig) {
    this.handleConfigChange(systemConfig);
  }

  deploymentHost(): string {
    return isUndefined(window) ? "your-deployment-host" : window.location.host;
  }

  pushReceiverHint(): string {
    return `https://${this.deploymentHost()}/api/inbox/pubsub/push?token=...`;
  }

  goToStep(index: number): void {
    this.stepperActiveIndex = index;
  }

  async runSetup(): Promise<void> {
    if (!this.projectIdInput.trim() || !this.topicNameInput.trim()) {
      return;
    }
    this.busy = true;
    this.errorMessage = null;
    this.statusMessage = null;
    try {
      window.location.href = await this.inboxService.startGoogleCloudSetup(this.projectIdInput.trim(), this.topicNameInput.trim());
    } catch (error) {
      this.errorMessage = (error as Error).message;
    } finally {
      this.busy = false;
    }
  }

  private handleConfigChange(systemConfig: SystemConfig) {
    this.systemConfigInternal = systemConfig;
    if (this.systemConfigInternal && !this.systemConfigInternal.googleInbox) {
      this.systemConfigInternal.googleInbox = {clientId: "", clientSecret: "", redirectUri: ""};
    }
    if (this.systemConfigInternal?.googleInbox?.pubsubProjectId && !this.projectIdInput) {
      this.projectIdInput = this.systemConfigInternal.googleInbox.pubsubProjectId;
    }
    const existingTopic = this.systemConfigInternal?.googleInbox?.pubsubTopicName;
    if (existingTopic && !this.topicNameInput) {
      const segments = existingTopic.split("/");
      this.topicNameInput = segments[segments.length - 1] ?? existingTopic;
    }
    this.logger.info("handleConfigChange:googleInbox:", this.systemConfigInternal?.googleInbox);
  }
}
