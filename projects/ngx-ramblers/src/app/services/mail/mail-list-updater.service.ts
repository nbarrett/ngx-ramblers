import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../models/member.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { AlertInstance } from "../notifier.service";
import { StringUtilsService } from "../string-utils.service";
import { MailConfigService } from "./mail-config.service";
import {
  Contact, ContactCreatedResponse,
  ContactIdToListId,
  ContactsAddOrRemoveRequest,
  ContactsListResponse,
  ContactToMember,
  CreateContactRequest,
  CreateContactRequestWithAttributes,
  CreateContactRequestWithObjectAttributes,
  ListIds,
  MailConfig,
  MailListAudit,
  MailMessagingConfig,
  MailSubscription,
  NumberOrString,
  StatusMappedResponseSingleInput
} from "../../models/mail.model";
import { MailService } from "./mail.service";
import { MemberService } from "../member/member.service";
import groupBy from "lodash-es/groupBy";
import map from "lodash-es/map";
import { KeyValue } from "../enums";
import { MailProviderStats } from "../../models/system.model";
import { MailMessagingService } from "./mail-messaging.service";
import cloneDeep from "lodash-es/cloneDeep";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MailListAuditService } from "./mail-list-audit.service";
import { AuditStatus } from "../../models/audit";
import omit from "lodash-es/omit";
import first from "lodash-es/first";


