import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { AdminPath } from "../../../../models/admin-route-paths.model";
import { SystemConfig } from "../../../../models/system.model";
import {
  GoogleCloudProvisioningStepStatus,
  GoogleCloudProvisioningStepView,
  GoogleCloudSetupStatusValue,
  GoogleCloudSetupStatusView,
  InboxReaderProvider,
  InboxRoleNotificationSetting
} from "../../../../models/inbox.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { FormsModule } from "@angular/forms";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";
import { InputSize } from "../../../../models/ui-size.model";
import { SystemInboxMailboxConnectionsComponent } from "./system-inbox-mailbox-connections";
import { SystemInboxRoleMailboxesComponent } from "./system-inbox-role-mailboxes";
import { InboxService } from "../../../../services/inbox/inbox.service";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { AlertTarget } from "../../../../models/alert-target.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCircleCheck,
  faGear,
  faList,
  faSpinner,
  faTrashCan,
  faTriangleExclamation,
  faUserPlus
} from "@fortawesome/free-solid-svg-icons";
import { StepperModule } from "primeng/stepper";
import { ActivatedRoute, Router } from "@angular/router";
import { StoredValue } from "../../../../models/ui-actions";
import { isUndefined } from "es-toolkit/compat";
import { Subject, Subscription } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { SystemConfigService } from "../../../../services/system/system-config.service";

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
      <div class="thumbnail-heading">Inbox</div>
      <div class="col-sm-12">
        <h6 class="section-heading">How this inbox receives mail</h6>
        <div class="form-check">
          <input class="form-check-input" type="radio" id="inbox-provider-gmail"
            name="inbox-provider" [checked]="inboxProvider === InboxReaderProvider.GMAIL_API"
            (change)="selectInboxProvider(InboxReaderProvider.GMAIL_API)">
          <label class="form-check-label" for="inbox-provider-gmail">Gmail account (read via the Gmail API)</label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="radio" id="inbox-provider-cloudflare"
            name="inbox-provider" [checked]="inboxProvider === InboxReaderProvider.CLOUDFLARE_INGRESS"
            (change)="selectInboxProvider(InboxReaderProvider.CLOUDFLARE_INGRESS)">
          <label class="form-check-label" for="inbox-provider-cloudflare">Direct to inbox &mdash; via Cloudflare Email Routing, no Gmail account</label>
        </div>
        <div class="small text-muted mt-1">
          @if (inboxProvider === InboxReaderProvider.CLOUDFLARE_INGRESS) {
            Mail sent to this site's committee addresses is delivered straight into this inbox through Cloudflare Email Routing. There's no Gmail account, OAuth or Google Cloud project to set up.
          } @else {
            Committee members read replies through a connected Gmail account. Work through the setup steps below.
          }
        </div>
      </div>
      @if (inboxProvider === InboxReaderProvider.CLOUDFLARE_INGRESS) {
        <div class="col-sm-12">
          <div class="mt-3">
            <h6 class="mb-2"><fa-icon [icon]="faCircleCheck" class="me-2"/>No Gmail setup needed</h6>
            <p class="text-muted small mb-2">
              With direct delivery there's nothing to connect here. To finish setting it up:
            </p>
            <ol class="text-muted small">
              <li>Make sure Cloudflare Email Routing and the MX records are in place for your domain, and that your committee addresses exist as routing rules.</li>
              <li>Click below to point this site's committee addresses at the inbox.</li>
              <li>Replies then appear in <a [routerLink]="'/' + adminInboxPath">Admin &rarr; Inbox</a> for whoever holds each role.</li>
            </ol>
            <button type="button" class="btn btn-primary btn-sm" [disabled]="directDeliverySaving" (click)="enableDirectDelivery()">
              @if (directDeliverySaving) {
                <fa-icon [icon]="faSpinner" [spin]="true" class="me-2"/>
              }
              Route this site's committee mail into the inbox
            </button>
            @if (directDeliveryMessage) {
              <div class="small text-success mt-2">{{ directDeliveryMessage }}</div>
            }
            @if (directDeliveryError) {
              <div class="small text-danger mt-2">{{ directDeliveryError }}</div>
            }
          </div>
        </div>
      }
      @if (inboxProvider === InboxReaderProvider.GMAIL_API && systemConfigInternal?.googleInbox) {
        <div class="col-sm-12">
          <p class="text-muted mb-3 small">
            The Inbox (<a [routerLink]="'/' + adminInboxPath">Admin &rarr; Inbox</a>) lets committee members read replies sent to their role
            addresses and reply from the role address. Work through the steps below in order: <strong>Step 1 is done once
            per deployment</strong> and provides the OAuth doorway used by all Gmail accounts; <strong>Step 2 is repeated
            for each Gmail account</strong> you want to read mail from; <strong>Step 3</strong> shows which committee
            roles route to which Gmail (configured in Committee Settings). Full setup steps are in
            <a href="https://www.ngx-ramblers.org.uk/how-to/technical-articles/2026-05-29-gmail-inbox-setup">Setting up a Gmail inbox for committee replies</a>.
          </p>
          <p-stepper [value]="stepperActiveIndex" (valueChange)="goToStep($event)" [linear]="false">
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
                                     (ngModelChange)="onOAuthFieldChange()"
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
                                (ngModelChange)="onOAuthFieldChange()"
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
                                     (ngModelChange)="onOAuthFieldChange()"
                                     type="text" class="form-control input-sm" id="google-inbox-redirect-uri"
                                     name="googleInboxRedirectUri"
                                     placeholder="https://this-deployment-host/api/inbox/oauth/callback">
                              <small class="text-muted d-block mt-1">Must exactly match an Authorised redirect URI on the Google OAuth
                                client, e.g.
                                <code>https://{{deploymentHost()}}/api/inbox/oauth/callback</code>.</small>
                            </div>
                          </div>
                        </div>
                        @if (oauthSaving) {
                          <div class="mb-2">
                            <small class="text-muted"><fa-icon [icon]="faSpinner" animation="spin" class="me-1"/>Saving OAuth
                              web-client…</small>
                          </div>
                        } @else if (oauthSaveError) {
                          <div class="alert alert-warning py-2 small mb-2">
                            <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
                            <strong>OAuth web-client not saved:</strong> {{ oauthSaveError }}
                          </div>
                        } @else if (oauthSaved) {
                          <div class="mb-2">
                            <small class="text-success"><fa-icon [icon]="faCircleCheck" class="me-1"/>OAuth web-client saved
                              automatically. There's no separate Save to press.</small>
                          </div>
                        }
                        @if (oAuthClientConfigured()) {
                          <div class="mb-2">
                            @if (!clearConfirmPending) {
                              <button class="btn btn-grey-danger btn-sm" type="button"
                                      (click)="clearConfirmPending = true" [disabled]="busy">
                                <fa-icon [icon]="faTrashCan" class="me-2"/>Clear OAuth client
                              </button>
                            } @else {
                              <div class="alert alert-warning py-2 small mb-0">
                                <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
                                This blanks the OAuth Client ID, Secret, Redirect URI and any Pub/Sub setup below, and
                                <strong>saves the change immediately</strong>. Connected Gmail accounts are not affected
                                &mdash; remove those individually in step 2.
                                <div class="mt-2">
                                  <button class="btn btn-outline-danger btn-sm me-2" type="button"
                                          (click)="clearOAuthClient()">Clear OAuth client</button>
                                  <button class="btn btn-sm btn-quiet" type="button"
                                          (click)="clearConfirmPending = false">Cancel</button>
                                </div>
                              </div>
                            }
                          </div>
                        }
                        <h6 class="mt-4 mb-2"><fa-icon [icon]="faGear" class="me-2"/>Pub/Sub setup (optional)</h6>
                        <p class="text-muted small mb-2">
                          Optional — switches inbox delivery from the default 30-second polling to real-time push. Skip it
                          unless you need instant delivery. Enter a Google Cloud project ID you own, then click
                          <strong>Run Google Cloud setup</strong>: you go through Google's consent screen, after which NGX
                          sets everything up for you — it enables the Gmail and Pub/Sub APIs, creates the topic and a push
                          subscription pointed at <code>{{ pushReceiverHint() }}</code>, and grants Google's
                          <code>gmail-api-push&#64;system.gserviceaccount.com</code> permission to publish to it. Your OAuth
                          client's consent screen must include the <code>cloud-platform</code> scope first.
                        </p>
                        @if (statusMessage) {
                          <div class="alert alert-success py-2 small mb-2">
                            <fa-icon [icon]="faCircleCheck" class="me-2"/>
                            @if (statusTitle) {
                              <strong>{{ statusTitle }}:</strong>
                            }
                            {{ statusMessage }}
                          </div>
                        }
                        @if (errorMessage && !setupSteps.length) {
                          <div class="alert alert-warning py-2 small mb-2">
                            <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
                            <strong>Google Cloud setup did not complete:</strong> {{ errorMessage }}
                          </div>
                        }
                        @if (setupInProgress || setupSteps.length) {
                          <div class="alert alert-warning py-2 small mb-2">
                            @if (setupInProgress) {
                              <div class="mb-1">
                                <fa-icon [icon]="faSpinner" animation="spin" class="me-2"/>
                                <strong>Running Google Cloud setup…</strong> This runs in the background — you can leave this page and come back.
                              </div>
                            } @else if (errorMessage) {
                              <div class="mb-1">
                                <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
                                <strong>Google Cloud setup did not complete</strong> — see the step that failed below.
                              </div>
                            }
                            <ul class="mb-0 ps-3">
                              @for (step of setupSteps; track step.step) {
                                <li>
                                  <fa-icon [icon]="step.status === GoogleCloudProvisioningStepStatus.FAILED ? faTriangleExclamation : faCircleCheck" class="me-1"/>
                                  {{ step.step }} — {{ step.status }}@if (step.detail) {<span class="text-muted"> ({{ step.detail }})</span>}
                                </li>
                              }
                            </ul>
                          </div>
                        }
                        <div class="row">
                          <div class="col-sm-12">
                            <div class="form-group">
                              <label class="d-block">Google Cloud project</label>
                              @if (oauthProjectNumber(); as projectNumber) {
                                <p class="mb-1 small">
                                  Detected from your OAuth client — project number <code>{{ projectNumber }}</code>. Setup uses this automatically; you don't need to enter anything. The full project ID is confirmed once you log in.
                                </p>
                                <a class="small d-block" [href]="googleConsoleProjectUrl()" target="_blank" rel="noopener">
                                  <fa-icon [icon]="faGear" class="me-1"/>View this project in Google Console
                                </a>
                                <a class="small d-block mt-1" [href]="googleAudienceUrl()" target="_blank" rel="noopener">
                                  <fa-icon [icon]="faGear" class="me-1"/>Check OAuth publishing status — must be "In production", not "Testing"
                                </a>
                                <details class="mt-2">
                                  <summary class="small text-muted">Advanced: provision in a different project</summary>
                                  <input [(ngModel)]="projectOverride" type="text" class="form-control input-sm mt-1"
                                         name="setupProjectOverride" placeholder="project ID or number">
                                  <small class="text-muted d-block mt-1">Leave blank to use the project from your OAuth client.</small>
                                </details>
                              } @else {
                                <div class="alert alert-warning py-2 small mb-0">
                                  <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
                                  Set the OAuth Client ID above first — the project is read from it.
                                </div>
                              }
                            </div>
                          </div>
                          <div class="col-sm-12">
                            <button class="btn btn-primary btn-sm" type="button" (click)="runSetup()"
                                    [disabled]="busy || !effectiveProjectId()">
                              @if (busy) {
                                <fa-icon [icon]="faGear" [spin]="true" class="me-2"/>Starting Google Cloud setup…
                              } @else {
                                Run Google Cloud setup
                              }
                            </button>
                            @if (busy) {
                              <small class="text-muted ms-2">Redirecting to Google to authorise…</small>
                            }
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
                        <app-system-inbox-mailbox-connections [projectNumber]="oauthProjectNumber()"/>
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
                        <app-system-inbox-role-mailboxes
                          [refreshToken]="inboxRefreshToken"
                          (pendingChanges)="inboxNotificationsPendingSave.emit($event)"/>
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
    StepperModule,
    RouterLink
  ]
})
export class SystemGmailInboxSettingsComponent implements OnInit, OnDestroy {
  adminInboxPath = AdminPath.INBOX;

