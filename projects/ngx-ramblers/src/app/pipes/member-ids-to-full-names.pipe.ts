import { inject, Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";
import { MemberIdToFullNamePipe } from "./member-id-to-full-name.pipe";

@Pipe({ name: "memberIdsToFullNames" })
export class MemberIdsToFullNamesPipe implements PipeTransform {

  private memberIdToFullNamePipe = inject(MemberIdToFullNamePipe);

  transform(memberIds: string[], members: Member[], defaultValue?: string) {
    return memberIds.map(memberId => this.memberIdToFullNamePipe.transform(memberId, members, defaultValue)).join(", ");
  }
}
