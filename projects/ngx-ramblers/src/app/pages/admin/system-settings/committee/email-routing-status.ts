import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommitteeMember } from "../../../../models/committee.model";
import { ALERT_ERROR, ALERT_SUCCESS, ALERT_WARNING } from "../../../../models/alert-target.model";
import {
  DestinationAddress,
  DestinationVerificationDetail,
  DestinationVerificationStatus,
  EmailRouteType,
  EmailRoutingActionType,
  EmailRoutingMatcherField,
  EmailRoutingMatcherType,
  EmailRoutingRule,
  EmailRoutingStatus,
  NonSensitiveCloudflareConfig
} from "../../../../models/cloudflare-email-routing.model";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertComponent } from "ngx-bootstrap/alert";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CloudflareButton } from "../../../../modules/common/third-parties/cloudflare-button";
import { normaliseEmail } from "../../../../functions/strings";

enum WorkerAction {
  DEPLOY = "deploy",
  UPDATE = "update",
  DELETE = "delete"
}

@Component({
    selector: "[app-email-routing-status]",
    template: `
    @if (status && !committeeMemberInternal?.vacant && !cloudflareEmailRoutingService.hasConfigError()) {
      @if (!memberEmail && !isMultiRecipient() && status?.routeType !== EmailRouteType.WORKER) {
        <div class="d-flex align-items-center">
          <alert type="warning" class="flex-grow-1 mb-0">
            <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
            <strong class="ms-2">Inbound forwarding not yet configured</strong>
            <span class="ms-2">Link a member with a personal email address to forward
              {{ status.roleEmail }} messages to them</span>
          </alert>
        </div>
      }
      @if (loadingStatus) {
        <div class="d-flex align-items-center mb-2">
          <alert type="warning" class="flex-grow-1 mb-0">
            <fa-icon [icon]="ALERT_WARNING.icon" [spin]="true"></fa-icon>
            <strong class="ms-2">Checking routing status</strong>
            <span class="ms-2">Loading Cloudflare configuration</span>
          </alert>
        </div>
      } @else if (!isMultiRecipient()) {
        @if (verificationEmail() && status.destinationVerificationStatus === DestinationVerificationStatus.VERIFIED) {
          <div class="d-flex align-items-center mb-2">
            <alert type="success" class="flex-grow-1 mb-0">
              <fa-icon [icon]="ALERT_SUCCESS.icon"></fa-icon>
              <strong class="ms-2">Destination Verified</strong>
              <span class="ms-2">{{ verificationEmail() }} is a verified forwarding destination</span>
            </alert>
          </div>
        }
        @if (verificationEmail() && status.destinationVerificationStatus === DestinationVerificationStatus.PENDING) {
          <div class="d-flex align-items-center mb-2">
            <alert type="warning" class="flex-grow-1 mb-0">
              <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
              <strong class="ms-2">Verification Pending</strong>
              <span class="ms-2">{{ verificationEmail() }} has not yet confirmed the verification email from Cloudflare</span>
            </alert>
            <app-cloudflare-button class="ms-2" [disabled]="apiRequestPending" [loading]="apiRequestPending" button
              (click)="resendVerification()"
              title="Resend Verification"></app-cloudflare-button>
          </div>
        }
        @if (verificationEmail() && status.destinationVerificationStatus === DestinationVerificationStatus.NOT_REGISTERED) {
          <div class="d-flex align-items-center mb-2">
            <alert type="warning" class="flex-grow-1 mb-0">
              <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
              <strong class="ms-2">Destination Not Registered</strong>
              <span class="ms-2">{{ verificationEmail() }} must be registered and verified before forwarding rules will work</span>
            </alert>
            <app-cloudflare-button class="ms-2" [disabled]="apiRequestPending" [loading]="apiRequestPending" button
              (click)="registerDestination()"
              title="Register & Verify"></app-cloudflare-button>
          </div>
        }
        @if (memberEmail && status.routeType === EmailRouteType.DIRECT && destinationMatches()) {
          <div class="d-flex align-items-center">
            <alert type="success" class="flex-grow-1 mb-0">
              <fa-icon [icon]="ALERT_SUCCESS.icon"></fa-icon>
              <strong class="ms-2">Direct Rule Active</strong>
              <span class="ms-2">{{ status.roleEmail }} &rarr; {{ status.effectiveDestination }}</span>
            </alert>
            <app-cloudflare-button class="ms-2" [disabled]="apiRequestPending" [loading]="apiRequestPending" button
              (click)="deleteForward()"
              title="Delete Forward"></app-cloudflare-button>
          </div>
        }
        @if (memberEmail && status.routeType === EmailRouteType.DIRECT && !destinationMatches()) {
          <div class="d-flex align-items-center">
            <alert type="warning" class="flex-grow-1 mb-0">
              <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
              <strong class="ms-2">Direct Rule Outdated</strong>
              <span class="ms-2">{{ status.roleEmail }} &rarr; {{ status.effectiveDestination }}
                (should be {{ status.destinationEmail }})</span>
            </alert>
            <app-cloudflare-button class="ms-2" [disabled]="forwardButtonDisabled()" [loading]="apiRequestPending" button
              (click)="updateForward()"
              [title]="forwardButtonDisabled() ? 'Destination must be verified first' : 'Update Forward'"></app-cloudflare-button>
          </div>
        }
        @if (memberEmail && status.routeType === EmailRouteType.CATCH_ALL && !catchAllDestinationMatches()) {
          <div class="d-flex align-items-center">
            <alert type="success" class="flex-grow-1 mb-0">
              <fa-icon [icon]="ALERT_SUCCESS.icon"></fa-icon>
              <strong class="ms-2">Routed via Catch-all</strong>
              <span class="ms-2">Catch-all routing is enabled for {{ status.roleEmail }}.</span>
            </alert>
            <app-cloudflare-button class="ms-2" [disabled]="forwardButtonDisabled()" [loading]="apiRequestPending" button
              (click)="createForward()"
              [title]="forwardButtonDisabled() ? 'Destination must be verified first' : 'Create Direct Rule'"></app-cloudflare-button>
          </div>
        }
        @if (memberEmail && status.routeType === EmailRouteType.CATCH_ALL && catchAllDestinationMatches()) {
          <div class="d-flex align-items-center">
            <alert type="success" class="flex-grow-1 mb-0">
              <fa-icon [icon]="ALERT_SUCCESS.icon"></fa-icon>
              <strong class="ms-2">Routed via Catch-all</strong>
              <span class="ms-2">Catch-all routing is enabled for {{ status.roleEmail }} (matches current destination).</span>
            </alert>
          </div>
        }
        @if (memberEmail && status.routeType === EmailRouteType.NONE) {
          <div class="d-flex align-items-center">
            <alert type="warning" class="flex-grow-1 mb-0">
              <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
              <strong class="ms-2">No Routing Configured</strong>
              <span class="ms-2">{{ status.roleEmail }} &rarr; {{ status.destinationEmail }}</span>
            </alert>
            <app-cloudflare-button class="ms-2" [disabled]="forwardButtonDisabled()" [loading]="apiRequestPending" button
              (click)="createForward()"
              [title]="forwardButtonDisabled() ? 'Destination must be verified first' : 'Create Forward'"></app-cloudflare-button>
          </div>
        }
      }
      @if (isMultiRecipient()) {
        @if (showRecipientStatus && status.destinationVerificationStatuses?.length) {
          <h6 class="section-heading">Recipient Verification</h6>
          <div class="mb-2">
            <label class="control-label mb-1">Per-recipient verification status</label>
            <ul class="list-group">
              @for (detail of status.destinationVerificationStatuses; track detail.email) {
                <li class="list-group-item d-flex justify-content-between align-items-center py-1">
                  <span>{{ detail.email }}</span>
                  @switch (detail.status) {
                    @case (DestinationVerificationStatus.VERIFIED) {
                      <span class="badge text-style-sunset">Verified</span>
                    }
                    @case (DestinationVerificationStatus.PENDING) {
                      <app-cloudflare-button [disabled]="apiRequestPending" [loading]="apiRequestPending" button
                        (click)="resendVerificationFor(detail.email)"
                        title="Resend">
                        <span class="badge bg-warning">Pending</span>
                      </app-cloudflare-button>
                    }
                    @case (DestinationVerificationStatus.NOT_REGISTERED) {
                      <app-cloudflare-button [disabled]="apiRequestPending" [loading]="apiRequestPending" button
                        (click)="registerDestinationFor(detail.email)"
                        title="Register">
                        <span class="badge bg-warning">Not Registered</span>
                      </app-cloudflare-button>
                    }
                  }
                </li>
              }
            </ul>
          </div>
        }
        <h6 class="section-heading">Email Routing</h6>
        @if (status.routeType === EmailRouteType.WORKER) {
          <h6 class="section-heading">Multi-recipient Forwarding
            @if (status.workerScriptName) {
              ({{ status.workerScriptName }})
            }
          </h6>
          <div class="d-flex align-items-start mb-2">
            <alert type="success" class="flex-grow-1 mb-0">
              <fa-icon [icon]="ALERT_SUCCESS.icon"></fa-icon>
              <strong class="ms-2">Forwarding Active</strong>
              <span class="ms-2">Forwarding to {{ memberEmailsInternal?.length }} recipients</span>
            </alert>
            <app-cloudflare-button class="ms-2 mt-1" [disabled]="updateWorkerDisabled()" [loading]="workerAction === WorkerAction.UPDATE" button
              (click)="updateWorker()"
              title="Update Worker"></app-cloudflare-button>
            <app-cloudflare-button class="ms-2 mt-1" [disabled]="apiRequestPending" [loading]="workerAction === WorkerAction.DELETE" button
              (click)="deleteWorker()"
              title="Delete Worker"></app-cloudflare-button>
          </div>
          @if (workerUpdateHint()) {
            <div class="small text-muted">{{ workerUpdateHint() }}</div>
          }
        }
        @if (status.routeType !== EmailRouteType.WORKER && memberEmailsInternal?.length > 1) {
          <h6 class="section-heading">Multi-recipient Forwarding</h6>
          <div class="d-flex align-items-start mb-2">
            <alert type="warning" class="flex-grow-1 mb-0">
              <fa-icon [icon]="ALERT_WARNING.icon"></fa-icon>
              <strong class="ms-2">Forwarding Not Set Up</strong>
              <span class="ms-2">{{ memberEmailsInternal?.length }} recipients configured but no worker is deployed yet</span>
              @if (loadingStatus) {
                <div class="mt-2 small text-muted">Loading recipient verification status...</div>
              } @else if (status.destinationVerificationStatuses?.length) {
                <div class="mt-2 d-flex flex-wrap gap-2">
                  @for (detail of status.destinationVerificationStatuses; track detail.email) {
                    @if (detail.status === DestinationVerificationStatus.VERIFIED) {
                      <span class="badge text-style-sunset">
                        {{ detail.email }} — Verified
                      </span>
                    } @else if (detail.status === DestinationVerificationStatus.PENDING) {
                      <button type="button" class="badge badge-action badge-action-attn"
                        [disabled]="apiRequestPending"
                        (click)="resendVerificationFor(detail.email)">
                        {{ detail.email }} — Pending (click to resend)
                      </button>
                    } @else {
                      <button type="button" class="badge badge-action badge-action-attn"
                        [disabled]="apiRequestPending"
                        (click)="registerDestinationFor(detail.email)">
                        {{ detail.email }} — Not registered (click to verify)
                      </button>
                    }
                  }
                </div>
              }
            </alert>
            <app-cloudflare-button class="ms-2 mt-1" [disabled]="workerButtonDisabled()" [loading]="workerAction === WorkerAction.DEPLOY" button
              (click)="createWorker()"
              title="Deploy Worker"></app-cloudflare-button>
          </div>
          @if (workerButtonDisabled() && !apiRequestPending) {
            <div class="small text-muted">All recipients must be verified before a worker can be deployed</div>
          }
        }
      }
      @if (error) {
        <div class="d-flex align-items-center mt-2">
          <alert type="danger" class="flex-grow-1 mb-0">
            <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
            <strong class="ms-2">Error</strong>
            <span class="ms-2">{{ stringUtilsService.stringify(error) }}</span>
          </alert>
        </div>
      }
    }`,
    styles: [`
      :host ::ng-deep .alert
        margin-bottom: 0
      .section-heading
        border-top: 1px solid #dee2e6
        padding-top: 0.75rem
        margin: 0.75rem 0
      .badge-action
        background: #0ea5a5
        color: #fff
        padding: 0.3rem 0.6rem
        border-radius: 0.5rem
        border: 0
        cursor: pointer
        font-weight: 600
        text-decoration: underline
        text-underline-offset: 2px
      .badge-action[disabled]
        opacity: 0.6
        cursor: not-allowed
      .badge-action-attn
        background: #c05711
    `],
    imports: [AlertComponent, FontAwesomeModule, CloudflareButton]
})
export class EmailRoutingStatusComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("EmailRoutingStatusComponent", NgxLoggerLevel.ERROR);
  cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  public stringUtilsService = inject(StringUtilsService);
  protected committeeMemberInternal: CommitteeMember;
  public status: EmailRoutingStatus;
  public error: any;
  public apiRequestPending = false;
  protected readonly WorkerAction = WorkerAction;
  public workerAction: WorkerAction | null = null;
  public loadingStatus = false;
  public workerNeedsUpdate = false;
  private lastAppliedRecipients: string[] = [];
  baseDomain = "";
  private rules: EmailRoutingRule[] = [];
  private catchAllRuleInternal: EmailRoutingRule;
  private destinationAddresses: DestinationAddress[] = [];
  private subscriptions: Subscription[] = [];
  memberEmailsInternal: string[] = [];

  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly ALERT_SUCCESS = ALERT_SUCCESS;
  protected readonly ALERT_WARNING = ALERT_WARNING;
  protected readonly EmailRouteType = EmailRouteType;
  protected readonly DestinationVerificationStatus = DestinationVerificationStatus;

  @Input() memberEmail: string;
  @Input() showRecipientStatus = true;
  @Input() forceMultiRecipient = false;

  @Input() set memberEmails(emails: string[]) {
    this.memberEmailsInternal = emails || [];
    this.refreshStatus();
  }

  @Input({
    alias: "committeeMember",
    required: true
  }) set committeeMemberValue(committeeMember: CommitteeMember) {
    const shouldResetRecipients = !this.committeeMemberInternal || this.committeeMemberInternal.type !== committeeMember?.type;
    this.committeeMemberInternal = committeeMember;
    if (shouldResetRecipients) {
      this.lastAppliedRecipients = [];
    }
    this.refreshStatus();
  }

  ngOnInit() {
    this.subscriptions.push(
      this.cloudflareEmailRoutingService.cloudflareConfigNotifications().subscribe((config: NonSensitiveCloudflareConfig) => {
        this.baseDomain = config?.baseDomain || "";
        this.logger.info("baseDomain set to:", this.baseDomain);
        this.refreshStatus();
      })
    );
    this.loadRules();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  isMultiRecipient(): boolean {
    return this.forceMultiRecipient || this.memberEmailsInternal?.length > 1;
  }

  private async loadRules() {
    this.loadingStatus = true;
    try {
      const [rules, catchAll, destinationAddresses] = await Promise.all([
        this.cloudflareEmailRoutingService.queryRules(),
        this.cloudflareEmailRoutingService.queryCatchAllRule(),
        this.cloudflareEmailRoutingService.queryDestinationAddresses()
      ]);
      this.rules = rules;
      this.catchAllRuleInternal = catchAll;
      this.destinationAddresses = destinationAddresses;
      this.refreshStatus();
    } catch (err) {
      this.logger.error("Failed to load email routing rules:", err);
    } finally {
      this.loadingStatus = false;
    }
  }

  private refreshStatus() {
    if (!this.committeeMemberInternal) {
      return;
    }
    const roleEmail = this.roleEmail();
    const destinationEmail = this.memberEmail;
    const matchingRule = this.rules.find(rule =>
      rule.matchers?.some(m => m.type === EmailRoutingMatcherType.LITERAL && m.field === EmailRoutingMatcherField.TO && m.value === roleEmail)
    );

    if (matchingRule) {
      const workerAction = matchingRule.actions?.find(a => a.type === EmailRoutingActionType.WORKER);
      const forwardAction = matchingRule.actions?.find(a => a.type === EmailRoutingActionType.FORWARD);
      if (workerAction) {
        this.status = {
          ruleExists: true,
          rule: matchingRule,
          roleEmail,
          destinationEmail,
          routeType: EmailRouteType.WORKER,
          workerScriptName: workerAction.value?.[0] || null,
          effectiveDestination: null
        };
      } else {
        this.status = {
          ruleExists: true,
          rule: matchingRule,
          roleEmail,
          destinationEmail,
          routeType: EmailRouteType.DIRECT,
          effectiveDestination: forwardAction?.value?.[0] || null
        };
      }
    } else if (this.catchAllRuleInternal?.enabled) {
      const catchAllForwardAction = this.catchAllRuleInternal.actions?.find(a => a.type === EmailRoutingActionType.FORWARD);
      this.status = {
        ruleExists: false,
        rule: null,
        roleEmail,
        destinationEmail,
        catchAllRule: this.catchAllRuleInternal,
        routeType: EmailRouteType.CATCH_ALL,
        effectiveDestination: catchAllForwardAction?.value?.[0] || null
      };
    } else {
      this.status = {
        ruleExists: false,
        rule: null,
        roleEmail,
        destinationEmail,
        routeType: EmailRouteType.NONE
      };
    }

    if (this.isMultiRecipient()) {
      this.status.destinationEmails = this.memberEmailsInternal;
      this.status.destinationVerificationStatuses = this.memberEmailsInternal.map(email => {
        const matchedAddress = this.destinationAddresses.find(addr => normaliseEmail(addr.email) === normaliseEmail(email));
        if (matchedAddress) {
          return {
            email,
            status: matchedAddress.verified ? DestinationVerificationStatus.VERIFIED : DestinationVerificationStatus.PENDING,
            destinationAddress: matchedAddress
          } as DestinationVerificationDetail;
        }
        return {email, status: DestinationVerificationStatus.NOT_REGISTERED} as DestinationVerificationDetail;
      });
    } else {
      const verificationEmail = this.verificationEmail();
      const matchedAddress = this.destinationAddresses.find(addr => normaliseEmail(addr.email) === normaliseEmail(verificationEmail));
      if (matchedAddress) {
        this.status.destinationAddress = matchedAddress;
        this.status.destinationVerificationStatus = matchedAddress.verified
          ? DestinationVerificationStatus.VERIFIED
          : DestinationVerificationStatus.PENDING;
      } else if (verificationEmail) {
        this.status.destinationVerificationStatus = DestinationVerificationStatus.NOT_REGISTERED;
      }
    }
    if (this.status?.routeType === EmailRouteType.WORKER && this.lastAppliedRecipients.length === 0) {
      this.lastAppliedRecipients = this.normalisedRecipients(this.memberEmailsInternal);
    }
    this.workerNeedsUpdate = this.status?.routeType === EmailRouteType.WORKER
      && this.recipientsChangedFromWorker(this.memberEmailsInternal, this.lastAppliedRecipients);
    this.logger.info("refreshStatus:", this.status);
  }

  destinationMatches(): boolean {
    return this.status?.effectiveDestination === this.status?.destinationEmail;
  }

  catchAllDestinationMatches(): boolean {
    return this.status?.effectiveDestination === this.memberEmail;
  }

  verificationEmail(): string {
    if (this.status?.routeType === EmailRouteType.DIRECT || this.status?.routeType === EmailRouteType.CATCH_ALL) {
      return this.status?.effectiveDestination || this.memberEmail;
    }
    return this.memberEmail;
  }

  allRecipientsVerified(): boolean {
    return this.status?.destinationVerificationStatuses?.every(d => d.status === DestinationVerificationStatus.VERIFIED) || false;
  }

  workerButtonDisabled(): boolean {
    return this.apiRequestPending || !this.allRecipientsVerified();
  }

  updateWorkerDisabled(): boolean {
    return this.workerButtonDisabled() || !this.workerNeedsUpdate;
  }

  workerUpdateHint(): string | null {
    if (!this.workerNeedsUpdate || this.apiRequestPending) {
      return null;
    }
    if (this.allRecipientsVerified()) {
      return "Recipients changed. Click Update Worker to apply.";
    }
    return "Recipients changed. Verify all recipients to enable updating the worker.";
  }

  async createWorker() {
    await this.applyWorker(WorkerAction.DEPLOY);
  }

  async updateWorker() {
    await this.applyWorker(WorkerAction.UPDATE);
  }

  async deleteWorker() {
    this.apiRequestPending = true;
    this.workerAction = WorkerAction.DELETE;
    this.error = null;
    try {
      if (this.status.workerScriptName) {
        await this.cloudflareEmailRoutingService.deleteWorker(this.status.workerScriptName);
      }
      await this.reloadRules();
    } catch (err) {
      this.error = err;
    } finally {
      this.apiRequestPending = false;
      this.workerAction = null;
      this.lastAppliedRecipients = [];
    }
  }

  private async applyWorker(action: WorkerAction) {
    if (action === WorkerAction.UPDATE && this.updateWorkerDisabled()) {
      return;
    }
    if (action === WorkerAction.DEPLOY && this.workerButtonDisabled()) {
      return;
    }
    this.apiRequestPending = true;
    this.workerAction = action;
    this.error = null;
    try {
      await this.cloudflareEmailRoutingService.createOrUpdateWorker({
        roleType: this.committeeMemberInternal.type,
        roleEmail: this.status.roleEmail,
        roleName: this.committeeMemberInternal.description,
        recipients: this.memberEmailsInternal,
        enabled: true
      });
      this.lastAppliedRecipients = this.normalisedRecipients(this.memberEmailsInternal);
      await this.reloadRules();
    } catch (err) {
      this.error = err;
    } finally {
      this.apiRequestPending = false;
      this.workerAction = null;
    }
  }

  private recipientsChangedFromWorker(current: string[], previous: string[]): boolean {
    const currentSet = this.normalisedRecipients(current);
    const previousSet = this.normalisedRecipients(previous);
    if (currentSet.length !== previousSet.length) {
      return true;
    }
    return currentSet.some((email, index) => email !== previousSet[index]);
  }

  private normalisedRecipients(recipients: string[]): string[] {
    return (recipients || [])
      .map(email => normaliseEmail(email))
      .filter(email => email)
      .sort();
  }

  private roleEmail(): string {
    const candidate = this.committeeMemberInternal?.email;
    if (candidate && this.baseDomain && candidate.endsWith(`@${this.baseDomain}`)) {
      return candidate;
    }
    return `${this.committeeMemberInternal.type}@${this.baseDomain}`;
  }

  async createForward() {
    this.apiRequestPending = true;
    this.error = null;
    try {
      await this.cloudflareEmailRoutingService.createRule({
        roleEmail: this.status.roleEmail,
        destinationEmail: this.memberEmail,
        roleName: this.committeeMemberInternal.description,
        enabled: true
      });
      await this.reloadRules();
    } catch (err) {
      this.error = err;
    } finally {
      this.apiRequestPending = false;
    }
  }

  async updateForward() {
    this.apiRequestPending = true;
    this.error = null;
    try {
      await this.cloudflareEmailRoutingService.updateRule(this.status.rule.id, {
        roleEmail: this.status.roleEmail,
        destinationEmail: this.memberEmail,
        roleName: this.committeeMemberInternal.description,
        enabled: true
      });
      await this.reloadRules();
    } catch (err) {
      this.error = err;
    } finally {
      this.apiRequestPending = false;
    }
  }

  async deleteForward() {
    this.apiRequestPending = true;
    this.error = null;
    try {
      await this.cloudflareEmailRoutingService.deleteRule(this.status.rule.id);
      await this.reloadRules();
    } catch (err) {
      this.error = err;
    } finally {
      this.apiRequestPending = false;
    }
  }

  forwardButtonDisabled(): boolean {
    return this.apiRequestPending || this.status?.destinationVerificationStatus !== DestinationVerificationStatus.VERIFIED;
  }

  async registerDestination() {
    const email = this.verificationEmail();
    if (!email) {
      return;
    }
    this.apiRequestPending = true;
    this.error = null;
    try {
      await this.cloudflareEmailRoutingService.createDestinationAddress(normaliseEmail(email));
      await this.reloadRules();
    } catch (err) {
      this.error = err;
    } finally {
      this.apiRequestPending = false;
    }
  }

  async registerDestinationFor(email: string) {
    this.apiRequestPending = true;
    this.error = null;
    try {
      this.markRecipientPending(email);
      await this.cloudflareEmailRoutingService.createDestinationAddress(normaliseEmail(email));
      await this.reloadRules();
    } catch (err) {
      this.error = err;
    } finally {
      this.apiRequestPending = false;
    }
  }

  async resendVerification() {
    const email = this.verificationEmail();
    if (!email) {
      return;
    }
    this.apiRequestPending = true;
    this.error = null;
    try {
      const existingAddress = this.status?.destinationAddress;
      if (existingAddress) {
        await this.cloudflareEmailRoutingService.deleteDestinationAddress(existingAddress.id);
      }
      await this.cloudflareEmailRoutingService.createDestinationAddress(normaliseEmail(email));
      await this.reloadRules();
    } catch (err) {
      this.error = err;
    } finally {
      this.apiRequestPending = false;
    }
  }

  async resendVerificationFor(email: string) {
    this.apiRequestPending = true;
    this.error = null;
    try {
      this.markRecipientPending(email);
      const detail = this.status?.destinationVerificationStatuses?.find(d => d.email === email);
      if (detail?.destinationAddress) {
        await this.cloudflareEmailRoutingService.deleteDestinationAddress(detail.destinationAddress.id);
      }
      await this.cloudflareEmailRoutingService.createDestinationAddress(normaliseEmail(email));
      await this.reloadRules();
    } catch (err) {
      this.error = err;
    } finally {
      this.apiRequestPending = false;
    }
  }

  private async reloadRules() {
    this.loadingStatus = true;
    this.cloudflareEmailRoutingService.invalidateCache();
    try {
      const [rules, catchAll, destinationAddresses] = await Promise.all([
        this.cloudflareEmailRoutingService.queryRules(),
        this.cloudflareEmailRoutingService.queryCatchAllRule(),
        this.cloudflareEmailRoutingService.queryDestinationAddresses()
      ]);
      this.rules = rules;
      this.catchAllRuleInternal = catchAll;
      this.destinationAddresses = destinationAddresses;
      this.refreshStatus();
    } finally {
      this.loadingStatus = false;
    }
  }

  private markRecipientPending(email: string) {
    const detail = this.status?.destinationVerificationStatuses?.find(d => d.email === email);
    if (detail) {
      detail.status = DestinationVerificationStatus.PENDING;
      this.status = {
        ...this.status,
        destinationVerificationStatuses: [...this.status.destinationVerificationStatuses]
      };
    }
  }
}
