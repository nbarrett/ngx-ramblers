import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../models/member.model";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberService } from "../member/member.service";
import { AlertInstance } from "../notifier.service";
import {
  Contact,
  ContactAddOrRemoveFromListResponse,
  ContactsAddOrRemoveFromListRequest,
  ContactsListResponse,
  CreateContactRequest,
  CreateContactRequestWithAttributes,
  MailIdentifiers,
  MailSubscription,
} from "../../models/mail.model";
import { MailService } from "./mail.service";
import { MailListAuditService } from "./mail-list-audit.service";
import { MemberLoginService } from "../member/member-login.service";

@Injectable({
  providedIn: "root"
})
export class MailListService {
  private logger: Logger;

  constructor(private memberService: MemberService,
              private mailListAuditService: MailListAuditService,
              private memberLoginService: MemberLoginService,
              private dateUtils: DateUtilsService,
              private mailService: MailService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailListService", NgxLoggerLevel.INFO);
  }

  setMailSubscriptionsStateFor(members: Member[], subscribedState: boolean, notify: AlertInstance): Promise<any> {
    const endState: string = subscribedState ? "subscribe" : "unsubscribe";
    const savePromises = [];
    notify.warning({
      title: "Bulk " + endState,
      message: `Bulk setting Mail subscriptions for ${members.length} members to ${subscribedState}`
    }, false, true);
    members.map(member => {
      this.setMailSubscriptionStateFor(member, subscribedState);
      savePromises.push(this.memberService.update(member));
    });

    return Promise.all(savePromises).then(() => {
      notify.success({
        title: `Bulk ${endState}`,
        message: `Reset of subscriptions completed. Next Mail send will bulk ${endState} all Mail lists`
      }, false);
      return this.refreshMembersIfAdmin();
    });
  }

  private refreshMembersIfAdmin(): Promise<Member[]> {
    if (this.memberLoginService.allowMemberAdminEdits()) {
      this.logger.info("refreshing all members");
      return this.memberService.all();
    } else {
      this.logger.info("not refreshing all members as not admin");
      return Promise.resolve([]);
    }
  }

  // addMailIdentifiersToRequest(member: Member, listType, mergeVariablesRequest?: MergeVariablesRequest): SubscriptionRequest {
  //   const mailchimpIdentifiers: MailSubscription = {email: {email: member.email}};
  //   if (member.mailchimpLists[listType].leid) {
  //     mailchimpIdentifiers.email.leid = member.mailchimpLists[listType].leid;
  //   }
  //   if (mergeVariablesRequest) {
  //     return {...mergeVariablesRequest, ...mailchimpIdentifiers};
  //   } else {
  //     return mailchimpIdentifiers.email;
  //   }
  // }
  //
  async createBatchSubscriptionForList(listType: string, members: Member[]): Promise<Member[]> {
    this.logger.info(`Sending ${listType} member data to Brevo`);
    const batchedMembers: Member[] = [];
    const createContactRequests: CreateContactRequest[] = members
      .filter(member => this.includeMemberInSubscription(listType, member))
      .map((member: Member) => {
        batchedMembers.push(member);
        return this.toCreateContactRequest(member);
      });
    this.logger.info("createBatchSubscriptionForList:", listType, "for", createContactRequests.length, "contacts");
    if (createContactRequests.length > 0) {
      this.logger.info("sending", createContactRequests.length, listType, "subscriptions to brevo", createContactRequests);
      const response = await this.mailService.createContacts(createContactRequests);
      // .catch(response => {
      //   this.logger.error(response);
      //   const data = response.error || response;
      //   const errorMessage = `Sending of ${listType} member data to Mail was not successful due to response: ${data}`;
      //   return Promise.reject(errorMessage);
      // });
      this.logger.info("received response:", response);
      // const request: ContactsAddOrRemoveFromListRequest = {listType, ids: createContactRequests};
      //
      //   .then((response: MailBatchSubscriptionResponse) => {
      //     this.logger.info("createBatchSubscriptionForList response", response);
      //     const savePromises = [];
      //     this.processValidResponses(listType, response.updated_members.concat(response.new_members), batchedMembers, savePromises);
      //     this.processErrorResponses(listType, response.errors, batchedMembers, savePromises);
      //     const totalResponseCount = response.total_created + response.total_updated + response.error_count;
      //     this.logger.info(`Send of ${createContactRequests.length} ${listType} members completed - processing ${totalResponseCount} Mail response(s)`);
      //     return Promise.all(savePromises).then(() => {
      //       return this.refreshMembersIfAdmin().then(refreshedMembers => {
      //         this.logger.info(`Send of ${createContactRequests.length} members to ${listType} list completed with ${response.total_created} member(s) added, ${response.total_updated} updated and ${response.error_count} error(s)`);
      //         return refreshedMembers;
      //       });
      //     });
      // return response;
    } else {
      const message = `No ${listType} updates to send to Mail`;
      this.logger.debug(message);
      return this.refreshMembersIfAdmin();
    }
  }

