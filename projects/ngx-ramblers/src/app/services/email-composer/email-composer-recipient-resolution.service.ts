import {inject} from "@angular/core";
import {memberHoldsCommitteeRole} from "../../functions/committee-members";
import {isNumber, values} from "es-toolkit/compat";
import {Member, MemberTerm} from "../../models/member.model";
import {BrandingMode, EmailComposerRecipientEntry, ComposerExternalRecipient, RecipientAddressMode, RecipientMode, RECIPIENT_PRE_FILTERS} from "../../models/email-composer.model";
import {COMPOSER_EVERYONE_FILTER_EMAIL, composerCampaignListId, composerCommitteeRoleSendOffered, composerRecipientFromMember, composerSelectedMembersAreCommitteeAudience, composerSendsAsCampaign, composerWholeMailingListSelected, memberIsCoveredByComposerHeaders} from "../../functions/email-composer";
import {MemberSelection} from "../../models/mail.model";
import {MailListUpdaterService} from "../mail/mail-list-updater.service";
import {MemberService} from "../member/member.service";
import {StringUtilsService} from "../string-utils.service";
import {DateUtilsService} from "../date-utils.service";
import {CommitteeMember, roleEmailAddresses} from "../../models/committee.model";
import {DateRangeUnit, NO_DATE_FILTER} from "../../models/search.model";
import {Injectable} from "@angular/core";
import {EmailComposerSessionService} from "./email-composer-session.service";
import {EmailComposerRecipientSourcesService} from "./email-composer-recipient-sources.service";

@Injectable()
export class EmailComposerRecipientResolutionService {
  private session = inject(EmailComposerSessionService);
  pool = inject(EmailComposerRecipientSourcesService);
  private mailListUpdaterService = inject(MailListUpdaterService);
  private memberService = inject(MemberService);
  protected stringUtils = inject(StringUtilsService);
  protected dateUtils = inject(DateUtilsService);

  campaignListId(): number | null {
    return composerCampaignListId({
      recipientMode: this.session.state.recipientMode,
      selectedListId: this.session.state.selectedListId,
      narrowListId: this.session.state.narrowListId
    });
  }

  wholeMailingListSelected(): boolean {
    const listId = this.campaignListId();
    const subscribedMemberIds = listId === null
      ? []
      : this.pool.members
        .filter(member => this.mailListUpdaterService.memberSubscribed(member, listId) && !!member.id && !!(member.email || "").trim())
        .map(member => member.id as string);
    return composerWholeMailingListSelected({
      listId,
      preFilterKey: this.session.state.preFilterKey,
      selectedMemberIds: this.session.state.selectedMemberIds ?? [],
      subscribedMemberIds,
      toRecipients: this.session.state.externalRecipients ?? []
    });
  }

  committeeOnlyAudience(): boolean {
    const listId = this.campaignListId();
    if (listId !== null && (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST || this.wholeMailingListSelected())) {
      return this.pool.committeeOnlyLists().some(list => list.id === listId);
    } else {
      const headers = this.expandedHeaderRecipients(this.headerRecipients());
      const members = this.recipientsForAddressMode();
      const memberChips = headers.filter(header => header.memberId && !header.committeeRoleType);
      const people = memberChips.length > 0
        ? members.filter(member => memberChips.some(chip => chip.memberId === member.id))
        : members;
      const roleChipCount = headers.filter(header => !!header.committeeRoleType).length;
      const headerCount = headers.length;
      const recipientCount = headerCount > 0 ? headerCount : people.length;
      return composerSelectedMembersAreCommitteeAudience(people, recipientCount, roleChipCount);
    }
  }

  headerRecipients(): ComposerExternalRecipient[] {
    return [
      ...(this.session.state.externalRecipients ?? []),
      ...(this.session.state.ccRecipients ?? []),
      ...(this.session.state.bccRecipients ?? [])
    ];
  }

