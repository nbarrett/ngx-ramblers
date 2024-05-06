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

  performBulkDelete(members: Member[], memberIds: string[]) {
    const deletedAt: number = this.dateUtils.momentNowNoTime().valueOf();
    const deletedBy: string = this.memberLoginService.loggedInMember().memberId;
    const deletedMembers: DeletedMember[] = memberIds.map(memberId => ({
      deletedAt,
      deletedBy,
      memberId,
      membershipNumber: members.find(member => member.id === memberId)?.membershipNumber
    }));
    this.logger.info("confirmBulkDelete:deletedMembers:", deletedMembers);
    return Promise.all(deletedMembers.map(deletedMember => {
      const memberToDelete: Member = members.find(member => member.id === deletedMember.memberId);
      if (memberToDelete) {
        this.logger.info("deleting:deletedMember:", deletedMember, "memberToDelete:", memberToDelete);
        return this.memberService.delete(memberToDelete).then(() => this.deletedMemberService.create(deletedMember));
      } else {
        this.logger.warn("cant delete:deletedMember:", deletedMember, "as member cant be found");
        return false;
      }
    }));
  }
}
