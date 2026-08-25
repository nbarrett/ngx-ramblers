import { Component, inject, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { RouterLink } from "@angular/router";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { InboxService } from "../../../../services/inbox/inbox.service";
import {
  InboxAliasConfigView,
  InboxAliasRecipientView,
  InboxNotifySource,
  InboxRoleNotificationSetting,
  isInboxGeneralRoleType
} from "../../../../models/inbox.model";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { RecipientMultiSelect } from "../committee/recipient-multi-select";
import { emailDomain, normaliseEmail } from "../../../../functions/strings";

@Component({
  selector: "app-system-inbox-role-mailboxes",
  template: `
    <div>
      <p class="text-muted">
        Choose who is notified when new mail arrives for each committee role address. Add any members or email addresses,
        or reuse the recipients already set up on another role. This applies however the inbox receives mail, whether
        directly via Cloudflare Email Routing or through a connected Gmail account. Roles and their assigned members are
        set in <a routerLink="../committee-settings">Committee Settings</a>; changes here save automatically.
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
          @if (showDeliveredTo) {
            <span class="mailbox-column">Delivered to</span>
          }
          <span class="notify-column">Notify</span>
        </div>
        @for (alias of aliases; track rowKey(alias)) {
          @if (!isInboxGeneralRoleType(alias.roleType)) {
            <div class="d-flex align-items-start gap-3 py-2 border-top">
              <span class="role-column">
                {{alias.roleEmail}}
                @for (additionalEmail of alias.additionalEmails; track $index) {
                  <div class="small text-muted">{{additionalEmail}}</div>
                }
              </span>
              @if (showDeliveredTo) {
                <span class="mailbox-column text-muted">{{alias.mailboxConnection?.gmailAccountEmail || "This site's inbox"}}</span>
              }
              <span class="notify-column">
                @let source = notifySource(alias);
                @let key = rowKey(alias);
                <div class="form-check">
                  <input class="form-check-input" type="radio" [name]="'notify-source-' + key"
                         [id]="'notify-source-none-' + key"
                         [value]="InboxNotifySource.NONE"
                         [ngModel]="source"
                         [ngModelOptions]="{standalone: true}"
                         (ngModelChange)="setNotifySource(alias, $event)">
                  <label class="form-check-label small" [for]="'notify-source-none-' + key">No notification</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="radio" [name]="'notify-source-' + key"
                         [id]="'notify-source-own-' + key"
                         [value]="InboxNotifySource.OWN"
                         [ngModel]="source"
                         [ngModelOptions]="{standalone: true}"
                         (ngModelChange)="setNotifySource(alias, $event)">
                  <label class="form-check-label small" [for]="'notify-source-own-' + key">Chosen members or addresses</label>
                </div>
                @if (source === InboxNotifySource.OWN) {
                  <app-recipient-multi-select class="d-block ms-4 mb-1"
                    [inputId]="'notify-' + key"
                    [recipients]="notifyEmailsFor(alias)"
                    [excludedEmails]="routingAddressList"
                    [groupDomain]="mailboxDomain()"
                    placeholder="Add people to notify"
                    (recipientsChange)="notifyRecipientsChanged(alias, $event)"/>
                }
                <div class="form-check">
                  <input class="form-check-input" type="radio" [name]="'notify-source-' + key"
                         [id]="'notify-source-role-' + key"
                         [value]="InboxNotifySource.ANOTHER_ROLE"
                         [ngModel]="source"
                         [ngModelOptions]="{standalone: true}"
                         (ngModelChange)="setNotifySource(alias, $event)">
                  <label class="form-check-label small" [for]="'notify-source-role-' + key">Same recipients as another role</label>
                </div>
                @if (source === InboxNotifySource.ANOTHER_ROLE) {
                  <select class="form-select form-select-sm ms-4 mt-1 same-role-select" [id]="'same-as-' + key"
                          [ngModel]="alias.recipientsFromRoleType"
                          (ngModelChange)="recipientsFromRoleChanged(alias, $event)">
                    <option [ngValue]="null">Choose a role…</option>
                    @for (other of otherRoles(alias); track rowKey(other)) {
                      <option [ngValue]="other.roleType">{{other.roleEmail}}</option>
                    }
                  </select>
                }
                @if (savedRoles.has(key)) {
                  <div class="small text-success mt-1">Saved</div>
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
      flex: 0 1 360px
      min-width: 300px
      overflow-wrap: anywhere
    .mailbox-column
      flex: 0 1 220px
      min-width: 160px
      overflow-wrap: anywhere
    .notify-column
      flex: 1 1 320px
      min-width: 300px
    .same-role-select
      max-width: calc(100% - 1.5rem)
  `],
  imports: [FormsModule, FontAwesomeModule, RouterLink, RecipientMultiSelect]
})
export class SystemInboxRoleMailboxesComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SystemInboxRoleMailboxesComponent", NgxLoggerLevel.ERROR);
  private inboxService = inject(InboxService);
  private committeeQueryService = inject(CommitteeQueryService);
  protected readonly isInboxGeneralRoleType = isInboxGeneralRoleType;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly InboxNotifySource = InboxNotifySource;

  public aliases: InboxAliasConfigView[] = [];
  protected savedRoles = new Set<string>();
  protected saveError: string | null = null;
  protected showDeliveredTo = false;
  protected routingAddressList: string[] = [];
  private routingAddresses = new Set<string>();
  private notifyEmailsByRoleType = new Map<string, string[]>();
  private selectedSource = new Map<string, InboxNotifySource>();
  private refreshTokenValue: number | null = null;

  @Input() set refreshToken(value: number | null) {
    const changed = this.refreshTokenValue !== null && value !== this.refreshTokenValue;
    this.refreshTokenValue = value ?? null;
    if (changed) {
      void this.reload();
    }
  }

  async ngOnInit(): Promise<void> {
    await this.committeeQueryService.queryCommitteeMembers();
    await this.reload();
  }

  private async reload(): Promise<void> {
    try {
      this.aliases = await this.inboxService.listAliasesForConfiguration();
    } catch (error) {
      this.logger.error("Failed to load role mailboxes:", error);
      this.aliases = [];
    }
    this.routingAddresses = this.aliases.reduce((addresses, alias) => {
      [alias.roleEmail, ...(alias.additionalEmails ?? []), alias.mailboxConnection?.gmailAccountEmail]
        .filter(Boolean)
        .forEach(address => addresses.add(normaliseEmail(address)));
      return addresses;
    }, new Set<string>());
    this.routingAddressList = Array.from(this.routingAddresses);
    const deliveryTargets = new Set(this.aliases
      .filter(alias => !isInboxGeneralRoleType(alias.roleType))
      .map(alias => alias.mailboxConnection?.gmailAccountEmail ?? "internal-inbox"));
    this.showDeliveredTo = deliveryTargets.size > 1;
    this.notifyEmailsByRoleType = this.aliases.reduce((map, alias) => {
      map.set(this.rowKey(alias), this.notifyEmails(alias));
      return map;
    }, new Map<string, string[]>());
    this.selectedSource.clear();
    this.saveError = null;
  }

  mailboxDomain(): string {
    const withEmail = this.aliases.find(alias => alias.roleEmail);
    return emailDomain(withEmail?.roleEmail) || "";
  }

  rowKey(alias: InboxAliasConfigView): string {
    return normaliseEmail(alias.roleEmail) || alias.roleType;
  }

  notifySource(alias: InboxAliasConfigView): InboxNotifySource {
    const override = this.selectedSource.get(this.rowKey(alias));
    if (override) {
      return override;
    } else if (alias.recipientsFromRoleType) {
      return InboxNotifySource.ANOTHER_ROLE;
    } else if (this.notifiedRecipients(alias).length > 0) {
      return InboxNotifySource.OWN;
    } else {
      return InboxNotifySource.NONE;
    }
  }

  async setNotifySource(alias: InboxAliasConfigView, source: InboxNotifySource): Promise<void> {
    this.selectedSource.set(this.rowKey(alias), source);
    if (source === InboxNotifySource.OWN && alias.recipientsFromRoleType) {
      await this.recipientsFromRoleChanged(alias, null);
    } else if (source === InboxNotifySource.NONE) {
      const changes = this.notifiedRecipients(alias).map(recipient => this.removalChange(alias, recipient));
      if (alias.recipientsFromRoleType) {
        alias.recipientsFromRoleType = null;
        changes.push(this.roleSetting(alias, {notify: false, recipientsFromRoleType: null}));
      }
      if (changes.length > 0) {
        if (await this.persistChanges(alias, changes)) {
          await this.reload();
        }
        this.selectedSource.set(this.rowKey(alias), InboxNotifySource.NONE);
      }
    }
  }

  otherRoles(alias: InboxAliasConfigView): InboxAliasConfigView[] {
    return this.aliases.filter(candidate => !isInboxGeneralRoleType(candidate.roleType)
      && candidate.roleType !== alias.roleType
      && (candidate.roleType === alias.recipientsFromRoleType
        || (!candidate.recipientsFromRoleType && this.reusableRecipients(candidate).length > 0)));
  }

  private reusableRecipients(alias: InboxAliasConfigView): InboxAliasRecipientView[] {
    return alias.recipients.filter(recipient => recipient.notify && !(alias.memberId && recipient.memberId === alias.memberId));
  }

  notifyEmailsFor(alias: InboxAliasConfigView): string[] {
    return this.notifyEmailsByRoleType.get(this.rowKey(alias)) ?? [];
  }

  private notifiedRecipients(alias: InboxAliasConfigView): InboxAliasRecipientView[] {
    return alias.recipients.filter(recipient => recipient.notify);
  }

  private notifyEmails(alias: InboxAliasConfigView): string[] {
    return this.notifiedRecipients(alias)
      .map(recipient => this.chipEmail(recipient))
      .filter((email): email is string => Boolean(email));
  }

  private chipEmail(recipient: InboxAliasRecipientView): string | null {
    return recipient.memberId ? recipient.memberEmail : recipient.email;
  }

  async recipientsFromRoleChanged(alias: InboxAliasConfigView, roleType: string | null): Promise<void> {
    alias.recipientsFromRoleType = roleType;
    await this.persistChanges(alias, [this.roleSetting(alias, {notify: false, recipientsFromRoleType: roleType})]);
  }

  async notifyRecipientsChanged(alias: InboxAliasConfigView, emails: string[]): Promise<void> {
    const wanted = (emails || []).map(normaliseEmail).filter(Boolean);
    const current = this.notifiedRecipients(alias);
    const currentEmails = current
      .map(recipient => this.chipEmail(recipient))
      .filter((email): email is string => Boolean(email))
      .map(normaliseEmail);
    const removedChanges: InboxRoleNotificationSetting[] = current
      .filter(recipient => {
        const email = this.chipEmail(recipient);
        return !email || !wanted.includes(normaliseEmail(email));
      })
      .map(recipient => this.removalChange(alias, recipient));
    const addedChanges: InboxRoleNotificationSetting[] = wanted
      .filter(email => !currentEmails.includes(email))
      .map(email => {
        const member = this.committeeQueryService.committeeMembers.find(candidate => normaliseEmail(candidate.email) === email);
        return this.roleSetting(alias, {
          memberId: member?.id ?? null,
          email: member?.id ? null : email,
          notify: true
        });
      });
    const changes = removedChanges.concat(addedChanges);
    if (changes.length > 0) {
      this.selectedSource.set(this.rowKey(alias), InboxNotifySource.OWN);
      if (await this.persistChanges(alias, changes)) {
        await this.reload();
      }
      this.selectedSource.set(this.rowKey(alias), InboxNotifySource.OWN);
    }
  }

  private roleSetting(alias: InboxAliasConfigView, rest: Partial<InboxRoleNotificationSetting>): InboxRoleNotificationSetting {
    return {
      roleType: alias.roleType,
      roleEmail: alias.roleEmail,
      memberId: rest.memberId ?? null,
      email: rest.email ?? null,
      notify: rest.notify === true,
      notificationEmail: rest.notificationEmail ?? null,
      remove: rest.remove,
      recipientsFromRoleType: rest.recipientsFromRoleType
    };
  }

  private removalChange(alias: InboxAliasConfigView, recipient: InboxAliasRecipientView): InboxRoleNotificationSetting {
    const isAssignedMember = Boolean(recipient.memberId) && recipient.memberId === alias.memberId;
    return this.roleSetting(alias, {
      memberId: recipient.memberId,
      email: recipient.memberId ? null : recipient.email,
      notify: false,
      remove: !isAssignedMember
    });
  }

  private async persistChanges(alias: InboxAliasConfigView, changes: InboxRoleNotificationSetting[]): Promise<boolean> {
    this.saveError = null;
    try {
      await this.inboxService.setAliasNotificationsBulk(changes);
      this.savedRoles.add(this.rowKey(alias));
      return true;
    } catch (error) {
      this.logger.error("Failed to save notification settings:", error);
      this.saveError = (error as Error)?.message || "Could not save the notification setting - try again.";
      return false;
    }
  }
}