  selectedListTokenPresent(): boolean {
    const listId = this.session.state.selectedListId;
    return listId !== null && this.headerRecipients().some(recipient => recipient.listId === listId);
  }

  unbrandedListExpanded(): boolean {
    return this.session.state.brandingMode === BrandingMode.UNBRANDED
      && this.session.state.recipientMode === RecipientMode.ENTIRE_LIST
      && this.session.state.selectedListId !== null
      && !this.selectedListTokenPresent();
  }

  unbrandedSelectedListId(): number | null {
    const to = this.session.state.externalRecipients ?? [];
    const listIds = to.map(recipient => recipient.listId).filter((listId): listId is number => isNumber(listId));
    if (to.length > 0 && listIds.length === to.length && new Set(listIds).size === 1) {
      return listIds[0];
    } else if (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST) {
      return this.session.state.selectedListId;
    } else {
      return null;
    }
  }

  cachedCommitteeAddresses: ComposerExternalRecipient[] = [];

  committeeRecipientAddresses(): ComposerExternalRecipient[] {
    return this.cachedCommitteeAddresses;
  }

  headerEmailSet(): Set<string> {
    return new Set(this.expandedHeaderRecipients([
      ...(this.session.state.externalRecipients ?? []),
      ...(this.session.state.ccRecipients ?? []),
      ...(this.session.state.bccRecipients ?? [])
    ]).map(recipient => recipient.email.toLowerCase()));
  }

  memberMatchesPreFilter(member: Member, key: MemberSelection): boolean {
    const amount = this.session.state.notificationConfig?.monthsInPast;
    const months = isNumber(amount) ? amount : 1;
    const timeUnit = this.session.state.notificationConfig?.timeUnit ?? DateRangeUnit.MONTHS;
    const noDateFilter = timeUnit === NO_DATE_FILTER;
    const windowStart = noDateFilter
      ? 0
      : this.dateUtils.dateTimeNowNoTime().minus({[timeUnit]: months} as {[unit: string]: number}).toMillis();
    if (key === MemberSelection.RECENTLY_ADDED) {
      return !!(member.groupMember && member.createdDate && (noDateFilter || member.createdDate >= windowStart));
    } else if (key === MemberSelection.EXPIRED_MEMBERS) {
      const memberStatus = member.memberStatus?.toLowerCase();
      const lifeMember = member.memberTerm === MemberTerm.LIFE;
      if (!member.groupMember || !member.membershipExpiryDate || memberStatus === "payment pending" || lifeMember) {
        return false;
      } else if (noDateFilter) {
        return member.membershipExpiryDate < this.dateUtils.dateTimeNowNoTime().toMillis();
      } else {
        const recentlyLoaded = !!member.createdDate && member.createdDate >= windowStart;
        const recentlyUpdated = !!member.updatedDate && member.updatedDate >= windowStart;
        return member.membershipExpiryDate < windowStart && !recentlyLoaded && !recentlyUpdated;
      }
    } else if (key === MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS) {
      const lastBulkLoadDate = member.membershipNumber ? this.pool.memberBulkLoadDateMap?.[member.membershipNumber] : null;
      return !!(member.groupMember && member.membershipNumber && lastBulkLoadDate && (noDateFilter || lastBulkLoadDate < windowStart));
    } else if (key === MemberSelection.ADDED_IN_LAST_BULK_LOAD_MEMBERS) {
      const dates = values(this.pool.memberBulkLoadDateMap ?? {});
      const latestBulkLoadDate = dates.length ? Math.max(...dates) : undefined;
      const memberBulkLoadDate = member.membershipNumber ? this.pool.memberBulkLoadDateMap?.[member.membershipNumber] : undefined;
      return !!(member.groupMember && member.membershipNumber && latestBulkLoadDate && memberBulkLoadDate === latestBulkLoadDate
        && member.createdDate && member.createdDate >= latestBulkLoadDate);
    } else {
      return false;
    }
  }

