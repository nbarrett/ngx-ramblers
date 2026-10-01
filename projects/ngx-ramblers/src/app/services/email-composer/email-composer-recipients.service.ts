import { inject } from "@angular/core";
import { committeeRoleEmailDiffersFromPersonal, memberHoldsCommitteeRole } from "../../functions/committee-members";
import { isNumber, kebabCase } from "es-toolkit/compat";
import { Member } from "../../models/member.model";
import { BrandingMode, ComposerExternalRecipient, RecipientAddressMode, RecipientField, RecipientMode, SendingChannel } from "../../models/email-composer.model";
import { COMPOSER_VISIBLE_RECIPIENT_CHIP_LIMIT, composerCommitteeRecipients, appendUniqueRecipients, composerEveryoneFilterToken, composerFilterToken, COMPOSER_EVERYONE_FILTER_EMAIL, composerListToken, composerRecipientFromMember, composerRecipientsForAddressMode, composerRecipientIsExpandableSet, syncedRecipientAddressMode } from "../../functions/email-composer";
import { ListInfo, MemberSelection, NotificationConfig } from "../../models/mail.model";
import { MailListUpdaterService } from "../mail/mail-list-updater.service";
import { ExternalRecipient } from "../../models/external-recipient.model";
import { StoredValue } from "../../models/ui-actions";
import { Injectable } from "@angular/core";
import { EmailComposerSessionService } from "./email-composer-session.service";
import { EmailComposerRecipientSourcesService } from "./email-composer-recipient-sources.service";
import { EmailComposerRecipientResolutionService } from "./email-composer-recipient-resolution.service";
@Injectable()
export class EmailComposerRecipientsService {
    private session = inject(EmailComposerSessionService);
    pool = inject(EmailComposerRecipientSourcesService);
    resolver = inject(EmailComposerRecipientResolutionService);
    private mailListUpdaterService = inject(MailListUpdaterService);
    forcedMemberId: string | null = null;
    savedExternalRecipients: ExternalRecipient[] = [];
    newExternalSaveForReuse = true;
    replyCcSuggestion: ComposerExternalRecipient[] = [];
    recipientAddressModeTouched = false;
    userPickedRecipientMode = false;
    applyDefaultListIfNeeded(): void {
        if (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST && this.pool.members.length > 0) {
            this.session.state.preFilterKey = null;
            const unbranded = this.session.state.brandingMode === BrandingMode.UNBRANDED;
            const lists = unbranded ? this.pool.unbrandedCommitteeLists() : this.pool.nonEmptyLists();
            const selectionStillValid = this.session.state.selectedListId != null
                && lists.some(list => list.id === this.session.state.selectedListId);
            if (!selectionStillValid) {
                if (unbranded) {
                    this.session.state.selectedListId = null;
                    this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
                    this.session.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
                    this.session.state.externalRecipients = (this.session.state.externalRecipients ?? [])
                        .filter(recipient => !recipient.listId || lists.some(list => list.id === recipient.listId));
                    this.session.syncStateToUrl({
                        [StoredValue.EMAIL_TYPE]: kebabCase(RecipientMode.SELECTED_MEMBERS),
                        [StoredValue.LIST_ID]: null
                    });
                }
                else if (lists.length > 0) {
                    this.session.state.selectedListId = lists[0].id;
                    this.recipientAddressModeTouched = false;
                }
            }
            this.ensureSelectedListIsOnTo();
        }
    }
    ensureSelectedListIsOnTo(): void {
        const listId = this.session.state.recipientMode === RecipientMode.ENTIRE_LIST
            ? this.session.state.selectedListId
            : this.session.state.narrowListId;
        if (listId !== null && this.pool.members.length > 0) {
            const list = this.pool.nonEmptyLists().find(item => item.id === listId);
            if (list) {
                const unbrandedDisallowed = this.session.state.brandingMode === BrandingMode.UNBRANDED
                    && !this.pool.unbrandedCommitteeLists().some(item => item.id === list.id);
                if (unbrandedDisallowed) {
                    this.session.state.externalRecipients = (this.session.state.externalRecipients ?? []).filter(recipient => !recipient.listId
                        || this.pool.unbrandedCommitteeLists().some(item => item.id === recipient.listId));
                }
                else {
                    this.onUnbrandedToChange([composerListToken(list.id, list.name, this.pool.subscribedMemberCount(list))]);
                }
            }
        }
    }
    unbrandedCommitteeListRecipients(): ComposerExternalRecipient[] {
        if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
            return this.pool.unbrandedCommitteeLists()
                .map(list => composerListToken(list.id, list.name, this.unbrandedListDisplayCount(list)));
        }
        else {
            return [];
        }
    }
    unbrandedListDisplayCount(list: ListInfo): number {
        if (this.session.state.selectedListId === list.id && this.resolver.unbrandedListExpanded()) {
            return new Set(this.resolver.headerRecipients().map(recipient => recipient.email.toLowerCase())).size;
        }
        else {
            return this.pool.subscribedMemberCount(list);
        }
    }
    unbrandedSuggestionMembers(): Member[] {
        const listId = this.resolver.unbrandedSelectedListId();
        if (this.session.state.brandingMode === BrandingMode.UNBRANDED && listId !== null) {
            return this.pool.members.filter(member => this.mailListUpdaterService.memberSubscribed(member, listId));
        }
        else if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
            return this.pool.members;
        }
        else {
            return this.pool.candidateMembers();
        }
    }
    unbrandedSuggestionSavedRecipients(): ExternalRecipient[] {
        if (this.session.state.brandingMode !== BrandingMode.UNBRANDED || this.resolver.unbrandedSelectedListId() !== null) {
            return [];
        }
        else {
            return this.savedExternalRecipients;
        }
    }
    onUnbrandedListIdChange(listId: number | null): void {
        const list = listId === null ? null : this.pool.unbrandedCommitteeLists().find(item => item.id === listId) ?? null;
        this.selectUnbrandedCommitteeList(list);
    }
    onSendListIdChange(listId: number | null): void {
        const list = this.pool.nonEmptyLists().find(item => item.id === listId);
        if (list) {
            this.selectList(list);
        }
    }
    selectUnbrandedCommitteeList(list: ListInfo | null): void {
        if (list?.id) {
            this.session.state.recipientMode = RecipientMode.ENTIRE_LIST;
            this.session.state.selectedListId = list.id;
            this.onUnbrandedToChange([composerListToken(list.id, list.name, this.pool.subscribedMemberCount(list))]);
            this.session.syncStateToUrl({
                [StoredValue.EMAIL_TYPE]: kebabCase(RecipientMode.ENTIRE_LIST),
                [StoredValue.LIST_ID]: list.id.toString()
            });
        }
        else {
            this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
            this.session.state.selectedListId = null;
            this.onUnbrandedToChange((this.session.state.externalRecipients ?? []).filter(recipient => !recipient.listId));
            this.session.syncStateToUrl({
                [StoredValue.EMAIL_TYPE]: kebabCase(RecipientMode.SELECTED_MEMBERS),
                [StoredValue.LIST_ID]: null
            });
        }
    }
    campaignRoleAddressMembers(): Member[] {
        const listId = this.session.state.selectedListId;
        const roles = this.pool.committeeReferenceData?.committeeMembers() ?? [];
        return listId === null
            ? []
            : this.pool.members
                .filter(member => this.mailListUpdaterService.memberSubscribed(member, listId))
                .filter(member => committeeRoleEmailDiffersFromPersonal(member, roles));
    }
    narrowMembersExpanded: boolean = false;
    recipientsPanelExpanded: boolean = true;
    syncingUnbrandedRecipients = false;
    unbrandedPopulateField: RecipientField = RecipientField.TO;
    syncedNotificationBccKey: string | null = null;
    externalRecipientsSummaryLabel(): string {
        const describe = (label: string, list: ComposerExternalRecipient[]): string | null => {
            if (list.length === 0) {
                return null;
            }
            else {
                const names = list.map(recipient => recipient.name || recipient.email);
                const shown = names.slice(0, 3).join(", ");
                const remainder = names.length > 3 ? ` +${names.length - 3} more` : "";
                return `${label}: ${shown}${remainder}`;
            }
        };
        const parts = [
            describe("To", this.session.state.externalRecipients ?? []),
            describe("Cc", this.session.state.ccRecipients ?? []),
            describe("Bcc", this.session.state.bccRecipients ?? [])
        ].filter((part): part is string => part !== null);
        return parts.length > 0 ? parts.join(" · ") : "No recipients chosen yet - expand to add.";
    }
    unbrandedPopulateFieldLabel(): string {
        if (this.unbrandedPopulateField === RecipientField.TO) {
            return "To";
        }
        else if (this.unbrandedPopulateField === RecipientField.CC) {
            return "Cc";
        }
        else {
            return "Bcc";
        }
    }
    recipientSelectionSummary(): string {
        if (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST) {
            const list = this.pool.nonEmptyLists().find(item => item.id === this.session.state.selectedListId);
            if (list) {
                return `Whole list: ${this.pool.listNameAndCount(list)}. Expand to change.`;
            }
            else {
                return "No mailing list chosen. Expand to pick one.";
            }
        }
        else {
            const list = this.pool.nonEmptyLists().find(item => item.id === this.session.state.narrowListId);
            const selected = this.session.state.selectedMemberIds?.length ?? 0;
            const pool = this.pool.candidateMembers().length;
            const selectedPhrase = `${selected} of ${pool} selected`;
            const key = this.session.state.preFilterKey;
            if (key) {
                const filterLabel = this.resolver.memberSelectionChipLabel(key);
                if (list) {
                    return `${filterLabel} from ${this.pool.listNameAndCount(list)}. ${selectedPhrase}. Expand to change.`;
                }
                else {
                    return `${filterLabel}. ${selectedPhrase}. Expand to change.`;
                }
            }
            else if (list) {
                return `From ${this.pool.listNameAndCount(list)}. ${selectedPhrase}. Expand to change.`;
            }
            else {
                return `${selectedPhrase}. Expand to limit to a list.`;
            }
        }
    }
    recipientBulkSourceName(): string | null {
        if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
            return null;
        }
        else {
            const listId = this.session.state.recipientMode === RecipientMode.ENTIRE_LIST
                ? this.session.state.selectedListId
                : this.session.state.narrowListId;
            const list = this.pool.nonEmptyLists().find(item => item.id === listId);
            if (list) {
                return list.name;
            }
            else if (this.pool.candidateMembers().length > 0) {
                return "members";
            }
            else {
                return null;
            }
        }
    }
    addAllFromSelectedList(field: RecipientField, replaceExisting = false): void {
        const listId = this.session.state.recipientMode === RecipientMode.ENTIRE_LIST
            ? this.session.state.selectedListId
            : this.session.state.narrowListId;
        const list = this.pool.nonEmptyLists().find(item => item.id === listId);
        const sourceMembers = this.session.state.recipientMode === RecipientMode.ENTIRE_LIST && listId !== null
            ? this.pool.members.filter(member => this.mailListUpdaterService.memberSubscribed(member, listId))
            : this.pool.candidateMembers();
        const people = sourceMembers
            .map(member => composerRecipientFromMember(member))
            .filter((recipient): recipient is ComposerExternalRecipient => !!recipient);
        if (people.length > 0) {
            const filterIds = this.session.state.preFilterKey ? this.session.state.selectedMemberIds : [];
            const filterToken = this.filterTokenForIds(filterIds);
            const addition = filterToken
                ? [filterToken]
                : (list && (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST
                    || people.length >= COMPOSER_VISIBLE_RECIPIENT_CHIP_LIMIT)
                    ? [composerListToken(list.id, list.name, people.length)]
                    : people);
            const existingRecipients = (recipients: ComposerExternalRecipient[]) => replaceExisting
                ? []
                : recipients.filter(item => !item.listId && !item.filterKey);
            if (field === RecipientField.TO) {
                this.onUnbrandedToChange(this.mergeRecipients(existingRecipients(this.session.state.externalRecipients ?? []), addition));
            }
            else if (field === RecipientField.CC) {
                this.onUnbrandedCcChange(this.mergeRecipients(existingRecipients(this.session.state.ccRecipients ?? []), addition));
            }
            else {
                this.onUnbrandedBccChange(this.mergeRecipients(existingRecipients(this.session.state.bccRecipients ?? []), addition));
            }
        }
    }
    mergeRecipients(existing: ComposerExternalRecipient[], addition: ComposerExternalRecipient[]): ComposerExternalRecipient[] {
        const emails = new Set(existing.map(item => item.email.toLowerCase()));
        return addition.reduce((list, item) => {
            if (emails.has(item.email.toLowerCase())) {
                return list;
            }
            else {
                emails.add(item.email.toLowerCase());
                return [...list, item];
            }
        }, existing);
    }
    expandListToken(field: RecipientField, token: ComposerExternalRecipient): void {
        if (token.filterKey || token.email === COMPOSER_EVERYONE_FILTER_EMAIL) {
            if (token.filterKey) {
                this.expandedRecipientFilterKeys.add(token.filterKey);
            }
            else {
                this.expandedEveryoneSet = true;
            }
            const people = this.resolver.memberRecipientsForIds(this.session.state.selectedMemberIds);
            const replace = (list: ComposerExternalRecipient[]) => this.mergeRecipients(list.filter(item => item.email.toLowerCase() !== token.email.toLowerCase()), people);
            if (field === RecipientField.TO) {
                this.onUnbrandedToChange(replace(this.session.state.externalRecipients ?? []));
            }
            else if (field === RecipientField.CC) {
                this.onUnbrandedCcChange(replace(this.session.state.ccRecipients ?? []));
            }
            else {
                this.onUnbrandedBccChange(replace(this.session.state.bccRecipients ?? []));
            }
        }
        else if (token.listId) {
            this.expandedRecipientListIds.add(token.listId);
            const people = this.pool.members
                .filter(member => this.mailListUpdaterService.memberSubscribed(member, token.listId!) && !!(member.email || "").trim())
                .map(member => composerRecipientFromMember(member))
                .filter((recipient): recipient is ComposerExternalRecipient => !!recipient);
            const replace = (list: ComposerExternalRecipient[]) => this.mergeRecipients(list.filter(item => item.email.toLowerCase() !== token.email.toLowerCase()), people);
            if (field === RecipientField.TO) {
                this.onUnbrandedToChange(replace(this.session.state.externalRecipients ?? []));
            }
            else if (field === RecipientField.CC) {
                this.onUnbrandedCcChange(replace(this.session.state.ccRecipients ?? []));
            }
            else {
                this.onUnbrandedBccChange(replace(this.session.state.bccRecipients ?? []));
            }
            this.promoteEntireListToSpecificMembers(token.listId);
        }
    }
    promoteEntireListToSpecificMembers(listId: number): void {
        if (!(this.session.state.recipientMode !== RecipientMode.ENTIRE_LIST)) if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
            this.onUnbrandedToChange(this.expandListChipsWhenMixedWithPeople(this.session.state.externalRecipients ?? []));
        }
        else {
            this.session.state.narrowListId = listId;
            this.session.state.selectedMemberIds = this.pool.members
                .filter(member => this.mailListUpdaterService.memberSubscribed(member, listId) && !!member.id && !!(member.email || "").trim())
                .map(member => member.id as string);
            this.userPickedRecipientMode = true;
            this.setRecipientMode(RecipientMode.SELECTED_MEMBERS);
            this.session.syncStateToUrl({ [StoredValue.LIST_ID]: listId.toString() });
        }
    }
    onUnbrandedActiveFieldChange(field: RecipientField | null): void {
        if (field) {
            this.unbrandedPopulateField = field;
        }
    }
    notificationConfigBccRecipients(): ComposerExternalRecipient[] {
        if (this.session.state.brandingMode === BrandingMode.UNBRANDED || !this.session.state.notificationConfig) {
            return [];
        }
        else {
            const types = this.session.state.notificationConfig.bccRoles?.length
                ? this.session.state.notificationConfig.bccRoles
                : (this.session.state.notificationConfig.ccRoles ?? []);
            const committee = this.pool.committeeReferenceData?.committeeMembers() ?? [];
            return types.reduce<ComposerExternalRecipient[]>((list, type) => {
                const role = committee.find(member => member.type === type);
                const email = (role?.email || "").trim();
                if (!role || !email || list.some(item => item.email.toLowerCase() === email.toLowerCase())) {
                    return list;
                }
                else {
                    return [...list, {
                            email,
                            name: role.description || role.fullName || email,
                            saveForReuse: false,
                            memberId: role.memberId || undefined,
                            committeeRoleType: role.type
                        }];
                }
            }, []);
        }
    }
    remainingNotificationBccRoleTypes(): string[] {
        this.syncNotificationConfigBccIntoBcc();
        const onBcc = new Set((this.session.state.bccRecipients ?? []).map(recipient => recipient.email.toLowerCase()));
        return this.notificationConfigBccRecipients()
            .filter(recipient => onBcc.has(recipient.email.toLowerCase()) && recipient.committeeRoleType)
            .map(recipient => recipient.committeeRoleType as string);
    }
    syncNotificationConfigBccIntoBcc(): void {
        if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
            this.syncedNotificationBccKey = null;
        }
        else {
            const fromConfig = this.notificationConfigBccRecipients();
            const key = fromConfig.map(recipient => recipient.email.toLowerCase()).sort().join("|");
            if (!(key === this.syncedNotificationBccKey)) {
                const previous = new Set((this.syncedNotificationBccKey || "").split("|").filter(Boolean));
                const next = new Set(fromConfig.map(recipient => recipient.email.toLowerCase()));
                this.session.state.bccRecipients = appendUniqueRecipients((this.session.state.bccRecipients ?? []).filter(recipient => {
                    const email = recipient.email.toLowerCase();
                    return !previous.has(email) || next.has(email);
                }), fromConfig);
                this.syncedNotificationBccKey = key;
            }
        }
    }
    onUnbrandedToChange(recipients: ComposerExternalRecipient[]): void {
        const normalised = this.expandListChipsWhenMixedWithPeople(recipients);
        this.session.state.externalRecipients = normalised;
        if (normalised !== recipients && this.session.state.recipientMode === RecipientMode.ENTIRE_LIST) {
            this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
            this.session.state.selectedListId = null;
            this.session.syncStateToUrl({
                [StoredValue.EMAIL_TYPE]: kebabCase(RecipientMode.SELECTED_MEMBERS),
                [StoredValue.LIST_ID]: null
            });
        }
        this.applyChipSendAddresses();
        this.maybePromoteEntireListAfterHeaderEdit();
        this.syncUnbrandedHeadersIntoPicker();
    }
    expandListChipsWhenMixedWithPeople(recipients: ComposerExternalRecipient[]): ComposerExternalRecipient[] {
        const listChips = recipients.filter(recipient => isNumber(recipient.listId));
        const others = recipients.filter(recipient => !recipient.listId);
        if (listChips.length === 0 || others.length === 0 || this.pool.members.length === 0) {
            return recipients;
        }
        else {
            const fromLists = listChips.flatMap(token => this.pool.members
                .filter(member => this.mailListUpdaterService.memberSubscribed(member, token.listId!) && !!(member.email || "").trim())
                .map(member => composerRecipientFromMember(member))
                .filter((item): item is ComposerExternalRecipient => !!item));
            return this.mergeRecipients(fromLists, others);
        }
    }
    maybePromoteEntireListAfterHeaderEdit(): void {
        if (!(this.session.state.recipientMode !== RecipientMode.ENTIRE_LIST)) if (this.session.state.selectedListId !== null
            && (this.session.state.externalRecipients ?? []).some(recipient => !recipient.listId)) {
            this.promoteEntireListToSpecificMembers(this.session.state.selectedListId);
        }
    }
    onUnbrandedCcChange(recipients: ComposerExternalRecipient[]): void {
        const allowed = this.session.inboxReplyContext ? null : new Set(this.committeeCcEmails());
        this.session.state.ccRecipients = allowed === null
            ? recipients
            : recipients.filter(recipient => allowed.has((recipient.email || "").toLowerCase()));
        this.applyChipSendAddresses();
        this.syncUnbrandedHeadersIntoPicker();
    }
    committeeCcEmails(): string[] {
        const roles = this.pool.committeeReferenceData?.committeeMembers() ?? [];
        const roleEmails = composerCommitteeRecipients(roles).map(recipient => recipient.email.toLowerCase());
        const memberEmails = this.pool.allMembers
            .filter(member => member.committee || memberHoldsCommitteeRole(member, roles))
            .map(member => (member.email || "").toLowerCase())
            .filter(email => !!email);
        return [...new Set([...roleEmails, ...memberEmails])];
    }
    onUnbrandedBccChange(recipients: ComposerExternalRecipient[]): void {
        this.session.state.bccRecipients = recipients;
        this.applyChipSendAddresses();
        this.syncUnbrandedHeadersIntoPicker();
    }
    memberIdsOnHeaders(): string[] {
        const headers = this.resolver.expandedHeaderRecipients(this.resolver.headerRecipients());
        const roles = this.pool.committeeReferenceData?.committeeMembers() ?? [];
        return [...new Set(headers
                .map(header => this.resolver.memberMatchingHeader(header, roles)?.id)
                .filter((id): id is string => !!id))];
    }
    syncSelectedMembersToHeaders(): void {
        if (this.resolver.headerRecipients().length > 0) {
            this.session.state.selectedMemberIds = this.memberIdsOnHeaders();
        }
    }
    filterTokenForIds(ids: string[]): ComposerExternalRecipient | null {
        if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
            return null;
        }
        else {
            const key = this.session.state.preFilterKey;
            if (ids.length === 0 || ids.length < COMPOSER_VISIBLE_RECIPIENT_CHIP_LIMIT) {
                return null;
            }
            else if (key) {
                if (this.expandedRecipientFilterKeys.has(key)) {
                    return null;
                }
                else {
                    return composerFilterToken(key, this.resolver.memberSelectionChipLabel(key), ids.length);
                }
            }
            else if (this.expandedEveryoneSet) {
                return null;
            }
            else {
                return composerEveryoneFilterToken("Everyone with an email address", ids.length);
            }
        }
    }
    applyPreFilterAudienceToTo(): void {
        if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
            this.clearUnbrandedBulkRecipients();
        }
        else {
            const key = this.session.state.preFilterKey;
            const ids = this.pool.candidateMembers()
                .filter(member => (!key || this.resolver.memberMatchesPreFilter(member, key)) && !!member.id && !!(member.email || "").trim())
                .map(member => member.id as string);
            if (key) {
                this.expandedRecipientFilterKeys.delete(key);
            }
            else {
                this.expandedEveryoneSet = false;
            }
            this.onFilteredMemberIdsChange(ids);
        }
    }
    clearUnbrandedBulkRecipients(): void {
        const strip = (list: ComposerExternalRecipient[] | null): ComposerExternalRecipient[] => (list ?? []).filter(recipient => !composerRecipientIsExpandableSet(recipient));
        this.session.state.externalRecipients = strip(this.session.state.externalRecipients);
        this.session.state.ccRecipients = strip(this.session.state.ccRecipients);
        this.session.state.bccRecipients = strip(this.session.state.bccRecipients);
    }
    applyUnbrandedListToBcc(): void {
        this.pool.recomputeCandidateMembers();
        if (this.session.state.narrowListId === null) {
            this.session.state.selectedMemberIds = this.resolver.membersInHeader([
                ...(this.session.state.externalRecipients ?? []),
                ...(this.session.state.ccRecipients ?? []),
                ...(this.session.state.bccRecipients ?? [])
            ]).map(member => member.id).filter((id): id is string => !!id);
        }
        else {
            const recipients = this.pool.cachedCandidateMembers
                .map(member => composerRecipientFromMember(member))
                .filter((recipient): recipient is ComposerExternalRecipient => !!recipient);
            if (this.unbrandedPopulateField === RecipientField.TO) {
                this.session.state.externalRecipients = recipients;
            }
            else if (this.unbrandedPopulateField === RecipientField.CC) {
                this.session.state.ccRecipients = recipients;
            }
            else {
                this.session.state.bccRecipients = recipients;
            }
            this.session.state.selectedMemberIds = this.pool.cachedCandidateMembers
                .map(member => member.id)
                .filter((id): id is string => !!id);
        }
    }
    syncUnbrandedHeadersIntoPicker(): void {
        if (this.session.state.brandingMode === BrandingMode.UNBRANDED && !this.syncingUnbrandedRecipients) {
            const emails = this.resolver.headerEmailSet();
            const ids = this.pool.allMembers
                .filter(member => member.id && member.email && emails.has(member.email.toLowerCase()))
                .map(member => member.id as string);
            const unchanged = ids.length === this.session.state.selectedMemberIds.length
                && ids.every((id, index) => id === this.session.state.selectedMemberIds[index]);
            if (!unchanged) {
                this.syncingUnbrandedRecipients = true;
                this.session.state.selectedMemberIds = ids;
                this.syncingUnbrandedRecipients = false;
                this.syncRecipientAddressMode();
            }
        }
    }
    chooseMemberAudience(listId: number | null): void {
        this.setNarrowListId(listId);
        this.onPreFilterKeyChange(null);
    }
    setNarrowListId(listId: number | null): void {
        this.session.state.narrowListId = listId;
        this.expandedRecipientListIds.clear();
        this.pool.recomputeCandidateMembers();
        this.session.state.selectedMemberIds = this.session.state.selectedMemberIds.filter(id => this.pool.cachedCandidateMembers.some(member => member.id === id));
        if (this.session.state.recipientMode === RecipientMode.SELECTED_MEMBERS && listId !== null) {
            this.addAllFromSelectedList(this.unbrandedPopulateField, true);
        }
        this.session.syncStateToUrl({ [StoredValue.LIST_ID]: listId?.toString() ?? null });
    }
    expandedRecipientListIds = new Set<number>();
    expandedRecipientFilterKeys = new Set<MemberSelection>();
    expandedEveryoneSet = false;
    chooseRecipientMode(mode: RecipientMode): void {
        this.userPickedRecipientMode = true;
        this.setRecipientMode(mode);
    }
    setRecipientMode(mode: RecipientMode): void {
        this.session.state.recipientMode = mode;
        if (mode === RecipientMode.ENTIRE_LIST) {
            this.session.state.preFilterKey = null;
            this.recipientAddressModeTouched = false;
        }
        this.applyDefaultListIfNeeded();
        this.session.state.sendingChannel = this.resolver.sendingAsCampaign()
            ? SendingChannel.CAMPAIGN
            : SendingChannel.TRANSACTIONAL_BATCH;
        this.syncRecipientAddressMode();
        this.session.syncStateToUrl({
            [StoredValue.EMAIL_TYPE]: kebabCase(mode),
            [StoredValue.PRE_FILTER]: mode === RecipientMode.SELECTED_MEMBERS ? this.session.state.preFilterKey ?? null : null
        });
    }
    onSendToCommitteeRoleAddressesChange(event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.recipientAddressModeTouched = true;
        this.session.state.recipientAddressMode = checked ? RecipientAddressMode.COMMITTEE_ROLE : RecipientAddressMode.PERSONAL;
        this.applyChipSendAddresses();
    }
    syncRecipientAddressMode(): void {
        this.session.state.recipientAddressMode = syncedRecipientAddressMode({
            committeeRoleSendOffered: this.resolver.committeeRoleSendOffered(),
            preselectCommitteeRole: !this.recipientAddressModeTouched,
            current: this.session.state.recipientAddressMode
        });
        this.applyChipSendAddresses();
    }
    applyChipSendAddresses(): void {
        const roles = this.pool.committeeReferenceData?.committeeMembers() ?? [];
        const mode = this.session.state.recipientAddressMode;
        this.session.state.externalRecipients = composerRecipientsForAddressMode(this.session.state.externalRecipients, this.pool.allMembers, roles, mode);
        this.session.state.ccRecipients = composerRecipientsForAddressMode(this.session.state.ccRecipients, this.pool.allMembers, roles, mode);
        this.session.state.bccRecipients = composerRecipientsForAddressMode(this.session.state.bccRecipients, this.pool.allMembers, roles, mode);
    }
    applyReplyCcSuggestion(single?: ComposerExternalRecipient): void {
        const toApply = single ? [single] : this.replyCcSuggestion;
        const merged = toApply.reduce<ComposerExternalRecipient[]>((recipients, suggestion) => recipients.some(existing => existing.email.toLowerCase() === suggestion.email.toLowerCase())
            ? recipients
            : [...recipients, suggestion], this.session.state.ccRecipients);
        this.session.state.ccRecipients = merged;
        if (single) {
            this.replyCcSuggestion = this.replyCcSuggestion.filter(r => r.email.toLowerCase() !== single.email.toLowerCase());
        }
        else {
            this.replyCcSuggestion = [];
        }
    }
    selectList(list: ListInfo): void {
        if (this.session.state.selectedListId !== list.id) {
            this.recipientAddressModeTouched = false;
        }
        this.session.state.selectedListId = list.id;
        this.syncRecipientAddressMode();
        this.session.state.sendingChannel = this.resolver.sendingAsCampaign()
            ? SendingChannel.CAMPAIGN
            : SendingChannel.TRANSACTIONAL_BATCH;
        this.ensureSelectedListIsOnTo();
        this.session.syncStateToUrl({ [StoredValue.LIST_ID]: list.id?.toString() });
    }
    onSelectedMemberIdsChange(ids: string[]): void {
        this.session.state.selectedMemberIds = ids;
        this.syncRecipientAddressMode();
    }
    onFilteredMemberIdsChange(ids: string[]): void {
        const recipients = this.resolver.memberRecipientsForIds(ids);
        const listId = this.session.state.recipientMode === RecipientMode.ENTIRE_LIST
            ? this.session.state.selectedListId
            : this.session.state.narrowListId;
        const list = this.pool.nonEmptyLists().find(item => item.id === listId);
        const unbranded = this.session.state.brandingMode === BrandingMode.UNBRANDED;
        const listAllowed = !unbranded || (!!list && this.pool.unbrandedCommitteeLists().some(item => item.id === list.id));
        const existingHasAllowedToken = (this.session.state.externalRecipients ?? [])
            .some(recipient => !!recipient.listId && this.pool.unbrandedCommitteeLists().some(item => item.id === recipient.listId));
        const compactListSelected = listAllowed
            && this.session.state.preFilterKey === null
            && !!list
            && recipients.length >= COMPOSER_VISIBLE_RECIPIENT_CHIP_LIMIT
            && !this.expandedRecipientListIds.has(list.id);
        const filterToken = list && this.session.state.preFilterKey === null ? null : this.filterTokenForIds(ids);
        if (unbranded && !listAllowed) {
            this.session.state.selectedMemberIds = ids;
            this.syncRecipientAddressMode();
        }
        else if (unbranded && existingHasAllowedToken && !compactListSelected) {
            this.session.state.selectedMemberIds = ids;
            this.syncRecipientAddressMode();
        }
        else {
            const displayedRecipients = filterToken
                ? [filterToken]
                : (compactListSelected && list
                    ? [composerListToken(list.id, list.name, recipients.length)]
                    : recipients);
            if (this.unbrandedPopulateField === RecipientField.TO) {
                this.onUnbrandedToChange(displayedRecipients);
            }
            else if (this.unbrandedPopulateField === RecipientField.CC) {
                this.onUnbrandedCcChange(displayedRecipients);
            }
            else {
                this.onUnbrandedBccChange(displayedRecipients);
            }
            this.session.state.selectedMemberIds = ids;
            this.syncRecipientAddressMode();
        }
    }
    onPreFilterKeyChange(key: MemberSelection | null): void {
        this.session.state.preFilterKey = key;
        if (key && this.session.state.narrowListId !== null) {
            this.session.state.narrowListId = null;
            this.pool.recomputeCandidateMembers();
            this.session.syncStateToUrl({[StoredValue.LIST_ID]: null});
        }
        this.expandedRecipientFilterKeys.clear();
        this.expandedEveryoneSet = false;
        this.applyPreFilterAudienceToTo();
        this.session.syncStateToUrl({ [StoredValue.PRE_FILTER]: key ?? null });
    }
    applyRecipientDefaultsFrom(config: NotificationConfig | null): void {
        if (config) {
            if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
                this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
                this.session.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
                this.session.state.preFilterKey = null;
                this.session.state.selectedListId = null;
                this.session.state.narrowListId = null;
                this.session.state.selectedMemberIds = [];
                this.expandedRecipientFilterKeys.clear();
                this.expandedEveryoneSet = false;
                this.clearUnbrandedBulkRecipients();
            }
            else if (config.defaultMemberSelection === MemberSelection.MAILING_LIST) {
                this.session.state.recipientMode = RecipientMode.ENTIRE_LIST;
                this.session.state.sendingChannel = SendingChannel.CAMPAIGN;
                this.session.state.preFilterKey = null;
                if (isNumber(config.defaultListId)) {
                    this.session.state.selectedListId = config.defaultListId;
                }
                this.session.state.selectedMemberIds = [];
                this.applyDefaultListIfNeeded();
            }
            else {
                this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
                this.session.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
                this.session.state.preFilterKey = config.defaultMemberSelection ?? null;
                this.session.state.selectedMemberIds = [];
                this.session.state.narrowListId = null;
                this.expandedRecipientFilterKeys.clear();
                this.expandedEveryoneSet = false;
                this.applyPreFilterAudienceToTo();
            }
            this.applyForcedMemberSelection();
            this.syncRecipientAddressMode();
        }
    }
    applyForcedMemberSelection(): void {
        if (!(!this.forcedMemberId)) {
            this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
            this.session.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
            this.session.state.preFilterKey = null;
            this.session.state.selectedMemberIds = [this.forcedMemberId];
        }
    }
}
