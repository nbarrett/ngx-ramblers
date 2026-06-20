import { Component, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { RouterLink } from "@angular/router";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { InboxService } from "../../../../services/inbox/inbox.service";
import { InboxAliasConfigView, isInboxGeneralRoleType } from "../../../../models/inbox.model";

@Component({
  selector: "app-system-inbox-role-mailboxes",
  standalone: true,
  template: `
    <div>
      <p class="text-muted">
        Role mailboxes appear here when a committee role's Inbound Forwarding (in <a routerLink="../committee-settings">Committee Settings</a>)
        points at one of the connected Gmail accounts. The mailbox mapping is read-only; use the notification toggle to email
        the member assigned to a role at their personal address whenever new mail arrives for it.
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
          <span class="flex-grow-1">Role address</span>
          <span class="mailbox-column">Receiving Gmail account</span>
          <span class="notify-column">Notify assigned member</span>
        </div>
        @for (alias of aliases; track alias.id) {
          @if (!isInboxGeneralRoleType(alias.roleType)) {
            <div class="d-flex align-items-center gap-3 py-1 border-top">
              <span class="flex-grow-1">{{alias.roleEmail}}</span>
              <span class="mailbox-column text-muted">{{alias.mailboxConnection?.gmailAccountEmail}}</span>
              <span class="notify-column">
                @if (alias.memberId) {
                  <div class="d-flex align-items-center gap-2">
                    <div class="form-check form-switch m-0">
                      <input type="checkbox" class="form-check-input" role="switch"
                             [id]="'notify-' + alias.roleType"
                             [disabled]="saving === alias.roleType"
                             [ngModel]="alias.inboxMessageNotifications"
                             (ngModelChange)="toggleNotifications(alias, $event)">
                    </div>
                    <span class="small text-muted text-truncate">{{alias.assignedMemberName || "Assigned member"}}</span>
                  </div>
                  @if (alias.inboxMessageNotifications) {
                    <input type="email" class="form-control form-control-sm mt-1"
                           placeholder="Notify at (personal email)"
                           [disabled]="saving === alias.roleType"
                           [(ngModel)]="alias.inboxNotificationEmail"
                           (blur)="saveNotificationEmail(alias)">
                  }
                } @else {
                  <span class="small text-muted fst-italic">No member assigned</span>
                }
              </span>
            </div>
          }
        }
      }
    </div>`,
  styles: [`
    .mailbox-column
      min-width: 200px
    .notify-column
      min-width: 240px
      max-width: 240px
  `],
  imports: [CommonModule, FormsModule, FontAwesomeModule, RouterLink]
})
export class SystemInboxRoleMailboxesComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SystemInboxRoleMailboxesComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  protected readonly isInboxGeneralRoleType = isInboxGeneralRoleType;
  protected readonly faTriangleExclamation = faTriangleExclamation;

  public aliases: InboxAliasConfigView[] = [];
  public saving: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      this.aliases = await this.inboxService.listAliases();
    } catch (error) {
      this.logger.error("Failed to load role mailboxes:", error);
      this.aliases = [];
    }
  }

  async toggleNotifications(alias: InboxAliasConfigView, enabled: boolean): Promise<void> {
    this.saving = alias.roleType;
    try {
      const updated = await this.inboxService.setAliasNotifications(alias.roleType, enabled);
      alias.inboxMessageNotifications = updated.inboxMessageNotifications;
    } catch (error) {
      this.logger.error("Failed to update role notifications:", error);
      alias.inboxMessageNotifications = !enabled;
    } finally {
      this.saving = null;
    }
  }

  async saveNotificationEmail(alias: InboxAliasConfigView): Promise<void> {
    this.saving = alias.roleType;
    try {
      const updated = await this.inboxService.setAliasNotificationEmail(alias.roleType, alias.inboxNotificationEmail?.trim() || null);
      alias.inboxNotificationEmail = updated.inboxNotificationEmail;
    } catch (error) {
      this.logger.error("Failed to update role notification email:", error);
    } finally {
      this.saving = null;
    }
  }
}
