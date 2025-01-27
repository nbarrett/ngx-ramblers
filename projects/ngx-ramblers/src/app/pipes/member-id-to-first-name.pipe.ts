import { inject, Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";
import { MemberService } from "../services/member/member.service";

@Pipe({ name: "memberIdToFirstName" })
export class MemberIdToFirstNamePipe implements PipeTransform {

  private memberService = inject(MemberService);

  transform(memberId: string, members: Member[], defaultValue?: string): string {
    const member = this.memberService.toMember(memberId, members);
    return member ? member.firstName : defaultValue;
  }

}
