import { Component, inject, Input, OnInit } from "@angular/core";
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
        Choose whether to notify the member assigned to each committee role when new mail arrives for it — no notification,
        email the member at their own address, or send to a different address. This applies however the inbox receives mail,
        whether directly via Cloudflare Email Routing or through a connected Gmail account. Roles and their assigned members
        are set in <a routerLink="../committee-settings">Committee Settings</a>; changes here save automatically.
      </p>
      @if (aliases.length === 0) {
        <div class="alert alert-warning mb-0" role="alert">
          <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
          <strong>No committee role mailboxes yet.</strong>
          Add committee roles and assign members in <a routerLink="../committee-settings">Committee Settings</a>.
        </div>
      } @else {
        <div class="d-flex align-items-end gap-3 mb-2 small fw-bold text-muted">
          <span class="role-column">Role address</span>
          <span class="mailbox-column">Delivered to</span>
          <span class="notify-column">Notify assigned member</span>
        </div>
        @for (alias of aliases; track alias.id) {
          @if (!isInboxGeneralRoleType(alias.roleType)) {
            <div class="d-flex align-items-start gap-3 py-2 border-top">
              <span class="role-column">{{alias.roleEmail}}</span>
              <span class="mailbox-column text-muted">{{alias.mailboxConnection?.gmailAccountEmail || "This site's inbox"}}</span>
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
                           (change)="persist(alias)">
                  }
                  @if (savedRoles.has(alias.roleType)) {
                    <div class="small text-success mt-1">Saved</div>
                  }
                } @else {
                  <span class="small text-muted fst-italic">No member assigned</span>
                }
              </span>
            </div>
          }
        }
        @if (saveError) {
          <div class="alert alert-warning mt-2 mb-0" role="alert">
            <fa-icon [icon]="faTriangleExclamation" class="me-2"/>{{ saveError }}
          </div>
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
  protected savedRoles = new Set<string>();
  protected saveError: string | null = null;
  private selectedMode = new Map<string, InboxNotifyMode>();
  private refreshTokenValue: number | null = null;

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
    this.savedRoles.clear();
    this.saveError = null;
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
    if (mode !== InboxNotifyMode.OVERRIDE || (alias.inboxNotificationEmail?.trim())) {
      void this.persist(alias);
    }
  }

  async persist(alias: InboxAliasConfigView): Promise<void> {
    const inboxNotificationEmail = alias.inboxMessageNotifications ? (alias.inboxNotificationEmail?.trim() || null) : null;
    this.saveError = null;
    try {
      await this.inboxService.setAliasNotificationsBulk([{roleType: alias.roleType, inboxMessageNotifications: alias.inboxMessageNotifications, inboxNotificationEmail}]);
      this.savedRoles.add(alias.roleType);
    } catch (error) {
      this.logger.error("Failed to save notification setting:", error);
      this.saveError = (error as Error)?.message || "Could not save the notification setting - try again.";
    }
  }
}