  memberSelectionChipLabel(key: MemberSelection): string {
    const amount = this.session.state.notificationConfig?.monthsInPast;
    const months = isNumber(amount) ? amount : 1;
    if (key === MemberSelection.RECENTLY_ADDED) {
      return `Added in last ${this.stringUtils.pluraliseWithCount(months, "month")}`;
    } else if (key === MemberSelection.EXPIRED_MEMBERS) {
      return `Expired (${this.stringUtils.pluraliseWithCount(months, "month")} past expiry)`;
    } else {
      return RECIPIENT_PRE_FILTERS.find(filter => filter.key === key)?.label ?? key;
    }
  }

  memberRecipientsForIds(ids: string[]): ComposerExternalRecipient[] {
    const idSet = new Set(ids);
    return this.pool.allMembers
      .filter(member => idSet.has(member.id ?? ""))
      .map(member => composerRecipientFromMember(member))
      .filter((recipient): recipient is ComposerExternalRecipient => !!recipient);
  }

  memberEmailsForIds(ids: string[]): string[] {
    return this.memberRecipientsForIds(ids).map(recipient => recipient.email.toLowerCase());
  }

  selectedMembersOutsideHeadersCount(): number {
    const headers = this.expandedHeaderRecipients(this.headerRecipients());
    const roles = this.pool.committeeReferenceData?.committeeMembers() ?? [];
    return (this.session.state.selectedMemberIds ?? [])
      .map(id => this.pool.allMembers.find(member => member.id === id))
      .filter((member): member is Member => !!member)
      .filter(member => !memberIsCoveredByComposerHeaders(member, headers, roles))
      .length;
  }

  committeeRoleSendOffered(): boolean {
    return composerCommitteeRoleSendOffered({
      recipients: this.headerRecipients(),
      members: this.pool.allMembers,
      roles: this.pool.committeeReferenceData?.committeeMembers() ?? [],
      committeeOnlyAudience: this.committeeOnlyAudience(),
      recipientCount: this.totalRecipientCount()
    });
  }

  allSelectedMembersHoldCommitteeRoles(): boolean {
    const members = this.recipientsForAddressMode();
    const roles = this.pool.committeeReferenceData?.committeeMembers() ?? [];
    return members.length > 0 && members.every(member => memberHoldsCommitteeRole(member, roles));
  }

  membersInHeader(list: ComposerExternalRecipient[]): Member[] {
    const expanded = this.expandedHeaderRecipients(list);
    const emails = new Set(expanded.map(recipient => recipient.email.toLowerCase()));
    const ids = new Set(expanded.map(recipient => recipient.memberId).filter((id): id is string => !!id));
    return this.pool.allMembers.filter(member =>
      (member.id && ids.has(member.id)) || (!!member.email && emails.has(member.email.toLowerCase()))
    );
  }

  useCommitteeRoleAddresses(): boolean {
    return this.committeeRoleSendOffered() && this.session.state.recipientAddressMode === RecipientAddressMode.COMMITTEE_ROLE;
  }

