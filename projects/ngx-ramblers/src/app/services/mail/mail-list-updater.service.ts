import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom } from "rxjs";
import { Member } from "../../models/member.model";
import { ApiResponse } from "../../models/api-response.model";
import { downloadBlob } from "../../functions/file-download";
import {
  APPLIED_OUTCOMES,
  ListSubscriptionChangeCount,
  ListSubscriptionExportRequest,
  ListSubscriptionImportSummary,
  ListSubscriptionOutcome,
  ListSubscriptionParseResponse,
  ListSubscriptionResult,
  ListSubscriptionRow,
  RetrospectiveApplyChange,
  RetrospectiveApplyPreview,
  SUBSCRIBED_NO,
  SUBSCRIBED_YES
} from "../../models/mail-list-subscription.model";
import { CommonDataService } from "../common-data-service";
import { DateUtilsService } from "../date-utils.service";
import { LoggerFactory } from "../logger-factory.service";
import { AlertInstance } from "../notifier.service";
import { StringUtilsService } from "../string-utils.service";
import {
  Contact,
  ContactCreatedResponse,
  ContactIdToListId,
  ContactsAddOrRemoveRequest,
  ContactsListResponse,
  ContactToMember,
  CreateContactRequest,
  CreateContactRequestWithAttributes,
  CreateContactRequestWithObjectAttributes,
  ListInfo,
  ListSetting,
  MailListAudit,
  MailMessagingConfig,
  MailSubscription,
  NumberOrString,
  StatusMappedResponseSingleInput
} from "../../models/mail.model";
import { MailService } from "./mail.service";
import { MemberService } from "../member/member.service";
import { groupBy } from "es-toolkit/compat";
import { isNumber } from "es-toolkit/compat";
import { booleanOf } from "../../functions/strings";
import { map } from "es-toolkit/compat";
import { values } from "es-toolkit/compat";
import { MailProviderStats } from "../../models/system.model";
import { cloneDeep } from "es-toolkit/compat";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MailListAuditService } from "./mail-list-audit.service";
import { AuditStatus } from "../../models/audit";
import { omit } from "es-toolkit/compat";
import { first } from "es-toolkit/compat";
import { MailMessagingService } from "./mail-messaging.service";
import { SalesforceConfigService } from "../salesforce/salesforce-config.service";
import { BroadcastService } from "../broadcast-service";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";


const AFFIRMATIVE_VALUES = ["yes", "y", "true", "1", "subscribed"];
const NEGATIVE_VALUES = ["no", "n", "false", "0", "unsubscribed"];

