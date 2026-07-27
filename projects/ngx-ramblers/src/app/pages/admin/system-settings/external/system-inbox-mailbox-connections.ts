import { Component, inject, Input, OnInit } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowUpRightFromSquare, faCheckCircle, faCircleNotch, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { ActivatedRoute } from "@angular/router";
import { InboxService } from "../../../../services/inbox/inbox.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { AlertTarget } from "../../../../models/alert-target.model";
import {
  InboxAccessMode,
  InboxAliasConfigView,
  InboxAliasConnectionStatus,
  InboxMailboxConnectionView,
  InboxSyncMode
} from "../../../../models/inbox.model";

@Component({
  selector: "app-system-inbox-mailbox-connections",
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, DatePipe],
  template: `
    <div class="mt-4">
      <hr>
      <h5 class="fw-bold mb-2">Connected Gmail accounts</h5>
      <div class="col-sm-12 px-0">
        <div class="d-flex align-items-center gap-3 flex-wrap mb-3">
          <span class="text-muted me-auto">Connect one or more Gmail accounts here, then point each committee role's Inbound Forwarding at the connected account. Members only ever see the role address, never the underlying Gmail account.</span>
          <button class="btn btn-primary text-nowrap flex-shrink-0" type="button" (click)="connectNewGmail()" [disabled]="busy">
            Add Gmail inbox
          </button>
        </div>
        @for (mailboxConnection of mailboxConnections; track mailboxConnection.id) {
          <div class="thumbnail-heading-frame-compact">
            <div class="thumbnail-heading">
              @if (!mailboxConnection.hasRefreshToken) {
                New Gmail inbox
              } @else {
                {{mailboxConnection.gmailAccountEmail}}
              }
            </div>
            @if (mailboxConnection.hasRefreshToken) {
              <div class="alert mb-3"
                   [class.alert-success]="mailboxConnection.connectionStatus === InboxAliasConnectionStatus.CONNECTED"
                   [class.alert-warning]="mailboxConnection.connectionStatus !== InboxAliasConnectionStatus.CONNECTED">
                <div class="d-flex align-items-start gap-2">
                  @if (busy) {
                    <fa-icon [icon]="faCircleNotch" animation="spin" class="mt-1"/>
                  } @else if (mailboxConnection.connectionStatus === InboxAliasConnectionStatus.CONNECTED) {
                    <fa-icon [icon]="faCheckCircle" class="mt-1"/>
                  } @else {
                    <fa-icon [icon]="faTriangleExclamation" class="mt-1"/>
                  }
                  <div class="flex-grow-1">
                    <strong>{{ connectionStatusTitle(mailboxConnection) }}</strong>
                    <ul class="mb-0 mt-2 ps-3">
                      <li>{{ deliverySummary(mailboxConnection) }}</li>
                      <li>{{ lastPollSummary(mailboxConnection) }}</li>
                      <li>{{ mappedRolesSummary(mailboxConnection.id) }}</li>
                      @if (mailboxConnection.importAllMessages) {
                        <li>Importing all messages in this Gmail inbox (role mailboxes plus a general mailbox for member admins).</li>
                      } @else {
                        <li>Importing only messages addressed to committee role mailboxes.</li>
                      }
                      @if (mailboxConnection.lastErrorMessage) {
                        <li>{{ friendlyErrorMessage(mailboxConnection.lastErrorMessage) }}</li>
                      }
                    </ul>
                    @if (mailboxConnection.connectionStatus === InboxAliasConnectionStatus.TOKEN_REVOKED) {
                      <p class="mb-2 mt-2">Google has revoked this mailbox's access. This happens 7 days after connecting while the Google Cloud OAuth consent screen is still in "Testing".</p>
                      <p class="mb-2">Fix it in two steps:</p>
                      <ol class="mb-0">
                        <li>
                          <a [href]="audienceUrl()" target="_blank" rel="noopener">
                            <fa-icon [icon]="faArrowUpRightFromSquare" class="me-1"/>Open the OAuth publishing screen
                          </a>
                          and set <strong>Publishing status</strong> to <strong>In production</strong> (this stops the 7-day expiry recurring).
                        </li>
                        <li>Click <strong>Reconnect</strong> below to issue a fresh token and pull in the backlog.</li>
                      </ol>
                    } @else if (mailboxConnection.connectionStatus === InboxAliasConnectionStatus.ERROR) {
                      <p class="mb-0 mt-2">
                        @if (mailboxConnection.importAllMessages) {
                          If it does not clear on the next automatic sync, click <strong>Re-scan general mailbox from scratch</strong> below.
                        } @else {
                          Wait for the next automatic sync, or switch Delivery briefly and back, to retry.
                        }
                      </p>
                    }
                  </div>
                </div>
              </div>
            } @else {
              <div class="alert alert-warning mt-2 mb-3">
                <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
                <strong>Not connected yet</strong>
                <p class="mb-0 mt-1">Complete Google authorisation to attach this mailbox.</p>
              </div>
            }
            <div class="d-flex align-items-end gap-3 flex-wrap">
              <div class="me-auto">
                @if (busy) {
                  <span class="text-muted">
                    <fa-icon [icon]="faCircleNotch" animation="spin" class="me-1"/>
                    Working…
                  </span>
                }
              </div>
              <div>
                <label class="form-label mb-1" [attr.for]="'inbox-access-mode-' + mailboxConnection.id">Committee mailbox access</label>
                <select [id]="'inbox-access-mode-' + mailboxConnection.id" class="form-select"
                        [(ngModel)]="mailboxConnection.accessMode"
                        (ngModelChange)="accessModeChanged(mailboxConnection, $event)"
                        [disabled]="busy">
                  <option [ngValue]="InboxAccessMode.ALL_COMMITTEE_ROLES">All committee role mailboxes</option>
                  <option [ngValue]="InboxAccessMode.ASSIGNED_ROLES">Assigned roles only</option>
                </select>
              </div>
              @if (mailboxConnection.hasRefreshToken) {
                <div>
                  <label class="form-label mb-1" [attr.for]="'inbox-sync-mode-' + mailboxConnection.id">Delivery</label>
                  <select [id]="'inbox-sync-mode-' + mailboxConnection.id" class="form-select"
                          [(ngModel)]="mailboxConnection.syncMode"
                          (ngModelChange)="syncModeChanged(mailboxConnection, $event)"
                          [disabled]="busy">
                    <option [ngValue]="InboxSyncMode.POLL">Pull - poll Gmail every 30 seconds</option>
                    <option [ngValue]="InboxSyncMode.WATCH">Push - real-time via Pub/Sub</option>
                  </select>
                </div>
                <div class="w-100 mt-2 form-check">
                  <input class="form-check-input" type="checkbox"
                         [id]="'inbox-import-all-' + mailboxConnection.id"
                         [ngModel]="mailboxConnection.importAllMessages"
                         (ngModelChange)="importAllChanged(mailboxConnection, $event)"
                         [disabled]="busy">
                  <label class="form-check-label" [attr.for]="'inbox-import-all-' + mailboxConnection.id">
                    Show all messages in this Gmail inbox
                  </label>
                  <small class="text-muted d-block">
                    By default only messages addressed to a committee role mailbox are loaded. Tick this to also pull in everything
                    else in this Gmail inbox; the extra messages appear under a "general" mailbox visible only to member administrators.
                  </small>
                </div>
                @if (mailboxConnection.importAllMessages) {
                  <button class="btn btn-sm btn-quiet mt-2" type="button" (click)="rescanGeneralMailbox(mailboxConnection)" [disabled]="busy"
                          tooltip="Re-poll this Gmail inbox for messages that are not yet in NGX. Existing conversations and each member's read or unread state are left as they are.">
                    Re-scan for missing messages
                  </button>
                }
              }
              @if (!mailboxConnection.hasRefreshToken) {
                <button class="btn btn-primary text-nowrap flex-shrink-0" type="button" (click)="connectGmail(mailboxConnection)" [disabled]="busy">
                  Connect Gmail
                </button>
              } @else {
                <button class="btn btn-primary text-nowrap flex-shrink-0" type="button" (click)="connectGmail(mailboxConnection)" [disabled]="busy"
                        tooltip="Re-run Google consent for this mailbox to replace a revoked or expired token, keeping its settings and Pub/Sub watch.">
                  Reconnect
                </button>
              }
              <button class="btn btn-grey-danger text-nowrap flex-shrink-0" type="button" (click)="removeMailbox(mailboxConnection)" [disabled]="busy">
                Remove
              </button>
              @if (mailboxConnection.hasRefreshToken && mailboxConnection.syncMode === InboxSyncMode.WATCH) {
                <div class="w-100 mt-2">
                  @if (mailboxConnection.pubsubTopicName) {
                    <small class="text-muted d-block">Real-time push via Pub/Sub topic <code>{{mailboxConnection.pubsubTopicName}}</code>, created by <strong>Run Google Cloud setup</strong> on step 1.</small>
                  }
                  @if (mailboxConnection.watchExpiresAt) {
                    <small class="text-muted d-block">Watch renews automatically; current registration expires {{mailboxConnection.watchExpiresAt | date:'medium'}}.</small>
                  }
                </div>
              }
            </div>
          </div>
        }
        <small class="text-muted d-block mt-2">After connecting a Gmail account, point each committee role's Inbound Forwarding (in Committee Settings) at it. The roles that route to a connected Gmail are listed in the next step.</small>
        @if (notifyTarget.showAlert) {
          <div class="alert mt-3" [ngClass]="notifyTarget.alertClass">
            <fa-icon [icon]="notifyTarget.alert.icon"/>
            @if (notifyTarget.alertTitle) {
              <strong class="ms-2">{{notifyTarget.alertTitle}}:</strong>
            }
            <span class="ms-1">{{notifyTarget.alertMessage}}</span>
          </div>
        }
      </div>
    </div>`
})
export class SystemInboxMailboxConnectionsComponent implements OnInit {

