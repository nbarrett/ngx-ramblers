import { inject, Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";
import { MemberService } from "../services/member/member.service";
import { FullNameWithAliasPipe } from "./full-name-with-alias.pipe";
import { FullNamePipe } from "./full-name.pipe";

@Pipe({ name: "memberIdToFullName" })
export class MemberIdToFullNamePipe implements PipeTransform {

  private memberService = inject(MemberService);
  private fullNamePipe = inject(FullNamePipe);
  private fullNameWithAliasPipe = inject(FullNameWithAliasPipe);


  transform(memberId: string, members: Member[], defaultValue?: string, alias?: boolean): string {
    const member = this.memberService.toMember(memberId, members);
    return alias ? this.fullNameWithAliasPipe.transform(member, defaultValue) : this.fullNamePipe.transform(member, defaultValue);
  }

}
