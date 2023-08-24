import { Injectable } from "@angular/core";
import { cloneDeep } from "lodash-es";
import { NgxLoggerLevel } from "ngx-logger";
import { AuditStatus } from "../../models/audit";
import {
  MailchimpBatchSubscriptionResponse,
  MailchimpEmailWithError,
  MailchimpMember,
  MailchimpSubscription,
  MailchimpSubscriptionMember,
  MergeVariablesRequest,
  SubscriptionRequest,
  SubscriptionStatus,
} from "../../models/mailchimp.model";
import { Member } from "../../models/member.model";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailchimpErrorParserService } from "../mailchimp-error-parser.service";
import { MemberLoginService } from "../member/member-login.service";
import { MemberService } from "../member/member.service";
import { AlertInstance } from "../notifier.service";
import { MailchimpListAuditService } from "./mailchimp-list-audit.service";
import { MailchimpListService } from "./mailchimp-list.service";

@Injectable({
  providedIn: "root"
})
export class MailchimpListSubscriptionService {
  private logger: Logger;

  constructor(private memberService: MemberService,
              private dateUtils: DateUtilsService,
              private mailchimpListAuditService: MailchimpListAuditService,
              private mailchimpListService: MailchimpListService,
              private memberLoginService: MemberLoginService,
              private mailchimpErrorParserService: MailchimpErrorParserService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MailchimpListSubscriptionService, NgxLoggerLevel.OFF);
  }

  setMailchimpSubscriptionsStateFor(members: Member[], subscribedState: boolean, notify: AlertInstance): Promise<any> {
    const endState: string = subscribedState ? "subscribe" : "unsubscribe";
    const savePromises = [];
    notify.warning({title: "Bulk " + endState, message: `Bulk setting Mailchimp subscriptions for ${members.length} members to ${subscribedState}`}, false, true);
    members.map(member => {
      this.mailchimpListService.setMailchimpSubscriptionStateFor(member, subscribedState);
      savePromises.push(this.memberService.update(member));
    });

    return Promise.all(savePromises).then(() => {
      notify.success({title: `Bulk ${endState}`, message: `Reset of subscriptions completed. Next Mailchimp send will bulk ${endState} all Mailchimp lists`}, false);
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

  addMailchimpIdentifiersToRequest(member: Member, listType, mergeVariablesRequest?: MergeVariablesRequest): SubscriptionRequest {
    const mailchimpIdentifiers: MailchimpSubscription = {email: {email: member.email}};
    if (member.mailchimpLists[listType].leid) {
      mailchimpIdentifiers.email.leid = member.mailchimpLists[listType].leid;
    }
    if (mergeVariablesRequest) {
      return {...mergeVariablesRequest, ...mailchimpIdentifiers};
    } else {
      return mailchimpIdentifiers.email;
    }
  }

  createBatchSubscriptionForList(listType, members: Member[]): Promise<Member[]> {
    this.logger.debug(`Sending ${listType} member data to Mailchimp`);
    const batchedMembers: Member[] = [];
    const subscriptionRequests: MailchimpSubscriptionMember[] = members
      .filter(member => this.mailchimpListService.includeMemberInSubscription(listType, member))
      .map((member: Member) => {
        batchedMembers.push(member);
        return {
          email_address: member.email,
          email_type: "html",
          status: SubscriptionStatus.SUBSCRIBED,
          merge_fields: this.mailchimpListService.toMergeVariables(member)
        };
      });
    this.logger.info("createBatchSubscriptionForList:", listType, "for", subscriptionRequests.length, "members");
    if (subscriptionRequests.length > 0) {
      this.logger.info("sending", subscriptionRequests.length, listType, "subscriptions to mailchimp", subscriptionRequests);
      return this.mailchimpListService.batchSubscribe(listType, subscriptionRequests)
        .then((response: MailchimpBatchSubscriptionResponse) => {
          this.logger.info("createBatchSubscriptionForList response", response);
          const savePromises = [];
          this.processValidResponses(listType, response.updated_members.concat(response.new_members), batchedMembers, savePromises);
          this.processErrorResponses(listType, response.errors, batchedMembers, savePromises);
          const totalResponseCount = response.total_created + response.total_updated + response.error_count;
          this.logger.info(`Send of ${subscriptionRequests.length} ${listType} members completed - processing ${totalResponseCount} Mailchimp response(s)`);
          return Promise.all(savePromises).then(() => {
            return this.refreshMembersIfAdmin().then(refreshedMembers => {
              this.logger.info(`Send of ${subscriptionRequests.length} members to ${listType} list completed with ${response.total_created} member(s) added, ${response.total_updated} updated and ${response.error_count} error(s)`);
              return refreshedMembers;
            });
          });
        }).catch(response => {
          this.logger.error(response);
          const data = response.error || response;
          const errorMessage = `Sending of ${listType} member data to Mailchimp was not successful due to response: ${data}`;
          return Promise.reject(errorMessage);
        });
    } else {
      const message = `No ${listType} updates to send to Mailchimp`;
      this.logger.debug(message);
      return this.refreshMembersIfAdmin();
    }
  }

  processValidResponses(listType: string, mailchimpMembers: MailchimpMember[], batchedMembers: Member[], savePromises) {
    mailchimpMembers.forEach((mailchimpMember: MailchimpMember) => {
      const member = this.mailchimpListService.findMemberAndMarkAsUpdated(listType, batchedMembers, mailchimpMember);
      if (member) {
        member.mailchimpLists[listType].code = null;
        member.mailchimpLists[listType].error = null;
        this.logger.debug(`processing valid response for member ${member.email}`);
        savePromises.push(this.memberService.updateMailSubscription(member.id, listType, member.mailchimpLists[listType]));
      }
    });
  }

  processErrorResponses(listType, errorResponses: MailchimpEmailWithError[], batchedMembers, savePromises) {
    errorResponses.forEach((mailchimpEmailWithError: MailchimpEmailWithError) => {
      const member: Member = this.mailchimpListService.findMemberAndMarkAsUpdatedFromError(listType, batchedMembers, mailchimpEmailWithError);
      if (member) {
        this.logger.debug("processing error mailchimpEmailWithError", mailchimpEmailWithError, "for member", member.email);
        const autoUnsubscribingWarning = ["ERROR_GENERIC"].includes(mailchimpEmailWithError.error_code);
        this.mailchimpListAuditService.create({
          audit: cloneDeep(mailchimpEmailWithError),
          listType,
          memberId: member.id,
          status: autoUnsubscribingWarning ? AuditStatus.warning : AuditStatus.error,
          timestamp: this.dateUtils.nowAsValue()
        });
        if (autoUnsubscribingWarning) {
          member.mailchimpLists[listType].subscribed = false;
          delete mailchimpEmailWithError.error;
        }
        savePromises.push(this.memberService.update(member));
      } else {
        this.logger.warn("failed to find member when processing error mailchimpEmailWithError", mailchimpEmailWithError);
      }
    });
  }

}