  private inboxService = inject(InboxService);
  private notifierService = inject(NotifierService);
  private route = inject(ActivatedRoute);
  private dateUtils = inject(DateUtilsService);
  protected stringUtils = inject(StringUtilsService);

  protected readonly InboxAccessMode = InboxAccessMode;
  protected readonly InboxSyncMode = InboxSyncMode;
  protected readonly InboxAliasConnectionStatus = InboxAliasConnectionStatus;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faCircleNotch = faCircleNotch;

  @Input() projectNumber: string | null = null;

  public mailboxConnections: InboxMailboxConnectionView[] = [];
  public aliases: InboxAliasConfigView[] = [];
  public pushConfigured = false;
  public configuredTopicName: string | null = null;
  public busy = false;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};

  async ngOnInit(): Promise<void> {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    await this.refresh();
    this.applyOauthOutcome();
  }

  audienceUrl(): string {
    return this.projectNumber
      ? `https://console.cloud.google.com/auth/audience?project=${this.projectNumber}`
      : "https://console.cloud.google.com/auth/audience";
  }

  private applyOauthOutcome(): void {
    const params = this.route.snapshot.queryParams;
    if (params["connected"]) {
      this.notify.success({title: "Gmail inbox connected", message: `${params["connected"]} is now connected`});
    } else if (params["oauthError"]) {
      this.notify.error({title: "Connect Gmail", message: params["oauthError"]});
    }
  }

  async refresh(): Promise<void> {
    this.busy = true;
    try {
      this.mailboxConnections = await this.inboxService.mailboxConnections();
      this.aliases = await this.inboxService.listAliasesForConfiguration();
      await this.loadPushConfig();
    } catch (error) {
      this.notify.error({title: "Gmail inboxes", message: (error as Error).message});
    } finally {
      this.busy = false;
    }
  }

  private async loadPushConfig(): Promise<void> {
    try {
      const pushConfig = await this.inboxService.pushConfig();
      this.pushConfigured = pushConfig.configured;
      this.configuredTopicName = pushConfig.configuredTopicName;
    } catch {
      this.pushConfigured = false;
      this.configuredTopicName = null;
    }
  }

  mappedRolesCount(mailboxConnectionId: string): number {
    return this.aliases.filter(alias => alias.mailboxConnectionId === mailboxConnectionId).length;
  }

  connectionStatusTitle(mailboxConnection: InboxMailboxConnectionView): string {
    if (this.busy) {
      return "Working on this mailbox…";
    }
    switch (mailboxConnection.connectionStatus) {
      case InboxAliasConnectionStatus.CONNECTED:
        return "Mail is importing";
      case InboxAliasConnectionStatus.TOKEN_REVOKED:
        return "Authorisation expired — mail is not importing";
      case InboxAliasConnectionStatus.ERROR:
        return "Mail is not importing";
      default:
        return "Mailbox status unknown";
    }
  }

  deliverySummary(mailboxConnection: InboxMailboxConnectionView): string {
    if (mailboxConnection.syncMode === InboxSyncMode.WATCH) {
      return mailboxConnection.pubsubTopicName
        ? `Delivery: push (Pub/Sub topic ${mailboxConnection.pubsubTopicName})`
        : "Delivery: push (Pub/Sub) — topic not set; run Google Cloud setup on step 1";
    }
    return "Delivery: pull (polls Gmail about every 30 seconds)";
  }

  lastPollSummary(mailboxConnection: InboxMailboxConnectionView): string {
    if (!mailboxConnection.lastPolledAt) {
      return "Last successful sync: not yet (no successful poll recorded)";
    }
    return `Last successful sync: ${this.dateUtils.displayDateAndTime(mailboxConnection.lastPolledAt)}`;
  }

  mappedRolesSummary(mailboxConnectionId: string): string {
    const count = this.mappedRolesCount(mailboxConnectionId);
    if (count === 0) {
      return "Mapped role mailboxes: none yet — point each role's Inbound Forwarding at this Gmail account in Committee Settings";
    }
    return `Mapped role mailboxes: ${this.stringUtils.pluraliseWithCount(count, "role")}`;
  }

  friendlyErrorMessage(raw: string): string {
    if (!raw) {
      return "Last error: unknown";
    }
    if (raw.includes("externalAddress") && raw.includes("required")) {
      return "Last error: a message could not be filed because the conversation's external address was missing (fixed in a recent update — re-scan or wait for the next sync after deploy)";
    }
    if (raw.length > 220) {
      return `Last error: ${raw.slice(0, 220)}…`;
    }
    return `Last error: ${raw}`;
  }

  private connectErrorMessage(error: any): string {
    return error?.error?.error || error?.error?.message || error?.message || "Failed to connect Gmail";
  }

  async connectNewGmail(): Promise<void> {
    this.busy = true;
    try {
      const connection = await this.inboxService.createMailboxConnection();
      window.location.href = await this.inboxService.startOauth(connection.id);
    } catch (error) {
      this.notify.error({title: "Connect Gmail", message: this.connectErrorMessage(error)});
      this.busy = false;
    }
  }

  async connectGmail(connection: InboxMailboxConnectionView): Promise<void> {
    this.busy = true;
    try {
      window.location.href = await this.inboxService.startOauth(connection.id);
    } catch (error) {
      this.notify.error({title: "Connect Gmail", message: this.connectErrorMessage(error)});
      this.busy = false;
    }
  }

  async removeMailbox(connection: InboxMailboxConnectionView): Promise<void> {
    this.busy = true;
    try {
      await this.inboxService.deleteMailboxConnection(connection.id);
      await this.refresh();
      this.notify.success({title: "Gmail inbox removed", message: "The Gmail inbox was removed"});
    } catch (error) {
      this.notify.error({title: "Gmail inbox", message: (error as Error).message});
    } finally {
      this.busy = false;
    }
  }

  async accessModeChanged(mailboxConnection: InboxMailboxConnectionView, accessMode: InboxAccessMode): Promise<void> {
    this.busy = true;
    try {
      const updatedConnection = await this.inboxService.updateAccessMode(mailboxConnection.id, accessMode);
      this.mailboxConnections = this.mailboxConnections.map(connection =>
        connection.id === updatedConnection.id ? updatedConnection : connection);
      this.notify.success({title: "Inbox access", message: accessMode === InboxAccessMode.ALL_COMMITTEE_ROLES ? "Committee users can access roles mapped to this Gmail inbox" : "Only members assigned to roles mapped to this Gmail inbox can access them"});
    } catch (error) {
      await this.refresh();
      this.notify.error({title: "Inbox access", message: (error as Error).message});
    } finally {
      this.busy = false;
    }
  }

  async rescanGeneralMailbox(mailboxConnection: InboxMailboxConnectionView): Promise<void> {
    this.busy = true;
    try {
      const result = await this.inboxService.rescanGeneralMailbox(mailboxConnection.id);
      this.mailboxConnections = this.mailboxConnections.map(connection =>
        connection.id === result.connection.id ? result.connection : connection);
      const countLabel = result.importedCount === 0
        ? "No missing messages were found."
        : `${this.stringUtils.pluraliseWithCount(result.importedCount, "missing message")} imported.`;
      this.notify.success({
        title: "Re-scan general mailbox",
        message: `${countLabel} Existing conversations and read state were left unchanged.${result.pollError ? ` Sync warning: ${result.pollError}` : ""}`
      });
    } catch (error) {
      this.notify.error({title: "Re-scan general mailbox", message: (error as Error).message});
    } finally {
      this.busy = false;
    }
  }

  async importAllChanged(mailboxConnection: InboxMailboxConnectionView, importAllMessages: boolean): Promise<void> {
    this.busy = true;
    try {
      const result = await this.inboxService.updateImportAllMessages(mailboxConnection.id, importAllMessages);
      this.mailboxConnections = this.mailboxConnections.map(connection =>
        connection.id === result.connection.id ? result.connection : connection);
      if (importAllMessages) {
        const countLabel = result.importedCount === 0
          ? "No new messages were found in this Gmail inbox."
          : `${this.stringUtils.pluraliseWithCount(result.importedCount, "new message")} imported from this Gmail inbox.`;
        this.notify.success({title: "Inbox visibility", message: `Every new message in this Gmail inbox will appear in NGX. Non-role messages appear under a "general" mailbox visible to member administrators. ${countLabel}${result.pollError ? ` Sync warning: ${result.pollError}` : ""}`});
      } else {
        this.notify.success({title: "Inbox visibility", message: "Only messages addressed to a committee role mailbox will be imported from this Gmail inbox"});
      }
    } catch (error) {
      await this.refresh();
      this.notify.error({title: "Inbox visibility", message: (error as Error).message});
    } finally {
      this.busy = false;
    }
  }

  private async resolvePushTopicName(mailboxConnection: InboxMailboxConnectionView): Promise<string | null> {
    await this.loadPushConfig();
    return this.configuredTopicName?.trim() || mailboxConnection.pubsubTopicName?.trim() || null;
  }

  async syncModeChanged(mailboxConnection: InboxMailboxConnectionView, syncMode: InboxSyncMode): Promise<void> {
    if (syncMode === InboxSyncMode.WATCH) {
      const topicName = await this.resolvePushTopicName(mailboxConnection);
      if (topicName) {
        mailboxConnection.pubsubTopicName = topicName;
        await this.applySyncMode(mailboxConnection, InboxSyncMode.WATCH, topicName);
      } else {
        mailboxConnection.syncMode = InboxSyncMode.POLL;
        this.notify.warning({title: "Inbox delivery", message: "Set up the Pub/Sub topic on step 1 (Run Google Cloud setup) before switching this mailbox to push."});
      }
      return;
    }
    await this.applySyncMode(mailboxConnection, InboxSyncMode.POLL, null);
  }

  private async applySyncMode(mailboxConnection: InboxMailboxConnectionView, syncMode: InboxSyncMode, pubsubTopicName: string | null): Promise<void> {
    this.busy = true;
    try {
      const updatedConnection = await this.inboxService.updateSyncMode(mailboxConnection.id, syncMode, pubsubTopicName);
      this.mailboxConnections = this.mailboxConnections.map(connection =>
        connection.id === updatedConnection.id ? updatedConnection : connection);
      await this.loadPushConfig();
      this.notify.success({title: "Inbox delivery", message: syncMode === InboxSyncMode.WATCH ? "This mailbox now receives mail in real time via Pub/Sub push" : "This mailbox is polled every 30 seconds"});
    } catch (error) {
      this.notify.error({title: "Inbox delivery", message: this.syncModeErrorMessage(error, syncMode, pubsubTopicName)});
      await this.refresh();
    } finally {
      this.busy = false;
    }
  }

  private syncModeErrorMessage(error: unknown, syncMode: InboxSyncMode, pubsubTopicName: string | null): string {
    const serverMessage = this.stringUtils.stringify(error);
    if (syncMode === InboxSyncMode.WATCH && this.topicSetupIncomplete(serverMessage)) {
      const topic = pubsubTopicName ? ` "${pubsubTopicName}"` : "";
      return `${serverMessage}. The Pub/Sub topic${topic} must already exist and let Gmail publish to it before this mailbox can use push. On step 1 (Google Cloud project), enter your project ID and click "Run Google Cloud setup" — it creates the topic, grants gmail-api-push@system.gserviceaccount.com the Publisher role, and creates the push subscription. Then return here and Apply push.`;
    }
    return serverMessage;
  }

  private topicSetupIncomplete(message: string): boolean {
    const lower = (message ?? "").toLowerCase();
    return ["not found", "does not exist", "not authorized", "permission", "publish"].some(token => lower.includes(token));
  }
}