  recipientsForAddressMode(): Member[] {
    if (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST) {
      const listId = this.session.state.selectedListId;
      return listId === null
        ? []
        : this.pool.members.filter(member => this.mailListUpdaterService.memberSubscribed(member, listId));
    } else if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
      return this.membersInHeader([
        ...(this.session.state.externalRecipients ?? []),
        ...(this.session.state.ccRecipients ?? []),
        ...(this.session.state.bccRecipients ?? [])
      ]);
    } else {
      const ids = new Set(this.session.state.selectedMemberIds ?? []);
      return this.pool.allMembers.filter(member => ids.has(member.id));
    }
  }

  totalRecipientCount(): number {
    if (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST && !this.unbrandedListExpanded()) {
      const list = this.pool.availableLists().find(item => item.id === this.session.state.selectedListId);
      return list ? this.pool.subscribedMemberCount(list) : 0;
    } else {
      return this.uniqueSendEntries().length;
    }
  }

  uniqueSendEntries(): EmailComposerRecipientEntry[] {
    const campaignListId = this.campaignListId();
    if (this.sendingAsCampaign() && campaignListId !== null) {
      return this.pool.members
        .filter(this.memberService.filterFor.GROUP_MEMBERS)
        .filter(member => this.mailListUpdaterService.memberSubscribed(member, campaignListId))
        .map(member => ({ name: this.previewMemberName(member), member }));
    } else {
      const fromHeaders = this.uniqueEntriesFrom(this.headerRecipients());
      if (fromHeaders.length > 0) {
        return fromHeaders;
      } else {
        return (this.session.state.selectedMemberIds ?? [])
          .map(id => this.pool.allMembers.find(member => member.id === id))
          .filter((member): member is Member => !!member)
          .map(member => ({ name: this.previewMemberName(member), member }));
      }
    }
  }

  uniqueEntriesFrom(list: ComposerExternalRecipient[]): EmailComposerRecipientEntry[] {
    const headers = this.expandedHeaderRecipients(list);
    const roles = this.pool.committeeReferenceData?.committeeMembers() ?? [];
    const seenEmails = new Set<string>();
    return headers.reduce<EmailComposerRecipientEntry[]>((entries, external) => {
      const email = (external.email || "").toLowerCase();
      const member = this.memberMatchingHeader(external, roles);
      if (email && seenEmails.has(email)) {
        return entries;
      } else {
        if (email) seenEmails.add(email);
        return [...entries, {
          name: external.name?.trim() || (member ? this.previewMemberName(member) : external.email),
          member: member ?? undefined,
          external
        }];
      }
    }, []);
  }

  memberMatchingHeader(header: ComposerExternalRecipient, roles: CommitteeMember[]): Member | null {
    if (header.memberId) {
      return this.pool.allMembers.find(member => member.id === header.memberId) ?? null;
    } else {
      const email = (header.email || "").toLowerCase();
      const byPersonal = this.pool.allMembers.find(member => (member.email || "").toLowerCase() === email) ?? null;
      if (byPersonal) {
        return byPersonal;
      } else {
        const role = roles.find(candidate => roleEmailAddresses(candidate).some(address => address.toLowerCase() === email));
        return role?.memberId ? this.pool.allMembers.find(member => member.id === role.memberId) ?? null : null;
      }
    }
  }

  previewMemberName(member: Member): string {
    const fullName = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
    return fullName || member.displayName?.trim() || member.email || "";
  }

  sendingAsCampaign(): boolean {
    if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
      return false;
    } else {
      return composerSendsAsCampaign(
        this.session.state.recipientMode,
        this.session.state.brandingMode,
        this.committeeOnlyAudience(),
        this.wholeMailingListSelected()
      );
    }
  }

  expandedHeaderRecipients(list: ComposerExternalRecipient[]): ComposerExternalRecipient[] {
    return (list ?? []).flatMap(recipient => {
      if (recipient.filterKey || recipient.email === COMPOSER_EVERYONE_FILTER_EMAIL) {
        const ids = (this.session.state.selectedMemberIds ?? []).filter(Boolean);
        if (ids.length > 0) {
          return this.memberRecipientsForIds(ids);
        } else {
          return this.memberRecipientsForIds(
            this.pool.members
              .filter(member => member.id && !!(member.email || "").trim())
              .map(member => member.id as string)
          );
        }
      } else if (!recipient.listId) {
        return [recipient];
      } else {
        return this.pool.members
          .filter(member => this.mailListUpdaterService.memberSubscribed(member, recipient.listId!) && !!(member.email || "").trim())
          .map(member => composerRecipientFromMember(member))
          .filter((item): item is ComposerExternalRecipient => !!item);
      }
    });
  }
}
