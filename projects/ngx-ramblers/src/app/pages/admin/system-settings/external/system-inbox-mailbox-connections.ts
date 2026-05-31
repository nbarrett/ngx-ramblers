import { Component, inject, OnInit } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgxLoggerLevel } from "ngx-logger";
import { ActivatedRoute } from "@angular/router";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { InboxService } from "../../../../services/inbox/inbox.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { AlertTarget } from "../../../../models/alert-target.model";
import {
  InboxAccessMode,
  InboxAliasConfigView,
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
            <div class="d-flex align-items-end gap-3 flex-wrap">
              <div class="me-auto">
                @if (!mailboxConnection.hasRefreshToken) {
                  <span class="text-muted">Complete Google authorisation to attach this mailbox.</span>
                } @else {
                  <span class="text-muted">{{stringUtils.pluraliseWithCount(mappedRolesCount(mailboxConnection.id), "mapped role mailbox", "mapped role mailboxes")}}.</span>
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
                  @if (mailboxConnection.importAllMessages) {
                    <button class="btn btn-sm btn-quiet mt-2" type="button" (click)="rescanGeneralMailbox(mailboxConnection)" [disabled]="busy"
                            tooltip="Delete every 'general' thread for this Gmail inbox and re-import from Gmail. Use this if existing-thread matches are stopping new messages from appearing.">
                      {{ rescanPendingConfirm.has(mailboxConnection.id) ? "Click again to confirm" : "Re-scan general mailbox from scratch" }}
                    </button>
                  }
                </div>
              }
              @if (!mailboxConnection.hasRefreshToken) {
                <button class="btn btn-primary text-nowrap flex-shrink-0" type="button" (click)="connectGmail(mailboxConnection)" [disabled]="busy">
                  Connect Gmail
                </button>
              }
              <button class="btn btn-outline-danger text-nowrap flex-shrink-0" type="button" (click)="removeMailbox(mailboxConnection)" [disabled]="busy">
                Remove
              </button>
              @if (mailboxConnection.hasRefreshToken && mailboxConnection.syncMode === InboxSyncMode.WATCH) {
                <div class="w-100 mt-2">
                  <label class="form-label mb-1" [attr.for]="'inbox-topic-' + mailboxConnection.id">Pub/Sub topic name</label>
                  <div class="input-group">
                    <input [id]="'inbox-topic-' + mailboxConnection.id" type="text" class="form-control"
                           [(ngModel)]="mailboxConnection.pubsubTopicName"
                           placeholder="projects/<project>/topics/<topic>" [disabled]="busy">
                    <button class="btn btn-primary text-nowrap flex-shrink-0" type="button" (click)="applyPushMode(mailboxConnection)" [disabled]="busy">
                      Apply push
                    </button>
                  </div>
                  @if (pushUrl) {
                    <small class="text-muted d-block mt-1">Point your Pub/Sub push subscription at this URL:
                      <code>{{pushUrl}}</code></small>
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

  private logger: Logger = inject(LoggerFactory).createLogger("SystemInboxMailboxConnectionsComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  private notifierService = inject(NotifierService);
  private route = inject(ActivatedRoute);
  protected stringUtils = inject(StringUtilsService);

  protected readonly InboxAccessMode = InboxAccessMode;
  protected readonly InboxSyncMode = InboxSyncMode;

  public mailboxConnections: InboxMailboxConnectionView[] = [];
  public aliases: InboxAliasConfigView[] = [];
  public pushUrl: string | null = null;
  public pushConfigured = false;
  public busy = false;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};

  async ngOnInit(): Promise<void> {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    await this.refresh();
    this.applyOauthOutcome();
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
      this.aliases = await this.inboxService.listAliases();
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
      this.pushUrl = pushConfig.pushUrl;
      this.pushConfigured = pushConfig.configured;
    } catch {
      this.pushUrl = null;
      this.pushConfigured = false;
    }
  }

  mappedRolesCount(mailboxConnectionId: string): number {
    return this.aliases.filter(alias => alias.mailboxConnectionId === mailboxConnectionId).length;
  }

  async connectNewGmail(): Promise<void> {
    this.busy = true;
    try {
      const connection = await this.inboxService.createMailboxConnection();
      window.location.href = await this.inboxService.startOauth(connection.id);
    } catch (error) {
      this.notify.error({title: "Connect Gmail", message: (error as Error).message});
      this.busy = false;
    }
  }

  async connectGmail(connection: InboxMailboxConnectionView): Promise<void> {
    this.busy = true;
    try {
      window.location.href = await this.inboxService.startOauth(connection.id);
    } catch (error) {
      this.notify.error({title: "Connect Gmail", message: (error as Error).message});
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

  protected rescanPendingConfirm = new Set<string>();

  async rescanGeneralMailbox(mailboxConnection: InboxMailboxConnectionView): Promise<void> {
    if (!this.rescanPendingConfirm.has(mailboxConnection.id)) {
      this.rescanPendingConfirm.add(mailboxConnection.id);
      setTimeout(() => this.rescanPendingConfirm.delete(mailboxConnection.id), 5000);
      return;
    }
    this.rescanPendingConfirm.delete(mailboxConnection.id);
    this.busy = true;
    try {
      const result = await this.inboxService.rescanGeneralMailbox(mailboxConnection.id);
      this.mailboxConnections = this.mailboxConnections.map(connection =>
        connection.id === result.connection.id ? result.connection : connection);
      const countLabel = result.importedCount === 0
        ? "No new messages were imported."
        : `${this.stringUtils.pluraliseWithCount(result.importedCount, "message")} re-imported.`;
      this.notify.success({title: "Re-scan general mailbox", message: `Removed ${this.stringUtils.pluraliseWithCount(result.deletedThreads, "thread")} and ${this.stringUtils.pluraliseWithCount(result.deletedMessages, "message")}. ${countLabel}${result.pollError ? ` Sync warning: ${result.pollError}` : ""}`});
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

  async syncModeChanged(mailboxConnection: InboxMailboxConnectionView, syncMode: InboxSyncMode): Promise<void> {
    if (syncMode === InboxSyncMode.WATCH) {
      return;
    }
    await this.applySyncMode(mailboxConnection, InboxSyncMode.POLL, null);
  }

  async applyPushMode(mailboxConnection: InboxMailboxConnectionView): Promise<void> {
    if (!mailboxConnection.pubsubTopicName?.trim()) {
      this.notify.error({title: "Inbox delivery", message: "Enter the Google Cloud Pub/Sub topic name before switching this mailbox to push"});
      return;
    }
    await this.applySyncMode(mailboxConnection, InboxSyncMode.WATCH, mailboxConnection.pubsubTopicName.trim());
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
      this.notify.error({title: "Inbox delivery", message: (error as Error).message});
      await this.refresh();
    } finally {
      this.busy = false;
    }
  }
}
