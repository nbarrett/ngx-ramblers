import { Component, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faInbox, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { InboxService } from "../../../services/inbox/inbox.service";
import { InboxAliasConfigView, InboxNotifyMode, InboxRoleNotificationSetting } from "../../../models/inbox.model";

interface InboxNotifyBaseline {
  inboxMessageNotifications: boolean;
  inboxNotificationEmail: string | null;
  mode: InboxNotifyMode;
}

@Component({
  selector: "app-profile-inbox-notifications",
  template: `
    @if (aliases.length > 0) {
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading">Inbox notifications</div>
        <div class="col-12">
          <div class="row align-items-start">
            <div class="col-sm-3 text-center">
              <fa-icon [icon]="faInbox" class="fa-5x admin-icon"></fa-icon>
            </div>
            <div class="col-sm-9">
              <p class="text-muted">
                For committee role addresses assigned to you, choose whether to be emailed when new mail arrives:
                no notification, your member address, or a different address. Use Save below to apply changes.
              </p>
              @for (alias of aliases; track alias.id) {
                <div class="py-2 border-top">
                  <div class="fw-semibold mb-1">{{alias.roleEmail}}</div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" [name]="'profile-notify-' + alias.roleType"
                           [id]="'profile-notify-none-' + alias.roleType"
                           [checked]="notifyMode(alias) === InboxNotifyMode.NONE"
                           (change)="setNotifyMode(alias, InboxNotifyMode.NONE)">
                    <label class="form-check-label" [for]="'profile-notify-none-' + alias.roleType">No notification</label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" [name]="'profile-notify-' + alias.roleType"
                           [id]="'profile-notify-member-' + alias.roleType"
                           [checked]="notifyMode(alias) === InboxNotifyMode.MEMBER"
                           (change)="setNotifyMode(alias, InboxNotifyMode.MEMBER)">
                    <label class="form-check-label" [for]="'profile-notify-member-' + alias.roleType">
                      Notify me@if (alias.assignedMemberEmail) { ({{alias.assignedMemberEmail}})}
                    </label>
                  </div>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" [name]="'profile-notify-' + alias.roleType"
                           [id]="'profile-notify-override-' + alias.roleType"
                           [checked]="notifyMode(alias) === InboxNotifyMode.OVERRIDE"
                           (change)="setNotifyMode(alias, InboxNotifyMode.OVERRIDE)">
                    <label class="form-check-label" [for]="'profile-notify-override-' + alias.roleType">Notify a different address</label>
                  </div>
                  @if (notifyMode(alias) === InboxNotifyMode.OVERRIDE) {
                    <input type="email" class="form-control form-control-sm mt-1" style="max-width: 22rem"
                           [id]="'profile-notify-email-' + alias.roleType"
                           placeholder="personal email"
                           [(ngModel)]="alias.inboxNotificationEmail">
                  }
                </div>
              }
              @if (saveError) {
                <div class="alert alert-warning mt-2 mb-0" role="alert">
                  <fa-icon [icon]="faTriangleExclamation" class="me-2"/>{{ saveError }}
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styleUrls: ["../admin/admin.component.sass"],
  imports: [CommonModule, FormsModule, FontAwesomeModule]
})
export class ProfileInboxNotificationsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("ProfileInboxNotificationsComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  protected readonly faInbox = faInbox;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly InboxNotifyMode = InboxNotifyMode;

  public aliases: InboxAliasConfigView[] = [];
  protected saveError: string | null = null;
  private selectedMode = new Map<string, InboxNotifyMode>();
  private baseline = new Map<string, InboxNotifyBaseline>();

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    try {
      this.aliases = await this.inboxService.listAliasesForMyAssignments();
      this.captureBaseline();
      this.saveError = null;
    } catch (error) {
      this.logger.error("Failed to load inbox notification settings:", error);
      this.aliases = [];
      this.baseline.clear();
      this.selectedMode.clear();
    }
  }

  notifyMode(alias: InboxAliasConfigView): InboxNotifyMode {
    const selected = this.selectedMode.get(alias.roleType);
    if (selected) {
      return selected;
    }
    return this.modeFromAlias(alias);
  }

  setNotifyMode(alias: InboxAliasConfigView, mode: InboxNotifyMode): void {
    this.selectedMode.set(alias.roleType, mode);
    alias.inboxMessageNotifications = mode !== InboxNotifyMode.NONE;
    if (mode === InboxNotifyMode.MEMBER || mode === InboxNotifyMode.NONE) {
      alias.inboxNotificationEmail = null;
    }
  }

  undo(): void {
    this.aliases = this.aliases.map(alias => {
      const snapshot = this.baseline.get(alias.roleType);
      if (!snapshot) {
        return alias;
      }
      return {
        ...alias,
        inboxMessageNotifications: snapshot.inboxMessageNotifications,
        inboxNotificationEmail: snapshot.inboxNotificationEmail
      };
    });
    this.selectedMode.clear();
    this.aliases.forEach(alias => {
      const snapshot = this.baseline.get(alias.roleType);
      if (snapshot) {
        this.selectedMode.set(alias.roleType, snapshot.mode);
      }
    });
    this.saveError = null;
  }

  async save(): Promise<void> {
    this.saveError = null;
    const changes = this.pendingChanges();
    if (changes.length === 0) {
      return;
    }
    try {
      await this.inboxService.setAliasNotificationsBulk(changes);
      this.captureBaseline();
    } catch (error) {
      this.logger.error("Failed to save inbox notification settings:", error);
      this.saveError = (error as Error)?.message || "Could not save the notification settings - try again.";
      throw error;
    }
  }

  private pendingChanges(): InboxRoleNotificationSetting[] {
    return this.aliases
      .filter(alias => this.isDirty(alias))
      .map(alias => ({
        roleType: alias.roleType,
        inboxMessageNotifications: alias.inboxMessageNotifications,
        inboxNotificationEmail: alias.inboxMessageNotifications ? (alias.inboxNotificationEmail?.trim() || null) : null
      }));
  }

  private isDirty(alias: InboxAliasConfigView): boolean {
    const snapshot = this.baseline.get(alias.roleType);
    if (!snapshot) {
      return true;
    }
    const currentEmail = alias.inboxMessageNotifications ? (alias.inboxNotificationEmail?.trim() || null) : null;
    return snapshot.inboxMessageNotifications !== alias.inboxMessageNotifications
      || snapshot.inboxNotificationEmail !== currentEmail
      || snapshot.mode !== this.notifyMode(alias);
  }

  private modeFromAlias(alias: InboxAliasConfigView): InboxNotifyMode {
    if (!alias.inboxMessageNotifications) {
      return InboxNotifyMode.NONE;
    }
    return alias.inboxNotificationEmail ? InboxNotifyMode.OVERRIDE : InboxNotifyMode.MEMBER;
  }

  private captureBaseline(): void {
    this.baseline.clear();
    this.selectedMode.clear();
    this.aliases.forEach(alias => {
      const mode = this.modeFromAlias(alias);
      this.baseline.set(alias.roleType, {
        inboxMessageNotifications: alias.inboxMessageNotifications,
        inboxNotificationEmail: alias.inboxNotificationEmail?.trim() || null,
        mode
      });
      this.selectedMode.set(alias.roleType, mode);
    });
  }
}
