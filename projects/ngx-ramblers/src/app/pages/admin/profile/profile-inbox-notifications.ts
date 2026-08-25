import { Component, inject, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faInbox, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { InboxService } from "../../../services/inbox/inbox.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import {
  InboxAliasConfigView,
  InboxAliasRecipientView,
  InboxRoleNotificationSetting,
  memberNotificationSetting
} from "../../../models/inbox.model";
import { InboxNotifyModePicker } from "../../../shared/components/inbox-notify-mode-picker";
import { emailDomain } from "../../../functions/strings";

interface InboxNotifyBaseline {
  notify: boolean;
  notificationEmail: string | null;
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
              @for (alias of aliases; track alias.id || alias.roleEmail) {
                <div class="py-2 border-top">
                  <div class="fw-semibold mb-1">{{alias.roleEmail}}</div>
                  <app-inbox-notify-mode-picker
                    [recipient]="myRecipient(alias)"
                    [idPrefix]="'profile-notify-' + alias.roleType"
                    [groupDomain]="emailDomain(alias.roleEmail)"
                    memberLabel="me"/>
                  @if (otherRecipientLabels(alias).length > 0) {
                    <div class="small text-muted mt-1">
                      Also assigned to this role: {{ otherRecipientLabels(alias).join(", ") }}
                    </div>
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
  imports: [FontAwesomeModule, InboxNotifyModePicker]
})
export class ProfileInboxNotificationsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("ProfileInboxNotificationsComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  private memberLoginService = inject(MemberLoginService);
  protected readonly faInbox = faInbox;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly emailDomain = emailDomain;

  public aliases: InboxAliasConfigView[] = [];
  protected saveError: string | null = null;
  private baseline = new Map<string, InboxNotifyBaseline>();

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private myMemberId(): string | null {
    return this.memberLoginService.loggedInMember()?.memberId ?? null;
  }

  myRecipient(alias: InboxAliasConfigView): InboxAliasRecipientView | null {
    const memberId = this.myMemberId();
    return alias.recipients.find(recipient => Boolean(memberId) && recipient.memberId === memberId) ?? null;
  }

  otherRecipientLabels(alias: InboxAliasConfigView): string[] {
    const memberId = this.myMemberId();
    return alias.recipients
      .filter(recipient => recipient.memberId !== memberId)
      .map(recipient => recipient.memberName || recipient.email)
      .filter((label): label is string => Boolean(label));
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
    }
  }

  undo(): void {
    this.aliases = this.aliases.map(alias => {
      const snapshot = this.baseline.get(alias.roleType);
      return {
        ...alias,
        recipients: alias.recipients.map(recipient => snapshot && recipient.memberId === this.myMemberId()
          ? {...recipient, notify: snapshot.notify, email: snapshot.notificationEmail}
          : recipient)
      };
    });
    this.saveError = null;
  }

  async save(): Promise<void> {
    this.saveError = null;
    const changes = this.pendingChanges();
    if (changes.length > 0) {
      try {
        await this.inboxService.setAliasNotificationsBulk(changes);
        this.captureBaseline();
      } catch (error) {
        this.logger.error("Failed to save inbox notification settings:", error);
        this.saveError = (error as Error)?.message || "Could not save the notification settings - try again.";
        throw error;
      }
    }
  }

  private pendingChanges(): InboxRoleNotificationSetting[] {
    return this.aliases
      .filter(alias => this.isDirty(alias))
      .map(alias => ({roleType: alias.roleType, mine: this.myRecipient(alias)}))
      .filter((pair): pair is { roleType: string; mine: InboxAliasRecipientView } => Boolean(pair.mine))
      .map(pair => memberNotificationSetting(pair.roleType, pair.mine));
  }

  private isDirty(alias: InboxAliasConfigView): boolean {
    const snapshot = this.baseline.get(alias.roleType);
    const mine = this.myRecipient(alias);
    if (!snapshot || !mine) {
      return Boolean(mine);
    } else {
      const currentEmail = mine.notify ? mine.email?.trim() || null : null;
      return snapshot.notify !== mine.notify || snapshot.notificationEmail !== currentEmail;
    }
  }

  private captureBaseline(): void {
    this.baseline.clear();
    this.aliases.forEach(alias => {
      const mine = this.myRecipient(alias);
      if (mine) {
        this.baseline.set(alias.roleType, {
          notify: mine.notify,
          notificationEmail: mine.email?.trim() || null
        });
      }
    });
  }
}