@Injectable({
  providedIn: "root"
})
export class MailListUpdaterService {
  private logger: Logger;
  private update = true;
  private mailMessagingConfig: MailMessagingConfig;
  public pendingMailListAudits: MailListAudit[] = [];
  constructor(private mailConfigService: MailConfigService,
              private mailService: MailService,
              private fullNamePipe: FullNamePipe,
              private mailMessagingService: MailMessagingService,
              private memberService: MemberService,
              private mailListAuditService: MailListAuditService,
              private stringUtils: StringUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailListUpdaterService", NgxLoggerLevel.OFF);
    this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
    });
  }

  updateMailLists(notify: AlertInstance, members: Member[]): Promise<any> {
    notify.setBusy();
    this.pendingMailListAudits = [];
    this.logger.info("updateMailLists:members:", members);
    return this.mailConfigService.queryConfig().then(async (mailConfig: MailConfig) => {
      if (mailConfig.allowSendCampaign) {
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
          .filter(member => !existingMemberIds.includes(member.id) && this.memberSubscribed(member))
          .map((member: Member) => this.toCreateContactRequest(member));
        this.logger.info("prepared", this.stringUtils.pluraliseWithCount(createContactRequests.length, "create contact request"), createContactRequests);

        const updateContactRequests: CreateContactRequestWithObjectAttributes[] = contactsToMembers
          .filter((contactToMember: ContactToMember) => contactToMember.member && this.memberSubscribed(contactToMember.member) && this.memberToContactMismatch(contactToMember))
          .map((contactToMember: ContactToMember) => this.toCreateContactRequestWithObjectAttributes(contactToMember.member));
        this.logger.info("prepared", this.stringUtils.pluraliseWithCount(updateContactRequests.length, "update contact request"), updateContactRequests);

        const deleteContactIds: NumberOrString[] = contactsToMembers
          .filter((contactToMember: ContactToMember) => (contactToMember.member && !this.memberSubscribed(contactToMember.member)) || !contactToMember.member)
          .map((contactToMember: ContactToMember) => {
            this.logger.info("preparing to delete contact", contactToMember.contact);
            return this.toNumberOrString(contactToMember.contact);
          });
        this.logger.info("prepared", this.stringUtils.pluraliseWithCount(deleteContactIds.length, "delete contact id"), deleteContactIds, "contacts:", contactsToMembers.filter(contactsToMember => deleteContactIds.includes(contactsToMember.contact.id)));

        const contactRemoveFromListRequest = groupBy(contactsToMembers.filter((contactToMember: ContactToMember) => (contactToMember.listIdsToRemoveFromContact.length > 0))
          .map((contactToMember: ContactToMember) => contactToMember.listIdsToRemoveFromContact.map(listId => ({
            contactId: contactToMember.contact.id, listId
          }))).flat(2), "listId");

        const contactRemoveRequests: ContactsAddOrRemoveRequest[] = map(contactRemoveFromListRequest, ((contactIdToListIds: ContactIdToListId[], fieldValue) => ({
          ids: contactIdToListIds.map(contactIdToListId => contactIdToListId.contactId),
          listId: contactIdToListIds[0].listId
        })));
        this.logger.info("prepared", this.stringUtils.pluraliseWithCount(contactRemoveRequests.length, "contact remove from list request"), contactRemoveRequests);

        if (this.update) {
          await this.processCreateContactRequests(createContactRequests, members, notify);
          await this.processDeleteContactsRequests(deleteContactIds, members, notify);
          await this.processUpdateContactRequests(updateContactRequests, notify);
          await this.processContactRemoveRequests(contactRemoveRequests, members, notify);
          await this.processMailListAuditing();
        }
        notify.success({
          title: "Brevo updates",
          message: "Brevo contact and list synchronisation complete"
        });
        notify.clearBusy();
      } else {
        return Promise.resolve(this.notifyIntegrationNotEnabled(notify));
      }
    });
  }

  private async processMailListAuditing() {
    this.logger.info("saving", this.pendingMailListAudits.length, "pendingMailListAudits:", this.pendingMailListAudits);
    const response = await this.mailListAuditService.createOrUpdateAll(this.pendingMailListAudits);
    this.logger.info("saved", response?.length, "pendingMailListAudits:", response);
  }

  public memberSubscribed(member: Member): boolean {
    const subscriptionCount = member?.mail?.subscriptions?.filter((mailSubscription) => mailSubscription.subscribed)?.length;
    const subscribed = member?.groupMember && !!(member?.email) && subscriptionCount > 0;
    this.logger.info("memberSubscribed:member.groupMember", member?.groupMember, "email", member?.email, "name:", this.fullNamePipe.transform(member), "member:", member, "subscriptionCount:", subscriptionCount, "subscribed:", subscribed);
    return subscribed;
  }

  private async processContactRemoveRequests(contactRemoveRequests: ContactsAddOrRemoveRequest[], members: Member[], notify: AlertInstance) {
    notify.success({
      title: "Brevo updates",
      message: "Processing " + this.stringUtils.pluraliseWithCount(contactRemoveRequests.length, "contact remove request")
    });

    const contactIdToMember = (contactId: number): string => members.find(member => member?.mail?.id === contactId)?.id;

    if (contactRemoveRequests.length > 0) {
      const contactAddOrRemoveResponse = await this.mailService.contactsRemoveFromList(contactRemoveRequests);
      this.logger.info("contactAddOrRemoveResponse:", contactAddOrRemoveResponse);
      const mailListAudits = contactRemoveRequests
        .map((contactRemoveRequest) => contactRemoveRequest.ids
          .map(contactId => this.mailListAuditService.createMailListAudit("Contact Removed from Brevo List", AuditStatus.info, contactIdToMember(contactId), contactRemoveRequest.listId))).flat(2);
      this.pendingMailListAudits.push(...mailListAudits);

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

  private contactDetails(contactRequest: CreateContactRequestWithObjectAttributes) {
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
    if (createContactRequests.length > 0) {
      const createContactResponse = await this.mailService.createContacts(createContactRequests);
      this.logger.info("createContactResponse:", createContactResponse);
      if (createContactResponse?.length > 0) {
        const updatedMembers = createContactResponse.map((contactCreatedResponse: ContactCreatedResponse) => {
          const member = members.find((member) => this.cleanEmail(member?.email) === this.cleanEmail(contactCreatedResponse?.id));
          if (member && contactCreatedResponse?.responseBody?.id) {
            member.mail.id = contactCreatedResponse.responseBody.id;
            this.pendingMailListAudits.push(this.mailListAuditService.createMailListAudit("Contact created in Brevo", AuditStatus.info, member.id, null));
            return member;
          }
        }).filter(member => member);
        const updatedMembersResponse = updatedMembers.length > 0 ? await this.memberService.createOrUpdateAll(updatedMembers) : [];
        this.logger.info("updatedMembers from create contact requests:", updatedMembersResponse);
      }
    }
  }

  private matchMemberToContact(member: Member, contact: Contact): boolean {
    this.logger.off("matchMemberToContact:member", member, "contact:", contact);
    const match = (member?.mail?.id && member?.mail?.id === contact.id) || (member?.mail?.email && this.cleanEmail(member?.mail?.email) === this.cleanEmail(contact?.email)) || (member?.email && this.cleanEmail(member.email) === this.cleanEmail(contact?.email));
    this.logger.off("matchMemberToContact:member", member, "contact:", contact, "match:", match);
    return match;
  }

  private cleanEmail(email: string) {
    return email?.toLowerCase()?.trim();
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
    const misMatch = !(emailMatch && memberEmailMatch && idMatch && firstNameMatch && lastNameMatch && listsIdMatch);
    this.logger.off("memberToContactMismatch:emailMatch", emailMatch, "memberEmailMatch", memberEmailMatch, "idMatch", idMatch, "firstNameMatch", firstNameMatch, "lastNameMatch", lastNameMatch, "listsIdMatch", listsIdMatch, "misMatch", misMatch, "contact:", contact, "member:", member);
    return misMatch;
  }

  private listIdsToRemoveFromContact(contactToMember: ContactToMember): number[] {
    const contact = contactToMember.contact;
    const member = contactToMember.member;
    const subscribedListIds = this.subscribedListIds(member);
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

  public initialiseMailSubscriptionsFromListIds(member: Member, lists: ListIds, subscribed: boolean) {
    const preMail = cloneDeep(member.mail);
    member.mail = {
      email: null,
      id: null,
      subscriptions: this.mapToKeyValues(lists).map(item => this.mapIdToSubscription(item.value, subscribed && !!(member.email)))
    };
    this.logger.info("initialiseMailSubscriptionsFromListIds:for subscribed:", "lists:", lists, subscribed, "name:", this.fullNamePipe.transform(member), "member.mail before:", preMail, "after:", member.mail);
  }

  public toCreateContactRequest(member: Member): CreateContactRequestWithAttributes {
    return {
      email: this.cleanEmail(member.email),
      extId: member.id,
      attributes: {FIRSTNAME: member.firstName, LASTNAME: member.lastName}
    };
  }

  public toCreateContactRequestWithObjectAttributes(member: Member): CreateContactRequestWithObjectAttributes {
    return {
      email: this.cleanEmail(member.mail.email),
      extId: member.id,
      attributes: {
        EMAIL: this.cleanEmail(member.email) as any,
        FIRSTNAME: member.firstName as any,
        LASTNAME: member.lastName as any
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

  public mapToKeyValues(lists: ListIds): KeyValue<number>[] {
    return map(lists, (value, key) => ({key, value}));
  }

  public mailProviderStats(groupMembers: Member[]): MailProviderStats {
    const hasMailSubscription = groupMembers.filter(member => this.memberSubscribed(member));
    const configuredIds: number[] = this.mapToKeyValues(this.mailMessagingConfig.mailConfig.lists).map(item => item.value);
    const pendingIds: number = hasMailSubscription.filter((member: Member) => !member?.mail.id)?.length;
    const validIds: number = hasMailSubscription.filter((member: Member) => {
      const subscribedMemberIds = member?.mail.subscriptions.filter(item => item.subscribed && item?.id).map(sub => sub.id);
      const invalidMemberIds = subscribedMemberIds?.filter(item => !configuredIds.includes(item));
      const match = member?.mail.id && invalidMemberIds?.length === 0;
      this.logger.off("calculateMailProviderStats:member:", member, "configuredIds:", configuredIds, "subscribedMemberIds:", subscribedMemberIds, "invalidMemberIds:", invalidMemberIds, "match:", match);
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
