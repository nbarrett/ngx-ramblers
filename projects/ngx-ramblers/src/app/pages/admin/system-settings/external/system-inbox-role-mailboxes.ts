import { Component, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { RouterLink } from "@angular/router";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { InboxService } from "../../../../services/inbox/inbox.service";
import { InboxAliasConfigView, InboxNotifyMode, isInboxGeneralRoleType } from "../../../../models/inbox.model";

@Component({
  selector: "app-system-inbox-role-mailboxes",
  standalone: true,
  template: `
    <div>
      <p class="text-muted">
        Role mailboxes appear here when a committee role's Inbound Forwarding (in <a routerLink="../committee-settings">Committee Settings</a>)
        points at one of the connected Gmail accounts. The mailbox mapping is read-only; choose whether to leave a role
        with no notification, email the assigned member at their own address, or send to a different address whenever new
        mail arrives for it.
      </p>
      @if (aliases.length === 0) {
        <div class="alert alert-warning mb-0" role="alert">
          <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
          <strong>No role mailboxes mapped yet.</strong>
          Open <a routerLink="../committee-settings">Committee Settings</a> and set each role's Inbound
          Forwarding to point at the Gmail account that should receive its mail.
        </div>
      } @else {
        <div class="d-flex align-items-end gap-3 mb-2 small fw-bold text-muted">
          <span class="role-column">Role address</span>
          <span class="mailbox-column">Receiving Gmail account</span>
          <span class="notify-column">Notify assigned member</span>
        </div>
        @for (alias of aliases; track alias.id) {
          @if (!isInboxGeneralRoleType(alias.roleType)) {
            <div class="d-flex align-items-start gap-3 py-2 border-top">
              <span class="role-column">{{alias.roleEmail}}</span>
              <span class="mailbox-column text-muted">{{alias.mailboxConnection?.gmailAccountEmail}}</span>
              <span class="notify-column">
                @if (alias.memberId) {
                  <div class="small fw-semibold mb-1">{{alias.assignedMemberName || "Assigned member"}}</div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" [name]="'notify-' + alias.roleType"
                           [id]="'notify-none-' + alias.roleType" [disabled]="busy"
                           [checked]="notifyMode(alias) === InboxNotifyMode.NONE"
                           (change)="setNotifyMode(alias, InboxNotifyMode.NONE)">
                    <label class="form-check-label small" [for]="'notify-none-' + alias.roleType">No notification</label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" [name]="'notify-' + alias.roleType"
                           [id]="'notify-member-' + alias.roleType" [disabled]="busy"
                           [checked]="notifyMode(alias) === InboxNotifyMode.MEMBER"
                           (change)="setNotifyMode(alias, InboxNotifyMode.MEMBER)">
                    <label class="form-check-label small" [for]="'notify-member-' + alias.roleType">
                      Notify {{alias.assignedMemberName || "the member"}}@if (alias.assignedMemberEmail) { ({{alias.assignedMemberEmail}})}
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" [name]="'notify-' + alias.roleType"
                           [id]="'notify-override-' + alias.roleType" [disabled]="busy"
                           [checked]="notifyMode(alias) === InboxNotifyMode.OVERRIDE"
                           (change)="setNotifyMode(alias, InboxNotifyMode.OVERRIDE)">
                    <label class="form-check-label small" [for]="'notify-override-' + alias.roleType">Notify a different address</label>
                  </div>
                  @if (notifyMode(alias) === InboxNotifyMode.OVERRIDE) {
                    <input type="email" class="form-control form-control-sm mt-1" [id]="'notify-email-' + alias.roleType"
                           placeholder="personal email"
                           [disabled]="busy"
                           [(ngModel)]="alias.inboxNotificationEmail"
                           (ngModelChange)="markDirty(alias)">
                  }
                } @else {
                  <span class="small text-muted fst-italic">No member assigned</span>
                }
              </span>
            </div>
          }
        }
        <div class="mt-3 d-flex align-items-center gap-2">
          <button class="btn btn-primary" type="button" [disabled]="busy || !hasPendingChanges()" (click)="saveAll()">
            Save notification settings
          </button>
          @if (hasPendingChanges()) {
            <span class="small text-muted">Unsaved changes</span>
          }
        </div>
      }
    </div>`,
  styles: [`
    .role-column
      flex: 1 1 0
      min-width: 160px
      word-break: break-word
    .mailbox-column
      flex: 1 1 0
      min-width: 200px
      word-break: break-word
    .notify-column
      flex: 0 0 300px
      width: 300px
  `],
  imports: [CommonModule, FormsModule, FontAwesomeModule, RouterLink]
})
export class SystemInboxRoleMailboxesComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SystemInboxRoleMailboxesComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  protected readonly isInboxGeneralRoleType = isInboxGeneralRoleType;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly InboxNotifyMode = InboxNotifyMode;

  public aliases: InboxAliasConfigView[] = [];
  public busy = false;
  private selectedMode = new Map<string, InboxNotifyMode>();
  private dirtyRoles = new Set<string>();

  async ngOnInit(): Promise<void> {
    try {
      this.aliases = await this.inboxService.listAliases();
    } catch (error) {
      this.logger.error("Failed to load role mailboxes:", error);
      this.aliases = [];
    }
  }

  notifyMode(alias: InboxAliasConfigView): InboxNotifyMode {
    const selected = this.selectedMode.get(alias.roleType);
    if (selected) {
      return selected;
    }
    if (!alias.inboxMessageNotifications) {
      return InboxNotifyMode.NONE;
    }
    return alias.inboxNotificationEmail ? InboxNotifyMode.OVERRIDE : InboxNotifyMode.MEMBER;
  }

  setNotifyMode(alias: InboxAliasConfigView, mode: InboxNotifyMode): void {
    this.selectedMode.set(alias.roleType, mode);
    alias.inboxMessageNotifications = mode !== InboxNotifyMode.NONE;
    if (mode === InboxNotifyMode.MEMBER) {
      alias.inboxNotificationEmail = null;
    }
    this.markDirty(alias);
  }

  markDirty(alias: InboxAliasConfigView): void {
    this.dirtyRoles.add(alias.roleType);
  }

  hasPendingChanges(): boolean {
    return this.dirtyRoles.size > 0;
  }

  async saveAll(): Promise<void> {
    this.busy = true;
    try {
      await Promise.all(Array.from(this.dirtyRoles).map(async roleType => {
        const alias = this.aliases.find(candidate => candidate.roleType === roleType);
        if (!alias) {
          return;
        }
        const enabled = await this.inboxService.setAliasNotifications(roleType, alias.inboxMessageNotifications);
        alias.inboxMessageNotifications = enabled.inboxMessageNotifications;
        const emailToSave = alias.inboxMessageNotifications ? (alias.inboxNotificationEmail?.trim() || null) : null;
        const saved = await this.inboxService.setAliasNotificationEmail(roleType, emailToSave);
        alias.inboxNotificationEmail = saved.inboxNotificationEmail;
      }));
      this.dirtyRoles.clear();
      this.selectedMode.clear();
    } catch (error) {
      this.logger.error("Failed to save notification settings:", error);
    } finally {
      this.busy = false;
    }
  }
}
