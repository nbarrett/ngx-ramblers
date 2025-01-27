import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import {
  MailchimpListSegmentAddResponse,
  MailchimpSegmentUpdateResponse,
  SaveSegmentResponse,
  SubscriptionRequest
} from "../../models/mailchimp.model";
import { IdentifiableOrId, MailchimpSegmentId, Member } from "../../models/member.model";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberService } from "../member/member.service";
import { StringUtilsService } from "../string-utils.service";
import { MailchimpListSubscriptionService } from "./mailchimp-list-subscription.service";
import { MailchimpListService } from "./mailchimp-list.service";

@Injectable({
  providedIn: "root"
})
export class MailchimpSegmentService {

  private logger: Logger = inject(LoggerFactory).createLogger("MailchimpSegmentService", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private memberService = inject(MemberService);
  private mailchimpListSubscriptionService = inject(MailchimpListSubscriptionService);
  private mailchimpListService = inject(MailchimpListService);

  createSubscriptionRequests(listType: string, memberIds: IdentifiableOrId[], members: Member[]): SubscriptionRequest[] {
    this.logger.debug("createSubscriptionRequests based on listType", listType, "memberIds:", memberIds, "members:", members);
    const subscriptionRequests: SubscriptionRequest[] = memberIds
      .map(memberId => this.memberService.toMember(memberId, members))
      .filter(member => member?.email)
      .map(member => this.mailchimpListSubscriptionService.addMailchimpIdentifiersToRequest(member, listType));
    if (!subscriptionRequests || subscriptionRequests.length === 0) {
      throw new Error(`No members were added to the ${listType} email segment from the ${memberIds.length} supplied members. Please check that they have a valid email address and are subscribed to ${listType}`);
    }
    this.logger.debug("subscriptionRequests", subscriptionRequests);
    return subscriptionRequests;
  }

  saveSegment(listType: string, mailchimpSegmentId: MailchimpSegmentId, memberIdentities: IdentifiableOrId[], segmentPrefix: string, members: Member[]): Promise<SaveSegmentResponse> {
    const subscriptionRequests: SubscriptionRequest[] = this.createSubscriptionRequests(listType, memberIdentities, members);
    this.logger.debug("saveSegment:buildSegmentMemberData:list:", listType, "member identities:", memberIdentities, "subscription requests:", subscriptionRequests);
    const segmentName = this.formatSegmentName(segmentPrefix);
    if (mailchimpSegmentId?.segmentId) {
      const segmentId: number = mailchimpSegmentId.segmentId;
      this.logger.debug("saveSegment:segmentId", segmentId);
      return this.mailchimpListService.updateSegment(listType, segmentId, segmentName, true)
        .then(() => this.mailchimpListService.updateSegment(listType, segmentId, segmentName, false))
        .then((mailchimpSegmentUpdateResponse: MailchimpSegmentUpdateResponse) => this.addSegmentMembersDuringUpdate(listType, segmentId, subscriptionRequests, mailchimpSegmentUpdateResponse))
        .then(() => ({segment: {id: segmentId}}));
    } else {
      this.logger.debug("saveSegment:no segment exists for list:", listType, "adding new one named", segmentName);
      return this.mailchimpListService.addSegment(listType, segmentName)
        .then((addSegmentResponse: MailchimpListSegmentAddResponse) => this.addSegmentMembersDuringAdd(listType, subscriptionRequests, addSegmentResponse));
    }
  }

  addSegmentMembersDuringUpdate(listType: string, segmentId: number, segmentMembers: SubscriptionRequest[], segmentUpdateResponse: MailchimpSegmentUpdateResponse): Promise<MailchimpSegmentId> {
    this.logger.debug("addSegmentMembersDuringUpdate, segmentMembers.length", segmentMembers.length, "->", segmentUpdateResponse);
    if (segmentMembers.length > 0) {
      return this.mailchimpListService.addSegmentMembers(listType, segmentId, segmentMembers)
        .then(() => ({segmentId: segmentUpdateResponse.id}));
    } else {
      return Promise.resolve({segmentId: segmentUpdateResponse.id});
    }
  }

  addSegmentMembersDuringAdd(listType, segmentMembers, addSegmentResponse: MailchimpListSegmentAddResponse) {
    this.logger.debug("addSegmentMembersDuringAdd, listType", listType, "->", segmentMembers, addSegmentResponse);
    if (segmentMembers.length > 0) {
      return this.mailchimpListService.addSegmentMembers(listType, addSegmentResponse.id, segmentMembers)
        .then(addMemberResponse => ({segment: addSegmentResponse}));
    } else {
      return Promise.resolve({segment: addSegmentResponse});
    }
  }

  getMemberSegmentId(member: Member, segmentType: string): number {
    return member?.mailchimpSegmentIds && member?.mailchimpSegmentIds[segmentType];
  }

  setMemberSegmentId(member: Member, segmentType: string, segmentId: number): void {
    if (!member.mailchimpSegmentIds) {
      member.mailchimpSegmentIds = {};
    }
    member.mailchimpSegmentIds[segmentType] = segmentId;
  }

  public formatSegmentName(prefix): string {
    const dateSuffix = ` (${this.dateUtils.nowAsValue()})`;
    const segmentName = this.stringUtils.stripLineBreaks(prefix, true).substring(0, 99 - dateSuffix.length) + dateSuffix;
    this.logger.debug("segmentName", segmentName, "length", segmentName.length);
    return segmentName;
  }

}