@Injectable({
  providedIn: "root"
})
export class MailListUpdaterService {
  private readonly SUBSCRIPTIONS_URL = "api/mail/lists/subscriptions";
  private http: HttpClient = inject(HttpClient);
  private commonDataService: CommonDataService = inject(CommonDataService);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  private performUpdates = true;
  public pendingMailListAudits: MailListAudit[] = [];
  public mailMessagingConfig: MailMessagingConfig;
  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  private mailService: MailService = inject(MailService);
  private fullNamePipe: FullNamePipe = inject(FullNamePipe);
  private memberService: MemberService = inject(MemberService);
  private salesforceConfigService: SalesforceConfigService = inject(SalesforceConfigService);
  private broadcastService: BroadcastService<any> = inject(BroadcastService);
  private mailListAuditService: MailListAuditService = inject(MailListAuditService);
  private stringUtils: StringUtilsService = inject(StringUtilsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MailListUpdaterService", NgxLoggerLevel.ERROR);


  constructor() {
    this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
    });
  }

  async updateMailLists(notify: AlertInstance, members: Member[]): Promise<any> {
    notify.setBusy();
    this.pendingMailListAudits = [];
    this.logger.info("updateMailLists:members:", members);
    if (this.mailMessagingConfig?.mailConfig?.allowSendCampaign) {
      const membersRequiringSync: Member[] = members.filter(member => this.memberRequiresBrevoSync(member));
      this.logger.info("updateMailLists:", this.stringUtils.pluraliseWithCount(membersRequiringSync.length, "member"), "with changed local data; reconciling Brevo against the NGX database");
      notify.success({
        title: "Brevo updates",
        message: "Synchronising Brevo contacts and lists"
      }, true);
      const contactsListResponse: ContactsListResponse = await this.mailService.queryContacts();
      const contactsToMembers: ContactToMember[] = contactsListResponse.contacts.map((contact) => {
        const member: Member = members.find((member) => this.matchMemberToContact(member, contact));
        return {
          contact,
          member,
          memberUpdateRequired: this.updateMemberWithContactIdentifiersRequired({contact, member}),
          listIdsToRemoveFromContact: this.listIdsToRemoveFromContact({contact, member})
        };
      });
      notify.success({title: "Brevo updates", message: "Updating Members with Brevo contact details"});
      this.logger.info("contactsListResponse", contactsListResponse, "contactsToMembers:", contactsToMembers);
      const createAllRequests: Member[] = contactsToMembers.filter(item => item.memberUpdateRequired).map((contactToMember) => {
        this.prepareUpdateOfMemberWithContactIdentifiers(contactToMember);
        return contactToMember.member;
      });
      const updatedMemberResponse = createAllRequests.length > 0 ? await this.memberService.createOrUpdateAll(createAllRequests) : [];
      this.logger.info("updatedMemberResponse fields from contact details", this.stringUtils.pluraliseWithCount(updatedMemberResponse.length, "member"), updatedMemberResponse);
      const existingMemberIds = contactsToMembers.filter(item => item.member).map(item => item.member.id);
      const createContactRequests: CreateContactRequest[] = members
        .filter(member => !existingMemberIds.includes(member.id) && this.brevoEligibleForAnyList(member))
        .map((member: Member) => this.toCreateContactRequest(member));
      this.logger.info("prepared", this.stringUtils.pluraliseWithCount(createContactRequests.length, "create contact request"), createContactRequests);

      const matchedMembers: Member[] = Array.from(new Set(contactsToMembers.filter(item => item.member).map(item => item.member)));
      const failedEmailChangeMembers: Member[] = this.performUpdates ? await this.processContactEmailChanges(matchedMembers, notify) : [];

      const updateContactRequests: CreateContactRequestWithObjectAttributes[] = contactsToMembers
        .filter((contactToMember: ContactToMember) => contactToMember.member && this.brevoEligibleForAnyList(contactToMember.member) && this.memberToContactMismatch(contactToMember))
        .map((contactToMember: ContactToMember) => this.toCreateContactRequestWithObjectAttributes(contactToMember.member));
      this.logger.info("prepared", this.stringUtils.pluraliseWithCount(updateContactRequests.length, "update contact request"), updateContactRequests);

      const deleteContactIds: NumberOrString[] = contactsToMembers
        .filter((contactToMember: ContactToMember) => (contactToMember.member && !this.brevoEligibleForAnyList(contactToMember.member)) || !contactToMember.member)
        .map((contactToMember: ContactToMember) => {
          this.logger.info("preparing to delete contact", contactToMember.contact);
          return this.toNumberOrString(contactToMember.contact);
        });
      this.logger.info("prepared", this.stringUtils.pluraliseWithCount(deleteContactIds.length, "delete contact id"), deleteContactIds, "contacts:", contactsToMembers.filter(contactsToMember => deleteContactIds.includes(contactsToMember.contact.id)));

      const contactRemoveFromListRequest = groupBy(contactsToMembers.filter((contactToMember: ContactToMember) => (contactToMember.listIdsToRemoveFromContact.length > 0))
        .map((contactToMember: ContactToMember) => contactToMember.listIdsToRemoveFromContact.map(listId => ({
          contactId: contactToMember.contact.id, listId
        }))).flat(2), "listId");
      this.logger.info("contactRemoveFromListRequest", contactRemoveFromListRequest);
      const contactRemoveRequests: ContactsAddOrRemoveRequest[] = map(contactRemoveFromListRequest, ((contactIdToListIds: ContactIdToListId[]) => ({
        ids: contactIdToListIds.map(contactIdToListId => contactIdToListId.contactId),
        listId: contactIdToListIds[0].listId
      })));
      this.logger.info("contactRemoveRequests", contactRemoveRequests);
      this.logger.info("prepared", this.stringUtils.pluraliseWithCount(contactRemoveRequests.length, "contact remove from list request"), contactRemoveRequests);
      const pendingChanges = createAllRequests.length + createContactRequests.length + updateContactRequests.length + deleteContactIds.length + contactRemoveRequests.length;
      if (pendingChanges === 0) {
        this.logger.info("updateMailLists: Brevo already matches the NGX database - no changes to apply");
        notify.success({title: "Brevo updates", message: "Brevo contacts already in sync - no changes to apply"});
        notify.clearBusy();
        return;
      }
      if (this.performUpdates) {
        await this.processCreateContactRequests(createContactRequests, members, notify);
        await this.processDeleteContactsRequests(deleteContactIds, members, notify);
        await this.processUpdateContactRequests(updateContactRequests, notify);
        await this.processContactRemoveRequests(contactRemoveRequests, notify);
        await this.processMailListAuditing();
        await this.stampBrevoSyncStateFor(membersRequiringSync.filter(member => !failedEmailChangeMembers.includes(member)));
      } else {
        this.logger.info("Not performing updates as performUpdates is false");
      }
      notify.success({
        title: "Brevo updates",
        message: "Brevo contact and list synchronisation complete" + (this.performUpdates ? "" : " (updates skipped as performUpdates is false)")
      });
      notify.clearBusy();
    } else {
      return Promise.resolve(this.notifyIntegrationNotEnabled(notify));
    }
  }

  private async processMailListAuditing() {
    this.logger.info("saving", this.pendingMailListAudits.length, "pendingMailListAudits:", this.pendingMailListAudits);
    const response = await this.mailListAuditService.createOrUpdateAll(this.pendingMailListAudits);
    this.logger.info("saved", response?.length, "pendingMailListAudits:", response);
  }

  private respectHeadOfficeConsent(): boolean {
    return booleanOf(this.mailMessagingConfig?.mailConfig?.respectHeadOfficeConsent, true);
  }

  private granularConsentEnabled(): boolean {
    return booleanOf(this.salesforceConfigService.cached()?.enableGranularConsent);
  }

  public brevoConsentWithheld(member: Member): boolean {
    if (this.granularConsentEnabled() && member?.groupMarketingConsent != null) {
      return !booleanOf(member.groupMarketingConsent);
    }
    return this.respectHeadOfficeConsent() && !booleanOf(member?.emailMarketingConsent);
  }

  private brevoEligibleListIds(member: Member): number[] {
    return this.subscribedListIds(member);
  }

  private brevoEligibleForAnyList(member: Member): boolean {
    return this.memberSubscribedToAnyList(member);
  }

  public brevoContactSignature(member: Member): string {
    const memberMergeFields = this.mailMessagingService.toMemberMergeVariables(member);
    const subscribedListIds = [...this.brevoEligibleListIds(member)].sort((left, right) => left - right);
    return JSON.stringify({
      mailEmail: this.cleanEmail(member?.mail?.email),
      email: this.cleanEmail(member?.email),
      firstName: member?.firstName ?? "",
      lastName: member?.lastName ?? "",
      memberNumber: memberMergeFields.MEMBER_NUM ?? "",
      memberExpiry: memberMergeFields.MEMBER_EXP ?? "",
      userName: memberMergeFields.USERNAME ?? "",
      consentWithheld: this.brevoConsentWithheld(member),
      subscribedListIds
    });
  }

  public memberRequiresBrevoSync(member: Member): boolean {
    return this.brevoContactSignature(member) !== member?.mail?.lastSyncedSignature;
  }

  private stampBrevoSyncState(member: Member): void {
    if (!member?.mail) {
      return;
    }
    member.mail.lastSyncedSignature = this.brevoContactSignature(member);
    member.mail.lastSyncedListIds = [...this.brevoEligibleListIds(member)].sort((left, right) => left - right);
  }

  private async stampBrevoSyncStateFor(members: Member[]): Promise<void> {
    if (members.length === 0) {
      return;
    }
    members.forEach(member => this.stampBrevoSyncState(member));
    const response = await this.memberService.createOrUpdateAll(members);
    this.logger.info("stamped Brevo sync signature on", this.stringUtils.pluraliseWithCount(members.length, "member"), response?.length, "members");
  }

  private buildListRemovalRequests(members: Member[]): ContactsAddOrRemoveRequest[] {
    const removals: ContactIdToListId[] = members
      .filter(member => isNumber(member?.mail?.id))
      .flatMap(member => {
        const eligibleListIds = this.brevoEligibleListIds(member);
        const previouslySyncedListIds = member.mail.lastSyncedListIds ?? [];
        return previouslySyncedListIds
          .filter(listId => !eligibleListIds.includes(listId))
          .map(listId => ({contactId: member.mail.id, listId}));
      });
    return values(groupBy(removals, (removal: ContactIdToListId) => removal.listId))
      .map((group: ContactIdToListId[]) => ({listId: group[0].listId, ids: group.map(removal => removal.contactId)}));
  }

  async syncChangedMembersToBrevo(notify: AlertInstance, members: Member[]): Promise<void> {
    if (!this.mailMessagingConfig?.mailConfig?.allowSendCampaign) {
      return;
    }
    this.pendingMailListAudits = [];
    const changedMembers: Member[] = members.filter(member => this.memberRequiresBrevoSync(member));
    if (changedMembers.length === 0) {
      this.logger.info("syncChangedMembersToBrevo: no members require Brevo sync");
      return;
    }
    notify.success({title: "Brevo updates", message: `Synchronising ${this.stringUtils.pluraliseWithCount(changedMembers.length, "member")} with Brevo`}, true);
    if (this.performUpdates) {
      const failedEmailChangeMembers: Member[] = await this.processContactEmailChanges(changedMembers, notify);
      const createContactRequests: CreateContactRequest[] = changedMembers
        .filter(member => !isNumber(member?.mail?.id) && this.brevoEligibleForAnyList(member))
        .map(member => this.toCreateContactRequest(member));
      const updateContactRequests: CreateContactRequestWithObjectAttributes[] = changedMembers
        .filter(member => isNumber(member?.mail?.id) && this.brevoEligibleForAnyList(member))
        .map(member => this.toCreateContactRequestWithObjectAttributes(member));
      const deletableMembers: Member[] = changedMembers
        .filter(member => isNumber(member?.mail?.id) && !this.brevoEligibleForAnyList(member));
      const deleteContactIds: NumberOrString[] = deletableMembers.map(member => member.mail.id);
      const contactRemoveRequests: ContactsAddOrRemoveRequest[] = this.buildListRemovalRequests(
        changedMembers.filter(member => !deletableMembers.includes(member)));
      await this.processCreateContactRequests(createContactRequests, members, notify);
      await this.processUpdateContactRequests(updateContactRequests, notify);
      await this.processDeleteContactsRequests(deleteContactIds, members, notify);
      await this.processContactRemoveRequests(contactRemoveRequests, notify);
      await this.processMailListAuditing();
      await this.stampBrevoSyncStateFor(changedMembers.filter(member => !failedEmailChangeMembers.includes(member)));
    }
    notify.success({title: "Brevo updates", message: "Member Brevo sync complete"});
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MAIL_SUBSCRIPTION_CHANGED, changedMembers));
  }

  private async processContactEmailChanges(changedMembers: Member[], notify: AlertInstance): Promise<Member[]> {
    const emailChangedMembers: Member[] = changedMembers.filter(member => isNumber(member?.mail?.id)
      && this.brevoEligibleForAnyList(member)
      && !!member?.email
      && this.cleanEmail(member.mail.email) !== this.cleanEmail(member.email));
    if (emailChangedMembers.length === 0) {
      return [];
    }
    notify.success({title: "Brevo updates", message: `Updating email address for ${this.stringUtils.pluraliseWithCount(emailChangedMembers.length, "changed contact")}`}, true);
    const failedMembers: Member[] = [];
    await emailChangedMembers.reduce<Promise<void>>(async (previous, member) => {
      await previous;
      const previousEmail = this.cleanEmail(member.mail.email) ?? "(not previously recorded)";
      const newEmail = this.cleanEmail(member.email);
      try {
        await this.mailService.updateContact({id: member.mail.id, email: newEmail, extId: member.id, attributes: this.toCreateContactRequestWithObjectAttributes(member).attributes});
        member.mail.email = newEmail;
        this.pendingMailListAudits.push(this.mailListAuditService.createMailListAudit(
          `Contact email updated in Brevo from ${previousEmail} to ${newEmail}`, AuditStatus.info, member.id, first(this.subscribedListIds(member))));
      } catch (error) {
        failedMembers.push(member);
        this.logger.warn("updateContactEmail failed for contact", member.mail.id, "from", previousEmail, "to", newEmail, error);
        notify.warning({
          title: "Brevo updates",
          message: `The email address change from ${previousEmail} to ${newEmail} could not be applied in Brevo - it will be retried on the next save`
        });
        this.pendingMailListAudits.push(this.mailListAuditService.createMailListAudit(
          `Contact email update in Brevo from ${previousEmail} to ${newEmail} failed: ${this.stringUtils.stringifyObject(error)}`, AuditStatus.error, member.id, first(this.subscribedListIds(member))));
      }
    }, Promise.resolve());
    return failedMembers;
  }

  public memberSubscribed(member: Member, listId: number): boolean {
    const subscriptionCount = member?.mail?.subscriptions?.filter((mailSubscription) => mailSubscription.id === listId && mailSubscription.subscribed)?.length;
    const subscribed = member?.groupMember && !!(member?.email) && subscriptionCount > 0;
    this.logger.off("memberSubscribed:member.groupMember", member?.groupMember, "email", member?.email, "name:", this.fullNamePipe.transform(member), "listId:", listId, "member:", member, "subscriptionCount:", subscriptionCount, "subscribed:", subscribed);
    return subscribed;
  }

  public memberSubscribedToAnyList(member: Member): boolean {
    const subscriptionCount = member?.mail?.subscriptions?.filter((mailSubscription) => mailSubscription.subscribed)?.length;
    const subscribed = member?.groupMember && !!(member?.email) && subscriptionCount > 0;
    this.logger.off("memberSubscribed:member.groupMember", member?.groupMember, "email", member?.email, "name:", this.fullNamePipe.transform(member), "member:", member, "subscriptionCount:", subscriptionCount, "subscribed:", subscribed);
    return subscribed;
  }

  public listUnsubscribedAt(member: Member, listId: number): number | null {
    const subscription = member?.mail?.subscriptions?.find(item => item.id === listId && !item.subscribed && isNumber(item.unsubscribedAt));
    return subscription?.unsubscribedAt ?? null;
  }

  public fullyUnsubscribedAt(member: Member): number | null {
    const subscriptions = member?.mail?.subscriptions ?? [];
    if (subscriptions.some(item => item.subscribed)) {
      return null;
    }
    const unsubscribeDates = subscriptions.filter(item => isNumber(item.unsubscribedAt)).map(item => item.unsubscribedAt);
    return unsubscribeDates.length > 0 ? Math.max(...unsubscribeDates) : null;
  }

  private async processContactRemoveRequests(contactRemoveRequests: ContactsAddOrRemoveRequest[], notify: AlertInstance) {
    notify.success({
      title: "Brevo updates",
      message: "Processing " + this.stringUtils.pluraliseWithCount(contactRemoveRequests.length, "contact remove request")
    });
    if (contactRemoveRequests.length > 0) {
      const contactAddOrRemoveResponse = await this.mailService.contactsRemoveFromList(contactRemoveRequests);
      this.logger.info("contactAddOrRemoveResponse:", contactAddOrRemoveResponse);
    }
  }

  private async processUpdateContactRequests(updateContactRequests: CreateContactRequestWithObjectAttributes[], notify: AlertInstance) {
    notify.success({
      title: "Brevo updates",
      message: "Processing " + this.stringUtils.pluraliseWithCount(updateContactRequests.length, "contact update request")
    });
    if (updateContactRequests.length > 0) {
      const updateContactResponse = await this.mailService.contactsBatchUpdate(updateContactRequests);
      this.logger.info("updateContactResponse:", updateContactResponse);
      const mailListAudits = updateContactRequests.map((contactRequest) => this.mailListAuditService.createMailListAudit(`Contact Updated in Brevo: ${this.contactDetails(contactRequest)}`, AuditStatus.info, contactRequest.extId, first(contactRequest.listIds)));
      this.pendingMailListAudits.push(...mailListAudits);
    }
  }

  private contactDetails(contactRequest: CreateContactRequest) {
    return this.stringUtils.stringifyObject(omit(contactRequest, "extId"));
  }

  private async processDeleteContactsRequests(deleteContactIds: NumberOrString[], members: Member[], notify: AlertInstance) {
    notify.success({
      title: "Brevo updates",
      message: "Processing " + this.stringUtils.pluraliseWithCount(deleteContactIds.length, "contact deletion request")
    });
    if (deleteContactIds.length > 0) {
      const deleteContactResponse: StatusMappedResponseSingleInput[] = await this.mailService.deleteContacts({ids: deleteContactIds});
      this.logger.info("deleteContactResponse:", deleteContactResponse);
      if (deleteContactResponse?.length > 0) {
        const updatedMembers = deleteContactResponse.map((contactDeleteResponse) => {
          const member = members.find((member) => member?.mail?.id === contactDeleteResponse.id);
          if (member) {
            this.pendingMailListAudits.push(this.mailListAuditService.createMailListAudit("Contact deleted from Brevo", AuditStatus.info, member.id, null));
            member.mail.id = null;
            return member;
          }
        }).filter(member => member);
        const updatedMembersResponse = updatedMembers.length > 0 ? await this.memberService.createOrUpdateAll(updatedMembers) : [];
        this.logger.info("updatedMembers from delete contact requests:", updatedMembersResponse);
      }
    }
  }

  private async processCreateContactRequests(createContactRequests: CreateContactRequest[], members: Member[], notify: AlertInstance) {
    notify.success({
      title: "Brevo updates",
      message: "Processing " + this.stringUtils.pluraliseWithCount(createContactRequests.length, "contact creation request")
    });
    if (createContactRequests.length === 0) {
      return;
    }
    try {
      const createContactResponse = await this.mailService.createContacts(createContactRequests);
      this.logger.info("createContactResponse:", createContactResponse);
      const failedCreates = (createContactResponse || []).filter(contactCreatedResponse => contactCreatedResponse && contactCreatedResponse.success === false);
      if (failedCreates.length > 0) {
        notify.error({
          title: "Brevo updates",
          message: `${this.stringUtils.pluraliseWithCount(failedCreates.length, "contact creation")} failed: ${failedCreates.map(item => {
            const responseBody: any = (item as any).responseBody;
            const contactId = item.id || responseBody?.id || "unknown";
            const errorMessage = item.message || responseBody?.message || "unknown error";
            return `${contactId} (${item.status} ${errorMessage})`;
          }).join("; ")}`
        });
        await this.handleDuplicateCreates(failedCreates, members, notify);
      }
      if (createContactResponse?.length > 0) {
        const updatedMembers = createContactResponse.map((contactCreatedResponse: ContactCreatedResponse) => {
          const member = members.find((member) => this.cleanEmail(member?.email) === this.cleanEmail(contactCreatedResponse?.id));
          if (member && contactCreatedResponse?.responseBody?.id) {
            member.mail.id = contactCreatedResponse.responseBody.id;
            member.mail.email = this.cleanEmail(member.email);
            const matchingRequest = createContactRequests.find(request => request.extId === member.id);
            const auditMessage = matchingRequest
              ? `Contact created in Brevo: ${this.contactDetails(matchingRequest)}`
              : "Contact created in Brevo";
            const auditListId = matchingRequest ? first(matchingRequest.listIds) : null;
            this.pendingMailListAudits.push(this.mailListAuditService.createMailListAudit(auditMessage, AuditStatus.info, member.id, auditListId));
            return member;
          }
        }).filter(member => member);
        const updatedMembersResponse = updatedMembers.length > 0 ? await this.memberService.createOrUpdateAll(updatedMembers) : [];
        this.logger.info("updatedMembers from create contact requests:", updatedMembersResponse);
      }
    } catch (error) {
      this.logger.warn("createContactResponse error:", error);
      const duplicateUpdates = this.fallbackDuplicateUpdates(createContactRequests, members, error);
      if (duplicateUpdates?.length) {
        notify.warning({
          title: "Brevo updates",
          message: `${this.stringUtils.pluraliseWithCount(duplicateUpdates.length, "duplicate contact")} being updated instead of created`
        });
        const updateResponse = await this.mailService.contactsBatchUpdate(duplicateUpdates);
        this.logger.info("contactsBatchUpdate after duplicate extId create failure:", updateResponse);
      } else {
        notify.error({
          title: "Error updating Brevo lists",
          message: error
        });
        throw error;
      }
    }
  }

  private fallbackDuplicateUpdates(createContactRequests: CreateContactRequest[], members: Member[], error: any): CreateContactRequestWithObjectAttributes[] {
    const errorMessage = this.stringUtils.stringifyObject(error || "").toLowerCase();
    const duplicateError = errorMessage.includes("duplicate_parameter") || errorMessage.includes("ext_id");
    if (!duplicateError) {
      return [];
    }
    return createContactRequests.map(request => {
      const member = members.find(m => m.id === request.extId || this.cleanEmail(m.email) === this.cleanEmail(request.email) || this.cleanEmail(m.mail?.email) === this.cleanEmail(request.email));
      return member ? this.toCreateContactRequestWithObjectAttributes(member) : null;
    }).filter(item => item);
  }

  private async handleDuplicateCreates(failedCreates: ContactCreatedResponse[], members: Member[], notify: AlertInstance) {
    const duplicateCreates = failedCreates.filter(item => {
      const responseBody: any = (item as any).responseBody;
      const errorMessage = (item.message || responseBody?.message || "").toString().toLowerCase();
      return errorMessage.includes("duplicate_parameter") || errorMessage.includes("ext_id");
    });
    if (duplicateCreates.length === 0) {
      return;
    }
    const updateRequests: CreateContactRequestWithObjectAttributes[] = duplicateCreates.map(item => {
      const member = members.find(m => this.cleanEmail(m.email) === this.cleanEmail(item.id as any) || this.cleanEmail(m.mail?.email) === this.cleanEmail(item.id as any) || m.id === item.id);
      return member ? this.toCreateContactRequestWithObjectAttributes(member) : null;
    }).filter(item => item);
    if (updateRequests.length > 0) {
      notify.warning({
        title: "Brevo updates",
        message: `${this.stringUtils.pluraliseWithCount(updateRequests.length, "duplicate contact")} being updated instead of created`
      });
      const updateResponse = await this.mailService.contactsBatchUpdate(updateRequests);
      this.logger.info("contactsBatchUpdate after duplicate extId create failure:", updateResponse);
    }
  }

  private matchMemberToContact(member: Member, contact: Contact): boolean {
    this.logger.off("matchMemberToContact:member", member, "contact:", contact);
    const extIdMatch = contact?.extId === member?.id;
    const match = extIdMatch || (member?.mail?.id && member?.mail?.id === contact.id) || (member?.mail?.email && this.cleanEmail(member?.mail?.email) === this.cleanEmail(contact?.email)) || (member?.email && this.cleanEmail(member.email) === this.cleanEmail(contact?.email));
    this.logger.off("matchMemberToContact:member", member, "contact:", contact, "match:", match);
    return match;
  }

  public subscribedMembers(members: Member[], listId: number): Member[] {
    return (members ?? []).filter(member => this.memberSubscribed(member, listId));
  }

  public subscriptionFor(member: Member, listId: number): MailSubscription {
    return member?.mail?.subscriptions?.find(subscription => subscription.id === listId);
  }

  public subscribedToList(member: Member, listId: number): boolean {
    return !!this.subscriptionFor(member, listId)?.subscribed;
  }

  public setSubscription(member: Member, listId: number, subscribed: boolean): void {
    if (!member.mail) {
      member.mail = {subscriptions: [], email: member.email, id: null};
    }
    if (!member.mail.subscriptions) {
      member.mail.subscriptions = [];
    }
    const existing: MailSubscription = this.subscriptionFor(member, listId);
    const wasSubscribed = !!existing?.subscribed;
    const subscription: MailSubscription = existing || this.mapIdToSubscription(listId, subscribed);
    subscription.subscribed = subscribed;
    if (subscribed) {
      subscription.unsubscribedAt = undefined;
    } else if (wasSubscribed) {
      subscription.unsubscribedAt = this.dateUtils.nowAsValue();
    }
    if (!existing) {
      member.mail.subscriptions.push(subscription);
    }
  }

  public rowsFrom(members: Member[], lists: ListInfo[]): ListSubscriptionRow[] {
    return members
      .flatMap(member => lists.map(list => ({
        email: member.email || "",
        listName: list.name,
        subscribed: this.subscribedToList(member, list.id) ? SUBSCRIBED_YES : SUBSCRIBED_NO
      })))
      .sort((left, right) => this.normalisedText(left.email).localeCompare(this.normalisedText(right.email))
        || left.listName.localeCompare(right.listName));
  }

  public async downloadSpreadsheet(members: Member[], lists: ListInfo[], fileName: string): Promise<number> {
    const request: ListSubscriptionExportRequest = {fileName, rows: this.rowsFrom(members, lists)};
    this.logger.info("downloading", request.rows.length, "rows as", fileName);
    const blob = await firstValueFrom(this.http.post(`${this.SUBSCRIPTIONS_URL}/export`, request, {responseType: "blob"}));
    downloadBlob(blob, fileName);
    return request.rows.length;
  }

  public async parseFile(file: File): Promise<ListSubscriptionRow[]> {
    const formData = new FormData();
    formData.append("file", file, file.name);
    const parseResponse: ListSubscriptionParseResponse =
      (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.SUBSCRIPTIONS_URL}/parse`, formData))).response;
    this.logger.info("parsed", parseResponse?.rows?.length, "rows from", file.name);
    return parseResponse?.rows || [];
  }

  public applyRows(rows: ListSubscriptionRow[], members: Member[], lists: ListInfo[]): ListSubscriptionImportSummary {
    const changedMembers = new Map<string, Member>();
    const results: ListSubscriptionResult[] = rows.map(row => this.resultForRow(row, members, lists, changedMembers));
    return {results, membersChanged: Array.from(changedMembers.values())};
  }

  private resultForRow(row: ListSubscriptionRow, members: Member[], lists: ListInfo[], changedMembers: Map<string, Member>): ListSubscriptionResult {
    if (!row.email) {
      return {row, outcome: ListSubscriptionOutcome.NO_EMAIL_ADDRESS};
    }
    const list = this.listMatching(row.listName, lists);
    if (!list) {
      return {row, outcome: ListSubscriptionOutcome.UNKNOWN_LIST};
    }
    const requested = this.requestedSubscription(row.subscribed);
    if (requested === null) {
      return {row, outcome: ListSubscriptionOutcome.UNRECOGNISED_SUBSCRIBED_VALUE};
    }
    const matches = this.membersMatching(row.email, members);
    if (matches.length === 0) {
      return {row, outcome: ListSubscriptionOutcome.NO_MATCHING_MEMBER};
    }
    if (matches.length > 1) {
      return {row, outcome: ListSubscriptionOutcome.AMBIGUOUS_MEMBER_MATCH};
    }
    const member = matches[0];
    if (this.subscribedToList(member, list.id) === requested) {
      return {row, outcome: ListSubscriptionOutcome.UNCHANGED};
    }
    this.setSubscription(member, list.id, requested);
    changedMembers.set(member.id, member);
    return {row, outcome: requested ? ListSubscriptionOutcome.SUBSCRIBED : ListSubscriptionOutcome.UNSUBSCRIBED};
  }

  public changeCountsByList(results: ListSubscriptionResult[], membersBefore: Member[], membersAfter: Member[], lists: ListInfo[]): ListSubscriptionChangeCount[] {
    const counts = results
      .filter(result => APPLIED_OUTCOMES.includes(result.outcome))
      .reduce((accumulator, result) => {
        const listName = result.row.listName || "";
        const existing = accumulator.get(listName)
          || {listName, subscribersBefore: 0, subscribing: 0, unsubscribing: 0, subscribersAfter: 0};
        const subscribing = result.outcome === ListSubscriptionOutcome.SUBSCRIBED;
        accumulator.set(listName, {
          ...existing,
          subscribing: existing.subscribing + (subscribing ? 1 : 0),
          unsubscribing: existing.unsubscribing + (subscribing ? 0 : 1)
        });
        return accumulator;
      }, new Map<string, ListSubscriptionChangeCount>());
    return Array.from(counts.values())
      .map(count => {
        const listId = this.listMatching(count.listName, lists)?.id;
        return {
          ...count,
          subscribersBefore: this.subscribedMembers(membersBefore, listId).length,
          subscribersAfter: this.subscribedMembers(membersAfter, listId).length
        };
      })
      .sort((left, right) => left.listName.localeCompare(right.listName));
  }

  public retrospectivePreview(list: ListInfo, listSetting: ListSetting, members: Member[]): RetrospectiveApplyPreview {
    const wanted: RetrospectiveApplyChange[] = members
      .map(member => this.retrospectiveChangeFor(member, list, listSetting))
      .filter(change => !!change);
    const changes: RetrospectiveApplyChange[] = wanted.filter(change => !this.keptUnsubscribed(change, list));
    this.logger.info("retrospectivePreview for list", list?.name, "produced", changes.length, "changes and kept",
      wanted.length - changes.length, "members unsubscribed");
    return {
      listId: list?.id,
      listName: list?.name,
      changes,
      subscribingCount: changes.filter(change => change.subscribed).length,
      unsubscribingCount: changes.filter(change => !change.subscribed).length,
      keptUnsubscribedCount: wanted.length - changes.length
    };
  }

  private keptUnsubscribed(change: RetrospectiveApplyChange, list: ListInfo): boolean {
    return change.subscribed && this.previouslyUnsubscribed(change.member, list?.id);
  }

  public applyRetrospective(preview: RetrospectiveApplyPreview): Member[] {
    return preview.changes.map(change => {
      this.setSubscription(change.member, preview.listId, change.subscribed);
      return change.member;
    });
  }

  public async saveAndSyncChanges(notify: AlertInstance, changedMembers: Member[], allMembers: Member[]): Promise<void> {
    if (changedMembers.length === 0) {
      return;
    }
    this.logger.info("saving", changedMembers.length, "changed members and syncing to the mail provider");
    await this.memberService.createOrUpdateAll(changedMembers);
    await this.syncChangedMembersToBrevo(notify, allMembers);
  }

  private retrospectiveChangeFor(member: Member, list: ListInfo, listSetting: ListSetting): RetrospectiveApplyChange {
    const subscribed = !!this.mailMessagingService.subscribed(listSetting, member);
    if (this.subscribedToList(member, list?.id) === subscribed) {
      return null;
    }
    return {member, subscribed};
  }

  private previouslyUnsubscribed(member: Member, listId: number): boolean {
    return isNumber(this.listUnsubscribedAt(member, listId));
  }

  private membersMatching(email: string, members: Member[]): Member[] {
    return members.filter(member => this.sameText(member.email, email));
  }

  private listMatching(listName: string, lists: ListInfo[]): ListInfo {
    return lists?.find(list => this.sameText(list.name, listName));
  }

  private requestedSubscription(value: string): boolean {
    const normalised = this.normalisedText(value);
    if (!normalised) {
      return false;
    }
    if (AFFIRMATIVE_VALUES.includes(normalised)) {
      return true;
    }
    if (NEGATIVE_VALUES.includes(normalised)) {
      return false;
    }
    return null;
  }

  private sameText(left: string, right: string): boolean {
    return !!left && !!right && this.normalisedText(left) === this.normalisedText(right);
  }

  private normalisedText(value: string): string {
    return value?.toLowerCase()?.trim();
  }

  private cleanEmail(email: string) {
    return this.normalisedText(email);
  }

  private notifyIntegrationNotEnabled(notify: AlertInstance) {
    notify.warning({
      title: "Brevo updates",
      message: "Mail Integration is not enabled so list updates have been skipped"
    });
    notify.clearBusy();
    return true;
  }

  private memberToContactMismatch(contactToMember: ContactToMember): boolean {
    const contact = contactToMember.contact;
    const member = contactToMember.member;
    const emailMatch = this.cleanEmail(contact.email) === this.cleanEmail(member?.mail?.email);
    const subscribedListIds = this.subscribedListIds(member);
    const listsIdMatch = subscribedListIds.length === 0 ? true : subscribedListIds.filter(item => !contact.listIds.includes(item)).length === 0;
    const memberEmailMatch = this.cleanEmail(contact.email) === this.cleanEmail(member.email);
    const idMatch = contact.id === member?.mail?.id;
    const firstNameMatch = contact.attributes.FIRSTNAME === member.firstName;
    const lastNameMatch = contact.attributes.LASTNAME === member.lastName;
    const memberMergeFields = this.mailMessagingService.toMemberMergeVariables(member);
    const memberNumberMatch = (contact.attributes.MEMBER_NUM ?? "") === memberMergeFields.MEMBER_NUM;
    const memberExpiryMatch = (contact.attributes.MEMBER_EXP ?? "") === memberMergeFields.MEMBER_EXP;
    const userNameMatch = (contact.attributes.USERNAME ?? "") === memberMergeFields.USERNAME;
    const misMatch = !(emailMatch && memberEmailMatch && idMatch && firstNameMatch && lastNameMatch && memberNumberMatch && memberExpiryMatch && userNameMatch && listsIdMatch);
    this.logger.off("memberToContactMismatch:emailMatch", emailMatch, "memberEmailMatch", memberEmailMatch, "idMatch", idMatch, "firstNameMatch", firstNameMatch, "lastNameMatch", lastNameMatch, "memberNumberMatch", memberNumberMatch, "memberExpiryMatch", memberExpiryMatch, "userNameMatch", userNameMatch, "listsIdMatch", listsIdMatch, "misMatch", misMatch, "contact:", contact, "member:", member);
    return misMatch;
  }

  private listIdsToRemoveFromContact(contactToMember: ContactToMember): number[] {
    const contact: Contact = contactToMember.contact;
    const member: Member = contactToMember.member;
    const subscribedListIds: number[] = this.subscribedListIds(member);
    return subscribedListIds.length > 0 ? contact.listIds.filter(item => !subscribedListIds.includes(item)) : [];
  }

  private updateMemberWithContactIdentifiersRequired(contactToMember: ContactToMember): boolean {
    if (contactToMember?.member) {
      const emailMatch = contactToMember?.member && this.cleanEmail(contactToMember?.contact?.email) === this.cleanEmail(contactToMember.member?.mail?.email);
      const idMatch = contactToMember?.member && contactToMember?.contact?.id === contactToMember.member?.mail?.id;
      return !(emailMatch && idMatch);
    } else {
      return false;
    }
  }

  private prepareUpdateOfMemberWithContactIdentifiers(contactToMember: ContactToMember): void {
    if (contactToMember?.member) {
      const subscriptions: MailSubscription[] = contactToMember.contact.listIds.map(id => this.mapIdToSubscription(id, true));
      const member = contactToMember.member;
      if (!member.mail) {
        this.initialiseMailSubscriptions(member, subscriptions);
      }
      const emailMatch = contactToMember?.member && this.cleanEmail(contactToMember?.contact?.email) === this.cleanEmail(member?.mail?.email);
      const idMatch = contactToMember?.member && contactToMember?.contact?.id === member?.mail?.id;
      if (!idMatch) {
        member.mail.id = contactToMember.contact?.id;
      }
      if (!emailMatch) {
        member.mail.email = contactToMember.contact?.email;
      }
    }
  }

  public mapIdToSubscription(id: number, subscribed: boolean): MailSubscription {
    return {id, subscribed};
  }

  public initialiseMailSubscriptions(member: Member, subscriptions: MailSubscription[]) {
    member.mail = {email: null, id: null, subscriptions};
  }

  public initialiseMailSubscriptionsFromListIds(member: Member, mailMessagingConfig: MailMessagingConfig) {
    const preMail = cloneDeep(member.mail);
    member.mail = {
      email: null,
      id: null,
      subscriptions: mailMessagingConfig?.brevo?.lists?.lists.map((item: ListInfo) => {
        const listSetting: ListSetting = mailMessagingConfig?.mailConfig?.listSettings?.find(setting => setting?.id === item?.id);
        return this.mapIdToSubscription(item.id, this.mailMessagingService.subscribed(listSetting, member));
      })
    };
    this.logger.off("initialiseMailSubscriptionsFromListIds:for subscribed:", "lists:", mailMessagingConfig?.brevo?.lists?.lists, "name:", this.fullNamePipe.transform(member), "member.mail before:", preMail, "after:", member.mail);
  }

  public toCreateContactRequest(member: Member): CreateContactRequestWithAttributes {
    const memberMergeFields = this.mailMessagingService.toMemberMergeVariables(member);
    return {
      email: this.cleanEmail(member.email),
      extId: member.id,
      attributes: {
        FIRSTNAME: member.firstName,
        LASTNAME: member.lastName,
        MEMBER_NUM: memberMergeFields.MEMBER_NUM,
        MEMBER_EXP: memberMergeFields.MEMBER_EXP,
        USERNAME: memberMergeFields.USERNAME
      },
      listIds: this.subscribedListIds(member)
    };
  }

  public toCreateContactRequestWithObjectAttributes(member: Member): CreateContactRequestWithObjectAttributes {
    const memberMergeFields = this.mailMessagingService.toMemberMergeVariables(member);
    return {
      ...(isNumber(member.mail.id) ? {id: member.mail.id} : {}),
      email: this.cleanEmail(member.mail.email) ?? this.cleanEmail(member.email),
      extId: member.id,
      attributes: {
        EMAIL: this.cleanEmail(member.email) as any,
        FIRSTNAME: member.firstName as any,
        LASTNAME: member.lastName as any,
        MEMBER_NUM: memberMergeFields.MEMBER_NUM as any,
        MEMBER_EXP: memberMergeFields.MEMBER_EXP as any,
        USERNAME: memberMergeFields.USERNAME as any
      },
      listIds: this.subscribedListIds(member)
    };
  }

  private subscribedListIds(member: Member): number[] {
    return member?.mail?.subscriptions?.filter(item => item.subscribed)?.map(item => item.id)?.sort() || [];
  }

  public toNumberOrString(contact: Contact): NumberOrString {
    return contact.id || contact.email;
  }

  public mailProviderStats(groupMembers: Member[], listId: number): MailProviderStats {
    const hasMailSubscription = groupMembers.filter(member => this.memberSubscribed(member, listId));
    const pendingIds: number = hasMailSubscription.filter((member: Member) => !member?.mail.id)?.length;
    const validIds: number = hasMailSubscription.filter((member: Member) => {
      const subscribedMemberListIds = member?.mail.subscriptions.filter(item => item.subscribed && item?.id === listId).map(sub => sub.id);
      const invalidMemberIds = subscribedMemberListIds?.filter(item => item !== listId);
      const match = member?.mail.id && invalidMemberIds?.length === 0;
      this.logger.info("calculateMailProviderStats:member:", member, "listId:", listId, "subscribedMemberListIds:", subscribedMemberListIds, "invalidMemberIds:", invalidMemberIds, "match:", match);
      return match;
    })?.length;
    const invalidIds: number = hasMailSubscription.length - validIds - pendingIds;
    const hasNoMailSubscription = groupMembers.length - hasMailSubscription.length;
    return {
      hasMailSubscription: hasMailSubscription.length,
      pendingIds,
      validIds,
      invalidIds,
      hasNoMailSubscription
    };
  }
}