  // processValidResponses(listType: string, mailchimpMembers: MailMember[], batchedMembers: Member[], savePromises) {
  //   mailchimpMembers.forEach((mailchimpMember: MailMember) => {
  //     const member = this.findMemberAndMarkAsUpdated(listType, batchedMembers, mailchimpMember);
  //     if (member) {
  //       member.mailchimpLists[listType].code = null;
  //       member.mailchimpLists[listType].error = null;
  //       this.logger.debug(`processing valid response for member ${member.email}`);
  //       savePromises.push(this.memberService.updateMailSubscription(member.id, listType, member.mailchimpLists[listType]));
  //     }
  //   });
  // }
  //
  // processErrorResponses(listType, errorResponses: MailEmailWithError[], batchedMembers, savePromises) {
  //   errorResponses.forEach((mailchimpEmailWithError: MailEmailWithError) => {
  //     const member: Member = this.findMemberAndMarkAsUpdatedFromError(listType, batchedMembers, mailchimpEmailWithError);
  //     if (member) {
  //       this.logger.debug("processing error mailchimpEmailWithError", mailchimpEmailWithError, "for member", member.email);
  //       const autoUnsubscribingWarning = ["ERROR_GENERIC"].includes(mailchimpEmailWithError.error_code);
  //       this.mailListAuditService.create({
  //         audit: cloneDeep(mailchimpEmailWithError),
  //         listType,
  //         memberId: member.id,
  //         status: autoUnsubscribingWarning ? AuditStatus.warning : AuditStatus.error,
  //         timestamp: this.dateUtils.nowAsValue()
  //       });
  //       if (autoUnsubscribingWarning) {
  //         member.mailchimpLists[listType].subscribed = false;
  //         delete mailchimpEmailWithError.error;
  //       }
  //       savePromises.push(this.memberService.update(member));
  //     } else {
  //       this.logger.warn("failed to find member when processing error mailchimpEmailWithError", mailchimpEmailWithError);
  //     }
  //   });
  // }

  batchUnsubscribeMembers(listType: string, allMembers: Member[], notify: AlertInstance) {
    return this.mailService.contactsInList(listType, notify)
      .then((listResponse: ContactsListResponse) => this.filterForUnsubscribes(listResponse, listType, allMembers))
      .then((contacts: Contact[]) => this.batchUnsubscribeForListType(contacts, listType, allMembers, notify));
  }

  batchUnsubscribeForListType(contacts: Contact[], listType: string, allMembers: Member[], notify: AlertInstance) {
    if (contacts.length > 0) {
      const contactRemoveFromListRequest: ContactsAddOrRemoveFromListRequest = {
        listType,
        ids: contacts.map(contact => contact.id)
      };
      this.logger.info("batch unsubscribing from list", listType, contacts, "contactRemoveFromListRequest:", contactRemoveFromListRequest);
      return this.mailService.contactsRemoveFromList(contactRemoveFromListRequest)
        .then((contactRemoveFromListResponse: ContactAddOrRemoveFromListResponse) => this.removeSubscriberDetailsFromMembers(listType, allMembers, contactRemoveFromListResponse, notify));
    } else {
      const message = {
        title: "List Unsubscription",
        message: "No members needed to be unsubscribed from " + listType + " list"
      };
      this.logger.info(message);
      notify.progress(message);
    }
  }

  removeSubscriberDetailsFromMembers(listType: string, allMembers: Member[], contactRemoveFromListResponse: ContactAddOrRemoveFromListResponse, notify: AlertInstance) {
    return () => {
      const updatedMembers = contactRemoveFromListResponse.success.map(contactId => {
        const mailIdentifiers = {id: contactId, email: null};
        const member: Member = this.subscriberToMember(listType, allMembers, mailIdentifiers);
        if (member) {
          const subscription: MailSubscription = member.mailLists[listType];
          subscription.subscribed = false;
          subscription.syncRequired = false;
          subscription.lastUpdated = this.dateUtils.nowAsValue();
          return this.memberService.update(member);
        } else {
          notify.warning({
            title: "Remove Subscriber Error",
            message: "Could not find member from " + listType + " response containing data " + JSON.stringify(mailIdentifiers)
          });
        }
      });
      Promise.all(updatedMembers).then(() => {
        notify.success({
          title: "Remove Subscriber",
          message: "Successfully unsubscribed " + updatedMembers.length + " member(s) from " + listType + " list"
        });
        return updatedMembers;
      });
    };
  }