  protected systemConfigInternal: SystemConfig;
  private logger = inject(LoggerFactory).createLogger("SystemGmailInboxSettingsComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  private cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  private notifierService = inject(NotifierService);
  private systemConfigService = inject(SystemConfigService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected readonly InputSize = InputSize;
  protected readonly faGear = faGear;
  protected readonly faUserPlus = faUserPlus;
  protected readonly faList = faList;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faTrashCan = faTrashCan;
  protected readonly faSpinner = faSpinner;
  protected readonly steps = GMAIL_INBOX_STEPS;
  protected readonly GmailInboxSetupStepKey = GmailInboxSetupStepKey;
  protected readonly InboxReaderProvider = InboxReaderProvider;
  protected readonly GoogleCloudProvisioningStepStatus = GoogleCloudProvisioningStepStatus;

  protected stepperActiveIndex = 0;
  protected directDeliverySaving = false;
  protected directDeliveryMessage: string | null = null;
  protected directDeliveryError: string | null = null;
  protected topicNameInput = "ngx-inbox-events";
  protected projectOverride = "";
  protected clearConfirmPending = false;
  protected oauthSaving = false;
  protected oauthSaved = false;
  protected oauthSaveError: string | null = null;
  private oauthDirty = false;
  private oauthEditVersion = 0;
  private oauthSave$ = new Subject<void>();
  private subscriptions: Subscription[] = [];
  protected busy = false;
  protected statusTitle: string | null = null;
  protected statusMessage: string | null = null;
  protected errorMessage: string | null = null;
  protected setupSteps: GoogleCloudProvisioningStepView[] = [];
  protected setupInProgress = false;
  private showSetupRun = false;
  private setupPollTimer: ReturnType<typeof setTimeout> | null = null;
  protected notify: AlertInstance;
  protected notifyTarget: AlertTarget = {};

  @Input() inboxRefreshToken: number | null = null;
  @Output() inboxNotificationsPendingSave = new EventEmitter<InboxRoleNotificationSetting[]>();

  @Input({
    alias: "config",
    required: true
  }) set configValue(systemConfig: SystemConfig) {
    this.handleConfigChange(systemConfig);
  }

  constructor() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    if (!isUndefined(window)) {
      const url = new URL(window.location.href);
      const step = url.searchParams.get(StoredValue.STEP);
      if (step !== null && !isNaN(+step)) {
        this.stepperActiveIndex = Math.min(Math.max(+step, 0), GMAIL_INBOX_STEPS.length - 1);
      }
      const setupStarted = url.searchParams.get(StoredValue.SETUP_STARTED);
      if (setupStarted) {
        this.showSetupRun = true;
        this.setupInProgress = true;
        this.stepperActiveIndex = 0;
      }
      const oauthError = url.searchParams.get(StoredValue.OAUTH_ERROR);
      if (oauthError) {
        this.errorMessage = oauthError;
      }
      const connectedParam = url.searchParams.get(StoredValue.CONNECTED);
      if (connectedParam) {
        this.stepperActiveIndex = 1;
      }
    }
  }

  async ngOnInit(): Promise<void> {
    this.subscriptions.push(this.oauthSave$.pipe(debounceTime(1000)).subscribe(() => this.autoSaveOAuthClient()));
    await this.refreshSetupStatus();
    this.clearSetupStartedParam();
  }

  private clearSetupStartedParam(): void {
    if (!isUndefined(window) && new URL(window.location.href).searchParams.has(StoredValue.SETUP_STARTED)) {
      void this.router.navigate([], {relativeTo: this.route, queryParams: {[StoredValue.SETUP_STARTED]: null}, queryParamsHandling: "merge", replaceUrl: true});
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    if (this.setupPollTimer) {
      clearTimeout(this.setupPollTimer);
      this.setupPollTimer = null;
    }
  }

  private async refreshSetupStatus(): Promise<void> {
    try {
      const status = await this.inboxService.googleCloudSetupStatus();
      this.applySetupStatus(status);
      if (status?.status === GoogleCloudSetupStatusValue.RUNNING) {
        this.setupPollTimer = setTimeout(() => void this.refreshSetupStatus(), 2000);
      }
    } catch (error) {
      this.logger.warn("Google Cloud setup status poll failed:", error);
    }
  }

  private applySetupStatus(status: GoogleCloudSetupStatusView | null): void {
    const running = status?.status === GoogleCloudSetupStatusValue.RUNNING;
    if (running) {
      this.showSetupRun = true;
    }
    if (!status || (!this.showSetupRun && !running)) {
      this.setupInProgress = false;
      this.setupSteps = [];
      return;
    }
    this.setupInProgress = running;
    if (running) {
      this.setupSteps = status.steps ?? [];
    } else if (status.status === GoogleCloudSetupStatusValue.COMPLETED) {
      this.setupSteps = [];
      this.statusTitle = "Google Cloud setup complete";
      this.statusMessage = `Project ${status.projectId}, topic ${status.topicFullName}`;
      this.errorMessage = null;
      if (this.systemConfigInternal?.googleInbox) {
        this.systemConfigInternal.googleInbox.pubsubTopicName = status.topicFullName ?? this.systemConfigInternal.googleInbox.pubsubTopicName;
        this.systemConfigInternal.googleInbox.pubsubSubscriptionName = status.subscriptionFullName ?? this.systemConfigInternal.googleInbox.pubsubSubscriptionName;
      }
    } else if (status.status === GoogleCloudSetupStatusValue.FAILED) {
      this.setupSteps = (status.steps ?? []).filter(step => step.status === GoogleCloudProvisioningStepStatus.FAILED);
      this.errorMessage = status.errorMessage || "Google Cloud setup failed";
    }
  }

  deploymentHost(): string {
    return isUndefined(window) ? "your-deployment-host" : window.location.host;
  }

  pushReceiverHint(): string {
    return `https://${this.deploymentHost()}/api/inbox/pubsub/push?token=...`;
  }

  goToStep(index: number): void {
    this.stepperActiveIndex = index;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.STEP]: index},
      queryParamsHandling: "merge"
    });
  }

  oAuthClientConfigured(): boolean {
    const googleInbox = this.systemConfigInternal?.googleInbox;
    return !!(googleInbox && (googleInbox.clientId || googleInbox.clientSecret || googleInbox.redirectUri
      || googleInbox.pubsubProjectId || googleInbox.pubsubTopicName || googleInbox.pubsubSubscriptionName));
  }

  clearOAuthClient(): void {
    this.systemConfigInternal.googleInbox = {clientId: "", clientSecret: "", redirectUri: ""};
    this.topicNameInput = "ngx-inbox-events";
    this.clearConfirmPending = false;
    this.errorMessage = null;
    this.statusTitle = null;
    this.statusMessage = null;
    this.oauthDirty = true;
    this.oauthEditVersion++;
    this.oauthSaved = false;
    this.oauthSaveError = null;
    void this.autoSaveOAuthClient();
  }

  onOAuthFieldChange(): void {
    this.oauthDirty = true;
    this.oauthEditVersion++;
    this.oauthSaved = false;
    this.oauthSaveError = null;
    this.oauthSave$.next();
  }

  private async autoSaveOAuthClient(): Promise<void> {
    if (!this.systemConfigInternal) {
      return;
    }
    const versionAtSaveStart = this.oauthEditVersion;
    this.oauthSaving = true;
    this.oauthSaveError = null;
    try {
      await this.systemConfigService.saveConfig(this.systemConfigInternal);
      if (this.oauthEditVersion === versionAtSaveStart) {
        this.oauthDirty = false;
        this.oauthSaved = true;
      }
    } catch (error) {
      this.oauthSaveError = (error as Error)?.message || "Save failed - try again or use the page Save button.";
    } finally {
      this.oauthSaving = false;
    }
  }

  get inboxProvider(): InboxReaderProvider {
    return this.systemConfigInternal?.inbox?.provider ?? InboxReaderProvider.GMAIL_API;
  }

  async selectInboxProvider(provider: InboxReaderProvider): Promise<void> {
    if (!this.systemConfigInternal || this.inboxProvider === provider) {
      return;
    }
    this.systemConfigInternal.inbox = {provider};
    this.directDeliveryMessage = null;
    this.directDeliveryError = null;
    try {
      await this.systemConfigService.saveConfig(this.systemConfigInternal);
    } catch (error) {
      this.errorMessage = (error as Error)?.message || "Could not save the inbox provider - try again.";
    }
  }

  async enableDirectDelivery(): Promise<void> {
    this.directDeliverySaving = true;
    this.directDeliveryMessage = null;
    this.directDeliveryError = null;
    try {
      const result = await this.cloudflareEmailRoutingService.routeToInbox();
      this.directDeliveryMessage = result.routed?.length
        ? `Direct delivery is active. Mail for ${result.routed.length} address${result.routed.length === 1 ? "" : "es"} (${result.routed.join(", ")}) now arrives in this inbox.`
        : "No committee addresses were found for this site's domain yet. Add the committee role addresses in Cloudflare Email Routing first, then try again.";
    } catch (error) {
      this.directDeliveryError = (error as Error)?.message || "Could not enable direct delivery. Check that Cloudflare Email Routing and the MX records are set up for your domain.";
    } finally {
      this.directDeliverySaving = false;
    }
  }

  async runSetup(): Promise<void> {
    const projectId = this.effectiveProjectId();
    if (!projectId) {
      this.errorMessage = "No Google Cloud project detected - set the OAuth Client ID above first.";
      return;
    }
    if (!this.topicNameInput.trim()) {
      this.errorMessage = "Enter a Pub/Sub topic name before running setup.";
      return;
    }
    this.busy = true;
    this.errorMessage = null;
    this.statusTitle = null;
    this.statusMessage = "Starting Google Cloud setup - redirecting to Google to authorise…";
    try {
      const consentUrl = await this.inboxService.startGoogleCloudSetup(projectId, this.topicNameInput.trim());
      if (!consentUrl) {
        this.statusMessage = null;
        this.errorMessage = "Setup could not start - no authorisation URL was returned. Check the OAuth client configuration.";
        return;
      }
      window.location.href = consentUrl;
    } catch (error) {
      this.statusMessage = null;
      this.errorMessage = (error as Error).message;
    } finally {
      this.busy = false;
    }
  }

  oauthProjectNumber(): string | null {
    const clientId = this.systemConfigInternal?.googleInbox?.clientId ?? "";
    const match = clientId.match(/^(\d+)-/);
    return match ? match[1] : null;
  }

  effectiveProjectId(): string | null {
    return this.projectOverride.trim() || this.oauthProjectNumber();
  }

  googleConsoleProjectUrl(): string {
    const projectNumber = this.oauthProjectNumber();
    return projectNumber
      ? `https://console.cloud.google.com/iam-admin/settings?project=${projectNumber}`
      : "https://console.cloud.google.com/projectselector2/iam-admin/settings";
  }

  googleAudienceUrl(): string {
    const projectNumber = this.oauthProjectNumber();
    return projectNumber
      ? `https://console.cloud.google.com/auth/audience?project=${projectNumber}`
      : "https://console.cloud.google.com/auth/audience";
  }

  private handleConfigChange(systemConfig: SystemConfig) {
    const preservedGoogleInbox = this.oauthDirty ? this.systemConfigInternal?.googleInbox : null;
    this.systemConfigInternal = systemConfig;
    if (this.systemConfigInternal && preservedGoogleInbox) {
      this.systemConfigInternal.googleInbox = preservedGoogleInbox;
    }
    if (this.systemConfigInternal && !this.systemConfigInternal.googleInbox) {
      this.systemConfigInternal.googleInbox = {clientId: "", clientSecret: "", redirectUri: ""};
    }
    if (this.systemConfigInternal && !this.systemConfigInternal.inbox) {
      this.systemConfigInternal.inbox = {provider: InboxReaderProvider.GMAIL_API};
    }
    const existingTopic = this.systemConfigInternal?.googleInbox?.pubsubTopicName;
    if (existingTopic && !this.topicNameInput) {
      const segments = existingTopic.split("/");
      this.topicNameInput = segments[segments.length - 1] ?? existingTopic;
    }
    this.logger.info("handleConfigChange:googleInbox:", this.systemConfigInternal?.googleInbox);
  }
}
