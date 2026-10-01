import { EmailComposerSessionService } from "../../services/email-composer/email-composer-session.service";
import { EmailComposerRecipientSourcesService } from "../../services/email-composer/email-composer-recipient-sources.service";
import { ComposerSenderIdentity } from "../../models/email-composer.model";
import { inject } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { Member } from "../../models/member.model";
import { composerSenderIdentities, defaultBrandedSenderEmail } from "../../functions/email-composer";
import { ComposerRoleDefaults } from "../../models/mail.model";
import { MemberService } from "../../services/member/member.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { committeeMailboxAddresses, CommitteeMailboxKind, CommitteeMember, roleEmailAddresses } from "../../models/committee.model";
import { Injectable } from "@angular/core";


@Injectable()
export class EmailComposerSenderService {
  logger: Logger = inject(LoggerFactory).createLogger("EmailComposer", NgxLoggerLevel.ERROR);

  session = inject(EmailComposerSessionService);

  memberLoginService = inject(MemberLoginService);

  memberService = inject(MemberService);

  recipientSources = inject(EmailComposerRecipientSourcesService);

  loggedInMemberRecord: Member | null = null;

  async loadLoggedInMemberRecord(): Promise<void> {
      try {
        const memberId = this.memberLoginService.loggedInMember()?.memberId;
        if (memberId) {
          this.loggedInMemberRecord = await this.memberService.getById(memberId);
        }
      } catch (error) {
        this.logger.error("loadLoggedInMemberRecord failed:", error);
        this.loggedInMemberRecord = null;
      }
    }

  unbrandedRoleOptions(): CommitteeMember[] {
      return (this.recipientSources.committeeReferenceData?.loggedOnRoles() ?? []).filter(role => !!role.email);
    }

  resolvedUnbrandedRole(): CommitteeMember | undefined {
      const options = this.unbrandedRoleOptions();
      if (options.length === 0) {
        return undefined;
      } else {
        const chosen = options.find(role => role.type === this.session.state.unbrandedSenderRoleType);
        return chosen ?? options[0];
      }
    }

  onUnbrandedSenderRoleChange(roleType: string): void {
      this.session.state.unbrandedSenderRoleType = roleType || null;
      this.session.state.unbrandedSenderEmail = null;
    }

  unbrandedSenderAddressOptions(): string[] {
      return this.unbrandedSenderAddressChoices().map(choice => choice.email);
    }

  unbrandedSenderAddressChoices(): {
      email: string;
      label: string;
    }[] {
      const role = this.resolvedUnbrandedRole();
      if (!role) {
        return [];
      } else {
        return committeeMailboxAddresses(role).map(address => ({
          email: address.email,
          label: this.unbrandedSenderAddressLabel(role, address.kind, address.email)
        }));
      }
    }

  unbrandedSenderAddressLabel(role: CommitteeMember, kind: CommitteeMailboxKind, email: string): string {
      const name = kind === CommitteeMailboxKind.ROLE_NAME
        ? (role.description || role.fullName || email)
        : (role.fullName || role.description || email);
      return `${name} <${email}>`;
    }

  onUnbrandedSenderEmailChange(email: string): void {
      this.session.state.unbrandedSenderEmail = email || null;
    }

  resolvedUnbrandedSenderEmail(): string {
      const role = this.resolvedUnbrandedRole();
      if (!role?.email) {
        return "";
      } else {
        const chosen = (this.session.state.unbrandedSenderEmail ?? "").trim().toLowerCase();
        return roleEmailAddresses(role).find(address => address.toLowerCase() === chosen) ?? role.email;
      }
    }

  unbrandedSenderInfo(): {
      name: string;
      email: string;
      description: string;
    } {
      const role = this.resolvedUnbrandedRole();
      if (role?.email) {
        return {
          name: role.fullName ?? "",
          email: this.resolvedUnbrandedSenderEmail(),
          description: role.description ?? ""
        };
      } else {
        return {name: "", email: "", description: ""};
      }
    }

  brandedSenderIdentities(): ComposerSenderIdentity[] {
      const loggedIn = this.memberLoginService.loggedInMember();
      const contactName = `${loggedIn?.firstName || ""} ${loggedIn?.lastName || ""}`.trim()
        || this.loggedInMemberRecord?.displayName
        || "";
      return composerSenderIdentities({
        contactEmail: this.loggedInMemberRecord?.email ?? null,
        contactName,
        roles: this.recipientSources.committeeReferenceData?.committeeMembers() ?? [],
        memberId: loggedIn?.memberId ?? this.loggedInMemberRecord?.id ?? null,
        allCommitteeMembers: this.session.state.notificationConfig?.composerRoleDefaults === ComposerRoleDefaults.SELECT_AT_SEND
      });
    }

  resolvedBrandedSenderEmail(): string {
      return defaultBrandedSenderEmail(this.brandedSenderIdentities(), {
        chosenEmail: this.session.state.brandedSenderEmail,
        preferredRoleType: this.session.state.notificationConfig?.senderRole
      });
    }

  onBrandedSenderEmailChange(email: string): void {
      this.session.state.brandedSenderEmail = email || null;
      const identity = this.brandedSenderIdentities().find(item => item.email.toLowerCase() === (email ?? "").toLowerCase());
      if (identity?.roleType && this.session.state.notificationConfig) {
        this.session.state.notificationConfig.senderRole = identity.roleType;
      }
    }

  resolvedBrandedSenderIdentity(): ComposerSenderIdentity | null {
      const email = this.resolvedBrandedSenderEmail();
      return this.brandedSenderIdentities().find(identity => identity.email.toLowerCase() === email.toLowerCase()) ?? null;
    }

  nameFromEmail(email: string): string {
      const localPart = email.split("@")[0] ?? "";
      if (!localPart) {
        return "";
      } else {
        const stripped = localPart.replace(/\d+$/, "");
        const tokens = stripped.split(/[._\-+]+/).filter(token => token.length > 0);
        return tokens
          .map(token => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
          .join(" ");
      }
    }
}
