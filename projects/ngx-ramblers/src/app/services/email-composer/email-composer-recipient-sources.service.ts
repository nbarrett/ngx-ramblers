import { inject } from "@angular/core";
import { isNumber } from "es-toolkit/compat";
import { Member, MemberBulkLoadDateMap } from "../../models/member.model";
import { RecipientMode } from "../../models/email-composer.model";
import { COMMITTEE_ROLE_CAMPAIGN_EXCLUSION_LIST_NAME, ListInfo, MailMessagingConfig, WorkflowAction } from "../../models/mail.model";
import { MailListUpdaterService } from "../mail/mail-list-updater.service";
import { ListSubscriberService } from "../mail/list-subscriber.service";
import { CommitteeReferenceData } from "../committee/committee-reference-data";
import { Injectable } from "@angular/core";
import { EmailComposerSessionService } from "./email-composer-session.service";
@Injectable()
export class EmailComposerRecipientSourcesService {
    private session = inject(EmailComposerSessionService);
    private mailListUpdaterService = inject(MailListUpdaterService);
    private listSubscriberService = inject(ListSubscriberService);
    mailMessagingConfig: MailMessagingConfig | null = null;
    committeeReferenceData: CommitteeReferenceData | null = null;
    members: Member[] = [];
    allMembers: Member[] = [];
    memberBulkLoadDateMap: MemberBulkLoadDateMap | null = null;
    availableLists(): ListInfo[] {
        return this.mailMessagingConfig?.brevo?.lists?.lists ?? [];
    }
    nonEmptyLists(): ListInfo[] {
        return this.availableLists()
            .filter(list => list.name !== COMMITTEE_ROLE_CAMPAIGN_EXCLUSION_LIST_NAME)
            .filter(list => this.subscribedMemberCount(list) > 0);
    }
    committeeOnlyLists(): ListInfo[] {
        return this.nonEmptyLists().filter(list => {
            const members = this.allMembers.filter(member => this.mailListUpdaterService.memberSubscribed(member, list.id));
            return members.length > 0 && members.every(member => member.committee);
        });
    }
    unbrandedCommitteeLists(): ListInfo[] {
        return this.committeeOnlyLists();
    }
    listSubscriberCount(list: ListInfo): string {
        return this.listSubscriberService.subscriberCountLabel(this.members, list.id);
    }
    listNameAndCount(list: ListInfo): string {
        return `${list.name} - ${this.listSubscriberCount(list)}`;
    }
    subscribedMemberCount(list: ListInfo): number {
        return this.listSubscriberService.subscriberCount(this.members, list.id);
    }
    cachedCandidateMembers: Member[] = [];
    cachedUnsubscribedDates: Record<string, number> = {};
    cachedNarrowListId: number | null = null;
    cachedMembersRef: Member[] = [];
    cachedReferenceListId: number | null = null;
    cachedRemovesRecipients: boolean | null = null;
    unsubscribeReferenceListId(): number | null {
        const narrowListId = this.session.state.narrowListId;
        if (isNumber(narrowListId)) {
            return narrowListId;
        }
        else {
            const defaultListId = this.session.state.notificationConfig?.defaultListId;
            return isNumber(defaultListId) ? defaultListId : null;
        }
    }
    recomputeCandidateMembers(): void {
        const narrowListId = this.session.state.narrowListId;
        const referenceListId = this.unsubscribeReferenceListId();
        const removesRecipients = this.workflowRemovesRecipients();
        const basePool = removesRecipients ? this.allMembers : this.members;
        if (narrowListId === null) {
            this.cachedCandidateMembers = basePool;
        }
        else {
            this.cachedCandidateMembers = basePool.filter(member => this.mailListUpdaterService.memberSubscribed(member, narrowListId));
        }
        this.cachedUnsubscribedDates = this.cachedCandidateMembers.reduce((dates, member) => {
            const unsubscribedAt = isNumber(referenceListId)
                ? this.mailListUpdaterService.listUnsubscribedAt(member, referenceListId)
                : this.mailListUpdaterService.fullyUnsubscribedAt(member);
            if (isNumber(unsubscribedAt) && member.id) {
                dates[member.id] = unsubscribedAt;
            }
            return dates;
        }, {} as Record<string, number>);
        this.cachedNarrowListId = narrowListId;
        this.cachedMembersRef = this.members;
        this.cachedReferenceListId = referenceListId;
        this.cachedRemovesRecipients = removesRecipients;
    }
    candidateMembers(): Member[] {
        if (this.candidateCacheStale()) {
            this.recomputeCandidateMembers();
        }
        return this.cachedCandidateMembers;
    }
    unsubscribedMemberDates(): Record<string, number> {
        if (this.candidateCacheStale()) {
            this.recomputeCandidateMembers();
        }
        return this.cachedUnsubscribedDates;
    }
    candidateCacheStale(): boolean {
        return this.cachedNarrowListId !== this.session.state.narrowListId
            || this.cachedMembersRef !== this.members
            || this.cachedReferenceListId !== this.unsubscribeReferenceListId()
            || this.cachedRemovesRecipients !== this.workflowRemovesRecipients();
    }
    configHasPostSendAction(action: WorkflowAction): boolean {
        return (this.session.state.notificationConfig?.postSendActions ?? []).includes(action);
    }
    bulkDeletionPending(): boolean {
        return this.configHasPostSendAction(WorkflowAction.BULK_DELETE_GROUP_MEMBER);
    }
    memberDisablePending(): boolean {
        return this.configHasPostSendAction(WorkflowAction.DISABLE_GROUP_MEMBER);
    }
    workflowRemovesRecipients(): boolean {
        return this.bulkDeletionPending() || this.memberDisablePending();
    }
    requiresConsent(): boolean {
        if (this.session.state.recipientMode !== RecipientMode.SELECTED_MEMBERS) {
            return false;
        }
        else {
            return this.mailMessagingConfig?.mailConfig?.respectHeadOfficeConsent !== false;
        }
    }
    respectsBlocks(): boolean {
        return this.mailMessagingConfig?.mailConfig?.respectEmailBlocks === true;
    }
}
