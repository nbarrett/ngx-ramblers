import { Component, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
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
        points at one of the connected Gmail accounts. This view is read-only.
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
          <span>Receiving Gmail account</span>
        </div>
        @for (alias of aliases; track alias.id) {
          @if (!isInboxGeneralRoleType(alias.roleType)) {
            <div class="d-flex align-items-center gap-3 py-1 border-top">
              <span class="flex-grow-1">{{alias.roleEmail}}</span>
              <span class="text-muted">{{alias.mailboxConnection?.gmailAccountEmail}}</span>
            </div>
          }
        }
      }
    </div>`,
  imports: [CommonModule, FontAwesomeModule, RouterLink]
})
export class SystemInboxRoleMailboxesComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SystemInboxRoleMailboxesComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  protected readonly isInboxGeneralRoleType = isInboxGeneralRoleType;
  protected readonly faTriangleExclamation = faTriangleExclamation;

  public aliases: InboxAliasConfigView[] = [];

  async ngOnInit(): Promise<void> {
    try {
      this.aliases = await this.inboxService.listAliases();
    } catch (error) {
      this.logger.error("Failed to load role mailboxes:", error);
      this.aliases = [];
    }
  }
}
