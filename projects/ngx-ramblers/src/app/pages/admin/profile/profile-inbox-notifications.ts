import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEnvelope, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { InboxService } from "../../../services/inbox/inbox.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import {
  InboxAliasConfigView,
  InboxAliasRecipientView,
  InboxNotifyBaseline,
  InboxRoleNotificationSetting,
  memberNotificationSetting,
  ProfileAssignedRoleMailbox
} from "../../../models/inbox.model";
import { InboxNotifyModePicker } from "../../../shared/components/inbox-notify-mode-picker";
import { emailDomain } from "../../../functions/strings";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import {
  CommitteeAssignedMailboxGroup,
  CommitteeMember
} from "../../../models/committee.model";
import { committeeAssignedMailboxGroupsForMemberId, committeeRoleList } from "../../../functions/committee-members";
import { CommitteeMailboxAdminCopyComponent } from "../../../shared/components/committee-mailbox-admin-copy";
import { CommitteeRoleMailboxesComponent } from "../../../shared/components/committee-role-mailboxes";

@Component({
  selector: "app-profile-inbox-notifications",
  template: `
    @if (assignedRoleMailboxes().length > 0) {
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading">Committee emails</div>
        <div class="col-12">
          <div class="row align-items-start">
            <div class="col-sm-3 text-center">
              <fa-icon [icon]="faEnvelope" class="fa-5x admin-icon"></fa-icon>
            </div>
            <div class="col-sm-9">
              <p class="text-muted mb-0">
                Mail sent to {{ roleList() }} is handled as {{ roleAgreement() }}.
                Choose whether to be emailed when new mail arrives: no notification, your member address, or a different address.
                Use Save or Save and exit below to apply changes.
                <app-committee-mailbox-admin-copy
                  [roleType]="assignedRoleMailboxes().length === 1 ? assignedRoleMailboxes()[0].group.roleType : null"
                  showReadOnly/>
              </p>
              @for (row of assignedRoleMailboxes(); track row.role.type) {
                <div class="border-top">
                  <app-committee-role-mailboxes
                    [groups]="[row.group]"
                    [showHeading]="assignedRoleMailboxes().length > 1"/>
                  @if (myRecipient(row.alias); as recipient) {
                    <app-inbox-notify-mode-picker
                      class="d-block mt-2"
                      [recipient]="recipient"
                      [idPrefix]="'profile-notify-' + row.role.type"
                      [groupDomain]="emailDomain(row.role.email || row.group.addresses[0]?.email)"
                      memberLabel="me"/>
                    @if (otherRecipientLabels(row.alias).length > 0) {
                      <div class="mt-1">
                        Also assigned to this role: {{ otherRecipientLabels(row.alias).join(", ") }}
                      </div>
                    }
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
  imports: [FontAwesomeModule, InboxNotifyModePicker, CommitteeMailboxAdminCopyComponent, CommitteeRoleMailboxesComponent]
})
export class ProfileInboxNotificationsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("ProfileInboxNotificationsComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  private memberLoginService = inject(MemberLoginService);
  private committeeConfigService = inject(CommitteeConfigService);
  protected readonly faEnvelope = faEnvelope;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly emailDomain = emailDomain;

  public aliases: InboxAliasConfigView[] = [];
  protected saveError: string | null = null;
  private baseline = new Map<string, InboxNotifyBaseline>();
  private committeeRoles: CommitteeMember[] = [];
  private subscriptions: Subscription[] = [];

  async ngOnInit(): Promise<void> {
    this.subscriptions.push(this.committeeConfigService.committeeReferenceDataEvents().subscribe(referenceData => {
      this.committeeRoles = referenceData.committeeMembers();
    }));
    this.committeeConfigService.refreshConfig();
    await this.reload();
  }

  protected roleList(): string {
    return committeeRoleList(this.assignedRoleMailboxes().map(row => row.group));
  }

  protected roleAgreement(): string {
    return this.assignedRoleMailboxes().length === 1 ? "that committee role" : "those committee roles";
  }

  protected assignedRoleMailboxes(): ProfileAssignedRoleMailbox[] {
    return committeeAssignedMailboxGroupsForMemberId(this.committeeRoles, this.myMemberId())
      .map(group => {
        const role = this.committeeRoles.find(item => item.type === group.roleType) ?? null;
        return {
          role,
          alias: this.aliases.find(item => item.roleType === group.roleType) ?? null,
          group
        };
      })
      .filter((row): row is ProfileAssignedRoleMailbox => Boolean(row.role));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private myMemberId(): string | null {
    return this.memberLoginService.loggedInMember()?.memberId ?? null;
  }

  myRecipient(alias: InboxAliasConfigView | null): InboxAliasRecipientView | null {
    const memberId = this.myMemberId();
    return alias && memberId
      ? alias.recipients.find(recipient => recipient.memberId === memberId) ?? null
      : null;
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
