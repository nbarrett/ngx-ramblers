import { inject, Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";
import { MemberLoginService } from "../services/member/member-login.service";
import { FullNamePipe } from "./full-name.pipe";

@Pipe({ name: "fullNameWithAliasOrMe" })
export class FullNameWithAliasOrMePipe implements PipeTransform {

  private memberLoginService = inject(MemberLoginService);
  private fullNamePipe = inject(FullNamePipe);


  transform(member: Member, defaultValue?: string) {
    return member ? (this.memberLoginService.loggedInMember().memberId === (member.id) ? "Me" :
      `${this.fullNamePipe.transform(member, defaultValue)}${member.nameAlias ? " (" + member.nameAlias + ")" : ""}`) : defaultValue;
  }
}
