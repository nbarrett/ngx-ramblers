import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DeletedMember, Member } from "../../models/member.model";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberService } from "./member.service";
import { DeletedMemberService } from "./deleted-member.service";
import { MemberLoginService } from "./member-login.service";

@Injectable({
  providedIn: "root"
})
export class MemberBulkDeleteService {
  private logger: Logger;

  constructor(private memberService: MemberService,
              private deletedMemberService: DeletedMemberService,
              private memberLoginService: MemberLoginService,
              private dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MemberBulkDeleteService", NgxLoggerLevel.OFF);
  }

  async performBulkDelete(members: Member[], memberIds: string[]) {
    const deletedAt: number = this.dateUtils.momentNowNoTime().valueOf();
    const deletedBy: string = this.memberLoginService.loggedInMember().memberId;
    const membersToDelete: Member[] = members.filter(member => memberIds.includes(member.id));
    const deletedMemberResponses = await this.memberService.deleteAll(membersToDelete);
    const deletedMemberRequests: DeletedMember[] = deletedMemberResponses
      .filter(item => item.deleted)
      .map(deletionResponse => ({
        deletedAt, deletedBy, memberId: deletionResponse.id,
        membershipNumber: members.find(member => member.id === deletionResponse.id)?.membershipNumber
    }));
    const deletedMembers = await this.deletedMemberService.createOrUpdateAll(deletedMemberRequests);
    this.logger.info("confirmBulkDelete:deletedMemberRequests:", deletedMemberRequests, "deletedMembers:", deletedMembers);
    return deletedMembers;
  }
}
