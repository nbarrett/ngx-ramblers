import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { RouterLink } from "@angular/router";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { InboxService } from "../../../../services/inbox/inbox.service";
import { InboxAliasConfigView, InboxNotifyMode, InboxRoleNotificationSetting, isInboxGeneralRoleType } from "../../../../models/inbox.model";

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
                           [id]="'notify-none-' + alias.roleType"
                           [checked]="notifyMode(alias) === InboxNotifyMode.NONE"
                           (change)="setNotifyMode(alias, InboxNotifyMode.NONE)">
                    <label class="form-check-label small" [for]="'notify-none-' + alias.roleType">No notification</label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" [name]="'notify-' + alias.roleType"
                           [id]="'notify-member-' + alias.roleType"
                           [checked]="notifyMode(alias) === InboxNotifyMode.MEMBER"
                           (change)="setNotifyMode(alias, InboxNotifyMode.MEMBER)">
                    <label class="form-check-label small" [for]="'notify-member-' + alias.roleType">
                      Notify {{alias.assignedMemberName || "the member"}}@if (alias.assignedMemberEmail) { ({{alias.assignedMemberEmail}})}
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" [name]="'notify-' + alias.roleType"
                           [id]="'notify-override-' + alias.roleType"
                           [checked]="notifyMode(alias) === InboxNotifyMode.OVERRIDE"
                           (change)="setNotifyMode(alias, InboxNotifyMode.OVERRIDE)">
                    <label class="form-check-label small" [for]="'notify-override-' + alias.roleType">Notify a different address</label>
                  </div>
                  @if (notifyMode(alias) === InboxNotifyMode.OVERRIDE) {
                    <input type="email" class="form-control form-control-sm mt-1" [id]="'notify-email-' + alias.roleType"
                           placeholder="personal email"
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
        @if (hasPendingChanges()) {
          <div class="small text-muted mt-2">Notification changes apply when you <strong>Save</strong> below.</div>
        }
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
  private selectedMode = new Map<string, InboxNotifyMode>();
  private dirtyRoles = new Set<string>();
  private refreshTokenValue: number | null = null;

  @Output() pendingChanges = new EventEmitter<InboxRoleNotificationSetting[]>();

  @Input() set refreshToken(value: number | null) {
    const changed = this.refreshTokenValue !== null && value !== this.refreshTokenValue;
    this.refreshTokenValue = value ?? null;
    if (changed) {
      void this.reload();
    }
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    try {
      this.aliases = await this.inboxService.listAliases();
    } catch (error) {
      this.logger.error("Failed to load role mailboxes:", error);
      this.aliases = [];
    }
    this.selectedMode.clear();
    this.dirtyRoles.clear();
    this.emitPending();
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
    this.emitPending();
  }

  hasPendingChanges(): boolean {
    return this.dirtyRoles.size > 0;
  }

  private emitPending(): void {
    const changes = Array.from(this.dirtyRoles).reduce<InboxRoleNotificationSetting[]>((list, roleType) => {
      const alias = this.aliases.find(candidate => candidate.roleType === roleType);
      if (!alias) {
        return list;
      }
      const inboxNotificationEmail = alias.inboxMessageNotifications ? (alias.inboxNotificationEmail?.trim() || null) : null;
      return list.concat({roleType, inboxMessageNotifications: alias.inboxMessageNotifications, inboxNotificationEmail});
    }, []);
    this.pendingChanges.emit(changes);
  }
}