  public toCreateContactRequest(member: Member): CreateContactRequestWithAttributes {
    return {
      email: member.email,
      extId: member.id,
      attributes: {FIRSTNAME: member.firstName, LASTNAME: member.lastName}
    };
  }

  filterForUnsubscribes(listResponse: ContactsListResponse, listType: string, allMembers: Member[]): Contact[] {
    const unsubscribes: Contact[] = listResponse.contacts
      .filter((contact: Contact) => this.includeInUnsubscribe(listType, allMembers, contact));
    this.logger.info("given", listResponse.contacts.length, "received in", listType, "list,", unsubscribes.length, "were filtered for unsubscription");
    return unsubscribes;
  }

  subscriberToMember(listType: string, members: Member[], mailIdentifiers: MailIdentifiers): Member {
    return members.find(member => {
      this.logger.off("subscriberToMember:member", member, "mailIdentifiers:", mailIdentifiers);
      const mailList: MailSubscription = member.mailLists[listType];
      const matchedOnUniqueEmailId = mailIdentifiers?.id && mailIdentifiers?.id === member?.mailContactIdentifiers?.id;
      const matchedOnLastReturnedEmail = mailIdentifiers?.email && mailIdentifiers?.email?.toLowerCase() === member?.mailContactIdentifiers?.email?.toLowerCase();
      const matchedOnCurrentEmail = mailIdentifiers?.email && mailIdentifiers?.email?.toLowerCase() === member?.email?.toLowerCase();
      const matched = matchedOnUniqueEmailId || matchedOnLastReturnedEmail || matchedOnCurrentEmail;
      this.logger.off("subscriberToMember:member:matched", matched);
      return matched;
    });
  }

  resetUpdateStatusForMember(member: Member): void {
    member.mailLists.walks.syncRequired = false;
    member.mailLists.socialEvents.syncRequired = false;
    member.mailLists.general.syncRequired = false;
  }

  findMemberAndMarkAsUpdated(listType: string, batchedMembers: Member[], contact: Contact): Member {
    const member: Member = this.subscriberToMember(listType, batchedMembers, contact);
    if (member) {
      (member.mailContactIdentifiers = member.mailContactIdentifiers || {email: null, id: null}).email = null;
      member.mailContactIdentifiers.email = null;
      const mailList: MailSubscription = member.mailLists[listType];
      mailList.syncRequired = false;
      mailList.lastUpdated = this.dateUtils.nowAsValue();
      this.logger.debug("Updated member:", member, "from:", contact);
    } else {
      this.logger.warn(`From ${batchedMembers.length} members, could not find any member related to subscriber ${JSON.stringify(contact)}`);
    }
    return member;
  }

  isActiveMemberAndSubscribed(listType: string, member: Member, mailSubscription: MailSubscription): boolean {
    if (member.email && mailSubscription?.subscribed) {
      if (listType === "socialEvents") {
        return member.groupMember && member.socialMember;
      } else {
        return member.groupMember;
      }
    } else {
      return false;
    }
  }

  includeMemberInSubscription(listType: string, member: Member): boolean {
    const mailSubscription: MailSubscription = this.mailSubscription(member, listType);
    return this.isActiveMemberAndSubscribed(listType, member, mailSubscription) && (mailSubscription?.syncRequired || !member?.mailContactIdentifiers?.email || !member?.mailContactIdentifiers?.id);
  }

  private mailSubscription(member: Member, listType: string): MailSubscription {
    const subscription = member?.mailLists?.[listType];
    this.logger.info("creating", listType, "mailSubscription for member:", member, "returning subscription:", subscription);
    return subscription;
  }

  includeInUnsubscribe(listType: string, members: Member[], identifiers: MailIdentifiers): boolean {
    return this.includeMemberInUnsubscription(listType, this.subscriberToMember(listType, members, identifiers));
  }

  includeMemberInUnsubscription(listType: string, member: Member): boolean {
    if (!member || !member?.groupMember) {
      return true;
    } else if (member.mailLists) {
      const mailSubscription: MailSubscription = this.mailSubscription(member, listType);
      if (listType === "socialEvents") {
        return (!member.socialMember && mailSubscription.subscribed) || (!mailSubscription.subscribed);
      } else {
        return (!mailSubscription.subscribed);
      }
    } else {
      return false;
    }
  }

  createOrSetMailSubscription(member: Member, listType: string, subscribedState: boolean): void {
    this.logger.info("createOrSetMailSubscription member:", member, "listType:", listType, "subscribedState:", subscribedState);
    if (!member.mailLists) {
      member.mailLists = {};
    }
    member.mailLists[listType] = {subscribed: subscribedState};
  }

  setMailSubscriptionStateFor(member: Member, subscribedState: boolean): void {
    if (!member.mailLists) {
      this.createOrSetMailSubscription(member, "general", subscribedState);

    }
  }
}
